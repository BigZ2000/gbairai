/* ============================================================================
 *  GBAIRAI — Firmware Buzzer ESP32
 * ----------------------------------------------------------------------------
 *  Parle EXACTEMENT le même protocole que le simulateur (tools/buzzer-simulator) :
 *
 *   Montant (device → serveur) :
 *     { "type":"buzzer_hello", "mac":"AA:BB:CC:DD:EE:FF", "firmware":"esp32-1.0" }
 *     { "type":"buzz", "source":"device", "mac":"AA:BB:CC:DD:EE:FF" }
 *
 *   Descendant (serveur → device) — pilote la LED :
 *     { "type":"awaiting_claim" }                       → à appairer
 *     { "type":"pairing_success" }                      → appairé
 *     { "type":"led", "state":"armed|winner|locked|reveal|idle" }
 *
 *  Le buzzer ne connaît NI le code de la partie, NI de room : le serveur résout
 *  tout via l'attribution et lui pousse l'état de sa LED.
 *
 *  Dépendances (Arduino Library Manager) :
 *     - WiFiManager            (tzapu)            → captive portal Wi-Fi
 *     - WebSockets             (Markus Sattler / links2004)
 *     - Adafruit NeoPixel      (LED RGB d'état)
 *
 *  Carte : "ESP32 Dev Module" (esp32 by Espressif).
 * ========================================================================== */

#include <WiFi.h>
#include <WiFiManager.h>          // https://github.com/tzapu/WiFiManager
#include <WebSocketsClient.h>     // https://github.com/Links2004/arduinoWebSockets
#include <Adafruit_NeoPixel.h>
#include <Preferences.h>
#include <HTTPUpdate.h>           // OTA (mise à jour par HTTP/HTTPS)
#include <WiFiClient.h>
#include <WiFiClientSecure.h>     // OTA en HTTPS (binaire servi par le serveur Gbairai)

// ── Brochage (adapter selon ton câblage) ────────────────────────────────────
// Bouton arcade 4 broches : COM + NO = microswitch, LED+ / LED− = anneau lumineux.
//   COM → GND            |  NO → GPIO13 (BUTTON_PIN, INPUT_PULLUP)
//   LED− → GND           |  LED+ → via transistor commandé par GPIO14 (voir §Câblage)
// ⚠️ La LED de l'anneau (5 V, souvent 20–40 mA) ne doit JAMAIS être branchée en
// direct sur un GPIO (3,3 V / 12 mA conseillés) : passer par un transistor
// (NPN 2N2222 / BC547, ou MOSFET 2N7000) en commutation « côté bas ».
#define BUTTON_PIN     13        // microswitch : NO → GPIO13, COM → GND
#define BUTTON_LED_PIN 14        // anneau du bouton (via transistor). -1 pour désactiver.
#define LED_PIN        5         // entrée DATA d'une LED WS2812 (NeoPixel)
#define LED_COUNT      7
#define BUZZER_PIN     12        // piézo (sortie son) — mêmes déclencheurs que le simulateur
#define BATTERY_PIN    34        // mesure batterie via pont diviseur (entrée ADC)
#define FIRMWARE_VERSION "esp32-1.3"
#define TELEMETRY_MS 30000UL     // télémétrie toutes les 30 s

// Canaux PWM (LEDC) — le piézo utilise tone() qui réserve le canal 0.
#define BTN_LED_CHANNEL 4
#define BTN_LED_FREQ    5000
#define BTN_LED_RES     8        // 8 bits → 0..255

// Reset d'usine par appui long EN FONCTIONNEMENT (plus découvrable que le
// « bouton tenu au démarrage », qui reste supporté).
#define LONG_PRESS_RESET_MS 10000UL

