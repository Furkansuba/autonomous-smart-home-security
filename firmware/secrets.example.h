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
// Format: space-separated uppercase hex bytes, matching the UID string built
// in handleRFIDAccess() and compared by isAuthorizedUid(). These are DUMMY
// PLACEHOLDER values — replace with your own card UIDs in secrets.h only.
// Never commit real card UIDs.
#define AUTHORIZED_RFID_UID_1  "DE AD BE EF"
#define AUTHORIZED_RFID_UID_2  "11 22 33 44"
#define AUTHORIZED_RFID_UID_3  "AA BB CC DD"

#endif // SECRETS_H
