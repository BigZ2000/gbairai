# 10 — Estimation des coûts

> ⚠️ **Aucun prix exact inventé ici.** Les tarifs AWS varient (région, type, période,
> Free Tier) → **recalcule toujours** sur l'[AWS Pricing Calculator](https://calculator.aws/).
> Région supposée **eu-west-3 (Paris)**, tarifs **on-demand**. Les valeurs ci-dessous
> sont des **ordres de grandeur** mensuels pour un trafic modéré.

## Ce qui coûte, par nature

| Type de coût | Exemples GBAIRAI |
|---|---|
| **Calcul** (temps) | EC2, Fargate |
| **Stockage** (Go/mois) | EBS (disque EC2), RDS, S3 |
| **Transfert sortant** (Go vers Internet) | médias, API, WebSocket |
| **À la requête / unité** | CloudFront, S3 (requêtes), Secrets Manager (par secret) |

## Option A — 1× EC2 (ordre de grandeur)

| Poste | Hypothèse | Ordre de grandeur |
|---|---|---|
| EC2 t4g.small | 1 instance ON 24/7 | ~ quelques dizaines de $/mois |
| EBS gp3 30 Go | disque | ~ quelques $/mois |
| IP Elastic | associée (gratuite si attachée à une instance active) | ~ 0 |
| Transfert sortant | faible trafic | quelques $ |
| **Total A** | | **~ 15–35 $/mois** ❓ à confirmer |

> 💡 Le **Free Tier** (12 mois) peut réduire fortement la 1ère année (selon éligibilité).

## Option B — EC2 + RDS + S3 + CloudFront

| Poste | Hypothèse | Ordre de grandeur |
|---|---|---|
| EC2 t4g.small | compute app | comme A |
| RDS db.t4g.micro | DB managée (mono-AZ) | ~ +15–30 $ |
| S3 | médias (quelques Go) | ~ quelques $ |
| CloudFront | CDN faible/moyen trafic | ~ quelques $ |
| **Total B** | | **~ 40–90 $/mois** ❓ à confirmer |

> Multi-AZ sur RDS ≈ **double** le coût RDS (haute dispo). À activer seulement si le
> besoin de disponibilité le justifie.

## Option C — Fargate + ALB + Redis (futur)

| Poste | Remarque |
|---|---|
| ALB | coût horaire fixe + à l'unité de trafic |
| Fargate | par vCPU/Go × durée × nb de tâches |
| ElastiCache Redis | instance dédiée |
| RDS Multi-AZ | HA |
| **Total C** | **~ 150–300 $/mois+** ❓ à confirmer |

## Leviers d'économie

1. **ARM / Graviton (t4g)** : meilleur rapport prix/perf que x86.
2. **Savings Plans / Reserved** : −30 à −60 % sur EC2/RDS si engagement 1–3 ans
   (à faire une fois la charge stabilisée).
3. **S3 Lifecycle** : purger les vieux backups → coût stockage maîtrisé.
4. **CloudFront** : le cache réduit le transfert sortant facturé de l'origine.
5. **Éteindre le superflu** : pas de Multi-AZ ni d'ALB tant qu'inutiles (philosophie).

## Garde-fous facturation (à activer dès le début)

- **AWS Budgets** : un budget mensuel + alerte email à 50/80/100 %.
- **Billing alarms** CloudWatch.
- Vérifier le **Cost Explorer** chaque semaine au lancement.

## Méthode pour TON chiffrage réel

1. Liste tes ressources (type EC2, taille RDS, Go S3, Go sortant estimés).
2. Saisis-les dans le **Pricing Calculator** (région eu-west-3).
3. Vérifie l'éligibilité **Free Tier**.
4. Mets une **alerte budget** au double de l'estimation (marge de sécurité).

## Sources

- [AWS Pricing Calculator](https://calculator.aws/)
- [EC2 — Tarifs](https://aws.amazon.com/ec2/pricing/) · [RDS — Tarifs](https://aws.amazon.com/rds/pricing/)
- [S3 — Tarifs](https://aws.amazon.com/s3/pricing/) · [CloudFront — Tarifs](https://aws.amazon.com/cloudfront/pricing/)
- [AWS Free Tier](https://aws.amazon.com/free/) · [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [Savings Plans](https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html)
