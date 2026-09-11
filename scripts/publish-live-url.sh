#!/usr/bin/env bash
# Actualiza live.json con túneles sanos (Cloudflare, lhr, bore) y deja listo el commit.
set -euo pipefail
cd "$(dirname "$0")/.."

URLS=()

add_if_healthy() {
  local u="${1:-}"
  [ -n "$u" ] || return 0
  u="${u%/}"
  if curl -sf --max-time 10 "$u/api/health" >/dev/null; then
    URLS+=("$u")
    echo "OK  $u"
  else
    echo "FAIL $u" >&2
  fi
}

# Cloudflare quick tunnels
for log in /tmp/cf-fresh.log /tmp/cf-now.log /tmp/cf-tunnel*.log /tmp/cloudflared*.log; do
  [ -f "$log" ] || continue
  while IFS= read -r cand; do
    add_if_healthy "$cand"
  done < <(tr -cd '\11\12\15\40-\176' < "$log" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | sort -u | tail -3 || true)
done

# localhost.run / lhr.life
for log in /tmp/lhr-fresh.log /tmp/lhr-stable.log /tmp/lhr*.log; do
  [ -f "$log" ] || continue
  while IFS= read -r cand; do
    add_if_healthy "$cand"
  done < <(tr -cd '\11\12\15\40-\176' < "$log" | grep -oE 'https://[a-z0-9]+\.(lhr\.life|lhr\.li)' | sort -u | tail -3 || true)
done

# bore.pub
for log in /tmp/bore-fresh.log /tmp/bore*.log /tmp/help-online-tunnels/bore.log; do
  [ -f "$log" ] || continue
  while IFS= read -r host; do
    add_if_healthy "http://$host"
  done < <(grep -oE 'bore\.pub:[0-9]+' "$log" | sort -u | tail -3 || true)
done

# localtunnel memorable
add_if_healthy "https://helponline-cdmx.loca.lt"

if [ ${#URLS[@]} -eq 0 ]; then
  echo "No hay túneles sanos. Levanta cloudflared/lhr/bore y reintenta." >&2
  exit 1
fi

UNIQ=()
for u in "${URLS[@]}"; do
  skip=0
  for e in "${UNIQ[@]:-}"; do
    [ "$e" = "$u" ] && skip=1 && break
  done
  [ $skip -eq 1 ] || UNIQ+=("$u")
done

python3 - "${UNIQ[@]}" <<'PY'
import json, sys
from datetime import datetime, timezone
urls = []
for u in sys.argv[1:]:
    if u and u not in urls:
        urls.append(u)
data = {
    "url": urls[0],
    "backup": urls[1] if len(urls) > 1 else urls[0],
    "urls": urls,
    "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "canonical": "https://jaciel15.github.io/help-online/entrar.html",
}
open("live.json", "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")
print("live.json ->", data["url"])
PY

git add live.json
git status -sb | head -15
echo
echo "Siguiente: commit + push a main para que entrar.html en Pages use la URL nueva."
echo "Permanente: sigue DEPLOY.md (Render/Fly) y pon esa URL en live.json."