// ── Objets globaux ──────────────────────────────────────────────────────────
WebSocketsClient webSocket;
Adafruit_NeoPixel pixel(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
Preferences prefs;

String gMac;                      // "AA:BB:CC:DD:EE:FF"
// Serveur Gbairai CODÉ EN DUR : l'utilisateur ne saisit QUE son Wi-Fi (plug & play,
// zéro réglage technique). Déploiement LAN/dev : remplacer ces 2 valeurs puis
// reflasher (ex. "192.168.1.10" / 4000 → liaison ws:// claire).
const char*    GBAIRAI_HOST = "api.gbairai.robotechci.com";
const uint16_t GBAIRAI_PORT = 443;   // 443 → wss (TLS) auto ; 4000 → ws (LAN)
bool gConnected = false;

// ── États de LED (miroir exact du simulateur) ───────────────────────────────
enum LedState { L_OFFLINE, L_PORTAL, L_AWAITING, L_READY, L_ARMED, L_WINNER, L_LOCKED, L_REVEAL, L_PRESSED };
LedState  gLed = L_OFFLINE;
uint32_t  gFlashUntil = 0;        // flash blanc local lors de l'appui

// ── Anti-rebond bouton ──────────────────────────────────────────────────────
int  gLastBtn = HIGH;
uint32_t gLastBtnMs = 0;

// ── Télémétrie ──────────────────────────────────────────────────────────────
uint32_t gLastTelemetryMs = 0;
WiFiClient gOtaClient;

// Vrai si CE boot suit un reset d'usine (bouton tenu OU commande serveur) —
// lu une fois depuis les prefs au démarrage, annoncé au hello puis consommé.
bool gJustFactoryReset = false;

// Appui long en fonctionnement (reset d'usine) : instant du début d'appui.
uint32_t gPressStartMs = 0;
// Progression OTA (0..100, -1 = pas de MAJ en cours) → retour visuel dédié.
int gOtaProgress = -1;

bool inGame() { return gLed == L_ARMED || gLed == L_WINNER || gLed == L_LOCKED || gLed == L_REVEAL; }

// Niveau de batterie en % (à calibrer selon ton pont diviseur).
// Hypothèse : pont /2, LiPo 3,3 V (0 %) → 4,2 V (100 %).
int readBatteryPercent() {
  uint32_t raw = 0;
  for (int i = 0; i < 8; i++) raw += analogRead(BATTERY_PIN);
  float v = (raw / 8.0) / 4095.0 * 3.3 * 2.0;        // tension batterie estimée
  int pct = (int)((v - 3.3) / (4.2 - 3.3) * 100.0);
  return constrain(pct, 0, 100);
}

// ============================================================================
//  LED : rendu non-bloquant (animations via millis())
// ============================================================================
uint32_t rgb(uint8_t r, uint8_t g, uint8_t b) { return pixel.Color(r, g, b); }

// Applique une couleur à TOUT le bandeau (LED_COUNT pixels) puis rafraîchit.
// ⚠️ Ne jamais adresser le seul pixel 0 : avec un bandeau, les autres resteraient
// éteints (leur tampon vaut 0). Tous les rendus passent par ici.
void setAll(uint32_t color) {
  for (uint16_t i = 0; i < LED_COUNT; i++) pixel.setPixelColor(i, color);
  pixel.show();
}

// Anneau lumineux du bouton arcade (LED simple, donc uniquement une intensité).
// Piloté en PWM pour reproduire les mêmes rythmes que la NeoPixel : le joueur
// voit le BOUTON lui-même s'allumer, ce qui est bien plus lisible à distance.
// NB : l'API LEDC diffère entre les cores ESP32 2.x (canal) et 3.x (broche).
// La garde ci-dessous évite une casse silencieuse si le core est mis à jour.
void setButtonLed(uint8_t level) {
#if BUTTON_LED_PIN >= 0
  #if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(BUTTON_LED_PIN, level);
  #else
    ledcWrite(BTN_LED_CHANNEL, level);
  #endif
#endif
}

void renderLed() {
  uint32_t now = millis();

  // Mise à jour OTA en cours : priorité absolue, la barre de progression se lit
  // sur l'intensité de l'anneau et la NeoPixel passe en bleu clignotant.
  if (gOtaProgress >= 0) {
    // Le bandeau se remplit au fil du téléchargement : N pixels allumés sur 7.
    uint16_t remplis = (uint16_t)((uint32_t)gOtaProgress * LED_COUNT / 100);
    for (uint16_t i = 0; i < LED_COUNT; i++)
      pixel.setPixelColor(i, i < remplis ? rgb(0, 80, 255) : rgb(0, 8, 30));
    pixel.show();
    setButtonLed((uint8_t)(gOtaProgress * 255 / 100)); // l'anneau suit aussi la progression
    return;
  }

  // Flash blanc prioritaire (retour tactile immédiat à l'appui).
  if (now < gFlashUntil) {
    setAll(rgb(255, 255, 255));
    setButtonLed(255);
    return;
  }

  // Respiration : 0..255 sinusoïdal lent.
  float phase = (sin(now / 350.0) + 1.0) / 2.0;     // 0..1
  uint8_t breath = 40 + (uint8_t)(phase * 180);

  // L'anneau reprend le rythme de l'état courant (allumé/pulsé/éteint).
  switch (gLed) {
    case L_OFFLINE:  setButtonLed(breath / 6); break;   // très faible, respire
    case L_PORTAL:   setButtonLed(breath); break;       // pulse franchement (à configurer)
    case L_AWAITING: setButtonLed(breath); break;       // pulse (à appairer)
    case L_READY:    setButtonLed(30); break;           // veilleuse discrète
    case L_ARMED:    setButtonLed(255); break;          // PLEIN FEU : « tu peux buzzer »
    case L_WINNER:   setButtonLed(255); break;
    case L_LOCKED:   setButtonLed(0); break;            // éteint : verrouillé
    case L_REVEAL:   setButtonLed(120); break;
    case L_PRESSED:  setButtonLed(255); break;
  }

  switch (gLed) {
  // Couleurs calibrées pour rester DISTINCTES à la luminosité réduite d'un
  // bandeau (90/255) : les états volontairement discrets (prêt, hors ligne)
  // étaient quasi invisibles avec les anciennes valeurs très basses.
  switch (gLed) {
    case L_OFFLINE:  setAll(rgb(breath/2, 0, 0)); break;                            // rouge sombre pulsé
    case L_PORTAL:   setAll(rgb(breath, breath, breath)); break;                    // blanc pulsé (config)
    case L_AWAITING: setAll(rgb(breath, (uint8_t)(breath*0.55), 0)); break;         // ambre pulsé
    case L_READY:    setAll(rgb(0, 90, 35)); break;                                 // vert doux stable (prêt)
    case L_ARMED:    setAll(rgb(0, (uint8_t)(breath*0.45), breath)); break;         // bleu pulsé
    case L_WINNER:   setAll(rgb(0, 235, 70)); break;                                // vert vif
    case L_LOCKED:   setAll(rgb(190, 0, 0)); break;                                 // rouge franc
    case L_REVEAL:   setAll(rgb(245, 130, 0)); break;                               // orange
    case L_PRESSED:  setAll(rgb(255, 255, 255)); break;
  }
}

// ── Son piézo (mêmes déclencheurs que le simulateur Web Audio) ──────────────
// `tone(pin, freq, durée)` (Arduino-ESP32) ; non bloquant pour des bips courts.
void sndBeep(int freq, int dur) { tone(BUZZER_PIN, freq, dur); }
void sndConnect() { sndBeep(660, 90); }
void sndAwaiting(){ sndBeep(500, 90); }
void sndPaired()  { sndBeep(700, 90); delay(110); sndBeep(950, 130); }
void sndArmed()   { sndBeep(880, 60); }
void sndWinner()  { sndBeep(660,140); delay(120); sndBeep(880,140); delay(120); sndBeep(1175,180); }
void sndLocked()  { sndBeep(160, 260); }
void sndReveal()  { sndBeep(520, 180); }
void sndPress()   { sndBeep(1000, 50); }

void playSoundForState(LedState s) {
  switch (s) {
    case L_ARMED:  sndArmed();  break;
    case L_WINNER: sndWinner(); break;
    case L_LOCKED: sndLocked(); break;
    case L_REVEAL: sndReveal(); break;
    default: break;
  }
}

void setLedFromState(const String& s) {
  if      (s == "armed")  gLed = L_ARMED;
  else if (s == "winner") gLed = L_WINNER;
  else if (s == "locked") gLed = L_LOCKED;
  else if (s == "reveal") gLed = L_REVEAL;
  else                    gLed = L_READY;   // 'idle' ou inconnu
}

// ============================================================================
//  Parsing minimal des messages (forme fixe → pas besoin d'ArduinoJson)
// ============================================================================
bool jsonHas(const char* p, const char* needle) { return strstr(p, needle) != nullptr; }

// Extrait la valeur texte d'une clé, ex. jsonField(p, "\"state\":\"").
String jsonField(const char* p, const char* keyQuoted) {
  const char* k = strstr(p, keyQuoted);
  if (!k) return "";
  k += strlen(keyQuoted);
  const char* end = strchr(k, '"');
  if (!end) return "";
  return String(k).substring(0, end - k);
}

// ============================================================================
//  Envois
// ============================================================================
void sendHello() {
  // Signale au serveur que ce boot suit un reset d'usine (traçabilité admin) —
  // annoncé une seule fois, puis on ne le répète pas aux hello suivants.
  String m = "{\"type\":\"buzzer_hello\",\"mac\":\"" + gMac + "\",\"firmware\":\"" + FIRMWARE_VERSION + "\""
             + (gJustFactoryReset ? ",\"resetReason\":\"factory\"" : "") + "}";
  webSocket.sendTXT(m);
  gJustFactoryReset = false;
}
void sendBuzz() {
  String m = "{\"type\":\"buzz\",\"source\":\"device\",\"mac\":\"" + gMac + "\"}";
  webSocket.sendTXT(m);
}
void sendTelemetry() {
  if (!gConnected) return;
  String m = "{\"type\":\"device_telemetry\",\"mac\":\"" + gMac + "\",\"battery\":" +
             String(readBatteryPercent()) + ",\"rssi\":" + String(WiFi.RSSI()) + "}";
  webSocket.sendTXT(m);
}

// Mise à jour OTA : télécharge et flashe le firmware depuis l'URL fournie.
// Refusée en cours de partie (on ne coupe jamais un buzzer en plein jeu).
// Remonte au serveur le résultat d'une MAJ (journalisé côté admin).
void sendOtaResult(bool ok, const String& version, const String& err) {
  String m = "{\"type\":\"ota_result\",\"mac\":\"" + gMac + "\",\"ok\":" + (ok ? "true" : "false")
             + ",\"version\":\"" + version + "\"";
  if (!ok) { String e = err; e.replace("\"", "'"); m += ",\"error\":\"" + e + "\""; }
  m += "}";
  webSocket.sendTXT(m);
  webSocket.loop();       // laisse la trame partir avant un éventuel redémarrage
  delay(120);
}

// Mise à jour OTA. Supporte HTTP **et HTTPS** : le binaire est servi par le
// serveur Gbairai lui-même (https://<host>/uploads/firmware/xxx.bin), donc une
// liaison TLS est indispensable — l'ancien WiFiClient simple échouait sur https.
// TLS sans validation de CA (setInsecure) : le flux est chiffré ; l'intégrité est
// garantie par le contrôle de somme/magic byte du bootloader ESP32.
void doOta(const String& url, const String& version) {
  if (url.isEmpty() || inGame()) return;
  Serial.printf("[OTA] mise à jour depuis %s\n", url.c_str());

  gOtaProgress = 0;                          // active le retour visuel dédié
  renderLed();

  httpUpdate.rebootOnUpdate(false);          // on veut rendre compte AVANT de redémarrer
  httpUpdate.onProgress([](int cur, int total) {
    if (total > 0) gOtaProgress = (cur * 100) / total;
    renderLed();                             // barre de progression sur l'anneau
  });

  t_httpUpdate_return ret;
  if (url.startsWith("https://")) {
    WiFiClientSecure secure;
    secure.setInsecure();                    // pas d'épinglage de CA sur l'appareil
    secure.setTimeout(20000);
    ret = httpUpdate.update(secure, url);
  } else {
    ret = httpUpdate.update(gOtaClient, url);
  }

  gOtaProgress = -1;

  if (ret == HTTP_UPDATE_OK) {
    Serial.println("[OTA] succès → redémarrage");
    sendOtaResult(true, version, "");
    // 3 clignotements verts : succès visible sans câble série.
    for (int i = 0; i < 3; i++) { setAll(rgb(0, 220, 60)); setButtonLed(255); delay(150);
                                  setAll(0); setButtonLed(0); delay(150); }
    ESP.restart();
  } else {
    String err = httpUpdate.getLastErrorString();
    Serial.printf("[OTA] échec (%d) %s\n", httpUpdate.getLastError(), err.c_str());
    sendOtaResult(false, version, err);
    // 3 clignotements rouges : échec identifiable d'un coup d'œil.
    for (int i = 0; i < 3; i++) { setAll(rgb(200, 0, 0)); delay(150);
                                  setAll(0); delay(150); }
  }
}

// ============================================================================
//  Évènements WebSocket
// ============================================================================
void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      gConnected = true;
      gLed = L_READY;
      sendHello();                              // annonce de l'appareil au boot
      sendTelemetry();                          // 1re télémétrie immédiate
      sndConnect();
      Serial.println("[WS] connecté → buzzer_hello");
      break;

    case WStype_DISCONNECTED:
      gConnected = false;
      gLed = L_OFFLINE;
      Serial.println("[WS] déconnecté");
      break;

    case WStype_TEXT: {
      const char* p = (const char*)payload;
      if (jsonHas(p, "\"awaiting_claim\""))       { gLed = L_AWAITING; sndAwaiting(); Serial.println("[WS] à appairer"); }
      else if (jsonHas(p, "\"pairing_success\"")) { gLed = L_READY;    sndPaired();   Serial.println("[WS] appairé"); }
      else if (jsonHas(p, "\"type\":\"led\"")) {
        String s = jsonField(p, "\"state\":\"");
        setLedFromState(s);
        playSoundForState(gLed);
        Serial.printf("[WS] led ← %s\n", s.c_str());
      }
      else if (jsonHas(p, "\"type\":\"ota\"")) {  // mise à jour proposée par le serveur
        doOta(jsonField(p, "\"url\":\""), jsonField(p, "\"version\":\""));
      }
      else if (jsonHas(p, "\"type\":\"factory_reset\"")) { // reset distant (admin)
        Serial.println("[WS] reset d'usine demandé par le serveur");
        doFactoryReset();
      }
      break;
    }
    default: break;
  }
}

