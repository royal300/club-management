#!/usr/bin/env bash
# Build locally, ship to the VPS, migrate, and reload under PM2.
#
# The VPS is shared and small (1 vCPU, no swap), so the Next.js build runs on this machine
# and only the output plus production dependencies are installed there.
#
# Usage:
#   DEPLOY_HOST=root@93.127.206.52 SSH_KEY=~/.ssh/club_deploy ./deploy/deploy.sh
# Needs: deploy/.secrets.local (SERVER_ACTIONS_KEY=...) matching the server's .env, and a
# local database reachable via ./.env (the build prerenders the public pages).
set -euo pipefail

HOST="${DEPLOY_HOST:?Set DEPLOY_HOST=user@host}"
APP_DIR="${DEPLOY_PATH:-/var/www/club-management}"
APP_URL="${APP_URL:-https://club.rasatech.in}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes)
[[ -n "${SSH_KEY:-}" ]] && SSH_OPTS+=(-i "$SSH_KEY")

if [[ -z "${SERVER_ACTIONS_KEY:-}" && -f deploy/.secrets.local ]]; then
  SERVER_ACTIONS_KEY="$(grep -E '^SERVER_ACTIONS_KEY=' deploy/.secrets.local | cut -d= -f2-)"
fi
: "${SERVER_ACTIONS_KEY:?Set SERVER_ACTIONS_KEY (must equal NEXT_SERVER_ACTIONS_ENCRYPTION_KEY on the server)}"

echo "→ building for $APP_URL"
APP_URL="$APP_URL" NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$SERVER_ACTIONS_KEY" npx next build

echo "→ syncing to $HOST:$APP_DIR"
# Anchored excludes: .next/node_modules holds Turbopack's links to external packages and must ship.
rsync -az --delete \
  --exclude /node_modules --exclude /.git --exclude /.data --exclude /logs \
  --exclude /.next/cache --exclude /.next/dev \
  --exclude /test-results --exclude /playwright-report --exclude /e2e/.auth \
  --exclude /.env --exclude '/.env.*' --include /.env.example \
  --exclude /.claude --exclude /docs/screenshots --exclude /deploy/.secrets.local --exclude '*.tsbuildinfo' \
  -e "ssh ${SSH_OPTS[*]}" ./ "$HOST:$APP_DIR/"

echo "→ installing, migrating and reloading"
ssh "${SSH_OPTS[@]}" "$HOST" bash -s -- "$APP_DIR" <<'REMOTE'
set -euo pipefail
cd "$1"
test -f .env || { echo "Missing $1/.env — create it first (see README)"; exit 1; }
mkdir -p logs
chown -R "$(id -u):$(id -g)" .
npm ci --omit=dev --no-audit --no-fund
npm run db:migrate
if pm2 describe club-management >/dev/null 2>&1; then
  pm2 reload club-management --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save
sleep 4
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '"' || true)
curl -fsS "http://127.0.0.1:${PORT:-3105}/api/health" && echo
REMOTE
echo "✓ deployed"
