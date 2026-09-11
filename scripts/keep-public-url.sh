#!/usr/bin/env bash
# Mantiene server + túneles HTTPS vivos y republica live.json cuando cambian.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p /tmp/help-online-tunnels
PORT="${PORT:-8765}"

ensure_server() {
  if curl -sf --max-time 2 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    return 0
  fi
  echo "[keep] levantando server.py :${PORT}"
  nohup python3 server.py >> /tmp/help-online-tunnels/server.log 2>&1 &
  sleep 1
}

ensure_cloudflared() {
  if pgrep -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" >/dev/null; then
    return 0
  fi
  if ! command -v cloudflared >/dev/null; then
    return 0
  fi
  echo "[keep] cloudflared"
  nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" \
    >> /tmp/cf-fresh.log 2>&1 &
}

ensure_lhr() {
  if pgrep -f "nokey@localhost.run" >/dev/null; then
    return 0
  fi
  echo "[keep] localhost.run / lhr"
  nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 \
    -o ExitOnForwardFailure=yes -R "80:127.0.0.1:${PORT}" nokey@localhost.run \
    >> /tmp/lhr-fresh.log 2>&1 &
}

ensure_bore() {
  if pgrep -f "/tmp/bore local ${PORT}" >/dev/null || pgrep -f "bore local ${PORT}" >/dev/null; then
    return 0
  fi
  if [ -x /tmp/bore ]; then
    echo "[keep] bore"
    nohup /tmp/bore local "${PORT}" --to bore.pub >> /tmp/bore-fresh.log 2>&1 &
  fi
}

LAST=""
while true; do
  ensure_server
  ensure_cloudflared
  ensure_lhr
  ensure_bore
  sleep 8
  if bash scripts/publish-live-url.sh >/tmp/help-online-tunnels/publish.out 2>&1; then
    CUR=$(python3 -c 'import json;print(json.load(open("live.json"))["url"])' 2>/dev/null || true)
    if [ -n "$CUR" ] && [ "$CUR" != "$LAST" ]; then
      echo "[keep] URL activa: $CUR"
      LAST="$CUR"
    fi
  fi
  sleep 25
done