// ============================================================================
//  Bouton (anti-rebond + front descendant)
// ============================================================================
void handleButton() {
  int b = digitalRead(BUTTON_PIN);
  uint32_t now = millis();
  if (b != gLastBtn && (now - gLastBtnMs) > 40) {   // 40 ms de debounce
    gLastBtnMs = now;
    gLastBtn = b;
    if (b == LOW) {                                 // appui (pull-up → LOW = pressé)
      gPressStartMs = now;                          // départ du chrono d'appui long
      gFlashUntil = now + 180;                      // flash blanc local immédiat
      sndPress();
      if (gConnected) { sendBuzz(); Serial.println("→ BUZZ"); }
    } else {
      gPressStartMs = 0;                            // relâché avant le seuil → rien
    }
  }

  // Reset d'usine par APPUI LONG (10 s) en fonctionnement : bien plus découvrable
  // que « tenir le bouton au démarrage ». L'anneau et la NeoPixel virent au rouge
  // pendant le décompte, pour que l'utilisateur comprenne ce qui va se passer.
  if (gPressStartMs && b == LOW) {
    uint32_t held = now - gPressStartMs;
    if (held > 3000) {                              // à partir de 3 s : avertissement visuel
      bool tick = (now / 150) % 2;
      setAll(tick ? rgb(220, 0, 0) : rgb(20, 0, 0));
      setButtonLed(tick ? 255 : 0);
    }
    if (held >= LONG_PRESS_RESET_MS) {
      Serial.println("[RESET] appui long → reset d'usine");
      doFactoryReset();                             // efface, puis redémarre
    }
  }
}

