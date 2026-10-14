@echo off
:: Devconnect - Production Server Launcher
:: Adds portable Node.js to PATH and starts Next.js production server

SET "NODE_PATH=D:\nodejs"
SET "PATH=%NODE_PATH%;%PATH%"

echo.
echo  ==========================================
echo   Devconnect Production  ^|  npm start
echo  ==========================================
echo   Node : %NODE_PATH%\node.exe
echo   URL  : http://localhost:3000
echo  ==========================================
echo.

cd /d "%~dp0frontend"
"%NODE_PATH%\npm.cmd" start
