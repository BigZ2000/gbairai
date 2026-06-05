# 05 — Déploiement pas à pas (Option A)

> Tutoriel pour mettre GBAIRAI en ligne sur **1× EC2** (région **eu-west-3 Paris**),
> domaine **IONOS** `gbairai.robotechci.com` + `api.gbairai.robotechci.com`.
> Chaque étape : **Objectif → Action → Vérification**.

---

## Pré-requis — Migrations Prisma ✅ (fait le 2026-06-04)

L'historique de migrations était désynchronisé du `schema.prisma`. Il a été **remis
à plat en une baseline unique** `20260604104618_init` (squash). La prod utilise donc
`PRISMA_BOOTSTRAP=migrate` (`prisma migrate deploy` au démarrage du conteneur).

> Pour mémoire, la procédure de squash (si à refaire un jour) :
> ```bash
> cd server
> rm -rf prisma/migrations
> npx prisma migrate reset --force --skip-seed
> npx prisma migrate dev --name init
> node prisma/seed.js   # données de base (admin + catégories + questions)
> ```
> ⚠️ Destructif (réinitialise la base). À ne faire qu'en dev.

**Vérification** : `npx prisma migrate status` → *Database schema is up to date!*

---

## Étape 1 — Compte AWS + utilisateur IAM

**Objectif** : ne pas travailler avec le compte root.
**Action** : crée le compte, active la **MFA** sur le root, puis crée un utilisateur
**IAM** avec accès console + droits EC2 (au début, `AmazonEC2FullAccess`).
**Vérification** : tu te connectes avec l'utilisateur IAM (pas le root).

## Étape 2 — Lancer une instance EC2 (eu-west-3)

**Objectif** : la machine qui héberge tout.
**Action** :
- Région **Paris (eu-west-3)** (en haut à droite).
- *Launch instance* → **Ubuntu Server 24.04 LTS (ARM64)**.
- Type **t4g.small** (ARM Graviton, bon rapport prix/perf ; t4g.micro pour tester).
- **Key pair** : crée/télécharge une clé `.pem` (sert au SSH + au CD).
- **Storage** : 20–30 Go gp3.
- **Security group** : autorise **22 (SSH)**, **80 (HTTP)**, **443 (HTTPS)**.
**Vérification** : l'instance est *running* et a une **IP publique**.

> 💡 Une **IP Elastic** (fixe) évite que l'IP change au redémarrage → recommandé
> (le DNS pointera dessus). *EC2 → Elastic IPs → Allocate → Associate*.

## Étape 3 — DNS chez IONOS

**Objectif** : faire pointer les 2 sous-domaines vers l'IP de l'EC2.
**Action** (IONOS) :
1. Connecte-toi à IONOS → **Domaines & SSL** → `robotechci.com` → **DNS**.
2. Ajoute **deux enregistrements de type A** :

   | Type | Nom (hôte) | Valeur (pointe vers) | TTL |
   |---|---|---|---|
   | A | `gbairai` | `<IP_PUBLIQUE_EC2>` | 1 h |
   | A | `api.gbairai` | `<IP_PUBLIQUE_EC2>` | 1 h |

   > Chez IONOS, on saisit **seulement le préfixe** (`gbairai`, `api.gbairai`) ; IONOS
   > ajoute `.robotechci.com` automatiquement. Résultat :
   > `gbairai.robotechci.com` et `api.gbairai.robotechci.com`.
3. Enregistre.

**Vérification** (attends la propagation, quelques minutes à 1 h) :
```bash
dig +short gbairai.robotechci.com
dig +short api.gbairai.robotechci.com
# → doivent renvoyer l'IP de l'EC2
```

> L'app existante sur `robotechci.com` n'est **pas** touchée : on n'ajoute que des
> sous-domaines.

## Étape 4 — Préparer le serveur (Docker + dépôt)

**Objectif** : installer Docker et récupérer le code.
**Action** (en SSH) :
```bash
ssh -i robotechci.pem ubuntu@<IP_PUBLIQUE_EC2>

# Docker Engine + plugin compose (méthode officielle Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Code
git clone https://github.com/BigZ2000/gbairai.git ~/gbairai
cd ~/gbairai
```
**Vérification** : `docker --version` et `docker compose version` répondent.

## Étape 5 — Configurer l'environnement de prod

