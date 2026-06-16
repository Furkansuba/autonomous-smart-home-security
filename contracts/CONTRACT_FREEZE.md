# Contract Freeze — Autonomous Smart Home Security
## 1. Fixed Technology Stack
- Embedded Controller: ESP32
- Communication: Wi-Fi + MQTT
- Backend: Node.js + Express
- Database: MongoDB Atlas
- Authentication: JWT
- Authorization: RBAC
- Mobile App: Kotlin Android
- Admin Panel: React
- Notifications: Firebase Cloud Messaging
- Deployment: AWS EC2
## 2. User Roles
### admin
Can:
- manage users
- manage devices
- view all events
- view all access logs
- send authorized override commands
- view notification logs
- view offline/online device status
### resident
Can:
- login
- view home/system status
- view active alerts
- view own access history where applicable
- receive critical notifications
## 3. Room IDs
- kitchen
- living_room
- bedroom_1
- bedroom_2
- garage
- hallway
- main_door
## 4. Device IDs
### Main controller
- esp32_home_01
  Name: Main ESP32 Controller
  Location: Prototype Home
### Logical component devices
One physical ESP32 may publish heartbeat messages on behalf of the logical component device IDs
below. Each heartbeat payload must carry the device_id matching the MQTT topic segment.
Hardware note: the physical suppression design uses a distributed 4-pump topology (one 5V
submersible pump per room zone on a 4-channel relay board). There are NO solenoid valves.
valve_01 does not exist and must never be seeded or published.
| device_id         | Name                       | Location                          |
|-------------------|----------------------------|-----------------------------------|
| pcf8574_01        | I2C Expander / Digital Bus | Prototype Home                    |
| flame_sensor_01   | Flame Sensor Group         | Multi-room Flame Zones            |
| mq2_sensor_01     | MQ-2 Gas Sensor            | Kitchen                           |
| mq7_sensor_01     | MQ-7 CO Sensor             | Garage                            |
| dht_sensor_01     | DHT Climate Sensor         | Prototype Home                    |
| pir_sensor_01     | PIR Motion Sensor Group    | Hallway / Garage / Living Room    |
| impact_sensor_01  | Impact Sensor Group        | Garage / Hallway                  |
| reed_sensor_01    | Reed Switch Group          | Bedroom 1 / Bedroom 2 / Kitchen   |
| door_controller_01| Door Controller            | Main Door                         |
| pump_rm1_01       | Bedroom 1 Pump             | Bedroom 1                         |
| pump_rm2_01       | Bedroom 2 Pump             | Bedroom 2                         |
| pump_kit_01       | Kitchen Pump               | Kitchen                           |
| pump_liv_01       | Living Room Pump           | Living Room                       |
| buzzer_01         | Alarm Buzzer               | Hallway                           |
### Device ID naming rule
device_id must match: ^[a-z][a-z0-9_]+_[0-9]+$
Rules:
- Starts with a lowercase letter
- Contains only lowercase letters, digits, and underscores
- Ends with an underscore followed by one or more digits
- Minimum 3 characters, maximum 80 characters
- No uppercase, hyphens, slashes, or spaces
Examples of valid IDs: esp32_home_01, flame_sensor_01, pump_rm1_01, mq2_sensor_01
Examples of invalid IDs: Pump_01, pump-01, valve_01 (no valves exist), pump (no numeric suffix)
### Component health model — v1
- Each logical device_id has its own heartbeat, offline detection, and status (online/degraded/offline).
- Offline detection is based on missed heartbeats per device_id; thresholds are unchanged:
  degraded threshold: 60 seconds; offline threshold: 90 seconds.
- Component-level fault status (sensor_fault, actuator_fault) is NOT implemented in v1.
  A broken or unavailable component is represented by missed heartbeat → degraded/offline.
  sensor_fault and actuator_fault events are reserved as future enhancements.
- Phase B notification policy (deferred): controller offline sends FCM; logical component offline
  is UI-visible only (logged as skipped in NotificationLog). Not yet implemented.