// ============================================================================
//  Configuration Wi-Fi + serveur (captive portal)
// ============================================================================
void startPortalIfNeeded() {
  WiFiManager wm;
  // Le portail ne demande QUE le Wi-Fi (SSID + mot de passe). Le serveur Gbairai
  // est codé en dur (GBAIRAI_HOST/PORT) → aucune saisie technique pour l'utilisateur.
  gLed = L_PORTAL;
  // ⚠️ autoConnect()/startConfigPortal() sont BLOQUANTS : loop() — et donc
  // renderLed() — ne tourne pas tant que le Wi-Fi n'est pas configuré. Sans le
  // rendu explicite ci-dessous, le bandeau restait ÉTEINT pendant toute la
  // configuration (le « blanc pulsé » n'apparaissait jamais). On allume donc en
  // blanc fixe avant de bloquer, et on le ré-affirme quand le point d'accès
  // démarre réellement (setAPCallback), seul moment où WiFiManager nous rend la main.
  setAll(rgb(255, 255, 255));
  setButtonLed(255);

  // Nom du point d'accès de configuration : "Gbairai-Buzzer-XXXX".
  String ap = "Gbairai-Buzzer-" + gMac.substring(gMac.length() - 5);
  ap.replace(":", "");
  wm.setConfigPortalTimeout(180);                   // 3 min puis re-tentative
  wm.setAPCallback([](WiFiManager*) {               // le portail vient de s'ouvrir
    Serial.println("[WiFi] portail ouvert → connecte-toi au Wi-Fi Gbairai-Buzzer-…");
    setAll(rgb(255, 255, 255));
    setButtonLed(255);
  });

  // Drapeau posé par doFactoryReset() : garantit l'ouverture du portail même si
  // l'effacement des identifiants Wi-Fi (NVS) avait échoué silencieusement —
  // bug connu de certaines combinaisons ESP32 core / WiFiManager où resetSettings()
  // ne prend pas effet si le pilote Wi-Fi n'était pas déjà démarré au moment du reset.
  prefs.begin("gbairai", false);
  bool forcePortal = prefs.getBool("force_portal", false);
  prefs.end();
  gJustFactoryReset = forcePortal;

  bool ok;
  if (forcePortal) {
    Serial.println("[WiFi] reset récent → portail forcé (identifiants connus ignorés)");
    ok = wm.startConfigPortal(ap.c_str());
  } else {
    // autoConnect : reconnecte au Wi-Fi connu, sinon ouvre le portail (bloquant).
    ok = wm.autoConnect(ap.c_str());
  }
  if (!ok) {
    // Le drapeau n'est PAS consommé ici : si l'utilisateur n'a pas eu le temps de
    // configurer (ou coupe le courant), le prochain boot rouvrira bien le portail.
    Serial.println("[WiFi] échec portail → redémarrage");
    delay(2000); ESP.restart();
  }

  // Configuration réussie → on peut consommer le drapeau en toute sécurité.
  if (forcePortal) {
    prefs.begin("gbairai", false);
    prefs.putBool("force_portal", false);
    prefs.end();
  }

  // EXTINCTION EXPLICITE DU POINT D'ACCÈS. WiFiManager laisse parfois la carte en
  // mode AP_STA après une configuration réussie : le réseau « Gbairai-Buzzer-XXXX »
  // resterait alors visible et connectable en permanence (confusion pour les
  // joueurs, et surface d'attaque inutile). On force donc le mode station seule.
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);

  Serial.printf("[WiFi] connecté (%s) — point d'accès éteint. Serveur = %s:%u\n",
                WiFi.localIP().toString().c_str(), GBAIRAI_HOST, GBAIRAI_PORT);
}

