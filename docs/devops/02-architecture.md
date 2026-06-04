# 02 — Architecture

## Contrainte n°1 (issue du code) ✅

Le serveur temps-réel garde son état **en mémoire** (`server/src/ws/wsServer.js` :
`rooms`, `userSockets`, `buzzerSockets` sont des `Map` ; les timers de jeu vivent dans
`gameHandler.js`). **Conséquence : le backend est *stateful* et mono-instance.**

On ne peut donc PAS simplement le dupliquer derrière un load balancer sans :
1. **sticky sessions** (un client reste collé à la même instance), ET
2. un **bus partagé** (Redis pub/sub) + refacto du code WS.

👉 Tant que ce refacto n'est pas fait, **la bonne archi = UN nœud applicatif**, scalé
verticalement. C'est aussi la plus simple et la moins chère.

## Composants (rappel)

Frontend (React/Vite, statique) · Backend (Express + `ws`, port 4000) · PostgreSQL
(Prisma) · Médias (disque + ffmpeg) · Paiements (CinetPay, webhook public) · ESP32
(WebSocket) · Simulateur (HTML statique).

## Les trois options

### Option A — MVP (bootstrap retenu)

```
Route/IONOS DNS ─► EC2 (Docker Compose)
                    ├─ Caddy (TLS auto Let's Encrypt) + SPA statique
                    ├─ Node (API + WebSocket)
                    └─ Postgres (volume) + médias (volume)
```
- ➕ Le moins cher, une machine, déploiement trivial.
- ➖ DB et médias liés à l'instance (sauvegardes à gérer), point unique de défaillance.
- Complexité ★☆☆☆☆.

### Option B — Production (cible) ✅

```
IONOS DNS ─► CloudFront (ACM TLS) ─► EC2 (Caddy + Node API/WS)
                                       ├─ RDS PostgreSQL (backups managés)
                                       └─ S3 (médias) + CloudFront (CDN)
             Secrets: SSM · Logs/alarmes: CloudWatch · ESP32: wss://api…
```
- ➕ On externalise **DB (RDS)** et **médias (S3)** — les deux choses à ne pas perdre.
- ➖ Compute encore mono-instance (mitigé par restart auto + backups).
- Complexité ★★☆☆☆.

### Option C — Scalable (futur)

```
CloudFront ─► ALB (WebSocket + sticky) ─► ECS Fargate (N tâches)
                                            ├─ ElastiCache Redis (pub/sub WS) ← refacto code
                                            └─ RDS Multi-AZ + S3 + ECR
```
- ➕ Haute dispo, autoscaling, zéro serveur à patcher.
- ➖ **Exige le refacto WebSocket (Redis) + sticky** ; coût/complexité supérieurs.
- Complexité ★★★★☆. **Sur-dimensionné aujourd'hui.**

## Pourquoi B (et pas A ni C)

- vs **A** : perdre la base ou les médias est inacceptable en prod → RDS + S3.
- vs **C** : C demande un refacto que le code ne porte pas encore, pour une charge
  qu'on n'a pas encore → over-engineering, contraire à la philosophie.

## Chemin d'évolution B → C (sans migration de données)

1. Refactor `wsServer.js` → adapteur **Redis pub/sub**.
2. Activer **sticky sessions** sur l'ALB.
3. Conteneurs sur **Fargate** (images via **ECR**).
4. Ajouter **ElastiCache**.

RDS et S3 étant déjà externes, **aucune donnée à déplacer** : tout l'intérêt de
commencer par B.

## Décisions de routage (issu du code) ✅

La SPA appelle l'API en **chemins relatifs** (`/api`, `/ws`, `/uploads`). Donc on sert
SPA **et** API **sur le même domaine** (`gbairai.robotechci.com`) → **aucun CORS** côté
navigateur. Le sous-domaine `api.gbairai.robotechci.com` sert l'**ESP32 (wss)**, le
**webhook CinetPay** et l'accès direct à l'API.

## Sources

- [AWS Application Load Balancer — WebSockets](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html)
- [AWS ECS sur Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [AWS RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Amazon S3](https://docs.aws.amazon.com/s3/) · [Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
- [Amazon ElastiCache for Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)
