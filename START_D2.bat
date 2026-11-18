@echo off
cd /d "%~dp0"
docker compose -p multimedia-d2 up -d --build
if errorlevel 1 (
 echo Start failed. Check Docker Desktop and ports 1880 / 27017.
 pause
 exit /b 1
)
echo Wait for first-time data restore and Node-RED startup, then refresh the browser.
start "" "http://localhost:1880/traffic"
pause
