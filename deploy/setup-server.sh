#!/usr/bin/env bash
# One-time setup of the club site on the VPS, then the first deploy. Run as root ON the server:
#
#   git clone --depth 1 https://github.com/royal300/club-management.git /tmp/club-setup
#   bash /tmp/club-setup/deploy/setup-server.sh
#
# It asks for the MySQL/MariaDB admin password and the first admin's email, and adds only
# things of its own: a new database and user (club_management / club_app), the app folders
# (/var/www/club-management, /var/lib/club-management/uploads), one Nginx server block for the
# domain plus its Let's Encrypt certificate, and the club-management PM2 process. Other sites,
# databases and Nginx files are never modified. Safe to re-run; existing pieces are kept.
#
# Options (env): DOMAIN, BRANCH, APP_DIR, UPLOAD_DIR, DB_NAME, DB_USER, DB_HOST, DB_PORT,
# MYSQL_ROOT_USER, MYSQL_ROOT_PASSWORD, ADMIN_EMAIL, ADMIN_NAME, LETSENCRYPT_EMAIL.
set -euo pipefail

DOMAIN="${DOMAIN:-club.rasatech.in}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/royal300/club-management.git}"
APP_DIR="${APP_DIR:-/var/www/club-management}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/club-management/uploads}"
DB_NAME="${DB_NAME:-club_management}"
DB_USER="${DB_USER:-club_app}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED="$APP_DIR/shared"
ENV_FILE="$SHARED/.env"
WEBROOT=/var/www/letsencrypt
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

say() { printf '\n→ %s\n' "$*"; }
warn() { printf '! %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }
ask() { # ask VAR "Prompt" [secret]
  local var=$1 prompt=$2
  [[ -n "${!var:-}" ]] && return
  (: </dev/tty) 2>/dev/null || die "Set $var (there is no terminal to ask on)"
  if [[ -n "${3:-}" ]]; then read -rsp "$prompt: " "${var?}" </dev/tty; echo; else read -rp "$prompt: " "${var?}" </dev/tty; fi
  [[ -n "${!var}" ]] || die "$var is required"
}

# ---- preflight ---------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "Run this as root"
for cmd in git node npm nginx openssl curl ss flock; do
  command -v "$cmd" >/dev/null || die "$cmd is not installed"
done
MYSQL="$(command -v mariadb || command -v mysql || true)"
[[ -n "$MYSQL" ]] || die "The mysql/mariadb client is not installed"
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 20 || (a === 20 && b >= 9) ? 0 : 1)' ||
  die "Node $(node -v) is too old: Next.js 16 needs 20.9 or newer (left alone so other apps keep working)"
nginx -t >/dev/null 2>&1 || die "nginx -t already fails before any change; fix that first"

if [[ -d /etc/nginx/sites-available ]]; then
  NGINX_SITE="/etc/nginx/sites-available/$DOMAIN"
  NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN"
else
  NGINX_SITE="/etc/nginx/conf.d/$DOMAIN.conf"
  NGINX_LINK=""
fi
domain_re="${DOMAIN//./\\.}"
others="$(grep -rlsE "server_name[^;]*[[:space:]]${domain_re}([[:space:];]|$)" /etc/nginx/sites-enabled /etc/nginx/conf.d |
  while read -r f; do [[ "$(readlink -f "$f")" == "$(readlink -f "$NGINX_SITE")" ]] || echo "$f"; done || true)"
[[ -z "$others" ]] || die "Another Nginx file already serves $DOMAIN: $others"

# ---- folders and .env --------------------------------------------------------------------
install -d -m 755 "$APP_DIR" "$APP_DIR/releases" "$SHARED" "$SHARED/logs" "$WEBROOT"
install -d -m 750 "$UPLOAD_DIR"

if [[ ! -f "$ENV_FILE" && -f "$APP_DIR/.env" ]]; then
  say "Reusing the settings of the earlier deploy ($APP_DIR/.env)"
  cp -p "$APP_DIR/.env" "$ENV_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  say "Keeping the existing $ENV_FILE (database and keys unchanged)"
  sed -i 's/^SEED_DEMO_DATA=.*/SEED_DEMO_DATA="false"/' "$ENV_FILE"
  APP_PORT="$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '"' || true)"
else
  ask MYSQL_ROOT_PASSWORD "MySQL/MariaDB password for '$MYSQL_ROOT_USER'" secret
  ask ADMIN_EMAIL "Email for the club's first admin login"
  export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
  sqlroot() { "$MYSQL" -u "$MYSQL_ROOT_USER" --batch --skip-column-names "$@"; }
  sqlroot -e "SELECT 1" >/dev/null || die "Could not log in to MySQL as '$MYSQL_ROOT_USER'"

  say "Creating database $DB_NAME and user $DB_USER"
  [[ "$(sqlroot -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME'")" == 0 ]] ||
    die "Database $DB_NAME already exists and has tables; set DB_NAME to a new name"
  [[ "$(sqlroot -e "SELECT COUNT(*) FROM mysql.db WHERE User = '$DB_USER' AND Db <> '$DB_NAME'")" == 0 ]] ||
    die "MySQL user $DB_USER already has rights on other databases; set DB_USER to a new name"
  DB_PASS="$(openssl rand -hex 24)"
  sqlroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost', '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  unset MYSQL_PWD
  MYSQL_PWD="$DB_PASS" "$MYSQL" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" -e "SELECT 1" >/dev/null ||
    die "The new user cannot connect to $DB_HOST:$DB_PORT; set DB_HOST/DB_PORT to where MySQL listens"

  port_free() { ! ss -ltnH "( sport = :$1 )" | grep -q .; }
  APP_PORT=3105
  while ! port_free "$APP_PORT"; do APP_PORT=$((APP_PORT + 1)); done

  ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-16)"
  NEW_ADMIN=1
  (
    umask 077
    cat >"$ENV_FILE" <<ENV
DATABASE_URL="mysql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"
DATABASE_POOL_SIZE=10
APP_URL="https://$DOMAIN"
APP_PORT=$APP_PORT
UPLOAD_DIR="$UPLOAD_DIR"
UPLOAD_MAX_MB=5
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
SEED_ADMIN_EMAIL="$ADMIN_EMAIL"
SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD"
SEED_ADMIN_NAME="${ADMIN_NAME:-Club Admin}"
SEED_DEMO_DATA="false"
ENV
  )
  say "Wrote $ENV_FILE (app port $APP_PORT)"
