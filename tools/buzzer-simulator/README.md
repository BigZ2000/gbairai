# Simulateur de buzzer Gbairai (Étapes 4 & 4b)

Simule un buzzer matériel ESP32 **sans matériel**, en parlant exactement le
protocole WebSocket du serveur. Trois interfaces :

- 🌐 **`buzzer.html`** — **interface navigateur (RECOMMANDÉE)** : un gros bouton
  rond + une LED colorée. **Aucune installation**, fiable sur tout macOS/Windows/
  Linux, et c'est le rendu le plus proche du buzzer final.
- 🖥️ **`gbairai_buzzer_gui.py`** — même interface en Python/Tkinter (utile si
  Tkinter fonctionne bien chez toi ; le Tk système d'anciens macOS peut mal
  s'afficher → préfère alors la version navigateur).
- ⌨️ **`gbairai_buzzer.py`** — version ligne de commande (auto-buzz, **test de
  charge** N buzzers, démos scriptées).

Sert à : valider le protocole avant le firmware ESP32, tester la charge, et faire
des démos sans boîtiers.

## ▶️ Option A — Interface navigateur (recommandée, zéro installation)

> **Le plus simple (et multi-appareils LAN)** : le simulateur est désormais
> **servi par l'app** → ouvre **`http://<ip-du-serveur>:5173/buzzer.html`** depuis
> n'importe quel appareil du réseau (téléphone, tablette, PC). Il **détecte
> automatiquement le serveur** (`ws://<même-ip>:4000`) et joue les **sons**.
> Accessible aussi via le **Guide** : `/buzzer`.
>
> Le fichier `tools/buzzer-simulator/buzzer.html` reste une copie autonome
> (ouvrable en `file://` sur la machine de dev) ; pour le LAN, préfère l'URL servie.

> Le simulateur se comporte **comme le vrai buzzer ESP32** : pas de code de
> partie à saisir, on l'« allume » et le **serveur pilote sa LED** tout seul.

1. Démarre le serveur Gbairai (`cd server && node --watch src/server.js`).
2. Ouvre le simulateur et **allume-le** :
   ```bash
   open tools/buzzer-simulator/buzzer.html      # macOS (ou double-clic)
   ```
   Clique **Allumer le buzzer** → il se connecte (`buzzer_hello`). La pastille
   indique **« À appairer »** (s'il est inconnu) ou **« En ligne — prêt »**.
3. **Appaire-le une fois** : dans l'app web → **Mes buzzers** → ajoute-le par sa
   **MAC** (affichée dans le simulateur). La pastille passe à **« Prêt »**.
4. Crée une partie → **salle d'attente** → **assigne** ce buzzer à un joueur.
5. **Lance la partie** : la LED s'allume **toute seule** (bleu = *armé*) — sans
   avoir saisi de code. Clique le bouton (ou **ESPACE**) pour buzzer :
   🟢 *gagné* / 🔴 *verrouillé* / 🟠 *réponse révélée*.

> Pour **plusieurs buzzers**, ouvre `buzzer.html` dans plusieurs onglets
> (chaque onglet génère une MAC différente).
>
> **Pastille d'état d'appairage** : ⚫ Éteint · 🟡 À appairer · 🟢 Prêt · 🔵 En jeu.

## ▶️ Option B — Interface Python (Tkinter)

> À utiliser seulement si Tkinter s'affiche correctement chez toi. Sur certains
> macOS, le Tk système (8.5, déprécié) n'affiche rien → **utilise l'Option A**.

### Installation (options B et C)

```bash
cd tools/buzzer-simulator
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

> ⚠️ L'interface graphique a besoin de **Tkinter**. Si tu obtiens
> `ModuleNotFoundError: No module named '_tkinter'` :
> - **macOS (Homebrew)** : `brew install python-tk@3.13` puis recrée le venv.
> - **macOS (alternative)** : crée le venv avec le Python système :
>   `/usr/bin/python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
> - **Linux** : `sudo apt install python3-tk`.
> - **Windows** : Tkinter est inclus avec Python.

### Lancer l'interface Python (pas à pas)

1. **Démarrer le serveur Gbairai** (dans un autre terminal) :
   ```bash
   cd server && npm run dev      # ou : node --watch src/server.js
   ```
2. **Créer une partie** dans l'app web (mode Animateur ou Automatique) et noter
   le **code** (ex. `QUIZ42`) affiché dans la salle d'attente.
3. **Lancer le buzzer graphique** :
   ```bash
   cd tools/buzzer-simulator
   .venv/bin/python gbairai_buzzer_gui.py
   ```
4. Dans la fenêtre : laisser **Serveur** = `ws://localhost:4000`, garder la **MAC**
   proposée (ou la tienne), saisir le **Code de la partie**, puis **Se connecter**.
5. *(Pour que le buzz **marque** un joueur)* : dans la salle d'attente, assigner
   ce buzzer (sa MAC) à un participant. Sinon le buzz fonctionne mais n'est lié à
   aucun joueur.
6. **Lancer la partie** → la LED passe au **bleu** : appuie sur le **gros bouton**
   (ou la **barre d'espace**) pour buzzer. La LED devient **verte** si tu gagnes,
   **rouge** si un autre a buzzé avant.

### Code couleur de la LED (identique au futur buzzer physique)
| Couleur | Sens |
|---|---|
| 🔵 Bleu (pulsé) | Prêt — tu peux buzzer |
| ⚪ Blanc (flash) | Appui détecté |
| 🟢 Vert | Tu as gagné le buzz |
| 🔴 Rouge | Verrouillé (quelqu'un a buzzé avant) |
| 🟠 Orange | Réponse révélée |
| ⚫ Gris | Déconnecté / en attente |

## ▶️ Option C — Ligne de commande (auto-buzz & test de charge)

## Protocole reproduit

**Montant (device → serveur)**
| Étape | Message |
|---|---|
| Annonce de l'appareil (boot) | `{"type":"buzzer_hello","mac":"…","firmware":"…"}` |
| Buzz (appui bouton) | `{"type":"buzz","source":"device","mac":"…"}` |

**Descendant (serveur → device)** — pilote la LED, **aucune room, aucun code**
| Message | Effet |
|---|---|
| `{"type":"awaiting_claim"}` | LED « à appairer » |
| `{"type":"pairing_success"}` | LED « prêt » (appairé) |
| `{"type":"led","state":"armed\|winner\|locked\|reveal\|idle"}` | état de jeu |

> Le serveur résout tout seul la partie EN_COURS à partir de l'assignation du
> buzzer **et lui pousse l'état de sa LED** : un vrai buzzer n'a donc besoin NI
> du code de la partie, NI de rejoindre une room. Pour qu'un buzz **marque** un
> joueur, la MAC doit être assignée à un participant (Salle d'attente →
> « assigner un buzzer »).

## Exemples

```bash
# Un buzzer interactif : appuie sur ENTER pour buzzer
python3 gbairai_buzzer.py --mac AA:BB:CC:00:11:22 --code QUIZ42

# Auto-buzz à chaque question (délai aléatoire 0,3–2,5 s) — parfait en démo
python3 gbairai_buzzer.py --mac AA:BB:CC:00:11:22 --code QUIZ42 --auto

# Test de charge : 50 buzzers pressent 1 s après connexion puis quittent
python3 gbairai_buzzer.py --count 50 --press-after 1 --once

# Buzz régulier toutes les 2 s
python3 gbairai_buzzer.py --mac AA:BB:CC:00:11:22 --interval 2
```

## Options principales

| Option | Rôle |
|---|---|
| `--url` | URL WebSocket (def. `ws://localhost:4000`) |
| `--mac` | MAC du buzzer (sinon générée) |
| `--code` | Code de partie : rejoint la salle + inclus dans le buzz |
| `--count N` | N buzzers simultanés (test de charge ; MAC auto) |
| `--auto` | Buzz auto à chaque `question_display` |
| `--press-after S` / `--once` | Buzz une fois S s après connexion (puis quitte) |
| `--interval S` | Buzz toutes les S secondes |
| `--interactive` | Buzz à chaque ENTER (défaut si un seul buzzer) |
