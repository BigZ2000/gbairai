# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────────────────────────
# Image du BACKEND Gbairai (API Express + serveur WebSocket).
# Base Debian "bookworm-slim" (glibc) : Prisma s'y installe sans la gymnastique
# OpenSSL/musl d'Alpine. ffmpeg/ffprobe sont requis par mediaProcessing.js
# (miniatures + compression média, en best-effort).
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

# ── Étape "deps" : installe les dépendances + génère le client Prisma ──────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ── Étape finale (runtime) : image mince, sans cache de build ──────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
# node_modules (avec @prisma/client déjà généré) recopiés depuis l'étape deps
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
# Dossier médias : monté en volume en prod (persistance hors conteneur)
RUN mkdir -p uploads/thumbs
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000
# Sonde de santé : réutilise la route /api/health déjà exposée par le serveur.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["entrypoint.sh"]
