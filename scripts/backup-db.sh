#!/bin/bash
# PostgreSQL daily backup with 7-day retention
# Deploy to VPS: /opt/generator-ad/scripts/backup-db.sh

set -euo pipefail

BACKUP_DIR="/opt/generator-ad/backups"
CONTAINER="generator-ad-postgres-1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/app_db_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump and compress
docker exec "$CONTAINER" pg_dump -U app_user -d app_db | gzip > "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "app_db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: ${BACKUP_FILE}"
