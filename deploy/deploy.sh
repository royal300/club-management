#!/usr/bin/env bash
# Deploy club-management via GitHub: the VPS pulls the code, builds it, and reloads PM2.
#
# From your machine (pushes the current branch, then deploys that exact commit):
#   ./deploy/deploy.sh                      # or: npm run deploy
#   DEPLOY_HOST=root@93.127.206.52 SSH_KEY=~/.ssh/club_deploy ./deploy/deploy.sh
#
# Directly on the VPS:
#   bash /var/www/club-management-deploy/repo/deploy/deploy.sh --remote
#
# Layout on the VPS (everything lives in our own folders; nothing else is touched):
#   /var/www/club-management              live app (PM2 cwd), holds .env and logs/
#   /var/www/club-management-deploy/repo  git checkout where npm ci + next build run
#   /var/www/club-management-deploy/previous  hard-link snapshot of the last good release
#
# The VPS is shared (1 vCPU, ~1 GB free RAM, no swap). The build gets at most 1 GB of RAM in its
# own cgroup, plus a temporary swap file that is deleted afterwards. If it still runs out,
# only the build is killed, not other services.
# The live app is only changed after a successful build. If migrate, reload or the health
# check fails, the previous release is restored automatically. Migrations are not reverted.
#
# Env overrides: DEPLOY_HOST, SSH_KEY, DEPLOY_BRANCH, NO_PUSH=1, BUILD_MEMORY_MAX (RAM cap,
# default 1000M), BUILD_SWAP (temporary swap for the build, default 3G, 0 = none),
# BUILD_HEAP_MB (V8 heap, default 1536).
set -euo pipefail

APP_NAME="club-management"
REPO_URL="${REPO_URL:-https://github.com/royal300/club-management.git}"
BRANCH="${DEPLOY_BRANCH:-main}"

log()  { printf '\033[1;36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------------------- local side
local_main() {
  local host="${DEPLOY_HOST:-root@93.127.206.52}"
  local key="${SSH_KEY:-$HOME/.ssh/club_deploy}"
  local ssh_opts=(-T -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
  [[ -f "$key" ]] && ssh_opts+=(-o IdentitiesOnly=yes -i "$key")

  cd "$(git rev-parse --show-toplevel)"
  [[ -z "$(git status --porcelain)" ]] || die "Working tree has uncommitted changes. Commit or stash them first."

  local current
  current="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$current" == "$BRANCH" ]] || die "On branch '$current', expected '$BRANCH' (set DEPLOY_BRANCH to override)."

  log "syncing with GitHub ($BRANCH)"
  git fetch --quiet origin "$BRANCH"
  local local_sha remote_sha base
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/$BRANCH")"
  if [[ "$local_sha" != "$remote_sha" ]]; then
    base="$(git merge-base HEAD "origin/$BRANCH")"
    if [[ "$base" == "$remote_sha" ]]; then
      [[ "${NO_PUSH:-}" == "1" ]] && die "Local $BRANCH is ahead of origin and NO_PUSH=1."
      log "pushing $BRANCH to origin"
      git push origin "$BRANCH"
    else
      die "Local $BRANCH is behind or has diverged from origin/$BRANCH. Pull or rebase first."
    fi
  fi

  log "deploying $(git log --oneline -1) to $host"
  # The script is sent over stdin and runs from a function, so commands on the server can't
  # consume the rest of it.
  ssh "${ssh_opts[@]}" "$host" \
    "BUILD_MEMORY_MAX='${BUILD_MEMORY_MAX:-}' BUILD_HEAP_MB='${BUILD_HEAP_MB:-}' BUILD_SWAP='${BUILD_SWAP:-}' bash -s -- --remote '$BRANCH' '$local_sha'" < "$0"
}

# Temporary swap that exists only while the build runs. It isn't in /etc/fstab, and it's
# removed on exit (success, failure or Ctrl-C).
SWAP_FILE=""
enable_build_swap() {
  local size="$1"
  [[ $EUID -eq 0 && "$size" != "0" ]] || return 1
  disable_build_swap                                    # clear a leftover from a crashed run
  log "enabling temporary $size swap at $SWAP_FILE"
  fallocate -l "$size" "$SWAP_FILE" 2>/dev/null \
    || dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$(numfmt --from=iec "$size" | awk '{print int($1/1048576)}')" status=none
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null && swapon "$SWAP_FILE" && return 0
  rm -f "$SWAP_FILE"
  echo "could not enable swap; building without it" >&2
  return 1
}
disable_build_swap() {
  [[ -n "$SWAP_FILE" ]] || return 0
  if grep -q "^$SWAP_FILE " /proc/swaps 2>/dev/null; then
    swapoff "$SWAP_FILE" && log "temporary swap removed"
  fi
  rm -f "$SWAP_FILE"
}

