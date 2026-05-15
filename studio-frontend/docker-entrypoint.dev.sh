#!/bin/sh
echo '[studio-frontend] Installing dependencies...'

# Background watchdog prints progress every 15s
( while true; do
    sleep 15
    count=$(ls /usr/src/node_modules 2>/dev/null | wc -l)
    echo "[studio-frontend] pnpm install in progress... (node_modules: ${count} packages)"
done ) &
watchdog=$!

pnpm install --frozen-lockfile --config.confirmModulesPurge=false || pnpm install --config.confirmModulesPurge=false
kill "$watchdog" 2>/dev/null
wait "$watchdog" 2>/dev/null

echo '[studio-frontend] Install complete. Starting dev server...'
exec pnpm dev
