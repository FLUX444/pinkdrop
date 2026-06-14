#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 "BOT TG/main.py"