# -------------------------------------------------------------------------- remote side
remote_main() {
  local branch="${1:-$BRANCH}" ref="${2:-}"
  local app_dir="/var/www/$APP_NAME"
  local root="/var/www/$APP_NAME-deploy"
  local src="$root/repo" prev="$root/previous"
  local mem_max="${BUILD_MEMORY_MAX:-1000M}"
  local heap_mb="${BUILD_HEAP_MB:-1536}"
  local swap_size="${BUILD_SWAP:-3G}"
  SWAP_FILE="$root/build.swap"

  [[ -f "$app_dir/.env" ]] || die "Missing $app_dir/.env. Create it first (see README)."
  mkdir -p "$root" "$app_dir/logs"

  exec 9>"$root/.lock"
  flock -n 9 || die "Another deploy is already running."

  # 1. Pull ---------------------------------------------------------------------------
  if [[ ! -d "$src/.git" ]]; then
    log "cloning $REPO_URL"
    git clone --quiet --branch "$branch" "$REPO_URL" "$src" </dev/null
  fi
  log "pulling $branch"
  git -C "$src" fetch --quiet --prune origin "$branch" </dev/null
  git -C "$src" reset --quiet --hard "${ref:-origin/$branch}"
  git -C "$src" clean -fdq          # untracked only; ignored node_modules/.next/cache stay
  local sha; sha="$(git -C "$src" rev-parse --short HEAD)"
  ok "at $(git -C "$src" log --oneline -1)"

  # The build reads DATABASE_URL (prerender), APP_URL and the Server Actions key from .env.
  ln -sfn "$app_dir/.env" "$src/.env"

  # 2. Install + build (RAM-capped, low priority) --------------------------------------------
  # RAM is capped at $mem_max. Anything above that goes to the temporary swap file, so the
  # build only pages out its own memory and never squeezes the other apps on the box.
  capped() {
    if [[ $EUID -eq 0 ]] && command -v systemd-run >/dev/null; then
      systemd-run --scope --quiet --collect -p MemoryMax="$mem_max" -p MemorySwapMax="$swap_max" \
        nice -n 10 env NODE_OPTIONS="--max-old-space-size=$heap_mb" "$@"
    else
      nice -n 10 env NODE_OPTIONS="--max-old-space-size=$heap_mb" "$@"
    fi
  }

  local swap_max=0
  trap disable_build_swap EXIT
  if enable_build_swap "$swap_size"; then swap_max="$swap_size"; fi

  cd "$src"
  local lock_hash; lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
  if [[ ! -d node_modules || "$(cat "$root/.lock-hash" 2>/dev/null)" != "$lock_hash" ]]; then
    # A from-scratch `npm ci` extracts ~600 packages in parallel and peaks above 1 GB off-heap,
    # which doesn't fit on this box. Instead, start from the live app's node_modules (on first
    # run or after a failed install) and let `npm install` fetch only what's missing.
    if [[ ! -f "$root/.lock-hash" && -d "$app_dir/node_modules" ]]; then
      log "seeding node_modules from the live app"
      rm -rf node_modules
      cp -a "$app_dir/node_modules" node_modules
    fi
    rm -f "$root/.lock-hash"
    log "npm install (incremental, lockfile changed)"
    capped npm install --no-save --include=dev --no-audit --no-fund --maxsockets=2 </dev/null \
      || die "npm install failed. Live site untouched."
    echo "$lock_hash" > "$root/.lock-hash"
  else
    ok "dependencies unchanged, skipping npm ci"
  fi

  log "next build (RAM cap $mem_max, swap $swap_max). This takes several minutes on 1 vCPU."
  local started=$SECONDS
  NEXT_TELEMETRY_DISABLED=1 capped npx --no-install next build </dev/null \
    || die "Build failed (if it was killed, raise BUILD_SWAP or BUILD_MEMORY_MAX). Live site untouched."
  ok "built in $((SECONDS - started))s"
  disable_build_swap

  # 3. Release -----------------------------------------------------------------------
  log "snapshotting current release"
  rm -rf "$prev"
  cp -al "$app_dir" "$prev"          # hard links: instant, and rsync's rename-on-write keeps it intact

  if ! release "$src" "$app_dir" "$sha"; then
    printf '\033[1;31m✗ release failed, rolling back\033[0m\n' >&2
    rsync -a --delete --exclude /.env --exclude /logs "$prev/" "$app_dir/"
    (cd "$app_dir" && pm2 reload "$APP_NAME" --update-env >/dev/null) || true
    pm2 logs "$APP_NAME" --lines 40 --nostream </dev/null || true
    die "Rolled back to the previous release."
  fi

  ok "deployed $sha → https://club.rasatech.in"
}

# Sync the build into the live dir, migrate, reload, health-check. Returns non-zero on failure.
release() {
  local src="$1" app_dir="$2" sha="$3"

  log "syncing build to $app_dir"
  # Anchored excludes: .next/node_modules holds Turbopack's relative links to external packages.
  rsync -a --delete \
    --exclude /.git --exclude /.env --exclude /logs --exclude /.next/cache \
    --exclude /test-results --exclude /playwright-report --exclude /e2e/.auth \
    --exclude '*.tsbuildinfo' \
    "$src/" "$app_dir/" || return 1
  echo "$sha" > "$app_dir/REVISION"

  cd "$app_dir" || return 1
  log "running migrations"
  npm run --silent db:migrate </dev/null || return 1

  log "reloading PM2"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$APP_NAME" --update-env </dev/null >/dev/null || return 1
  else
    pm2 start deploy/ecosystem.config.cjs </dev/null >/dev/null || return 1
    pm2 save </dev/null >/dev/null
  fi

  local port
  port="$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '"' || true)"
  log "health check on 127.0.0.1:${port:-3105}"
  for _ in $(seq 1 20); do
    if body="$(curl -fsS -m 5 "http://127.0.0.1:${port:-3105}/api/health" 2>/dev/null)" \
       && [[ "$body" == *'"db":"up"'* ]]; then
      ok "healthy: $body"
      return 0
    fi
    sleep 2
  done
  echo "health check failed" >&2
  return 1
}

main() {
  if [[ "${1:-}" == "--remote" ]]; then
    shift
    remote_main "$@"
  else
    local_main
  fi
}

main "$@"
