# Firmware Buzzer ESP32 — Gbairai (Étape 5)

Firmware du buzzer physique. Il parle **exactement le même protocole** que le
simulateur (`tools/buzzer-simulator`) — déjà validé de bout en bout côté serveur.
La validation logicielle est donc faite ; il ne reste que le test sur boîtier réel.

```
boot → Wi-Fi (captive portal) → WebSocket → buzzer_hello
appui bouton → buzz {source:"device", mac}
serveur → led {state}  → pilote la LED RGB
```

## 1. Matériel

| Composant | Rôle |
|---|---|
| ESP32 (Dev Module, ESP32-WROOM) | cerveau + Wi-Fi |
| Bouton arcade (poussoir) | le « buzz » |
| LED RGB **WS2812 / NeoPixel** (1 pixel) | indicateur d'état |
| Batterie LiPo + module de charge (option) | autonomie |

### Câblage

| Élément | Broche ESP32 |
|---|---|
| Bouton — borne 1 | **GPIO 13** |
| Bouton — borne 2 | **GND** |
| NeoPixel **DIN** | **GPIO 5** |
| NeoPixel **VCC** | **3V3** (ou 5V) |
| NeoPixel **GND** | **GND** |
| Piézo **+** | **GPIO 12** |
| Piézo **−** | **GND** |

> Le bouton utilise la résistance de tirage interne (`INPUT_PULLUP`) : appui = niveau bas.
> Tu peux changer les broches en haut du `.ino` (`BUTTON_PIN`, `LED_PIN`).

## 2. Logiciels (Arduino IDE)

1. Installe **Arduino IDE** (2.x).
2. **Support ESP32** : *Préférences → URL de gestionnaire de cartes* :
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   puis *Gestionnaire de cartes → installer « esp32 » (Espressif)*.
3. **Bibliothèques** (*Gérer les bibliothèques…*) :
   - **WiFiManager** (tzapu)
   - **WebSockets** (Markus Sattler / Links2004)
   - **Adafruit NeoPixel**
4. Carte : **« ESP32 Dev Module »** + le bon **port** série.

## 3. Flasher

1. Ouvre `tools/firmware-esp32/gbairai_buzzer/gbairai_buzzer.ino`.
2. **Téléverser** (→).
3. Ouvre le **Moniteur série** (115200 bauds) pour suivre les logs.

## 4. Premier démarrage (captive portal)

1. Au 1er boot, le buzzer crée un Wi-Fi **`Gbairai-Buzzer-XXXX`** (LED blanche pulsée).
2. Connecte ton téléphone/PC à ce réseau → un **portail** s'ouvre.
3. Saisis : ton **Wi-Fi** (SSID + mot de passe) + l'adresse du serveur Gbairai :
   - **LAN** : l'**IP** locale + port **`4000`** → liaison `ws://`.
   - **Cloud (prod)** : le **domaine** `api.gbairai.robotechci.com` + port **`443`**
     → le firmware bascule **automatiquement en `wss://`** (TLS).
4. Enregistre → le buzzer redémarre et se connecte (les identifiants sont mémorisés).

## 5. Appairage & jeu (workflow réel)

1. Le buzzer connecté apparaît **« À appairer »** (LED ambre) s'il est inconnu.
2. Dans l'app : **Mes buzzers** → ajoute-le par sa **MAC** (visible dans le Moniteur série). LED → **prêt**.
3. L'hôte **assigne** le buzzer à un joueur en salle d'attente (ou « Attribuer automatiquement »).
4. **Lancement** → le serveur pousse la LED **toute seule** (pas de code à saisir).
5. **Appui** → buzz. 🟢 gagné / 🔴 verrouillé / 🟠 réponse révélée.

## 6. Code couleur de la LED (identique au simulateur)

| Couleur | État |
|---|---|
| 🔴 rouge sombre pulsé | hors ligne / déconnecté |
| ⚪ blanc pulsé | portail de configuration |
| 🟡 ambre pulsé | à appairer |
| 🟢 vert doux | prêt (en attente de partie) |
| 🔵 bleu pulsé | **armé — tu peux buzzer** |
| ⚪ blanc (flash) | appui détecté |
| 🟢 vert vif | gagné |
| 🔴 rouge | verrouillé |
| 🟠 orange | réponse révélée |

## 7. Reset d'usine

**Maintiens le bouton enfoncé pendant la mise sous tension** → efface le Wi-Fi et
la config serveur (clignotement rouge de confirmation), puis rouvre le portail.

## 8. Télémétrie & OTA (Étape 6)

- **Télémétrie** : le buzzer envoie toutes les 30 s
  `{"type":"device_telemetry","mac":"…","battery":0-100,"rssi":dBm}`.
  Le serveur l'enregistre, alerte le propriétaire et signale la **batterie faible (≤15 %)**.
  Visible dans **Administration → Buzzers** (parc, batterie, signal, firmware).
- **OTA** : depuis **Administration → Buzzers**, on définit *version cible + URL du `.bin`*
  et on active l'OTA. Le serveur pousse alors `{"type":"ota","url":…,"version":…}` aux
  buzzers **en ligne, au repos et obsolètes** (jamais en pleine partie). Le firmware
  télécharge et flashe (`httpUpdate`) puis redémarre.
  - Pour héberger le `.bin` : *Croquis → Exporter le binaire compilé*, puis sers le
    fichier (n'importe quel serveur HTTP en LAN).

## 9. Notes production

- **Bascule auto `ws`/`wss`** : le firmware utilise `beginSSL` (TLS) **dès que le port
  saisi = `443`** (prod cloud), sinon `ws://` clair (LAN). Sur ESP32, `beginSSL` sans CA
  **chiffre sans valider** le certificat — suffisant ici ; durcissement = épingler la CA
  Let's Encrypt (`beginSslWithCA`). Pour l'OTA en cloud, héberger le `.bin` en `https`.
- Le contrat protocole étant **commun au simulateur**, toute évolution se valide
  d'abord sans matériel via `tools/buzzer-simulator`.
