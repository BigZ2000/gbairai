# 03 — Docker

## Pourquoi Docker ?

Un **conteneur** empaquète l'app + ses dépendances (Node, ffmpeg, Prisma…) dans une
**image** reproductible. « Ça marche sur ma machine » → ça marche partout pareil.
On évite d'installer Node/ffmpeg à la main sur le serveur.

- **Image** = modèle figé (recette = `Dockerfile`).
- **Conteneur** = instance qui tourne à partir d'une image.
- **Volume** = stockage qui **survit** au conteneur (DB, médias, certificats).
- **docker compose** = orchestrer plusieurs conteneurs ensemble.

## Fichiers créés pour GBAIRAI

| Fichier | Rôle |
|---|---|
| `server/Dockerfile` | Image backend (Node 20 + ffmpeg + Prisma) |
| `server/docker/entrypoint.sh` | Synchronise le schéma puis lance le serveur |
| `client/Dockerfile` | Image **edge** : build SPA + Caddy (TLS + proxy) |
| `client/Caddyfile` | Config du reverse-proxy / TLS |
| `docker-compose.dev.yml` | Dev : db + backend (hot reload) |
| `docker-compose.prod.yml` | Prod Option A : edge + server + db |
| `.env.prod.example` | Modèle des variables de prod |

## `server/Dockerfile` expliqué

- `FROM node:20-bookworm-slim` : base **Debian (glibc)** — Prisma s'y installe sans la
  gymnastique OpenSSL/musl d'Alpine. 🔎 (cf. doc Prisma sur les bases d'images.)
- `apt-get install ffmpeg openssl` : **ffmpeg/ffprobe sont requis** par
  `mediaProcessing.js` (miniatures + compression). Sans eux, ce traitement échoue
  silencieusement (best-effort).
- **Étape `deps`** : `npm ci` (installe à l'identique du lockfile) puis `prisma generate`
  (génère le client Prisma typé).
- **Étape `runtime`** : recopie `node_modules` + `src` + `prisma` → image finale mince.
- `HEALTHCHECK … /api/health` : Docker sait si le conteneur est *réellement* up
  (réutilise la route santé existante).
- `ENTRYPOINT entrypoint.sh` : voir ci-dessous.

## `entrypoint.sh` expliqué

Avant de lancer le serveur, on **aligne la base** :
- `PRISMA_BOOTSTRAP=db-push` (défaut, Option A) → `prisma db push` aligne la base sur
  `schema.prisma`. Choisi car **l'historique de migrations est désynchronisé** (voir
  readiness report).
- `PRISMA_BOOTSTRAP=migrate` → `prisma migrate deploy` (cible, une fois les migrations
  réconciliées).
- `exec node src/server.js` : `exec` → Node reçoit bien `SIGTERM` (arrêt propre).

## `client/Dockerfile` (edge) expliqué

Multi-étapes : (1) `npm run build` produit `dist/` ; (2) image **Caddy** qui sert
`dist/` et proxifie le backend. Caddy a été choisi car il fait **TLS automatique**
(Let's Encrypt) et **proxifie nativement les WebSockets** — zéro config TLS manuelle.

## `Caddyfile` expliqué

- `{$APP_DOMAIN}` sert la SPA + proxifie `/api`, `/uploads`, `/ws` vers `server:4000`
  (même domaine → pas de CORS navigateur).
- `try_files {path} /index.html` : fallback **SPA** (les routes React renvoient l'index).
- `{$API_DOMAIN}` proxifie tout vers le backend (ESP32 wss, webhook CinetPay).
- Les `{$VAR}` sont injectées par Compose (section `edge.environment`).

## Vérification effectuée ✅

- `docker compose -f docker-compose.dev.yml config` → OK
- `docker compose -f docker-compose.prod.yml --env-file .env.prod.example config` → OK
- `docker build ./server` → image construite
- `docker build ./client` → image construite
- `caddy validate` → *Valid configuration* (HTTPS auto activé)

## Commandes utiles

```bash
# Dev (backend conteneurisé ; frontend sur l'hôte : cd client && npm run dev)
docker compose -f docker-compose.dev.yml up

# Prod (sur l'EC2, après avoir rempli .env)
cp .env.prod.example .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down      # arrêt (volumes conservés)
```

## Pièges évités

- **Bind-mount qui masque `node_modules`** (dev) : on ajoute un **volume anonyme**
  `/app/node_modules` pour garder les binaires Linux de l'image (et non ceux de macOS).
- **`catalog/` exclu** via `.dockerignore` (outillage de seed, inutile au runtime).
- **Médias en volume** (`uploads_data`) → ne disparaissent pas au redéploiement.

## Sources

- [Docker — Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Docker — Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Prisma — Deploy with Docker](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Caddy — Reverse proxy & automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Node.js — Docker best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
