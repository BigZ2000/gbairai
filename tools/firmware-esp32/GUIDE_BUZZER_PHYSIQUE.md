# 🔴 Guide complet — Buzzer physique Gbairai (ESP32)

> Guide matériel **de bout en bout** : liste d'équipements (AliExpress), choix du
> microcontrôleur (benchmark), brochage, câblage, assemblage, impression 3D et
> téléversement du firmware.
>
> ⚠️ **Le firmware est déjà écrit, testé et validé** (même protocole que le
> simulateur, validé de bout en bout côté serveur). Voir
> [`gbairai_buzzer/gbairai_buzzer.ino`](gbairai_buzzer/gbairai_buzzer.ino).
> **Il ne reste qu'à le téléverser** — aucune ligne de code à écrire.

---

## 1. Liste des équipements (BOM) — recherches & prix AliExpress

Prix unitaires indicatifs (USD, hors promo), constatés sur AliExpress. Acheter en
lot de 5–10 fait baisser fortement le prix unitaire.

| # | Composant | Terme de recherche AliExpress | Qté / buzzer | Prix ~unit. |
|---|---|---|---|---|
| 1 | **Carte ESP32** ESP-WROOM-32, 30 broches (USB-C de préférence) | `ESP32 ESP-WROOM-32 development board 30 pin` | 1 | **3,50–6 $** |
| 2 | **Bouton arcade transparent 60 mm** (ou 100 mm « dôme ») avec **microswitch** | `60mm arcade button LED illuminated microswitch` | 1 | **1,60–3 $** |
| 3 | **LED WS2812B / NeoPixel** (module 1 pixel, ou bout de ruban) | `WS2812B LED module single` | 1 | **0,50–1 $** |
| 4 | **Piézo PASSIF** (impératif pour `tone()`) | `passive piezo buzzer arduino 3.3V` | 1 | **0,30 $** |
| 5 | **Module de charge 18650 USB-C** (TP4056 **avec protection**) | `TP4056 Type-C 18650 charging module protection` | 1 | **1,10–1,50 $** |
| 6 | **Support batterie 1× 18650 avec interrupteur** | `18650 battery holder 1 slot with switch` | 1 | **0,80–1,50 $** |
| 7 | **Accu 18650** Li-ion 3,7 V (2000–3000 mAh, marque sérieuse) | `18650 battery 3.7V 2600mAh` | 1 | **3–5 $** |
| 8 | **⚠️ Élévateur 5 V MT3608** *(recommandé — voir §6 Alimentation)* | `MT3608 boost converter module` | 1 | **0,40–0,80 $** |
| 9 | **Résistances** : 2× 100 kΩ (diviseur batterie) + 1× 330 Ω (data NeoPixel) | `resistor kit 1/4W` | 3 | **~2 $** (kit) |
| 10 | **Condensateur 1000 µF / 6,3 V+** *(optionnel, stabilise la NeoPixel)* | `1000uF 16V electrolytic capacitor` | 1 | **~0,10 $** |
| 11 | **Fil silicone 24–22 AWG** + Dupont | `silicone wire 24awg` / `dupont wire kit` | — | **~2 $** |
| 12 | **Visserie M3** + inserts laiton à chaud *(boîtier)* | `M3 heat set insert brass` | — | **~2 $** |
| 13 | **Filament PLA/PETG** *(boîtier imprimé 3D)* | — | ~80 g | **~1,50 $** |

**Coût matière ≈ 15–22 $ par buzzer** (dégressif en lot).

> 💡 **Alternative « tout-en-un »** au lieu des lignes 5 + 6 + 8 : un module combiné
> **« charge 18650 + protection + boost 5 V, entrée USB-C »**
> (recherche : `18650 charging discharge 5V boost module Type-C`, ~1,50–2,50 $).
> Il charge **et** sort un 5 V stable → plus besoin du MT3608 (voir §6).

