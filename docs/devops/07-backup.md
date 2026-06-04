# 07 — Sauvegardes

## Règle d'or : 3-2-1

**3** copies des données, sur **2** supports différents, dont **1** hors-site.
Une sauvegarde **non testée** ne compte pas.

## Quoi sauvegarder pour GBAIRAI

| Donnée | Où | Criticité |
|---|---|---|
| **Base PostgreSQL** | conteneur `db` (A) / RDS (B) | 🔴 vitale |
| **Médias** | volume `uploads_data` (A) / S3 (B) | 🟠 importante |
| **`.env`** (secrets) | serveur | 🔴 (à garder dans un coffre, pas dans Git) |

## Option A — sur l'EC2

### Sauvegarde Postgres (dump)
```bash
# Dump compressé horodaté
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U gbairai gbairai | gzip > ~/backups/gbairai_$(date +%F_%H%M).sql.gz
```
Automatiser avec **cron** (ex. tous les jours à 3 h) :
```bash
crontab -e
0 3 * * * cd ~/gbairai && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U gbairai gbairai | gzip > ~/backups/gbairai_$(date +\%F).sql.gz
```
**Hors-site** : copier les dumps vers **S3** (durable, peu cher) :
```bash
aws s3 cp ~/backups/ s3://gbairai-backups/ --recursive
```
Et appliquer une **règle de cycle de vie** S3 (supprimer > 30 j) pour limiter le coût.

### Médias
```bash
tar czf ~/backups/uploads_$(date +%F).tgz -C /var/lib/docker/volumes/gbairai_uploads_data/_data .
# ou, mieux : aws s3 sync du dossier uploads vers un bucket
```

## Option B — RDS + S3 (managé, recommandé)

- **RDS** : **sauvegardes automatiques** + **PITR** (restauration à un instant T) →
  activer une fenêtre de rétention (7–14 j). Snapshots manuels avant gros changements.
- **S3** : durabilité native ; activer le **versioning** pour récupérer un fichier
  écrasé/supprimé.

## Restauration (à TESTER avant d'en avoir besoin)

```bash
# Postgres (Option A)
gunzip -c ~/backups/gbairai_2026-06-04.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U gbairai -d gbairai
```
RDS : *Restore to point in time* ou *Restore snapshot* (crée une nouvelle instance),
puis bascule `DATABASE_URL`.

> ✅ Note la durée d'une restauration réelle → c'est ton **RTO** (voir doc 09).

## Sources

- [PostgreSQL — `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html) · [`pg_restore`](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [RDS — Sauvegardes automatiques & PITR](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
- [S3 — Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) · [Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
