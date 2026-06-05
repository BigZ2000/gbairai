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
#include <HTTPUpdate.h>           // OTA (mise à jour par HTTP)
#include <WiFiClient.h>

// ── Brochage (adapter selon ton câblage) ────────────────────────────────────
#define BUTTON_PIN   13          // bouton arcade entre GPIO13 et GND
#define LED_PIN      5           // entrée DATA d'une LED WS2812 (NeoPixel)
#define LED_COUNT    1
#define BUZZER_PIN   12          // piézo (sortie son) — mêmes déclencheurs que le simulateur
#define BATTERY_PIN  34          // mesure batterie via pont diviseur (entrée ADC)
#define FIRMWARE_VERSION "esp32-1.0"
#define TELEMETRY_MS 30000UL     // télémétrie toutes les 30 s

// ── Objets globaux ──────────────────────────────────────────────────────────
WebSocketsClient webSocket;
Adafruit_NeoPixel pixel(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
Preferences prefs;

String gMac;                      // "AA:BB:CC:DD:EE:FF"
String gServerHost = "192.168.1.10";
uint16_t gServerPort = 4000;
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

void renderLed() {
  uint32_t now = millis();
  // Flash blanc prioritaire (retour tactile immédiat à l'appui).
  if (now < gFlashUntil) { pixel.setPixelColor(0, rgb(255, 255, 255)); pixel.show(); return; }

  // Respiration : 0..255 sinusoïdal lent.
  float phase = (sin(now / 350.0) + 1.0) / 2.0;     // 0..1
  uint8_t breath = 40 + (uint8_t)(phase * 180);

  switch (gLed) {
    case L_OFFLINE:  pixel.setPixelColor(0, rgb(breath/3, 0, 0)); break;            // rouge sombre lent
    case L_PORTAL:   pixel.setPixelColor(0, rgb(breath, breath, breath)); break;    // blanc pulsé (config)
    case L_AWAITING: pixel.setPixelColor(0, rgb(breath, (uint8_t)(breath*0.7), 0)); break; // ambre pulsé
    case L_READY:    pixel.setPixelColor(0, rgb(10, 40, 20)); break;                // vert très doux (prêt)
    case L_ARMED:    pixel.setPixelColor(0, rgb(0, (uint8_t)(breath*0.5), breath)); break;  // bleu pulsé
    case L_WINNER:   pixel.setPixelColor(0, rgb(0, 220, 60)); break;                // vert vif
    case L_LOCKED:   pixel.setPixelColor(0, rgb(160, 0, 0)); break;                 // rouge
    case L_REVEAL:   pixel.setPixelColor(0, rgb(230, 140, 0)); break;               // orange
    case L_PRESSED:  pixel.setPixelColor(0, rgb(255, 255, 255)); break;
  }
  pixel.show();
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
  String m = "{\"type\":\"buzzer_hello\",\"mac\":\"" + gMac + "\",\"firmware\":\"" + FIRMWARE_VERSION + "\"}";
  webSocket.sendTXT(m);
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
void doOta(const String& url) {
  if (url.isEmpty() || inGame()) return;
  Serial.printf("[OTA] mise à jour depuis %s\n", url.c_str());
  gLed = L_PORTAL;                          // LED blanche pulsée pendant la MAJ
  httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return ret = httpUpdate.update(gOtaClient, url);
  if (ret == HTTP_UPDATE_FAILED)
    Serial.printf("[OTA] échec (%d) %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
  // En cas de succès, l'ESP32 redémarre automatiquement sur le nouveau firmware.
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
        doOta(jsonField(p, "\"url\":\""));
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
      gFlashUntil = now + 180;                      // flash blanc local immédiat
      sndPress();
      if (gConnected) { sendBuzz(); Serial.println("→ BUZZ"); }
    }
  }
}

// ============================================================================
//  Configuration Wi-Fi + serveur (captive portal)
// ============================================================================
void loadConfig() {
  prefs.begin("gbairai", true);
  gServerHost = prefs.getString("host", gServerHost);
  gServerPort = prefs.getUShort("port", gServerPort);
  prefs.end();
}
void saveConfig(const String& host, uint16_t port) {
  prefs.begin("gbairai", false);
  prefs.putString("host", host);
  prefs.putUShort("port", port);
  prefs.end();
}

void startPortalIfNeeded() {
  WiFiManager wm;
  // Paramètres personnalisés : adresse IP et port du serveur Gbairai.
  // Serveur : IP en LAN (port 4000) OU domaine en prod cloud (port 443 = wss auto).
  WiFiManagerParameter pHost("host", "Serveur (IP ou domaine)", gServerHost.c_str(), 64);
  WiFiManagerParameter pPort("port", "Port (4000 LAN / 443 cloud)", String(gServerPort).c_str(), 6);
  wm.addParameter(&pHost);
  wm.addParameter(&pPort);

  gLed = L_PORTAL;
  // Nom du point d'accès de configuration : "Gbairai-Buzzer-XXXX".
  String ap = "Gbairai-Buzzer-" + gMac.substring(gMac.length() - 5);
  ap.replace(":", "");
  // autoConnect : reconnecte au Wi-Fi connu, sinon ouvre le portail (bloquant).
  wm.setConfigPortalTimeout(180);                   // 3 min puis re-tentative
  if (!wm.autoConnect(ap.c_str())) {
    Serial.println("[WiFi] échec portail → redémarrage");
    delay(2000); ESP.restart();
  }
  // Sauvegarde des paramètres serveur saisis dans le portail.
  String host = pHost.getValue();
  uint16_t port = (uint16_t) String(pPort.getValue()).toInt();
  if (host.length()) gServerHost = host;
  if (port) gServerPort = port;
  saveConfig(gServerHost, gServerPort);
  Serial.printf("[WiFi] connecté. Serveur = %s:%u\n", gServerHost.c_str(), gServerPort);
}

// Reset d'usine : bouton maintenu enfoncé au démarrage → efface Wi-Fi + config.
void maybeFactoryReset() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("[RESET] bouton maintenu → effacement Wi-Fi/config");
    WiFiManager wm; wm.resetSettings();
    prefs.begin("gbairai", false); prefs.clear(); prefs.end();
    // clignotement rouge de confirmation
    for (int i = 0; i < 6; i++) { pixel.setPixelColor(0, rgb(180,0,0)); pixel.show(); delay(120);
                                  pixel.setPixelColor(0, 0); pixel.show(); delay(120); }
    ESP.restart();
  }
}

// ============================================================================
//  Setup / Loop
// ============================================================================
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pixel.begin(); pixel.setBrightness(160); pixel.show();

  gMac = WiFi.macAddress();           // "AA:BB:CC:DD:EE:FF" (majuscules)
  gMac.toUpperCase();
  Serial.printf("\nGbairai Buzzer — MAC %s\n", gMac.c_str());

  maybeFactoryReset();                // reset d'usine si bouton tenu au boot
  loadConfig();
  startPortalIfNeeded();              // Wi-Fi (captive portal au 1er démarrage)

  // Connexion WebSocket au serveur (chemin "/" — le serveur accepte tout chemin).
  // Port 443 → WSS (TLS, prod cloud) ; sinon WS clair (LAN). Sur ESP32, beginSSL
  // sans CA chiffre la liaison sans valider le certificat (suffisant ici ;
  // durcissement futur = épingler la CA Let's Encrypt via beginSslWithCA).
  if (gServerPort == 443) {
    Serial.println("[WS] liaison sécurisée (wss)");
    webSocket.beginSSL(gServerHost.c_str(), gServerPort, "/");
  } else {
    webSocket.begin(gServerHost.c_str(), gServerPort, "/");
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
