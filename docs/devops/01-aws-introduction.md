# 01 — Introduction à AWS (pour débutant)

## C'est quoi AWS ?

**AWS (Amazon Web Services)** loue de l'infrastructure informatique à la demande :
serveurs, bases de données, stockage, réseau, paiement à l'usage. Au lieu d'acheter
une machine, tu « loues » exactement ce dont tu as besoin.

## Vocabulaire de base

| Terme | Définition simple |
|---|---|
| **Région** | Zone géographique (ex. `eu-west-3` = Paris). On choisit la plus proche des joueurs. |
| **Availability Zone (AZ)** | Datacenter isolé dans une région. Plusieurs AZ = résilience. |
| **IAM** | Gestion des identités et permissions (qui a le droit de faire quoi). |
| **VPC** | Réseau privé virtuel où vivent tes ressources. |
| **Security Group** | Pare-feu virtuel d'une ressource (ports autorisés). |

> **GBAIRAI** : région **eu-west-3 (Paris)**, généralement la meilleure latence vers
> la Côte d'Ivoire (❓ à mesurer ; alternative `af-south-1` Cape Town).

## Les services AWS, et lesquels servent à GBAIRAI

| Service | Rôle | Utile à GBAIRAI ? |
|---|---|---|
| **EC2** | Serveur virtuel (une « machine » Linux). | ✅ Oui — héberge l'API + WebSocket. |
| **ECS / Fargate** | Exécuter des conteneurs sans gérer de serveur. | 🔜 Plus tard (Option C). |
| **ECR** | Registre privé d'images Docker. | 🔜 Avec le CI (Option B/C). |
| **RDS** | Base de données **managée** (backups, patchs auto). | ✅ Oui (Option B). |
| **S3** | Stockage d'objets (fichiers) durable. | ✅ Oui — médias (Option B). |
| **CloudFront** | CDN : sert le contenu vite + en HTTPS. | ✅ Oui — SPA + médias. |
| **Route 53** | DNS managé. | ⚪ Optionnel (DNS reste possible chez IONOS). |
| **Certificate Manager (ACM)** | Certificats TLS **gratuits**. | ✅ Avec CloudFront. (En Option A, Caddy fait Let's Encrypt.) |
| **Load Balancer (ALB)** | Répartit le trafic ; **gère les WebSockets**. | 🔜 Option C (multi-instances). |
| **Secrets Manager / SSM Param Store** | Stocker les secrets hors du code. | ✅ Oui. |
| **CloudWatch** | Logs, métriques, alarmes. | ✅ Oui. |
| **Lambda** | Exécuter du code sans serveur, à l'événement. | ⚪ Pas au cœur ; utile pour cron/tâches async. |

## Pourquoi PAS App Runner pour GBAIRAI ?

App Runner est le service « le plus simple » pour un conteneur web… mais 🔎 **il ne
supporte pas les WebSockets entrants** (limitation officielle, encore ouverte). Or
le cœur de GBAIRAI **est** un serveur WebSocket. → écarté pour le backend.

## Modèle de coût (principe)

On paie : le **temps** de calcul (EC2/Fargate), le **stockage** (Go/mois sur S3/EBS/RDS),
le **transfert sortant** (Go vers Internet), et certains services au **nombre de requêtes**.
Détails chiffrés : voir `10-cost-estimation.md`.

## Sécuriser dès le début

- Ne **jamais** utiliser le compte « root » au quotidien → créer un utilisateur **IAM**.
- Activer la **MFA** (double authentification).
- Principe du **moindre privilège** (donner juste les droits nécessaires).

## Sources

- [AWS — Régions et zones de disponibilité](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
- [AWS IAM — Bonnes pratiques de sécurité](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS App Runner roadmap #13 — WebSockets](https://github.com/aws/apprunner-roadmap/issues/13)
- [AWS — Liste des services](https://docs.aws.amazon.com/)
