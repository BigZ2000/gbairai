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

// Une note du séquenceur audio. freq = 0 → silence (articulation entre deux notes).
// Défini ici, avant toute fonction, pour que les prototypes générés par Arduino
// (qui référencent `const Note*`) voient bien le type.
struct Note { uint16_t freq; uint16_t ms; };
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
uint8_t  gLastResetTickSec = 0;   // dernière seconde « tictée » du décompte sonore
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

// ============================================================================
//  MOTEUR DE TRANSITION — « rien ne claque »
// ----------------------------------------------------------------------------
//  Trois couches composées à chaque image :
//    1. COULEUR CIBLE de l'état (avec sa respiration propre)
//    2. FONDU depuis la couleur RÉELLEMENT AFFICHÉE au moment du changement,
//       avec une durée et une courbe choisies selon l'INTENTION de l'état
//       (le verrouillage retombe, la victoire éclôt, le repos se pose).
//    3. ACCENT synchronisé au son : la mélodie et le changement d'état partent
//       au même instant, donc chronométrer depuis gStateSince suffit à faire
//       « frapper » la lumière exactement sur la note.
// ============================================================================

// ── Courbes d'accélération ──────────────────────────────────────────────────
float easeOutCubic (float t) { float u = 1.0f - t; return 1.0f - u * u * u; }   // arrivée franche
float easeInCubic  (float t) { return t * t * t; }                              // départ mou, chute
float easeInOutCubic(float t) { return t < 0.5f ? 4*t*t*t : 1 - powf(-2*t + 2, 3) / 2; }
float smoothstep   (float t) { return t * t * (3.0f - 2.0f * t); }

// Respiration perceptuelle. Une rampe linéaire paraît saccadée car l'œil perçoit
// la luminosité de façon logarithmique : la puissance ci-dessous creuse les bas
// et rend le souffle organique. `periode` en ms (plus long = plus calme/premium).
float breathe(uint32_t now, uint16_t periode) {
  float phase = (sinf(6.2832f * (now % periode) / (float)periode) + 1.0f) * 0.5f;
  return powf(phase, 1.7f);
}

// Durée du fondu selon l'intention de l'état.
uint16_t transitionMs(LedState s) {
  switch (s) {
    case L_ARMED:   return 130;   // assertif : on doit sentir l'ordre « à toi »
    case L_WINNER:  return 260;   // éclosion
    case L_LOCKED:  return 420;   // on se dégonfle
    case L_REVEAL:  return 280;
    case L_READY:   return 520;   // on se pose doucement
    case L_AWAITING:return 380;
    case L_PORTAL:  return 320;
    case L_OFFLINE: return 650;   // extinction lente
    default:        return 250;
  }
}

// Courbe associée à l'intention.
float transitionCurve(LedState s, float t) {
  switch (s) {
    case L_ARMED:
    case L_WINNER:  return easeOutCubic(t);    // impact immédiat puis stabilisation
    case L_LOCKED:  return easeInCubic(t);     // chute qui s'accélère
    default:        return easeInOutCubic(t);  // calme des deux côtés
  }
}

// Couleur « au repos » d'un état, respiration comprise.
void stateColor(LedState s, uint32_t now, float& r, float& g, float& b) {
  float br;
  switch (s) {
    case L_OFFLINE:                                   // souffle très lent, presque éteint
      br = breathe(now, 5200); r = 25 + br * 70; g = 0; b = 0; break;
    case L_PORTAL:                                    // blanc calme : « configure-moi »
      br = breathe(now, 3600); r = g = b = 45 + br * 175; break;
    case L_AWAITING:                                  // ambre plus insistant
      br = breathe(now, 2400); r = 50 + br * 190; g = (50 + br * 190) * 0.5f; b = 0; break;
    case L_READY:    r = 0;   g = 90;  b = 35; break; // veilleuse stable
    case L_ARMED:                                     // bleu vif qui respire vite
      br = breathe(now, 1500); r = 0; g = 40 + br * 90; b = 120 + br * 135; break;
    case L_WINNER:   r = 0;   g = 235; b = 70; break;
    case L_LOCKED:   r = 190; g = 0;   b = 0;  break;
    case L_REVEAL:   r = 245; g = 130; b = 0;  break;
    default:         r = g = b = 255; break;
  }
}

