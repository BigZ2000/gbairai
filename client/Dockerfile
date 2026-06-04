# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────────────────────────
# Image "EDGE" Gbairai = reverse-proxy Caddy + SPA React pré-buildée.
# Caddy fait : TLS automatique (Let's Encrypt), service des fichiers statiques,
# fallback SPA, et reverse-proxy /api /uploads /ws vers le backend (WebSocket
# géré nativement par Caddy lors de l'upgrade HTTP→WS).
# ──────────────────────────────────────────────────────────────────────────────

# ── Étape build : compile la SPA (Vite) ───────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Étape finale : Caddy sert /srv et proxifie le backend ──────────────────────
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
