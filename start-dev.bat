@echo off
start "API (port 4000)" cmd /k "cd /d %~dp0apps\api && npm run dev"
start "Dashboard (port 3000)" cmd /k "cd /d %~dp0apps\dashboard && npm run dev"
start "Mobile (Expo)" cmd /k "cd /d %~dp0apps\mobile && npx expo start --clear"