// Niveau « au repos » de l'anneau du bouton.
float stateRing(LedState s, uint32_t now) {
  switch (s) {
    case L_OFFLINE:  return breathe(now, 5200) * 40;
    case L_PORTAL:   return 40 + breathe(now, 3600) * 200;
    case L_AWAITING: return 40 + breathe(now, 2400) * 200;
    case L_READY:    return 30;
    case L_ARMED:    return 255;                       // plein feu
    case L_WINNER:   return 255;
    case L_LOCKED:   return 0;                         // éteint
    case L_REVEAL:   return 120;
    default:         return 255;
  }
}

// Enveloppe d'accent : attaque instantanée, extinction douce.
float pulseEnv(uint32_t e, uint32_t start, uint32_t dur) {
  if (e < start || e >= start + dur) return 0.0f;
  return 1.0f - (float)(e - start) / (float)dur;
}
// Enveloppe d'éclosion : montée puis retombée (final de la fanfare).
float bloomEnv(uint32_t e, uint32_t start, uint32_t rise, uint32_t fall) {
  if (e < start || e >= start + rise + fall) return 0.0f;
  uint32_t d = e - start;
  if (d < rise) return smoothstep((float)d / rise);
  return 1.0f - smoothstep((float)(d - rise) / fall);
}

// ACCENT SYNCHRONISÉ AU SON. Les instants ci-dessous correspondent NOTE À NOTE
// aux mélodies définies plus haut — la lumière frappe donc pile sur l'accent.
float accentFor(LedState s, uint32_t e) {
  switch (s) {
    // melArmed = la(45) + silence(35) + do aigu(60) → deux tics : 0 et 80 ms.
    case L_ARMED:  return fmaxf(pulseEnv(e, 0, 110), pulseEnv(e, 80, 130));
    // melWinner = sol(110) do(110) mi(110) silence(40) SOL(230) → final à 370 ms.
    case L_WINNER: return fmaxf(fmaxf(pulseEnv(e, 0, 90), pulseEnv(e, 110, 90)),
                          fmaxf(pulseEnv(e, 220, 90), bloomEnv(e, 370, 90, 320)));
    // melReveal = fa(90) + silence(50) + fa(130) → deux frappes douces.
    case L_REVEAL: return fmaxf(pulseEnv(e, 0, 90), pulseEnv(e, 140, 130)) * 0.55f;
    default:       return 0.0f;
  }
}

// État affiché (float) : c'est de LUI que part chaque fondu, jamais de la cible
// théorique — sinon une transition interrompue produirait un saut visible.
float gCurR = 0, gCurG = 0, gCurB = 0, gCurRing = 0;
float gFromR = 0, gFromG = 0, gFromB = 0, gFromRing = 0;
uint32_t gStateSince = 0;

// Point d'entrée unique pour changer d'état : mémorise ce qui est à l'écran et
// démarre le fondu. Toute affectation directe de gLed court-circuiterait ça.
void setLedState(LedState s) {
  if (s == gLed) return;
  gFromR = gCurR; gFromG = gCurG; gFromB = gCurB; gFromRing = gCurRing;
  gLed = s;
  gStateSince = millis();
}

