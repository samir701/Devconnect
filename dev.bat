@echo off
:: Devconnect - Development Server Launcher
:: Adds portable Node.js to PATH and starts Next.js dev server

SET "NODE_PATH=D:\nodejs"
SET "PATH=%NODE_PATH%;%PATH%"

echo.
echo  ==========================================
echo   Devconnect Dev Server  ^|  npm run dev
echo  ==========================================
echo   Node : %NODE_PATH%\node.exe
echo   URL  : http://localhost:3000
echo  ==========================================
echo.

cd /d "%~dp0frontend"
"%NODE_PATH%\npm.cmd" run dev