fi
APP_PORT="${APP_PORT:-3105}"

# ---- PM2 ---------------------------------------------------------------------------------
command -v pm2 >/dev/null || { say "Installing PM2"; npm install -g pm2 --no-audit --no-fund --loglevel=error; }

# ---- Nginx -------------------------------------------------------------------------------
reload_nginx() { systemctl reload nginx 2>/dev/null || nginx -s reload; }
install_site() { # install_site <template in deploy/nginx>
  local tmp backup=""
  tmp="$(mktemp)"
  local sed_args=(-e "s/club\.rasatech\.in/$DOMAIN/g" -e "s/127\.0\.0\.1:3105/127.0.0.1:$APP_PORT/g")
  [[ -f /proc/net/if_inet6 ]] || sed_args+=(-e '/listen \[::\]/d') # no IPv6 on this server
  sed "${sed_args[@]}" "$HERE/nginx/$1" >"$tmp"
  if [[ -f "$NGINX_SITE" ]]; then backup="$(mktemp)"; cp -p "$NGINX_SITE" "$backup"; fi
  install -m 644 "$tmp" "$NGINX_SITE"
  rm -f "$tmp"
  [[ -n "$NGINX_LINK" ]] && ln -sfn "$NGINX_SITE" "$NGINX_LINK"
  if ! nginx -t >/dev/null 2>&1; then
    if [[ -n "$backup" ]]; then mv "$backup" "$NGINX_SITE"; else rm -f "$NGINX_SITE" ${NGINX_LINK:+"$NGINX_LINK"}; fi
    nginx -t || true
    die "The Nginx block for $DOMAIN did not pass nginx -t; it was removed again"
  fi
  [[ -n "$backup" ]] && rm -f "$backup"
  reload_nginx
}

if [[ ! -f "$CERT" ]]; then
  say "Adding the HTTP Nginx block for $DOMAIN"
  install_site club.rasatech.in.http-only.conf
fi

# ---- first deploy ------------------------------------------------------------------------
say "Deploying $BRANCH"
APP_DIR="$APP_DIR" BRANCH="$BRANCH" REPO_URL="$REPO_URL" RUN_SEED=1 bash "$HERE/deploy.sh"
systemctl is-enabled pm2-root >/dev/null 2>&1 || pm2 startup systemd -u root --hp /root >/dev/null || warn "Could not enable PM2 at boot (run: pm2 startup)"
pm2 save >/dev/null

# ---- HTTPS -------------------------------------------------------------------------------
if [[ ! -f "$CERT" ]]; then
  if [[ -z "$(getent ahostsv4 "$DOMAIN" | head -n1)" ]]; then
    warn "$DOMAIN does not resolve yet. Add the DNS record (A $DOMAIN → this server), wait a few minutes, then re-run this script for HTTPS."
  else
    if ! command -v certbot >/dev/null; then
      say "Installing certbot"
      apt-get update -q >/dev/null && apt-get install -y -q certbot >/dev/null
    fi
    say "Requesting a Let's Encrypt certificate for $DOMAIN"
    LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-${ADMIN_EMAIL:-}}"
    email_args=(--register-unsafely-without-email)
    [[ -n "$LETSENCRYPT_EMAIL" ]] && email_args=(--email "$LETSENCRYPT_EMAIL")
    certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" --non-interactive --agree-tos "${email_args[@]}" \
      --deploy-hook "systemctl reload nginx" ||
      warn "Certificate request failed (is $DOMAIN pointing at this server?). Re-run this script once DNS is right."
  fi
fi
if [[ -f "$CERT" ]]; then
  say "Enabling HTTPS for $DOMAIN"
  install_site club.rasatech.in.conf
fi

# ---- summary -----------------------------------------------------------------------------
echo
echo "✓ Setup finished"
if [[ -f "$CERT" ]]; then echo "  Site:   https://$DOMAIN"; else echo "  Site:   http://$DOMAIN (sign-in needs HTTPS; re-run once DNS points here)"; fi
echo "  App:    PM2 process club-management on 127.0.0.1:$APP_PORT, files in $APP_DIR"
echo "  DB:     $DB_NAME (user $DB_USER; password only in $ENV_FILE)"
if [[ -n "${NEW_ADMIN:-}" ]]; then
  echo "  Admin:  $ADMIN_EMAIL / $ADMIN_PASSWORD   ← shown once; change it under Account after signing in"
fi
echo "  Update: bash $APP_DIR/current/deploy/deploy.sh   (BRANCH=… to deploy another branch)"
if [[ -f "$APP_DIR/package.json" ]]; then
  echo "  Note:   files from the earlier rsync deploy are still in $APP_DIR (package.json, .next, node_modules…); they are no longer used."
fi
