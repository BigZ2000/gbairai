# 09 — Reprise après sinistre (PRA / DR)

## Deux chiffres à connaître

- **RTO** (Recovery Time Objective) : en combien de temps je dois **revenir en ligne** ?
- **RPO** (Recovery Point Objective) : combien de **données** puis-je me permettre de
  perdre (≈ fréquence des sauvegardes) ?

Pour GBAIRAI (Option A), une cible raisonnable : **RTO ~1 h**, **RPO ~24 h** (dump
quotidien). En Option B avec RDS PITR : **RPO ~5 min**.

## Scénarios & réponses

### 1. Le conteneur backend plante
- `restart: unless-stopped` le relance seul.
- Sinon : `docker compose -f docker-compose.prod.yml up -d`.
- Diagnostic : `docker compose logs server`.

### 2. L'instance EC2 est perdue (corruption, suppression)
**Option A** :
1. Lancer une **nouvelle EC2** (même AMI/type, eu-west-3).
2. Réassocier l'**IP Elastic** (le DNS n'a pas à changer).
3. Installer Docker + `git clone` + restaurer `.env` (depuis le coffre).
4. **Restaurer la base** depuis le dernier dump (doc 07) et les **médias**.
5. `docker compose -f docker-compose.prod.yml up -d --build`.

> 💡 C'est précisément pour réduire ce risque qu'on migre vers **Option B** : RDS et S3
> survivent à la perte de l'EC2 → il suffit de recréer le compute et de re-pointer.

### 3. Base de données corrompue
- **A** : restaurer le dump (doc 07).
- **B** : *RDS → Restore to point in time* → bascule `DATABASE_URL`.

### 4. Mauvais déploiement (régression)
- **Rollback** : `git checkout <commit_stable>` puis `docker compose up -d --build`.
- En images-registre (Option B) : redéployer le **tag précédent** (rollback instantané).

### 5. Domaine / TLS KO
- Vérifier DNS IONOS (`dig`), ports 80/443, logs Caddy.
- Le volume `caddy_data` conserve les certificats → ne pas le supprimer.

### 6. Fuite de secret
- **Roter** immédiatement : nouveaux `JWT_SECRET` (déconnecte les sessions), clés
  CinetPay/Google, mot de passe DB. Redéployer.

## Runbook minimal (à imprimer)

| Incident | 1ère action | Restauration |
|---|---|---|
| App down | `docker compose ps` + `logs` | `up -d` |
| EC2 perdue | nouvelle EC2 + Elastic IP | clone + `.env` + restore DB/médias |
| DB KO | stopper l'app | dump (A) / PITR (B) |
| Régression | `git checkout` stable | `up -d --build` |

## Le test qui compte

**Fais une restauration à blanc** (sur une instance jetable) au moins une fois. Mesure
le temps réel → c'est ton **RTO** vérifié, pas estimé.

## Sources

- [AWS — Disaster Recovery (whitepaper / docs)](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html)
- [RDS — Restauration PITR](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- [EC2 — Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)
