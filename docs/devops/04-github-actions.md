# 04 — GitHub Actions (CI/CD)

## CI et CD, c'est quoi ?

- **CI (Intégration Continue)** : à chaque `git push`, une machine **vérifie**
  automatiquement le code (build, tests, lint). But : détecter une casse **tôt**.
- **CD (Déploiement Continu)** : une fois le code validé, il est **déployé**
  automatiquement. But : livrer **vite et sans geste manuel** source d'erreurs.

Pourquoi c'est important : zéro déploiement « à la main » oublié, historique clair,
et un filet qui empêche de mettre en prod un build cassé.

## Le pipeline GBAIRAI

```
git push ─► GitHub ─► CI (ci.yml)               ─► CD (deploy.yml)
                       ├─ build frontend            (sur push main / manuel)
                       ├─ check backend (prisma)     └─ SSH EC2 → git pull
                       └─ build images Docker             → compose up -d --build
```

## `ci.yml` — étape par étape

| Job | Ce qu'il fait | Pourquoi |
|---|---|---|
| `client` | `npm ci` + `npm run build` dans `client/` | Prouver que la SPA compile |
| `server` | `npm ci` + `prisma generate` + `node --check src/server.js` | Prouver que le backend est sain |
| `docker` | build des 2 images (avec cache GitHub) | Prouver que les images se construisent |

- `actions/checkout@v4` : récupère le code.
- `actions/setup-node@v4` avec `cache: npm` : installe Node 20 + cache les deps.
- `docker/build-push-action@v6` + `cache-from/to: type=gha` : build rapide grâce au
  cache GitHub.
- `push: false` : en CI on **build sans publier** (pas encore de registre).

## `deploy.yml` — étape par étape

Déclencheurs : `workflow_dispatch` (bouton manuel) **et** `push` sur `main`.

```yaml
uses: appleboy/ssh-action@v1.2.0
with:
  host: ${{ secrets.EC2_HOST }}
  username: ${{ secrets.EC2_USER }}
  key: ${{ secrets.EC2_SSH_KEY }}
  script: |
    cd ~/gbairai
    git pull --ff-only
    docker compose -f docker-compose.prod.yml up -d --build
    docker image prune -f
```

- `concurrency: deploy-prod` → **un seul déploiement à la fois** (pas de collision).
- Les images sont (re)buildées **sur l'EC2** : simple pour démarrer (Option A).

## Secrets & variables

**Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|---|---|
| `EC2_HOST` | IP publique / DNS de l'EC2 |
| `EC2_USER` | utilisateur SSH (ex. `ubuntu`) |
| `EC2_SSH_KEY` | clé privée SSH (contenu du `.pem`) |

> Les secrets ne sont **jamais** affichés dans les logs. Ne mets **jamais** un secret
> en clair dans un fichier versionné.

## Environnements (notion)

GitHub permet des **Environments** (`staging`, `production`) avec règles de protection
(approbation manuelle, secrets dédiés). Recommandé quand tu auras un `staging`.

## Évolution (Option B) : images via registre

Plus tard, le CI **poussera** les images vers **ECR** (ou GHCR), et le CD fera un
`docker compose pull && up -d` (au lieu de `--build`). Avantage : déploiement plus
rapide et image identique testée en CI = celle déployée.

```
CI  ─► docker build ─► push ECR/GHCR
CD  ─► docker compose pull ─► up -d   (l'EC2 ne build plus)
```

## Sources

- [GitHub Actions — Documentation](https://docs.github.com/actions)
- [GitHub Actions — Secrets chiffrés](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions)
- [GitHub Actions — Environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [docker/build-push-action](https://github.com/docker/build-push-action)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action)
- [Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/)
