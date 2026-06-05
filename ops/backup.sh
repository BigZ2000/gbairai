#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Sauvegarde Gbairai (Option A) : dump PostgreSQL + médias, rotation locale, et
# copie hors-site S3 (optionnelle). Conçu pour tourner via cron sur l'EC2.
#
#   bash ~/gbairai/ops/backup.sh
#
# Variables (lues depuis ~/gbairai/.env, toutes optionnelles sauf POSTGRES_*) :
#   BACKUP_DIR       dossier local des sauvegardes      (défaut: $HOME/backups)
#   RETENTION_DAYS   jours de rétention locale          (défaut: 7)
#   S3_BUCKET        bucket S3 pour la copie hors-site   (ex: gbairai-backups)
#                    → si défini ET aws CLI présent, copie automatique vers S3.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Racine du projet (= dossier parent de ops/), quel que soit le cwd du cron.
cd "$(dirname "$0")/.."

# Charge .env (POSTGRES_USER/DB, S3_BUCKET, RETENTION_DAYS…). Nos valeurs n'ont
# pas d'espaces (base64/domaines) → le sourcing est sûr.
set -a; [ -f .env ] && . ./.env; set +a

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
STAMP="$(date +%F_%H%M)"
mkdir -p "$BACKUP_DIR"

# 1) Base de données — dump SQL compressé.
DB_FILE="$BACKUP_DIR/gbairai_db_${STAMP}.sql.gz"
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$DB_FILE"
echo "[backup] DB     → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# 2) Médias — archive du volume uploads (best-effort, ne bloque pas si vide).
MEDIA_FILE="$BACKUP_DIR/gbairai_uploads_${STAMP}.tgz"
if $COMPOSE exec -T server tar czf - -C /app/uploads . > "$MEDIA_FILE" 2>/dev/null; then
  echo "[backup] médias → $MEDIA_FILE ($(du -h "$MEDIA_FILE" | cut -f1))"
else
  rm -f "$MEDIA_FILE"; echo "[backup] médias → (rien à sauvegarder)"
fi

# 3) Rotation locale — supprime les sauvegardes de plus de RETENTION_DAYS jours.
find "$BACKUP_DIR" -name 'gbairai_*' -type f -mtime +"$RETENTION_DAYS" -delete

# 4) Copie hors-site S3 (si configurée) — protège contre la perte de l'EC2.
if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$DB_FILE" "s3://${S3_BUCKET}/db/"
  [ -f "$MEDIA_FILE" ] && aws s3 cp "$MEDIA_FILE" "s3://${S3_BUCKET}/uploads/"
  echo "[backup] copié → s3://${S3_BUCKET}/"
else
  echo "[backup] S3 non configuré (sauvegarde locale uniquement)"
fi

echo "[backup] terminé ✓ ($STAMP)"
