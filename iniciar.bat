@echo off
title ASAP Cobranzas
echo.
echo  ╔══════════════════════════════════════╗
echo  ║        ASAP Cobranzas - Backend      ║
echo  ╚══════════════════════════════════════╝
echo.
echo  Iniciando servidor...
echo  La app estara disponible en: http://localhost:3001
echo.

cd /d "%~dp0backend"

:: Abrir el navegador despues de 4 segundos
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3001"

npm run dev
