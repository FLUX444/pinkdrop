#!/usr/bin/env bash
# Деплой на VPS: обновляет /var/www/pinkdrop (nginx).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/pinkdrop}"
MIN_FAVICON_BYTES=85000

cd "$ROOT"

echo "==> git pull"
git pull

COMMIT=$(git log -1 --oneline)
echo "    $COMMIT"

if ! git log -1 --oneline | grep -qE '619eadc|e94b76c'; then
  if [ "$(wc -c < public/favicon-512.png | tr -d ' ')" -lt "$MIN_FAVICON_BYTES" ]; then
    echo "ОШИБКА: старый favicon в репозитории. Сначала: git pull origin main"
    exit 1
  fi
fi

echo "==> npm install"
npm install

echo "==> npm run build"
npm run build

FAV_DIST="$ROOT/dist/favicon-512.png"
BYTES=$(wc -c < "$FAV_DIST" | tr -d ' ')
echo "    dist/favicon-512.png = ${BYTES} bytes (нужно >= ${MIN_FAVICON_BYTES})"
if [ "$BYTES" -lt "$MIN_FAVICON_BYTES" ]; then
  echo "ОШИБКА: сборка дала старый пиксельный favicon. Проверь git pull и public/images/pinkdrop-email-logo.png"
  exit 1
fi

echo "==> copy dist -> $WEB_ROOT"
mkdir -p "$WEB_ROOT"
cp -r dist/* "$WEB_ROOT/"

echo "==> verify web root"
wc -c "$WEB_ROOT/favicon-512.png"
wc -c "$WEB_ROOT/images/brand-logo-116.png"

if [ -f /etc/nginx/sites-available/pinkdrop ]; then
  echo "==> nginx: обнови конфиг если менялся scripts/nginx-pinkdrop.conf"
  echo "    sudo cp ~/pinkdrop/scripts/nginx-pinkdrop.conf /etc/nginx/sites-available/pinkdrop"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
fi

echo "==> pm2 restart"
pm2 restart pinkdrop-api --update-env

echo "Готово. Проверь:"
echo "  wc -c $WEB_ROOT/favicon-512.png   # ~90000"
echo "  https://pinkdrop.ru/favicon-512.png"
echo "  https://pinkdrop.ru/images/brand-logo-116.png"