void renderLed() {
  uint32_t now = millis();

  // Mise à jour OTA : priorité absolue. Le bandeau se remplit progressivement,
  // et le pixel de tête pulse pour montrer que le téléchargement vit.
  if (gOtaProgress >= 0) {
    float remplis = (float)gOtaProgress * LED_COUNT / 100.0f;
    float tete = breathe(now, 700);
    for (uint16_t i = 0; i < LED_COUNT; i++) {
      float f = constrain(remplis - i, 0.0f, 1.0f);          // remplissage partiel = dégradé
      if (i == (uint16_t)remplis) f = 0.35f + tete * 0.65f;  // le pixel en cours respire
      pixel.setPixelColor(i, rgb((uint8_t)(0), (uint8_t)(f * 90), (uint8_t)(20 + f * 235)));
    }
    pixel.show();
    setButtonLed((uint8_t)(gOtaProgress * 255 / 100));
    gCurR = 0; gCurG = 60; gCurB = 200; gCurRing = gOtaProgress * 2.55f;
    return;
  }

  // 1. Cible de l'état courant.
  float tr, tg, tb;
  stateColor(gLed, now, tr, tg, tb);
  float tring = stateRing(gLed, now);

  // 2. Fondu depuis ce qui était affiché, avec la courbe de l'intention.
  uint16_t dur = transitionMs(gLed);
  uint32_t e = now - gStateSince;
  float t = (dur == 0 || e >= dur) ? 1.0f : transitionCurve(gLed, (float)e / dur);
  gCurR = gFromR + (tr - gFromR) * t;
  gCurG = gFromG + (tg - gFromG) * t;
  gCurB = gFromB + (tb - gFromB) * t;
  gCurRing = gFromRing + (tring - gFromRing) * t;

  // 3. Accent calé sur la mélodie + retour tactile de l'appui, tous deux fondus
  //    en blanc plutôt qu'en bascule brutale.
  float accent = accentFor(gLed, e);
  if (now < gFlashUntil) {                                   // appui : attaque immédiate
    accent = fmaxf(accent, (float)(gFlashUntil - now) / 180.0f);
  }
  float r = gCurR + (255.0f - gCurR) * accent;
  float g = gCurG + (255.0f - gCurG) * accent;
  float b = gCurB + (255.0f - gCurB) * accent;
  float ring = gCurRing + (255.0f - gCurRing) * accent;

  setAll(rgb((uint8_t)constrain(r, 0.0f, 255.0f),
             (uint8_t)constrain(g, 0.0f, 255.0f),
             (uint8_t)constrain(b, 0.0f, 255.0f)));
  setButtonLed((uint8_t)constrain(ring, 0.0f, 255.0f));
}

// ============================================================================
//  SON — séquenceur de mélodies NON BLOQUANT
// ----------------------------------------------------------------------------
//  Les anciennes mélodies enchaînaient des `delay()` : jusqu'à 240 ms pendant
//  lesquelles webSocket.loop(), le bouton et la LED étaient gelés — inacceptable
//  sur un buzzer où le temps de réaction est l'essence du jeu. Le séquenceur
//  ci-dessous avance à chaque tour de loop() via millis().
//
//  Deux modes :
//    • playMelody()    → non bloquant, pour tout ce qui arrive EN JEU.
//    • playMelodyNow() → bloquant, réservé aux phases où loop() ne tourne pas
//                        de toute façon (démarrage, portail Wi-Fi, OTA, reset).
// ============================================================================

// Gamme de do majeur — les mélodies partagent le même vocabulaire pour former
// une famille sonore cohérente plutôt qu'une collection de bips au hasard.
#define N_C4  262
#define N_F4  349
#define N_G4  392
#define N_A4  440
#define N_G3  196
#define N_A3  220
#define N_C5  523
#define N_E5  659
#define N_F5  698
#define N_G5  784
#define N_A5  880
#define N_C6 1047
#define N_E6 1319
#define N_G6 1568
#define SIL     0        // silence

#define MEL(x) x, (uint8_t)(sizeof(x) / sizeof((x)[0]))

