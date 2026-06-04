# 00 — Vue d'ensemble DevOps GBAIRAI

> Point d'entrée de la documentation d'exploitation. Lis les documents dans l'ordre.

## À qui s'adresse cette doc ?

À un développeur qui sait coder mais **débute sur AWS / DevOps**. Chaque document
explique d'abord le **concept**, puis **comment il s'applique à GBAIRAI**.

## Le projet en une phrase

GBAIRAI = plateforme de quiz/buzzers (web, téléphone, buzzer ESP32). Philosophie :
**simple, plug-and-play, peu de maintenance**. Cette doc applique la même règle à
l'infrastructure : *« la solution la plus simple qui fonctionne et pourra évoluer »*.

## Décisions verrouillées

| Sujet | Choix |
|---|---|
| Architecture cible | **Option B** (EC2 + RDS + S3 + CloudFront) |
| Démarrage | **Option A** (tout sur 1 EC2) puis migration vers B |
| Région AWS | **eu-west-3 (Paris)** |
| Domaine | `gbairai.robotechci.com` (app) + `api.gbairai.robotechci.com` (API/WS/ESP32), DNS chez **IONOS** |
| Buzzer ESP32 | en prod cloud via **wss** |

## Plan de lecture

| Doc | Contenu |
|---|---|
| 01 | Introduction à AWS (vocabulaire, services utiles à GBAIRAI) |
| 02 | Architecture (A / B / C, schémas, choix) |
| 03 | Docker (Dockerfiles & Compose, ligne par ligne) |
| 04 | GitHub Actions (CI/CD expliqué) |
| 05 | Déploiement pas à pas (dont DNS IONOS) |
| 06 | Monitoring (logs, métriques, alertes) |
| 07 | Sauvegardes (Postgres, médias) |
| 08 | Sécurité (HTTPS, secrets, WebSocket, ESP32) |
| 09 | Reprise après sinistre (PRA) |
| 10 | Estimation des coûts |

## Schéma cible (Option B)

```
Navigateur / Téléphone ─┐
                        ├─ https ─► CloudFront ─► gbairai.robotechci.com (SPA + /api,/ws,/uploads)
ESP32 (wss) ────────────┘                         │
                                                  ▼
                                    EC2 (Docker : Caddy + Node API/WS)
                                       │                    │
                                  RDS PostgreSQL      S3 (médias) + CloudFront
```

## Convention « Hypothèses / Vérifié »

Chaque doc distingue ce qui vient **du code analysé** (✅), de la **doc officielle**
(🔎), et ce qui reste une **hypothèse à confirmer** (❓). On ne présente jamais une
hypothèse comme un fait.

## Sources

- [AWS — Documentation centrale](https://docs.aws.amazon.com/)
- [The Twelve-Factor App](https://12factor.net/) (principes config/déploiement)
