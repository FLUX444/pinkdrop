@echo off
cd /d "%~dp0"
echo.
echo === PINKDROP Telegram Bot ===
echo 1. Убедитесь что сервер запущен: npm run dev:server
echo 2. Прокси 127.0.0.1:2080 должен быть включен в VPN
echo.
py -3 -m pip install -r "BOT TG\requirements.txt" -q
py -3 "BOT TG\main.py"
pause