// ── Palette : une intention par évènement ───────────────────────────────────
static const Note melBoot[]     = {{N_C5,60},{N_E5,60},{N_G5,80}};                              // réveil
static const Note melPortal[]   = {{N_G5,100},{SIL,60},{N_C6,170}};                             // « configure-moi »
static const Note melWifiOk[]   = {{N_C5,70},{N_G5,120}};                                       // Wi-Fi obtenu
static const Note melWsConnect[]= {{N_E5,60},{N_A5,90}};                                        // serveur joint
static const Note melOffline[]  = {{N_G5,100},{N_E5,100},{N_C5,190}};                           // liaison perdue
static const Note melAwaiting[] = {{N_E5,90},{SIL,50},{N_A5,110}};                              // question : « appaire-moi ? »
static const Note melPaired[]   = {{N_C5,70},{N_E5,70},{N_G5,70},{N_C6,150}};                   // résolution joyeuse
static const Note melReady[]    = {{N_G4,45}};                                                  // veilleuse, très discret
static const Note melArmed[]    = {{N_A5,45},{SIL,35},{N_C6,60}};                               // double tic : « à toi ! »
static const Note melPress[]    = {{N_C6,40}};                                                  // impact sec de l'appui
static const Note melWinner[]   = {{N_G5,110},{N_C6,110},{N_E6,110},{SIL,40},{N_G6,230}};       // fanfare
static const Note melLocked[]   = {{N_A3,120},{SIL,40},{N_G3,230}};                             // grave, « trop tard »
static const Note melReveal[]   = {{N_F5,90},{SIL,50},{N_F5,130}};                              // notification neutre
static const Note melOtaStart[] = {{N_C5,70},{N_E5,70},{N_G5,70},{N_C6,70}};                    // « travaux en cours »
static const Note melOtaOk[]    = {{N_C6,90},{N_E6,90},{N_G6,210}};                             // MAJ réussie
static const Note melOtaFail[]  = {{N_E5,140},{SIL,40},{N_C5,140},{SIL,40},{N_A4,260}};         // MAJ échouée
static const Note melResetDone[]= {{N_C5,90},{N_A4,90},{N_F4,90},{N_C4,260}};                   // effacement

// ── Moteur ──────────────────────────────────────────────────────────────────
const Note* gMel = nullptr;
uint8_t  gMelLen = 0, gMelIdx = 0;
uint32_t gNoteUntil = 0;

void updateMelody() {
  if (!gMel) return;
  uint32_t now = millis();
  if (gNoteUntil && now < gNoteUntil) return;          // note en cours
  if (gMelIdx >= gMelLen) { noTone(BUZZER_PIN); gMel = nullptr; return; }
  const Note& n = gMel[gMelIdx++];
  if (n.freq) tone(BUZZER_PIN, n.freq); else noTone(BUZZER_PIN);
  gNoteUntil = now + n.ms;
}

// Non bloquant. La 1re note est attaquée immédiatement → aucune latence perçue
// sur l'appui du bouton, qui doit rester le retour le plus instantané possible.
void playMelody(const Note* m, uint8_t len) {
  gMel = m; gMelLen = len; gMelIdx = 0; gNoteUntil = 0;
  updateMelody();
}

// Bloquant — uniquement là où loop() est de toute façon à l'arrêt.
void playMelodyNow(const Note* m, uint8_t len) {
  for (uint8_t i = 0; i < len; i++) {
    if (m[i].freq) tone(BUZZER_PIN, m[i].freq); else noTone(BUZZER_PIN);
    delay(m[i].ms);
  }
  noTone(BUZZER_PIN);
}

// Un simple tic ponctuel (décompte du reset d'usine).
void sndTick(uint16_t freq) { tone(BUZZER_PIN, freq, 45); }

// Évite de rejouer la même mélodie si le serveur renvoie deux fois le même état.
LedState gLastSoundState = L_OFFLINE;

void playSoundForState(LedState s) {
  if (s == gLastSoundState) return;
  gLastSoundState = s;
  switch (s) {
    case L_ARMED:  playMelody(MEL(melArmed));  break;
    case L_WINNER: playMelody(MEL(melWinner)); break;
    case L_LOCKED: playMelody(MEL(melLocked)); break;
    case L_REVEAL: playMelody(MEL(melReveal)); break;
    case L_READY:  playMelody(MEL(melReady));  break;
    default: break;
  }
}

