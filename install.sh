#!/usr/bin/env bash
set -euo pipefail

APP_NAME="finance-tracker"
APP_USER="finance-tracker"
APP_GROUP="finance-tracker"
INSTALL_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
REPO_URL=""
REPO_REF="main"

usage() {
  cat <<'EOF'
Usage: sudo ./install.sh [options]

Options:
  --repo <url>       Clone or update from a Git repository URL before installing.
  --ref <name>       Git branch, tag, or commit to deploy when --repo is used. Default: main
  --dir <path>       Install location. Default: /opt/finance-tracker
  --data-dir <path>  Database and runtime data directory. Default: /var/lib/finance-tracker
  --user <name>      Service user. Default: finance-tracker
  --help             Show this help text.
EOF
}

log() {
  printf '[install] %s\n' "$1"
}

fail() {
  printf '[install] %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --ref)
      REPO_REF="${2:-}"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --data-dir)
      DATA_DIR="${2:-}"
      shift 2
      ;;
    --user)
      APP_USER="${2:-}"
      APP_GROUP="$APP_USER"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  fail "Run this installer as root or with sudo."
fi

if [ "$(uname -s)" != "Linux" ]; then
  fail "This installer currently supports Linux only."
fi

ensure_apt_package() {
  local package="$1"
  if ! dpkg -s "$package" >/dev/null 2>&1; then
    apt-get install -y "$package"
  fi
}

install_nodejs() {
  local node_major current_major

  node_major=22
  current_major=""
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p "process.versions.node.split('.')[0]")"
  fi

  if [ -n "$current_major" ] && [ "$current_major" -ge 20 ]; then
    return
  fi

  log "Installing Node.js ${node_major}.x"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "$node_major" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

sync_local_source() {
  local source_dir

  source_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  [ -f "$source_dir/backend/package.json" ] || fail "backend/package.json not found in $source_dir"
  [ -f "$source_dir/frontend/package.json" ] || fail "frontend/package.json not found in $source_dir"

  if [ "$source_dir" = "$INSTALL_DIR" ]; then
    return
  fi

  log "Copying application files into ${INSTALL_DIR}"
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  tar \
    --exclude='./.git' \
    --exclude='./backend/node_modules' \
    --exclude='./backend/data' \
    --exclude='./frontend/node_modules' \
    --exclude='./frontend/.next' \
    -C "$source_dir" -cf - . | tar -C "$INSTALL_DIR" -xf -
}

prepare_source_tree() {
  if [ -n "$REPO_URL" ]; then
    log "Syncing source from ${REPO_URL} (${REPO_REF})"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    if [ -d "$INSTALL_DIR/.git" ]; then
      git -C "$INSTALL_DIR" fetch --tags origin
      git -C "$INSTALL_DIR" checkout "$REPO_REF"
      git -C "$INSTALL_DIR" pull --ff-only origin "$REPO_REF"
    else
      rm -rf "$INSTALL_DIR"
      git clone --branch "$REPO_REF" --depth 1 "$REPO_URL" "$INSTALL_DIR"
    fi
  else
    sync_local_source
  fi

  [ -f "$INSTALL_DIR/backend/package.json" ] || fail "backend/package.json not found in $INSTALL_DIR"
  [ -f "$INSTALL_DIR/frontend/package.json" ] || fail "frontend/package.json not found in $INSTALL_DIR"
}

install_node_modules() {
  local package_dir="$1"

  if [ -f "$package_dir/package-lock.json" ]; then
    npm ci --prefix "$package_dir"
  else
    npm install --prefix "$package_dir"
  fi
}

write_service_file() {
  cat > /etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=Finance Tracker
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=FINANCE_DB_PATH=${DATA_DIR}/finance.db
ExecStart=/usr/bin/env node ${INSTALL_DIR}/start.js --prod
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
}

log "Updating apt package metadata"
apt-get update
ensure_apt_package ca-certificates
ensure_apt_package curl
ensure_apt_package git
ensure_apt_package gnupg
ensure_apt_package build-essential
ensure_apt_package python3

install_nodejs

if ! getent group "$APP_GROUP" >/dev/null 2>&1; then
  groupadd --system "$APP_GROUP"
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --gid "$APP_GROUP" --create-home --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

prepare_source_tree

log "Preparing runtime directories"
mkdir -p "$DATA_DIR"
mkdir -p "$INSTALL_DIR/backend/data"
chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR"
chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR/backend/data"

log "Installing backend dependencies"
install_node_modules "$INSTALL_DIR/backend"

log "Installing frontend dependencies"
install_node_modules "$INSTALL_DIR/frontend"

log "Building frontend"
npm run build --prefix "$INSTALL_DIR/frontend"

log "Writing systemd service"
write_service_file

log "Enabling and restarting service"
systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"

log "Installation complete"
log "Frontend: http://$(hostname -I | awk '{print $1}'):3000"
log "Backend:  http://$(hostname -I | awk '{print $1}'):3001/api/health"
log "Service:  systemctl status ${APP_NAME}"