You are working on the Autonomous Smart Home Security project.
Before making changes, read:
- docs/CLAUDE_CODE_ADMIN_WEB_GUARDRAILS.md
- docs/BACKEND_API_REFERENCE.md
- docs/AUTH_RBAC_GUIDE.md
- docs/BACKEND_TEST_GUIDE.md
Strict scope:
- Edit only files inside admin-web/
- Do not edit backend/
- Do not edit contracts/
- Do not edit docs/ unless I explicitly ask
Task:
Implement the first admin-web frontend baseline cleanup.
Requirements:
1. Replace the default Vite React page.
2. Create a clean admin dashboard shell.
3. Include sidebar or top navigation with these sections:
   - Dashboard
   - Devices
   - Events
   - Access Logs
   - Telemetry
   - Overrides
4. Add basic CSS suitable for a smart home security admin panel.
5. Do not connect to backend yet.
6. Do not implement login yet.
7. Do not install new packages.
8. Keep the implementation simple and reviewable.
After changes:
- Run npm run build inside admin-web.
- Show changed files.
- Confirm backend files were not touched.