void setLedFromState(const String& s) {
  if      (s == "armed")  setLedState(L_ARMED);
  else if (s == "winner") setLedState(L_WINNER);
  else if (s == "locked") setLedState(L_LOCKED);
  else if (s == "reveal") setLedState(L_REVEAL);
  else                    setLedState(L_READY);   // 'idle' ou inconnu
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
  playMelodyNow(MEL(melOtaStart));           // « travaux en cours »

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
    playMelodyNow(MEL(melOtaOk));
    // 3 clignotements verts : succès visible sans câble série.
    for (int i = 0; i < 3; i++) { setAll(rgb(0, 220, 60)); setButtonLed(255); delay(150);
                                  setAll(0); setButtonLed(0); delay(150); }
    ESP.restart();
  } else {
    String err = httpUpdate.getLastErrorString();
    Serial.printf("[OTA] échec (%d) %s\n", httpUpdate.getLastError(), err.c_str());
    sendOtaResult(false, version, err);
    playMelodyNow(MEL(melOtaFail));
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
      setLedState(L_READY);
      sendHello();                              // annonce de l'appareil au boot
      sendTelemetry();                          // 1re télémétrie immédiate
      playMelody(MEL(melWsConnect));
      gLastSoundState = L_READY;                // évite un doublon si un 'idle' suit
      Serial.println("[WS] connecté → buzzer_hello");
      break;

    case WStype_DISCONNECTED:
      gConnected = false;
      setLedState(L_OFFLINE);
      gLastSoundState = L_OFFLINE;
      playMelody(MEL(melOffline));              // motif descendant : liaison perdue
      Serial.println("[WS] déconnecté");
      break;

    case WStype_TEXT: {
      const char* p = (const char*)payload;
      if (jsonHas(p, "\"awaiting_claim\""))       { setLedState(L_AWAITING); gLastSoundState = L_AWAITING; playMelody(MEL(melAwaiting)); Serial.println("[WS] à appairer"); }
      else if (jsonHas(p, "\"pairing_success\"")) { setLedState(L_READY);    gLastSoundState = L_READY;    playMelody(MEL(melPaired));   Serial.println("[WS] appairé"); }
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
      playMelody(MEL(melPress));                    // impact sec, latence nulle
      if (gConnected) { sendBuzz(); Serial.println("→ BUZZ"); }
    } else {
      gPressStartMs = 0;                            // relâché avant le seuil → rien
      gLastResetTickSec = 0;                        // réarme le décompte sonore
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

      // Décompte SONORE : un tic par seconde, de plus en plus aigu à mesure que
      // l'effacement approche. On entend le reset arriver — et on peut relâcher.
      uint8_t sec = held / 1000;                    // 3,4,5… jusqu'à 10
      if (sec != gLastResetTickSec) {
        gLastResetTickSec = sec;
        sndTick(400 + (uint16_t)sec * 90);
      }
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
  setLedState(L_PORTAL);
  // ⚠️ autoConnect()/startConfigPortal() sont BLOQUANTS : loop() — et donc
  // renderLed() — ne tourne pas tant que le Wi-Fi n'est pas configuré. Sans le
  // rendu explicite ci-dessous, le bandeau restait ÉTEINT pendant toute la
  // configuration (le « blanc pulsé » n'apparaissait jamais). On allume donc en
  // blanc fixe avant de bloquer, et on le ré-affirme quand le point d'accès
  // démarre réellement (setAPCallback), seul moment où WiFiManager nous rend la main.
  setAll(rgb(255, 255, 255));
  setButtonLed(255);
  playMelodyNow(MEL(melPortal));   // bloquant : loop() ne tourne pas pendant le portail

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
  playMelodyNow(MEL(melWifiOk));    // « Wi-Fi obtenu » avant de rendre la main à loop()

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

  playMelodyNow(MEL(melResetDone));          // motif descendant : effacement
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

  playMelodyNow(MEL(melBoot));        // petit réveil sonore : « je suis vivant »

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
  updateMelody();          // fait avancer la mélodie en cours (jamais de delay)
  // Télémétrie périodique (batterie + signal Wi-Fi).
  if (millis() - gLastTelemetryMs > TELEMETRY_MS) { gLastTelemetryMs = millis(); sendTelemetry(); }
}
