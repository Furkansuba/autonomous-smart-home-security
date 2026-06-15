// secrets.example.h — template for firmware/secrets.h
//
// Copy this file to "secrets.h" in the same folder and fill in your real
// values. secrets.h is gitignored and must NEVER be committed.
//
//   cp secrets.example.h secrets.h
//
// All values below are PLACEHOLDERS — replace them locally.

#ifndef SECRETS_H
#define SECRETS_H

// ── Wi-Fi ────────────────────────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// ── MQTT broker ──────────────────────────────────────────────────────
#define MQTT_HOST       "your-broker-host.example.org"
#define MQTT_PORT       1883

// ── Authorized RFID card UIDs ────────────────────────────────────────
// Format: space-separated uppercase hex bytes, matching the serial print
// format produced by handleRFIDAccess(). These are PLACEHOLDER bytes —
// replace with your own card UIDs in secrets.h.
#define RFID_CARD_1     "00 00 00 01"
#define RFID_CARD_2     "00 00 00 02"
#define RFID_CARD_3     "00 00 00 03"

#endif // SECRETS_H
