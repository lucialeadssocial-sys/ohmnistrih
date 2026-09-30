#!/usr/bin/env bash
# KROK 22 — HOSTING: spustí OmniStrih v PRODUKČNOM režime.
#
# Rozdiel proti `start-app.sh` (dev):
#   dev   = `tsx server.ts` + Vite dev server (hot-reload, pomalší, ladený)
#   prod  = `vite build` → `node dist/server.cjs` (hotový balík, bez dev servera)
#
# Čo to robí:
#   1. postaví produkčný balík (`bun run build`),
#   2. spustí server v režime `NODE_ENV=production` na `0.0.0.0:3000`
#      (musí to byť 0.0.0.0, inak sa appka nedá otvoriť cez internet/preview),
#   3. appka potom slúži hotové súbory z `dist/` — nič sa nedorenderúva za behu.
#
# POZOR (poctivo): toto je hostovanie na TOMTO stroji. Nie je to doména,
# nie je to cloud a nie je tam prihlásenie. Detaily: docs/HOSTING.md.
set -uo pipefail

export BUN_INSTALL="$HOME/.bun"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
REPO=/home/user/ohmnistrih
PORT="${PORT:-3000}"

cd "$REPO" || { echo "[prod] repo nenájdené: $REPO"; exit 1; }

if ! command -v bun >/dev/null 2>&1; then
  echo "[prod] bun chýba — inštalujem…"
  curl -fsSL https://bun.sh/install >/dev/null 2>&1
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "[prod] stavím produkčný balík…"
if ! bun run build >/tmp/omnistrih-build.log 2>&1; then
  echo "[prod] BUILD ZLYHAL — pozri /tmp/omnistrih-build.log"
  tail -20 /tmp/omnistrih-build.log
  exit 2
fi

if [ ! -f dist/index.html ] || [ ! -f dist/server.cjs ]; then
  echo "[prod] po builde chýba dist/index.html alebo dist/server.cjs — neštartujem"
  exit 3
fi

echo "[prod] build OK ($(du -sh dist | cut -f1)) — spúšťam server na 0.0.0.0:$PORT"
export NODE_ENV=production
export PORT
exec node dist/server.cjs
