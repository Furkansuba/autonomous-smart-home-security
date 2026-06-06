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
## 9. Heartbeat Policy
- heartbeat interval: 30 seconds
- degraded threshold: 60 seconds
- offline threshold: 90 seconds
Device status values:
- online
- degraded
- offline
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
