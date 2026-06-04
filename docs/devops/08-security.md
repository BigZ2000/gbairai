# 08 — Sécurité

> Bonnes pratiques appliquées à GBAIRAI. Statuts : ✅ déjà en place · ⚠️ à activer.

## 1. HTTPS / TLS partout

- ✅ **Caddy** émet et renouvelle les certificats Let's Encrypt automatiquement
  (Option A). En Option B, **ACM** + CloudFront.
- ⚠️ Forcer la redirection HTTP→HTTPS (Caddy le fait par défaut).
- **ESP32** : passer de `ws://` à **`wss://`** (chiffré) — voir doc 05 étape 10.

## 2. Secrets & variables d'environnement

- ✅ `.env` **gitignored** ; `.env.prod.example` ne contient aucune vraie valeur.
- ⚠️ Générer des secrets **forts et distincts** (`openssl rand -base64 48`) pour
  `JWT_SECRET`, `JWT_REFRESH_SECRET`, mot de passe Postgres.
- ⚠️ Option B : déplacer les secrets dans **SSM Parameter Store** (SecureString) ou
  **Secrets Manager** ; ne jamais les laisser en clair sur disque si évitable.
- Ne **jamais** committer un secret ; en cas de fuite → **révoquer/roter**.

## 3. Protection de l'API

- ✅ Auth **JWT Bearer** (pas de cookie → **pas de CSRF**).
- ✅ Validation des entrées avec **Zod** sur les routes.
- ✅ `CORS_STRICT=true` en prod (origine limitée à `CLIENT_URL`).
- ⚠️ Ajouter un **rate limiting** (ex. `express-rate-limit`) sur `/api/auth/*` et le
  webhook — actuellement absent (dette).
- ✅ Webhook CinetPay **signé** (vérification HMAC `x-token`).

## 4. Sécurité réseau (AWS)

- ⚠️ **Security Group** minimal : 22 (SSH, idéalement restreint à ton IP), 80, 443.
  **Ne pas** exposer 4000 ni 5432 publiquement (seul l'edge est public).
- ⚠️ SSH par **clé** uniquement (désactiver l'auth par mot de passe).
- Option B : **RDS dans un sous-réseau privé**, accessible seulement par l'EC2.

## 5. Anti-DDoS / abus

- AWS fournit **Shield Standard** (gratuit, niveau réseau) automatiquement.
- **CloudFront** absorbe et met en cache le trafic (Option B) → amortit les pics.
- ⚠️ Option avancée : **AWS WAF** (règles applicatives) si attaques applicatives.
- Rate limiting applicatif (point 3) = première ligne pas chère.

## 6. Protection WebSocket

- ✅ Le client s'authentifie après connexion (`{type:'auth', token}` vérifié par JWT).
- ⚠️ Envisager une **limite de connexions/messages par IP** et un **timeout** des
  sockets inactifs (anti-abus) — amélioration future.
- ✅ `wss://` (chiffré) en prod via Caddy/CloudFront.

## 7. Sécurité ESP32 / buzzers

- Le modèle **MAC fait foi** : 1er à *claimer* = propriétaire permanent (✅ code).
- ⚠️ Le buzzer s'identifie par sa MAC en clair (`buzzer_hello`) ; sur Internet,
  `wss://` chiffre le canal. Pour durcir : prévoir un **jeton d'appairage** côté
  device (évolution).
- Reset d'usine = maintien du bouton à l'allumage (efface Wi-Fi + serveur).

## 8. Mises à jour

- ⚠️ `apt upgrade` régulier sur l'EC2 (ou **unattended-upgrades**).
- ⚠️ Reconstruire les images régulièrement (base Node/Caddy patchées).

## Checklist avant ouverture publique

- [ ] Secrets forts générés, `.env` rempli, aucun `CHANGER` restant
- [ ] Security Group: 22/80/443 seulement, SSH par clé
- [ ] HTTPS OK sur app + api (cadenas valide)
- [ ] Rate limiting sur `/api/auth` et webhook
- [ ] Sauvegardes actives + **restauration testée**
- [ ] Monitoring + alerte uptime branchés

## Sources

- [OWASP — Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP — Cheat Sheets (JWT, WebSocket)](https://cheatsheetseries.owasp.org/)
- [AWS — Bonnes pratiques Security Groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html)
- [AWS Shield](https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html) · [AWS WAF](https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/) · [SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Let's Encrypt — Documentation](https://letsencrypt.org/docs/)
