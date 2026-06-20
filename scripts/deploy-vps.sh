#!/usr/bin/env bash
# Деплой на VPS: обновляет и /var/www/pinkdrop (nginx), и public/ (Node /images).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/pinkdrop}"

cd "$ROOT"

echo "==> git pull"
git pull

echo "==> npm install"
npm install

echo "==> npm run build"
npm run build

echo "==> copy dist -> $WEB_ROOT"
mkdir -p "$WEB_ROOT"
cp -r dist/* "$WEB_ROOT/"

echo "==> verify favicon-512 (ожидается ~90000 байт, не 72742)"
FAV="$WEB_ROOT/favicon-512.png"
if [ ! -f "$FAV" ]; then
  echo "ОШИБКА: $FAV не найден"
  exit 1
fi
BYTES=$(wc -c < "$FAV" | tr -d ' ')
echo "    favicon-512.png = ${BYTES} bytes"
if [ "$BYTES" -lt 85000 ]; then
  echo "ПРЕДУПРЕЖДЕНИЕ: файл слишком маленький — возможно старая пиксельная версия"
fi

echo "==> pm2 restart"
pm2 restart pinkdrop-api --update-env

echo "Готово. Проверь: https://pinkdrop.ru/favicon-512.png (Ctrl+Shift+R)"
