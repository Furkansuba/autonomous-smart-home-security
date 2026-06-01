const { spawnSync } = require('child_process');
const checks = [
  'check:config',
  'validate:contracts',
  'test:pagination',
  'test:request-validation',
  'test:error-handlers',
  'test:models',
  'test:auth-api',
  'test:rbac',
  'test:mqtt-client',
  'test:mqtt-message-handler',
  'test:mqtt-command-publisher',
  'test:mqtt-router',
  'test:ingestion',
  'test:ingestion-mapper',
  'test:db',
  'test:persistence',
  'test:device-status',
  'test:device-api',
  'test:event-api',
  'test:access-log-api',
  'test:telemetry-api',
  'test:override-api',
  'test:dashboard-api',
  'test:mqtt-e2e-local',
  'test:override-mqtt-e2e',
];
function runCheck(scriptName) {
  console.log('');
  console.log('============================================================');
  console.log('[RUN] npm run ' + scriptName);
  console.log('============================================================');
  const result = spawnSync('npm', ['run', scriptName], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('');
    console.error('[FAIL] npm run ' + scriptName);
    process.exit(result.status || 1);
  }
  console.log('[PASS] npm run ' + scriptName);
}
function main() {
  console.log('Starting backend regression checks...');
  console.log('Total checks: ' + checks.length);
  for (const check of checks) {
    runCheck(check);
  }
  console.log('');
  console.log('============================================================');
  console.log('All backend regression checks passed.');
  console.log('============================================================');
}
main();