**Objectif** : renseigner secrets et domaines.
**Action** :
```bash
cp .env.prod.example .env
# Génère des secrets forts :
openssl rand -base64 48   # → JWT_SECRET
openssl rand -base64 48   # → JWT_REFRESH_SECRET
nano .env                 # remplir APP_DOMAIN, API_DOMAIN, ACME_EMAIL,
                          # POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
```
**Vérification** : `grep -c CHANGER .env` → **0** (plus aucune valeur à remplacer).

## Étape 6 — Démarrer la stack

**Objectif** : tout lancer, TLS compris.
**Action** :
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f edge   # voir Caddy obtenir le certif
```
**Vérification** :
- `https://gbairai.robotechci.com` → l'app charge (cadenas TLS valide).
- `https://api.gbairai.robotechci.com/api/health` → `{"ok":true}`.
- WebSocket : ouvrir une partie, vérifier le temps réel (buzz).

> ⚠️ Caddy a besoin des ports 80/443 ouverts **et** du DNS déjà propagé pour émettre
> le certificat. Si erreur ACME → revérifier `dig` (étape 3) et le Security Group.

## Étape 7 — Google OAuth (si utilisé)

**Action** : dans Google Cloud Console → identifiants OAuth → **Authorized redirect
URI** : `https://api.gbairai.robotechci.com/api/auth/google/callback`. Renseigner
`GOOGLE_CLIENT_ID/SECRET` dans `.env`, puis `docker compose … up -d`.
**Vérification** : « Se connecter avec Google » aboutit.

## Étape 8 — CinetPay (quand prêt)

**Action** : `.env` → `CINETPAY_ENABLED=true` + clés + `CINETPAY_MODE=TEST` d'abord.
`notify_url`/`return_url` sont déjà construits sur tes domaines par le Compose.
Déclarer l'URL de notification chez CinetPay :
`https://api.gbairai.robotechci.com/api/billing/webhook`.
**Vérification** : un paiement TEST déclenche le webhook (logs `server`), abonnement activé.

## Étape 9 — CD automatique (optionnel)

**Action** : ajouter les secrets GitHub `EC2_HOST`, `EC2_USER` (`ubuntu`), `EC2_SSH_KEY`
(contenu du `.pem`). Ensuite, un push sur `main` (ou *Run workflow*) déploie tout seul
(voir `04-github-actions.md`).
**Vérification** : l'onglet **Actions** montre le job *Deploy (prod)* vert.

## Étape 10 — ESP32 en wss (prod) ✅ (firmware prêt)

Le firmware bascule **automatiquement en `wss://` (TLS) quand le port = 443** (sinon
`ws://` en LAN) — aucune autre modif de code nécessaire.

Le serveur est **codé en dur** dans le firmware (`GBAIRAI_HOST`/`GBAIRAI_PORT` =
`api.gbairai.robotechci.com:443`) → au captive portal, l'utilisateur ne saisit **que
son Wi-Fi** (UX plug & play, aucune adresse technique).

**Action** : **flasher** `tools/firmware-esp32/gbairai_buzzer/gbairai_buzzer.ino` sur le
boîtier (changer les 2 constantes en tête de fichier seulement pour un déploiement LAN/dev).

**Vérification** : le buzzer se connecte via Internet et apparaît **« en ligne »** dans
l'app (Administration → Buzzers). Moniteur série → `[WS] liaison sécurisée (wss)`.

> Sécurité : `beginSSL` sans CA **chiffre sans valider** le certificat (suffisant ici).
> Durcissement : épingler la CA Let's Encrypt via `beginSslWithCA`.

---

## Migration vers Option B (plus tard, sans coupure majeure)

1. **RDS** : créer une instance PostgreSQL (eu-west-3), `pg_dump`/`pg_restore` depuis le
   conteneur, puis pointer `DATABASE_URL` vers RDS et retirer le service `db`.
2. **S3** : créer un bucket médias, migrer `uploads/`, adapter `media.js` (upload→S3).
3. **CloudFront + ACM** : distribution devant la SPA/médias, certificat ACM.
   (Détails dédiés fournis au moment de cette migration.)

## Sources

- [Amazon EC2 — Démarrer](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html)
- [EC2 — Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)
- [EC2 — Security groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html)
- [IONOS — Configurer les enregistrements DNS d'un domaine](https://www.ionos.fr/assistance/domaines/configurer-les-parametres-dns-de-votre-domaine/)
- [Docker — Installation (Ubuntu / convenience script)](https://docs.docker.com/engine/install/ubuntu/)
- [Caddy — Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [CinetPay — Documentation](https://docs.cinetpay.com/)