// Effacement Wi-Fi + config puis redémarrage (rouvre le portail au reboot).
// Appelé soit par le bouton tenu au boot, soit par la commande serveur (admin).
void doFactoryReset() {
  Serial.println("[RESET] effacement Wi-Fi/config");

  // Ceinture ET bretelles : sur certaines combinaisons ESP32 core / WiFiManager,
  // wm.resetSettings() seul peut échouer à effacer les identifiants en NVS si le
  // pilote Wi-Fi n'a pas encore été démarré à cet instant (ex. reset physique au
  // tout premier boot). On force explicitement le driver puis l'effacement NVS
  // AVANT d'appeler resetSettings(), qui repasse derrière en confirmation.
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);        // (wifioff, eraseAP) → efface les identifiants NVS
  delay(300);
  WiFiManager wm; wm.resetSettings();
  delay(200);

  // Drapeau "portail forcé" : même si l'effacement ci-dessus échouait malgré
  // tout, le prochain boot ouvrira le portail sans tenter l'ancien Wi-Fi.
  prefs.begin("gbairai", false);
  prefs.clear();
  prefs.putBool("force_portal", true);
  prefs.end();

  // clignotement rouge de confirmation
  for (int i = 0; i < 6; i++) { setAll(rgb(180,0,0)); delay(120);
                                setAll(0); delay(120); }
  ESP.restart();
}

