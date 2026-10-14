@echo off
:: Devconnect - Backend Socket Server Launcher
:: Adds portable Node.js to PATH and starts the Socket.IO gateway

SET "NODE_PATH=D:\nodejs"
SET "PATH=%NODE_PATH%;%PATH%"

echo.
echo  ==========================================
echo   Devconnect Socket Gateway  ^|  Port 3001
echo  ==========================================
echo   Node : %NODE_PATH%\node.exe
echo  ==========================================
echo.

cd /d "%~dp0"
"%NODE_PATH%\node.exe" scripts\socket-server.mjs
