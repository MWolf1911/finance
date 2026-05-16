#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="finance-tracker"
APP_USER="finance-tracker"
APP_GROUP="finance-tracker"
DATA_DIR="/var/lib/${SERVICE_NAME}"
TARGET_DB="${DATA_DIR}/finance.db"
TARGET_WAL="${TARGET_DB}-wal"
TARGET_SHM="${TARGET_DB}-shm"
BACKUP_DIR="${DATA_DIR}/backups"

usage() {
  cat <<'EOF'
Usage: sudo ./restore-db.sh /path/to/finance.db [--keep-service-stopped]

Restores a finance.db file into the installed Finance Tracker service.
The current database is backed up before replacement.
EOF
}

log() {
  printf '[restore-db] %s\n' "$1"
}

fail() {
  printf '[restore-db] %s\n' "$1" >&2
  exit 1
}

SOURCE_DB=""
KEEP_STOPPED=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-service-stopped)
      KEEP_STOPPED=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -n "$SOURCE_DB" ]; then
        fail "Only one source database path may be provided."
      fi
      SOURCE_DB="$1"
      shift
      ;;
  esac
done

if [ -z "$SOURCE_DB" ]; then
  usage
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  fail "Run this script as root or with sudo."
fi

[ -f "$SOURCE_DB" ] || fail "Source database not found: $SOURCE_DB"
systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service" || fail "Service ${SERVICE_NAME}.service is not installed."

mkdir -p "$DATA_DIR"
mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_db="${BACKUP_DIR}/finance.db.${timestamp}.bak"

log "Stopping ${SERVICE_NAME} service"
systemctl stop "$SERVICE_NAME"

if [ -f "$TARGET_DB" ]; then
  log "Backing up current database to ${backup_db}"
  cp "$TARGET_DB" "$backup_db"
fi

if [ -f "$TARGET_WAL" ]; then
  cp "$TARGET_WAL" "${backup_db}-wal"
fi

if [ -f "$TARGET_SHM" ]; then
  cp "$TARGET_SHM" "${backup_db}-shm"
fi

log "Restoring database from ${SOURCE_DB}"
install -m 640 "$SOURCE_DB" "$TARGET_DB"
chown "$APP_USER:$APP_GROUP" "$TARGET_DB"

source_dir="$(dirname "$SOURCE_DB")"
source_name="$(basename "$SOURCE_DB")"
source_wal="${source_dir}/${source_name}-wal"
source_shm="${source_dir}/${source_name}-shm"

if [ -f "$source_wal" ]; then
  log "Restoring WAL file from ${source_wal}"
  install -m 640 "$source_wal" "$TARGET_WAL"
  chown "$APP_USER:$APP_GROUP" "$TARGET_WAL"
else
  rm -f "$TARGET_WAL"
fi

if [ -f "$source_shm" ]; then
  log "Restoring SHM file from ${source_shm}"
  install -m 640 "$source_shm" "$TARGET_SHM"
  chown "$APP_USER:$APP_GROUP" "$TARGET_SHM"
else
  rm -f "$TARGET_SHM"
fi

if [ "$KEEP_STOPPED" -eq 1 ]; then
  log "Restore complete. Service left stopped by request."
  exit 0
fi

log "Starting ${SERVICE_NAME} service"
systemctl start "$SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,12p'

log "Restore complete"