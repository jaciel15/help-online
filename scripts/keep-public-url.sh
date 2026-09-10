#!/usr/bin/env bash
# Mantiene el servidor + túnel con URL memorable.
# URL pública: https://helponline-cdmx.loca.lt
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p /tmp/help-online-tunnels
PORT="${PORT:-8765}"

if ! curl -sf --max-time 2 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "[start] levantando server.py en :${PORT}"
  nohup python3 server.py >> /tmp/help-online-tunnels/server.log 2>&1 &
  sleep 1
fi

start_lt() {
  if pgrep -f "lt --port ${PORT} --subdomain helponline-cdmx" >/dev/null; then
    return 0
  fi
  echo "[start] localtunnel helponline-cdmx.loca.lt"
  nohup npx --yes localtunnel --port "${PORT}" --subdomain helponline-cdmx \
    >> /tmp/help-online-tunnels/lt.log 2>&1 &
}

start_bore() {
  if pgrep -f "/tmp/bore local ${PORT}" >/dev/null; then
    return 0
  fi
  if [ -x /tmp/bore ]; then
    echo "[start] bore backup"
    nohup /tmp/bore local "${PORT}" --to bore.pub >> /tmp/help-online-tunnels/bore.log 2>&1 &
  fi
}

echo "=============================================="
echo " HELP ONLINE — link fijo (mientras el agente esté activo):"
echo " https://helponline-cdmx.loca.lt/#administrador"
echo " clave: adminupa2026"
echo "=============================================="

while true; do
  start_lt
  start_bore
  if ! curl -sf --max-time 2 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    nohup python3 server.py >> /tmp/help-online-tunnels/server.log 2>&1 &
  fi
  sleep 20
done