// Reset d'usine : bouton maintenu enfoncé au démarrage → efface Wi-Fi + config.
void maybeFactoryReset() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("[RESET] bouton maintenu au boot");
    doFactoryReset();
  }
}

// ============================================================================
//  Setup / Loop
// ============================================================================
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  // Luminosité volontairement modérée : une WS2812 tire ~60 mA en blanc plein.
  // Avec LED_COUNT=7 cela ferait ~420 mA — bien trop pour la broche 3V3 de la
  // carte, surtout pendant les pics d'émission Wi-Fi (risque de brownout/reset).
  // À 90/255 on plafonne autour de ~150 mA, ce qui reste sûr. Si tu alimentes le
  // bandeau en 5 V (VIN) avec sa propre masse, tu peux remonter jusqu'à 160–255.
  pixel.begin(); pixel.setBrightness(LED_COUNT > 1 ? 90 : 160); pixel.show();

  // Anneau lumineux du bouton arcade (4 broches) piloté en PWM via transistor.
#if BUTTON_LED_PIN >= 0
  #if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(BUTTON_LED_PIN, BTN_LED_FREQ, BTN_LED_RES);
  #else
    ledcSetup(BTN_LED_CHANNEL, BTN_LED_FREQ, BTN_LED_RES);
    ledcAttachPin(BUTTON_LED_PIN, BTN_LED_CHANNEL);
  #endif
  setButtonLed(0);
