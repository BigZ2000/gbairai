# DEPLOYMENT READINESS REPORT — GBAIRAI

> Rapport d'état avant mise en production. Mis à jour le 2026-06-04.
> Architecture cible **Option B**, bootstrap **Option A**, région **eu-west-3 (Paris)**.

## Légende des statuts

| | |
|---|---|
| ✅ Vérifié (code) | Constaté directement dans le dépôt |
| 🔎 Vérifié (doc officielle) | Confirmé sur source officielle |
| ⚠️ À faire | Action requise avant prod |
| 🔴 Bloquant | À traiter impérativement avant le 1er déploiement |

---

## 1. Ce qui est PRÊT ✅

- **Frontend** : build Vite OK (`client/dist`), SPA en chemins relatifs `/api`, `/ws`, `/uploads`.
- **Backend** : Express + WebSocket sur un seul serveur HTTP (port 4000), route `/api/health`.
- **Base** : PostgreSQL + Prisma, 23 modèles, schéma stable.
- **Conteneurisation** : `server/Dockerfile` (+ ffmpeg), `client/Dockerfile` (Caddy + SPA), `docker-compose.dev.yml`, `docker-compose.prod.yml`, `Caddyfile`. **Les 2 images se buildent et les 2 Compose + le Caddyfile sont validés.**
- **CI/CD** : `.github/workflows/ci.yml` (build front + check back + build images) et `deploy.yml` (SSH).
- **Sécurité de base** : auth JWT (Bearer, pas de cookie → pas de CSRF), `CORS_STRICT` activable, webhook CinetPay signé HMAC, `.env` gitignored.

## 2. Ce qui MANQUE ⚠️

| Élément | Action | Réf |
|---|---|---|
| Secrets de prod | Générer `JWT_SECRET`/`JWT_REFRESH_SECRET` forts, mot de passe Postgres fort | `.env.prod.example` |
| DNS | Créer `gbairai` + `api.gbairai` chez IONOS → IP EC2 | `docs/devops/05-deployment.md` |
| Google OAuth prod | Ajouter le redirect `https://api.gbairai.robotechci.com/api/auth/google/callback` | doc 05 |
| Sauvegardes | `pg_dump` planifié (Option A) → puis backups RDS (Option B) | `docs/devops/07-backup.md` |
| Monitoring | Alarmes CloudWatch (CPU/disque) + uptime | `docs/devops/06-monitoring.md` |

## 3. Risques & dette technique 🔴 / ⚠️

1. ✅ **Migrations Prisma — RÉSOLU (2026-06-04).** L'historique était désynchronisé (évolutions faites en `db push`). Une tentative de migration « reconcile » a échoué (bug d'ordre Prisma : `AlterEnum` du type `Plan` émis avant les `CreateTable` des tables qui l'utilisent). **Correctif appliqué : squash en une baseline unique** `20260604104618_init` (que des `CREATE`, enum `Plan` final, 0 `AlterEnum`). `prisma migrate status` → *up to date*. La prod utilise désormais `PRISMA_BOOTSTRAP=migrate` (`migrate deploy`).
2. ⚠️ **WebSocket mono-instance (état en mémoire).** ✅ Conforme à Option A/B (1 nœud). La montée en charge (Option C) impose un refacto `wsServer.js` → Redis pub/sub + sticky sessions.
3. ⚠️ **Médias sur disque local.** OK en Option A (volume Docker). À migrer vers **S3** en Option B (compute futur éphémère).
4. ✅ **ESP32 en `wss` — fait.** Le firmware bascule en `beginSSL` (TLS) **automatiquement quand le port saisi au portail = 443** (sinon `ws://` en LAN). Reste à **flasher** les boîtiers et saisir `api.gbairai.robotechci.com` / `443`. Durcissement futur : épingler la CA Let's Encrypt (`beginSslWithCA`) — actuellement chiffré sans validation.
5. ⚠️ **Pas de tests automatisés formels.** Les `_t*.mjs` sont des scripts manuels. Le CI vérifie build + syntaxe, pas la logique métier.
6. ⚠️ **Pas de HA applicative en Option A** (1 instance). Mitigation : `restart: unless-stopped`, backups DB, et bascule Option B (RDS Multi-AZ possible).

## 4. Recommandations (ordre)

1. ~~Réconcilier les migrations Prisma~~ ✅ fait (baseline `init`).
2. Déployer Option A en suivant `docs/devops/05-deployment.md`.
3. Activer backups + monitoring (docs 06/07) **avant** d'ouvrir au public.
4. Activer CinetPay (TEST → PRODUCTION) une fois le webhook public joignable.
5. Migrer vers Option B (RDS → S3 → CloudFront) sans interruption majeure.
6. Faire évoluer le firmware ESP32 vers `wss`.

## 5. Décision

- [ ] **GO** Option A en production
- [ ] GO après correction des points 🔴

## Sources

- [AWS Application Load Balancer — WebSocket (listeners)](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html)
- [AWS App Runner roadmap #13 — WebSockets non supportés](https://github.com/aws/apprunner-roadmap/issues/13)
- [Prisma — `migrate deploy` / `db push`](https://www.prisma.io/docs/orm/prisma-migrate)
- [GitHub Actions — Documentation](https://docs.github.com/actions)