## 5. Event Types
Safety:
- fire_detected
- gas_detected
- co_detected
Security:
- intrusion_detected
- vibration_detected
- motion_detected
- reed_switch_opened
Access:
- door_access_granted
- door_access_denied
- door_unlock_requested
- door_unlocked
Connectivity:
- device_online
- device_offline
- heartbeat_missed
Override:
- manual_override_requested
- manual_override_executed
- manual_override_failed
- system_reset
Alarm:
- alarm_triggered
- alarm_silenced
## 6. Severity Levels
- info
- warning
- critical
Rules:
- fire_detected = critical
- gas_detected = critical
- co_detected = critical
- intrusion_detected = warning or critical
- device_offline = warning
- door_access_denied = warning
- door_access_granted = info
- manual_override_executed = info
- manual_override_failed = warning
## 7. Timestamp Rule
All backend, database, MQTT and API timestamps use UTC ISO-8601.
Example:
2026-06-01T18:00:00Z
Local time conversion is only handled in UI.
## 8. MQTT Topics
Device to Backend:
- home/{deviceId}/heartbeat
- home/{deviceId}/telemetry
- home/{deviceId}/event
- home/{deviceId}/access
- home/{deviceId}/override/result
Backend to Device:
- home/{deviceId}/cmd/override
- home/{deviceId}/cmd/arm
- home/{deviceId}/cmd/disarm
- home/{deviceId}/cmd/reset
- home/{deviceId}/cmd/unlock
Arm/Disarm transport — v1:
- v1 issues ARM/DISARM as override actions (`arm` / `disarm`) through the existing
  `POST /api/overrides` route, published on `home/{deviceId}/cmd/override`, and
  acknowledged on `home/{deviceId}/override/result`. This reuses the audited override
  pipeline and minimizes firmware/transport risk.
- The dedicated `home/{deviceId}/cmd/arm` and `home/{deviceId}/cmd/disarm` topics remain
  RESERVED for a future dedicated control path and are not used by v1.
## 9. Heartbeat Policy
- heartbeat interval: 30 seconds
- degraded threshold: 60 seconds
- offline threshold: 90 seconds
Device status values:
- online
- degraded
- offline
Heartbeat may also include an optional boolean `security_armed` reporting the device's
current ARMED (true) / DISARMED (false) security mode. When present it is treated as
device-reported truth and persisted to the device's `security_armed` field.
## 10. Notification Policy
Push notification required:
- fire_detected
- gas_detected
- co_detected
- intrusion_detected
- device_offline
No push notification by default:
- heartbeat
- telemetry
- door_access_granted
- manual_override_requested
## 11. Database Collections
- users
- devices
- events
- access_logs
- override_requests
- telemetry_summaries
- device_status_history
- notification_logs
## 12. Safety Rule
Safety overrides security.
If fire is detected:
- activate the zone pump for the affected room (pump_rm1_01, pump_rm2_01, pump_kit_01, or pump_liv_01)
- trigger alarm
- publish critical event
Note: hardware uses distributed 4-pump topology; there are no valves.
If gas or CO is detected:
- trigger alarm
- lock out pump
- do not activate pump even by manual override
- publish critical event
Gas/CO pump lockout is mandatory.
### Fire-active state and false-alarm recovery
- A fire is considered active for a device while the latest recent-window
  `fire_detected` event is newer than the latest successful (`executed`)
  `maintenance_reset` for that device.
- While fire is active, a normal `pump_off` override must be blocked (saved with
  status `blocked`, never published, never auto-acked).
- `maintenance_reset` (UI label: "Confirm Threat Cleared") is the admin-only
  false-alarm recovery action. It is an `OVERRIDE_ACTIONS` value, issued through
  the existing `POST /api/overrides` route and published on `home/{deviceId}/cmd/override`.
  - It requires a non-empty `reason`.
  - It is never demo-auto-acked; it only becomes `executed` from a real device ACK.
  - Firmware must verify flame sensors are currently clear before acknowledging.
    If flame is still detected it must ACK `failed` with `blocked_reason: "fire_still_present"`.
    If gas/CO is active it must ACK `failed` with `blocked_reason: "gas_co_active"`.
    On success it clears the fire latch, forces pump relays off, and ACKs `executed`.
  - `maintenance_reset` must not clear gas/CO hazards.
