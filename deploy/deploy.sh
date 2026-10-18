#!/usr/bin/env bash
# Deploys straight from GitHub and builds on the VPS.
#
# Each deploy clones the branch into a fresh folder under releases/, installs, migrates and
# builds there, then points the `current` symlink at it and restarts PM2. The live site keeps
# serving the previous release until the new one has built, and a release that fails its
# health check is rolled back. The last KEEP_RELEASES releases are kept.
#
#   On the VPS (as root):         bash /var/www/club-management/current/deploy/deploy.sh
#   From your computer over SSH:  DEPLOY_HOST=root@93.127.206.52 ./deploy/deploy.sh
#
# Options (env): BRANCH (main), APP_DIR (/var/www/club-management), REPO_URL, KEEP_RELEASES (2),
# SSH_KEY (remote mode only). First-time setup of a server is deploy/setup-server.sh.
set -euo pipefail

if [[ -n "${DEPLOY_HOST:-}" ]]; then
  SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
  [[ -n "${SSH_KEY:-}" ]] && SSH_OPTS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
  remote_env=""
  for var in BRANCH APP_DIR REPO_URL KEEP_RELEASES; do
    [[ -n "${!var:-}" ]] && remote_env+="$(printf '%s=%q ' "$var" "${!var}")"
  done
  exec ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" "${remote_env}bash -s" < "${BASH_SOURCE[0]}"
fi

APP_DIR="${APP_DIR:-/var/www/club-management}"
REPO_URL="${REPO_URL:-https://github.com/royal300/club-management.git}"
BRANCH="${BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-2}"
NAME="club-management"
SHARED="$APP_DIR/shared"
CURRENT="$APP_DIR/current"

[[ -f "$SHARED/.env" ]] || { echo "✗ Missing $SHARED/.env — run deploy/setup-server.sh first"; exit 1; }
mkdir -p "$APP_DIR/releases" "$SHARED/logs"
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || { echo "✗ Another deploy is already running"; exit 1; }

PORT="$(grep -E '^APP_PORT=' "$SHARED/.env" | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-3105}"
PREVIOUS="$(readlink -f "$CURRENT" 2>/dev/null || true)"
RELEASE="$APP_DIR/releases/$(date +%Y%m%d-%H%M%S)"

on_build_failure() {
  echo "✗ Deploy failed before going live; the site still runs ${PREVIOUS:-nothing yet}."
  echo "  If the build was killed (exit 137), the VPS ran out of memory: add swap or stop other services while building."
  rm -rf "$RELEASE"
}
trap on_build_failure ERR

echo "→ fetching $BRANCH from $REPO_URL"
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$RELEASE"
cd "$RELEASE"
echo "  $(git log -1 --format='%h %s')"
ln -s ../../shared/.env .env

echo "→ installing dependencies"
npm ci --no-audit --no-fund --loglevel=error

echo "→ migrating database"
npm run -s db:migrate
if [[ "${RUN_SEED:-0}" == 1 ]]; then npm run -s db:seed; fi

echo "→ building (a few minutes on a small VPS)"
npm run build
npm prune --omit=dev --no-audit --no-fund --loglevel=error
trap - ERR

# PM2 runs from the `current` symlink, so a restart picks up whichever release it points at.
switch_to() {
  ln -sfn "$1" "$CURRENT.tmp"
  mv -Tf "$CURRENT.tmp" "$CURRENT"
  export APP_ROOT="$CURRENT" APP_LOG_DIR="$SHARED/logs"
  local cwd
  cwd="$(pm2 jlist 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const app = (JSON.parse(s || "[]")).find((a) => a.name === process.argv[1]);
      process.stdout.write(app ? app.pm2_env.pm_cwd : "");
    });' "$NAME")"
  if [[ "$cwd" == "$CURRENT" ]]; then
    pm2 reload "$CURRENT/deploy/ecosystem.config.cjs" --update-env >/dev/null
  else
    [[ -n "$cwd" ]] && pm2 delete "$NAME" >/dev/null
    pm2 start "$CURRENT/deploy/ecosystem.config.cjs" >/dev/null
  fi
}

healthy() {
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

echo "→ going live"
switch_to "$RELEASE"
if ! healthy; then
  echo "✗ The new release failed its health check (pm2 logs $NAME)."
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    echo "  Rolling back to $PREVIOUS"
    switch_to "$PREVIOUS"
    healthy && echo "  previous release is serving again"
  fi
  rm -rf "$RELEASE"
  exit 1
fi
pm2 save >/dev/null

# Keep the newest releases (always including the live one).
live="$(readlink -f "$CURRENT")"
ls -1dt "$APP_DIR"/releases/*/ | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [[ "$(readlink -f "$old")" == "$live" ]] || rm -rf "$old"
done

echo "✓ deployed $(git -C "$RELEASE" log -1 --format=%h) — $(curl -fsS "http://127.0.0.1:$PORT/api/health")"