#endif

  gMac = WiFi.macAddress();           // "AA:BB:CC:DD:EE:FF" (majuscules)
  gMac.toUpperCase();
  Serial.printf("\nGbairai Buzzer — MAC %s\n", gMac.c_str());

  maybeFactoryReset();                // reset d'usine si bouton tenu au boot
  startPortalIfNeeded();              // Wi-Fi (captive portal au 1er démarrage)

  // Connexion WebSocket au serveur codé en dur (chemin "/" — le serveur accepte tout chemin).
  // Port 443 → WSS (TLS, prod cloud) ; sinon WS clair (LAN). Sur ESP32, beginSSL
  // sans CA chiffre la liaison sans valider le certificat (suffisant ici ;
  // durcissement futur = épingler la CA Let's Encrypt via beginSslWithCA).
  if (GBAIRAI_PORT == 443) {
    Serial.println("[WS] liaison sécurisée (wss)");
    webSocket.beginSSL(GBAIRAI_HOST, GBAIRAI_PORT, "/");
  } else {
    webSocket.begin(GBAIRAI_HOST, GBAIRAI_PORT, "/");
  }
  webSocket.onEvent(onWsEvent);
  webSocket.setReconnectInterval(3000);   // reconnexion auto toutes les 3 s
  webSocket.enableHeartbeat(15000, 3000, 2);
}

void loop() {
  webSocket.loop();
  handleButton();
  renderLed();
  // Télémétrie périodique (batterie + signal Wi-Fi).
  if (millis() - gLastTelemetryMs > TELEMETRY_MS) { gLastTelemetryMs = millis(); sendTelemetry(); }
}
