/**
 * seed-logical-devices.js
 *
 * Idempotent seed for logical component device records.
 * Run manually before a demo or first boot, not automatically.
 *
 * Safe to run multiple times — uses updateOne with upsert.
 * Does NOT delete existing devices.
 * Does NOT trigger notifications.
 * Sets status: 'offline' and is_active: true so the offline monitor
 * begins tracking each device immediately after seeding.
 */
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Device } = require('../src/models');

// Approved logical device list — contract §4.
// Hardware note: distributed 4-pump topology; NO valve_01 exists.
const LOGICAL_DEVICES = [
  // Main controller
  { device_id: 'esp32_home_01',       name: 'Main ESP32 Controller',       location_label: 'Prototype Home' },
  // Bus / expander
  { device_id: 'pcf8574_01',          name: 'I2C Expander / Digital Bus',  location_label: 'Prototype Home' },
  // Sensors
  { device_id: 'flame_sensor_01',     name: 'Flame Sensor Group',          location_label: 'Multi-room Flame Zones' },
  { device_id: 'mq2_sensor_01',       name: 'MQ-2 Gas Sensor',             location_label: 'Kitchen' },
  { device_id: 'mq7_sensor_01',       name: 'MQ-7 CO Sensor',              location_label: 'Garage' },
  { device_id: 'dht_sensor_01',       name: 'DHT Climate Sensor',          location_label: 'Prototype Home' },
  { device_id: 'pir_sensor_01',       name: 'PIR Motion Sensor Group',     location_label: 'Hallway' },
  { device_id: 'impact_sensor_01',    name: 'Impact Sensor Group',         location_label: 'Garage' },
  { device_id: 'reed_sensor_01',      name: 'Reed Switch Group',           location_label: 'Bedroom 1' },
  // Access peripheral
  { device_id: 'door_controller_01',  name: 'Door Controller',             location_label: 'Main Door' },
  // Zone pumps (4-pump topology, one per room zone)
  { device_id: 'pump_rm1_01',         name: 'Bedroom 1 Pump',              location_label: 'Bedroom 1' },
  { device_id: 'pump_rm2_01',         name: 'Bedroom 2 Pump',              location_label: 'Bedroom 2' },
  { device_id: 'pump_kit_01',         name: 'Kitchen Pump',                location_label: 'Kitchen' },
  { device_id: 'pump_liv_01',         name: 'Living Room Pump',            location_label: 'Living Room' },
  // Actuator
  { device_id: 'buzzer_01',           name: 'Alarm Buzzer',                location_label: 'Hallway' },
];

async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('[FAIL] MongoDB connection required.');
    console.error(dbResult);
    process.exit(1);
  }

  let upserted = 0;
  let existing = 0;

  for (const record of LOGICAL_DEVICES) {
    const result = await Device.updateOne(
      { device_id: record.device_id },
      {
        $setOnInsert: {
          device_id: record.device_id,
          name: record.name,
          location_label: record.location_label,
          status: 'offline',
          is_active: true,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log('[CREATED] ' + record.device_id + ' — ' + record.name);
      upserted++;
    } else {
      console.log('[EXISTS]  ' + record.device_id + ' — ' + record.name);
      existing++;
    }
  }

  console.log('');
  console.log('Seed complete. Created: ' + upserted + '  Already existed: ' + existing);
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('[FAIL] seed-logical-devices failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
