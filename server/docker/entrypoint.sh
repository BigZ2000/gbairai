#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Point d'entrée du conteneur backend.
# 1. Synchronise le schéma de base AVANT de démarrer le serveur.
# 2. Lance le serveur (exec → le signal SIGTERM arrive bien à Node = arrêt propre).
#
# PRISMA_BOOTSTRAP :
#   - "db-push" (défaut, Option A) : aligne la base sur prisma/schema.prisma.
#       Pratique tant que l'historique de migrations n'est pas réconcilié.
#   - "migrate"  : `prisma migrate deploy` (recommandé en cible, une fois les
#       migrations remises à niveau — voir DEPLOYMENT_READINESS_REPORT.md).
# ──────────────────────────────────────────────────────────────────────────────
set -e

: "${PRISMA_BOOTSTRAP:=db-push}"

echo "[entrypoint] Schéma Prisma — mode: ${PRISMA_BOOTSTRAP}"
if [ "${PRISMA_BOOTSTRAP}" = "migrate" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate
fi

echo "[entrypoint] Démarrage du serveur Gbairai (port ${PORT:-4000})…"
exec node src/server.js