## 13. Payload Example Files
The canonical payload examples are stored under:
- contracts/examples/heartbeat.json
- contracts/examples/telemetry.json
- contracts/examples/event_fire_detected.json
- contracts/examples/access_granted.json
- contracts/examples/override_request.json
- contracts/examples/override_result.json
These files are the reference payloads for firmware, backend, Android app, admin panel, and tests.
Rules:
- Backend must validate incoming MQTT payloads against these structures.
- Firmware must publish messages compatible with these structures.
- Android and admin-web must display fields from these structures without inventing new names.
- Tests should use these examples as fixtures.
- New payload types must be added to this contract before implementation.
## 14. Security Arm/Disarm Mode
ARM/DISARM controls security/intrusion monitoring only. It NEVER affects fire/gas/CO safety.
### Override actions
`OVERRIDE_ACTIONS` includes `arm` and `disarm` (alongside pump/buzzer/door/system_reset/
maintenance_reset). They are admin-only, issued via `POST /api/overrides`, and published on
`home/{deviceId}/cmd/override` (see §8). They are never demo-auto-acked: the stored override
only becomes `executed` from a real device ACK on `override/result`.
### Device field
- `devices.security_armed` (boolean, default `true` = ARMED). It is the displayable source of
  truth for the current mode.
- It is updated ONLY by a confirmed device ACK:
  - `arm` ACK with result `executed` → `security_armed = true`
  - `disarm` ACK with result `executed` → `security_armed = false`
  - `failed` / `blocked` / `requested` ACKs do NOT change `security_armed`
- A heartbeat carrying `security_armed` overrides the stored value (device-reported truth).
### Behavior
- ARMED: PIR motion (`motion_detected`), impact/vibration (`vibration_detected`), and
  reed/window/door (`reed_switch_opened`) intrusion detection is active.
- DISARMED: the above security/intrusion detection is suppressed (no security events, no
  security siren).
- FIRE, GAS, and CO detection are ALWAYS active regardless of mode.
- DISARM must never silence an active fire/gas/CO siren; the firmware safety loop owns the
  buzzer and pumps during a hazard, and arm/disarm only set the security flag.
### Roles
- ARM/DISARM is admin-only. Residents may VIEW the current mode but cannot change it.
## 15. Door Lock / Door Unlock
`door_lock` and `door_unlock` are physical door actuator controls (servo on the main door).
They are SEPARATE from ARM/DISARM: door control never changes `security_armed`, and ARM/DISARM
never locks or unlocks the door.
### Override actions
- `OVERRIDE_ACTIONS` includes `door_lock` and `door_unlock`. Admin-only, issued via
  `POST /api/overrides`, published on `home/{deviceId}/cmd/override` (see §8). They are never
  demo-auto-acked: the stored override only becomes `executed` from a real device ACK.
- `home/{deviceId}/cmd/unlock` remains RESERVED for a future dedicated path; v1 uses cmd/override.
### Evacuation safety
- `door_lock` is BLOCKED while a fire/gas/CO hazard is active (so evacuation is never trapped):
  - Backend saves it as `blocked` with `blocked_reason: "door_lock_blocked_hazard"`, never
    publishes it, never auto-acks it. Fire-active respects `maintenance_reset` (a confirmed
    threat-cleared reset re-allows `door_lock`); gas/CO use the recent hazard-event window.
  - Firmware also refuses `door_lock` during a hazard, ACKing `failed` with
    `blocked_reason: "door_lock_blocked_hazard"` instead of locking.
- `door_unlock` is ALLOWED at all times, including during a hazard — evacuation may require it,
  and the firmware safety loop auto-unlocks the door during fire/gas/CO.
### Device field
- `devices.door_locked` (boolean, default `null` = unknown). This is DEVICE-REPORTED /
  last-commanded lock state — it is NOT independently sensor-verified (no physical lock sensor).
  UI must label it as device-reported, not as verified physical state.
- It is updated ONLY by:
  - a heartbeat carrying `door_locked` (device-reported truth), or
  - a confirmed ACK: `door_lock` executed → `true`; `door_unlock` executed → `false`.
  - `failed` / `blocked` / `requested` ACKs do NOT change `door_locked`.
### Roles
- Door Lock / Door Unlock are admin-only. Residents may VIEW the door state but cannot change it.
