#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="/etc/finance-tracker/autoupdate.conf"

log() {
  printf '[auto-update] %s\n' "$1"
}

fail() {
  printf '[auto-update] %s\n' "$1" >&2
  exit 1
}

if [ "$(id -u)" -ne 0 ]; then
  fail "Run this script as root or with sudo."
fi

[ -f "$CONFIG_FILE" ] || fail "Auto-update config not found: $CONFIG_FILE"

# shellcheck source=/dev/null
. "$CONFIG_FILE"

if [ "${AUTO_UPDATE_ENABLED:-0}" != "1" ]; then
  log "Auto-update is disabled."
  exit 0
fi

[ -n "${REPO_URL:-}" ] || fail "No repository URL is configured."
[ -n "${REPO_REF:-}" ] || fail "No repository ref is configured."
[ -n "${INSTALL_DIR:-}" ] || fail "No install directory is configured."
[ -n "${DATA_DIR:-}" ] || fail "No data directory is configured."
[ -n "${APP_USER:-}" ] || fail "No app user is configured."
[ -f "${INSTALL_DIR}/install.sh" ] || fail "Installer not found at ${INSTALL_DIR}/install.sh"

mkdir -p "$DATA_DIR"
lock_file="${DATA_DIR}/auto-update.lock"

exec 9>"$lock_file"
if ! flock -n 9; then
  log "Another auto-update run is already in progress."
  exit 0
fi

[ -d "${INSTALL_DIR}/.git" ] || fail "Git checkout not found at ${INSTALL_DIR}"

if [ -n "$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=no)" ]; then
  fail "Tracked local changes exist in ${INSTALL_DIR}; refusing to auto-update."
fi

current_commit="$(git -C "$INSTALL_DIR" rev-parse HEAD)"
git -C "$INSTALL_DIR" fetch --tags origin "$REPO_REF"

if ! remote_commit="$(git -C "$INSTALL_DIR" rev-parse "origin/${REPO_REF}" 2>/dev/null)"; then
  fail "Remote branch origin/${REPO_REF} was not found. Auto-update expects REPO_REF to be a branch."
fi

if [ "$current_commit" = "$remote_commit" ]; then
  log "Already up to date at ${current_commit}."
  exit 0
fi

log "Update available: ${current_commit} -> ${remote_commit}"

bash "${INSTALL_DIR}/install.sh" \
  --repo "$REPO_URL" \
  --ref "$REPO_REF" \
  --dir "$INSTALL_DIR" \
  --data-dir "$DATA_DIR" \
  --user "$APP_USER" \
  --update-schedule "${AUTO_UPDATE_SCHEDULE:-daily}"

log "Auto-update complete."