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
## 4. Main Device ID
- esp32_home_01
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
- activate pump
- open related room valve
- trigger alarm
- publish critical event
If gas or CO is detected:
- trigger alarm
- lock out pump
- do not activate pump even by manual override
- publish critical event
Gas/CO pump lockout is mandatory.
