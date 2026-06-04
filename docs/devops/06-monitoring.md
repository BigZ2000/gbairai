# 06 — Monitoring (logs, métriques, alertes)

## Pourquoi

Savoir **avant les utilisateurs** que quelque chose ne va pas : serveur down, disque
plein, base saturée. Objectif : observer sans usine à gaz.

## 3 niveaux

1. **Logs** — ce qui se passe (texte).
2. **Métriques** — chiffres dans le temps (CPU, RAM, disque, connexions).
3. **Alertes** — être prévenu quand une métrique dépasse un seuil.

## Option A — simple, sur l'EC2

### Logs
Les conteneurs écrivent sur stdout → consultables via :
```bash
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs --since=1h edge
```
Limiter la taille des logs (éviter de remplir le disque) en ajoutant aux services :
```yaml
logging:
  driver: json-file
  options: { max-size: "10m", max-file: "3" }
```

### Métriques rapides
```bash
docker stats           # CPU/RAM par conteneur, en direct
df -h                  # espace disque (médias + Postgres + images)
```

### Healthcheck
Le backend a déjà `/api/health` et un `HEALTHCHECK` Docker → `docker compose ps`
affiche `healthy`/`unhealthy`.

### Alerte « pauvre » mais efficace
Un **uptime check externe** gratuit (ex. UptimeRobot) qui ping
`https://api.gbairai.robotechci.com/api/health` toutes les 5 min et t'email si KO.

## Option B — CloudWatch (managé)

- **CloudWatch Agent** sur l'EC2 → métriques système (CPU, **disque**, RAM) + logs.
- **CloudWatch Alarms** → email/SNS si CPU > 80 % 5 min, disque > 85 %, etc.
- **RDS** publie nativement ses métriques (connexions, CPU, stockage libre) →
  alarmes recommandées sur *FreeStorageSpace* et *DatabaseConnections*.
- **CloudFront / S3** : métriques de requêtes et d'erreurs 4xx/5xx.

## Que surveiller en priorité pour GBAIRAI

| Métrique | Pourquoi | Seuil indicatif |
|---|---|---|
| Disque EC2 | médias + Postgres + images Docker grossissent | > 85 % |
| CPU EC2 | un nœud unique = goulot | > 80 % soutenu |
| `/api/health` | l'app répond ? | KO 2 fois |
| Connexions DB | fuite/saturation | proche de la limite |
| Certificat TLS | expiration | < 15 j (Caddy renouvelle seul, mais surveiller) |

## Sources

- [Amazon CloudWatch — Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch Agent — Installer/collecter métriques & logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html)
- [RDS — Surveillance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Monitoring.html)
- [Docker — Logging drivers](https://docs.docker.com/engine/logging/configure/)
