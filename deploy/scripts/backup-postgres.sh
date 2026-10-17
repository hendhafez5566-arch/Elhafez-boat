#!/usr/bin/env sh
# Run only in a trusted operations environment, never print connection credentials.
set -eu
umask 077
: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL to a least-privilege backup user connection}"
: "${BACKUP_DIR:?Set BACKUP_DIR to private destination directory}"
command -v pg_dump >/dev/null 2>&1 || { echo 'pg_dump missing' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/elhafez-$(date -u +%Y%m%dT%H%M%SZ).dump"
if pg_dump "$BACKUP_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUT"; then
  chmod 600 "$OUT"
  echo "Archive created: $OUT"
  echo 'IMPORTANT: Encrypt archive with organization-approved encryption and store offsite. A backup is not verified until restore is tested.'
else
  rm -f "$OUT"
  echo 'Backup failed' >&2
  exit 1
fi