Sources AliExpress :
[ESP32 WROOM-32 30 pin](https://www.aliexpress.com/w/wholesale-esp32-wroom-32.html) ·
[Bouton arcade 60 mm LED + microswitch](https://www.aliexpress.com/item/32999949832.html) ·
[TP4056 USB-C 18650 protection](https://www.aliexpress.com/w/wholesale-tp4056-usb-c.html) ·
[Support 18650 1 slot avec interrupteur](https://www.aliexpress.com/item/1005001330361752.html)

---

## 2. Choix du microcontrôleur — benchmark

Le firmware **cible l'ESP32** (utilise `<WiFi.h>`, `HTTPUpdate` ESP32 pour l'OTA,
l'ADC `GPIO34`, `tone()`, et tourne confortablement avec WiFiManager + WebSockets +
NeoPixel + TLS `wss`). Voici la comparaison honnête des cartes envisagées.

| Critère | **ESP32 WROOM-32** ✅ | ESP32-C3 mini | ESP8266 (NodeMCU) | Wemos/LOLIN **D1 mini** |
|---|---|---|---|---|
| Puce | Xtensa LX6 **double cœur** | RISC-V **mono cœur** | Tensilica L106 mono cœur | L106 (= ESP8266) |
| Fréquence | 240 MHz | 160 MHz | 80/160 MHz | 80/160 MHz |
| RAM utile | ~520 KB | ~400 KB | ~80 KB | ~80 KB |
| WiFi | ✔ | ✔ | ✔ | ✔ |
| **Bluetooth/BLE** | ✔ (BT+BLE) | ✔ (BLE 5) | ✗ | ✗ |
| **ADC** (batterie) | plusieurs (ADC1 sur GPIO34, OK avec WiFi) | quelques-uns | **1 seul** (A0, 0–1 V, diviseur obligatoire) | 1 (A0, 0–3,2 V via diviseur intégré) |
| GPIO utilisables | ~25 | ~11 | ~9 | ~11 (étiquetées D0–D8) |
| **`tone()` piézo** | ✔ | ✔ | ✔ | ✔ |
| OTA HTTP | `HTTPUpdate` (firmware actuel) | idem (core ESP32) | `ESP8266httpUpdate` (à porter) | idem ESP8266 |
| **Portage du firmware** | **aucun** ✅ | léger (remap broches) | **moyen** (lib WiFi, ADC, OTA) | **moyen** (idem ESP8266) |
| Taille | moyenne | **très compacte** | moyenne | **très compacte** |
| Prix | 3,5–6 $ | 2–3 $ | 2–3 $ | 2–3 $ |

### Verdict
- **ESP32 WROOM-32 (30 broches) → choix par défaut.** ✅ Le firmware tourne **tel
  quel**, marge de RAM/CPU large, ADC dédié à la batterie, BLE en réserve. C'est ce
  qui est documenté et validé.
- **ESP32-C3 mini → meilleure alternative compacte.** Même cœur Arduino ESP32 (donc
  portage **minime** : juste remapper `BUTTON_PIN`/`LED_PIN`/`BUZZER_PIN`/`BATTERY_PIN`
  sur des GPIO valides du C3), USB-C natif, plus petit, moins cher. Idéal si tu veux un
  boîtier mini.
- **ESP8266 / D1 mini → possibles mais déconseillés ici.** Pas de Bluetooth, **un seul
  ADC** (mesure batterie plus contrainte), moins de RAM, et il faut **porter le code**
  (`ESP8266WiFi.h`, `ESP8266httpUpdate`, broches `Dx`). Gain de prix marginal vs la
  perte de marge. À réserver à une version « ultra low-cost » assumée.

👉 **Reste sur l'ESP32 WROOM-32** : zéro portage, c'est la cible du firmware existant.

Réf. prix : [ESP32 dev board AliExpress](https://www.aliexpress.com/w/wholesale-esp32-development-board.html).

---

## 3. Brochage (pinout) — exactement celui du firmware

Constantes en haut de [`gbairai_buzzer.ino`](gbairai_buzzer/gbairai_buzzer.ino) :

```c
#define BUTTON_PIN   13   // bouton arcade (microswitch) entre GPIO13 et GND
#define LED_PIN      5    // DIN de la LED WS2812 (NeoPixel)
#define LED_COUNT    1
#define BUZZER_PIN   12   // piézo PASSIF (sortie son)
#define BATTERY_PIN  34   // mesure batterie via diviseur (ADC, entrée seule)
```

| Signal | Broche ESP32 | Vers… | Remarque |
|---|---|---|---|
| **Bouton** (microswitch, contact NO) | **GPIO 13** | autre borne → **GND** | `INPUT_PULLUP` → appui = niveau bas. Pas de résistance externe. |
| **NeoPixel DIN** | **GPIO 5** | via **330 Ω** en série | protège l'entrée data |
| **NeoPixel VCC** | **3V3** (ou 5V) | — | 1 pixel : 3V3 suffit |
| **NeoPixel GND** | **GND** | — | masse commune |
| **Piézo +** | **GPIO 12** | piézo **−** → **GND** | **piézo passif** obligatoire (`tone()`) |
| **Batterie (mesure)** | **GPIO 34** | diviseur **2×100 kΩ** | BAT+ → 100 kΩ → GPIO34 → 100 kΩ → GND |
| **Alimentation** | **VIN/5V** | sortie du module d'alim (§6) | **ne jamais** injecter >3,3 V sur la broche `3V3` |

> ⚠️ **GPIO 34 = entrée uniquement** (pas de pull-up interne) : parfait pour l'ADC,
> ne pas y câbler de sortie. Le diviseur /2 ramène 4,2 V → 2,1 V (< 3,3 V, sûr).

---

## 4. Câblage

```
                         ┌─────────────── ESP32 (WROOM-32) ───────────────┐
   Bouton arcade         │                                                │
   (microswitch)         │  GPIO13 ●───────────────── borne NO du bouton  │
        ├── NO  ─────────┤  GND    ●───────────────── borne COM du bouton │
        └── COM ─────────┘                                                │
                         │  GPIO5  ●──[330Ω]── DIN  ┐                      │
   NeoPixel WS2812       │  3V3    ●──────────  VCC ├── NeoPixel (1 px)    │
        (1 pixel)        │  GND    ●──────────  GND ┘   (sous le bouton    │
                         │                              transparent)       │
   Piézo passif          │  GPIO12 ●──────────  (+) ┐                      │
        ├── (+) ─────────┤  GND    ●──────────  (−) ┘── piézo             │
        └── (−) ─────────┘                                                │
                         │  GPIO34 ●──┐                                    │
   Diviseur batterie     │            ├─[100kΩ]── BAT+ (sortie module)     │
        2×100 kΩ         │            └─[100kΩ]── GND                      │
                         │  VIN(5V)●──────────── +5V  (sortie alim §6)     │
                         │  GND    ●──────────── GND  (alim §6)            │
                         └────────────────────────────────────────────────┘
```

Points clés :
- **Une seule masse commune** (GND) reliant ESP32, NeoPixel, piézo, bouton, alim.
- Le bouton arcade a souvent **aussi une LED d'anneau** (5 V/12 V) : ici on s'en sert
  pas — c'est la **NeoPixel** placée derrière le **bouton transparent** qui fait
  l'indicateur couleur. (Tu peux laisser la LED d'anneau du bouton non câblée, ou la
  brancher en 5 V permanent si tu veux un halo fixe.)
- Condensateur 1000 µF (optionnel) entre **VCC et GND** près de la NeoPixel.

---

## 5. Impression 3D (boîtier)

> Aucun fichier STL n'est encore versionné dans le dépôt — voici le **cahier des
> charges** pour le modéliser (Fusion 360 / Tinkercad / OpenSCAD) ou le commander.

### Pièces à imprimer
1. **Corps / base cylindrique** : loge l'ESP32, le module de charge, le support
   18650 et l'interrupteur. Hauteur ~60–80 mm, Ø selon le bouton (≥ Ø bouton + 10 mm).
2. **Capot supérieur** : perçage central au **diamètre de montage du bouton arcade**
   (60 mm → trou Ø **~58–59 mm** ; 100 mm → Ø **~99 mm** ; vérifier la fiche du
   bouton). Le bouton se clipse/visse par sa bague.
3. **Découpe latérale USB-C** : fenêtre alignée sur le port du module de charge
   (pour brancher le câble sans ouvrir).
4. **Découpe interrupteur** : lumière pour l'**interrupteur du support 18650**.
5. **Supports internes** : bossages/clips pour l'ESP32 et le module, logement du
   support 18650.

### Réglages d'impression conseillés
| Paramètre | Valeur |
|---|---|
| Matière | **PETG** (robuste, on tape dessus) ou PLA |
| Hauteur de couche | 0,2 mm |
| Remplissage | **30–40 %** (le capot encaisse les coups) |
| Parois | 3 périmètres |
| Supports | seulement sous les surplombs (découpes) |
| Inserts | **inserts laiton M3 à chaud** pour visser le capot |

> Astuce : un **bouton « dôme » 100 mm** donne le ressenti « gros buzzer de plateau
> TV » ; le **60 mm** fait un boîtier plus compact et moins cher.

---

## 6. ⚠️ Alimentation — point important

Le firmware lit la batterie sur `GPIO34` et l'envoie en télémétrie. Mais **alimenter
proprement l'ESP32 avec un seul 18650 demande attention** :

- Un 18650 délivre **3,0 → 4,2 V**. Le régulateur 3,3 V embarqué de la carte (AMS1117)
  a un **dropout ~1 V** : injecté tel quel sur `VIN/5V`, le 3,3 V **décroche** quand
  l'accu descend (brownouts, WiFi instable).
- **Ne jamais** brancher l'accu directement sur la broche `3V3` (4,2 V > 3,3 V → casse).

### Schéma d'alimentation recommandé
```
USB-C ─▶ [TP4056 + protection] ─▶ [interrupteur du support] ─▶ [Boost MT3608 → 5,0 V] ─▶ VIN(5V) ESP32
              ▲ charge l'accu          (coupe tout)              (5 V stable)
        [ Accu 18650 dans le support ]
```
- **TP4056 USB-C** : charge l'accu **et** protège (sur/sous-tension). Bornes
  `B+/B-` → accu (support), `OUT+/OUT-` → reste du circuit.
- **Interrupteur** (celui du support 18650) en série sur `OUT+` → éteint le buzzer.
- **Boost MT3608** réglé sur **5,0 V** → `VIN/5V` de l'ESP32 : tension stable même
  accu faible. (Régler le potentiomètre **avant** de brancher l'ESP32, voltmètre.)
- Diviseur **2×100 kΩ** pris sur la tension **accu** (avant le boost) → `GPIO34`.

> ✅ **Plus simple** : remplace TP4056 + MT3608 par le **module combiné « charge 18650
> + boost 5 V USB-C »** (un seul circuit : USB-C en entrée, 5 V en sortie). On garde
> juste le support 18650 + interrupteur. C'est le montage le plus « plug & play ».

Réf. : [TP4056 USB-C avec protection](https://www.aliexpress.com/item/32930640893.html).

---

## 7. Téléversement du firmware (le code est déjà prêt ✅)

> Rien à coder : on **flashe** simplement `gbairai_buzzer.ino`. Détails complets dans
> [`README.md`](README.md). Résumé :

1. **Arduino IDE 2.x** → ajouter le support **ESP32** (Espressif) via l'URL de
   gestionnaire de cartes :
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. **Bibliothèques** (Gestionnaire de bibliothèques) :
   - **WiFiManager** (tzapu)
   - **WebSockets** (Links2004 / Markus Sattler)
   - **Adafruit NeoPixel**
3. Carte : **« ESP32 Dev Module »** + le bon **port** série.
4. Ouvrir `tools/firmware-esp32/gbairai_buzzer/gbairai_buzzer.ino` → **Téléverser**.
5. **Moniteur série 115200 bauds** → relève la **MAC** (sert à l'appairage).

Le serveur est **codé en dur** dans le `.ino` :
```c
const char*    GBAIRAI_HOST = "api.gbairai.robotechci.com";
const uint16_t GBAIRAI_PORT = 443;   // 443 → wss (TLS) ; 4000 → ws (LAN)
```
→ l'utilisateur ne saisit **que son Wi-Fi** au premier démarrage (captive portal
`Gbairai-Buzzer-XXXX`). Aucun réglage technique.

---

## 8. Mise en route & code couleur (rappel firmware)

**Flux :** boot → Wi-Fi (portail) → WebSocket → `buzzer_hello` → apparaît
**« À appairer »** dans **Mes buzzers** → on l'ajoute par sa **MAC** → l'hôte
l'attribue à un joueur → au lancement, le serveur **pilote la LED tout seul** → appui
= `buzz`.

| Couleur NeoPixel | État |
|---|---|
| 🔴 rouge sombre pulsé | hors ligne / déconnecté |
| ⚪ blanc pulsé | portail de configuration |
| 🟡 ambre pulsé | à appairer |
| 🟢 vert doux | prêt (en attente de partie) |
| 🔵 bleu pulsé | **armé — tu peux buzzer** |
| ⚪ flash blanc | appui détecté |
| 🟢 vert vif | gagné |
| 🔴 rouge | verrouillé |
| 🟠 orange | réponse révélée |

**Reset d'usine** : maintenir le bouton enfoncé **à la mise sous tension** → efface
Wi-Fi/config (clignotement rouge), rouvre le portail.

**Télémétrie / OTA** : batterie + RSSI toutes les 30 s ; mises à jour OTA poussées
depuis **Administration → Buzzers** (jamais en pleine partie). Voir [`README.md`](README.md) §8.

---

## 9. Récap « shopping list » express

```
1× ESP32 WROOM-32 (30 broches, USB-C)
1× Bouton arcade transparent 60 mm (ou dôme 100 mm) + microswitch
1× LED WS2812B (NeoPixel, 1 pixel)
1× Piézo PASSIF
1× Module charge 18650 USB-C (TP4056 + protection)   ┐ ou 1× module combiné
1× Boost MT3608 (réglé 5 V)                           ┘ « charge + boost 5 V USB-C »
1× Support 18650 (1 slot) avec interrupteur
1× Accu 18650 (marque sérieuse, 2600 mAh)
Résistances : 2×100 kΩ + 1×330 Ω   |   1× condo 1000 µF (option)
Fil silicone + visserie M3 + filament PETG
```

→ ~15–22 $/buzzer. **Firmware déjà prêt** : il ne reste qu'à imprimer le boîtier,
câbler selon §3/§4, alimenter selon §6 et **téléverser** (§7).
