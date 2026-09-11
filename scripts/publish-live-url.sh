#!/usr/bin/env bash
# Actualiza live.json con túneles sanos y lo publica a GitHub Pages.
set -euo pipefail
cd "$(dirname "$0")/.."

URLS=()

add_if_healthy() {
  local u="$1"
  [ -n "$u" ] || return 0
  if curl -sf --max-time 8 "$u/api/health" >/dev/null; then
    URLS+=("$u")
  fi
}

# Prefer HTTPS tunnels for GitHub Pages redirector
for log in /tmp/lhr-stable.log /tmp/lhr1.log /tmp/lhr-d.log /tmp/lhr-up.log /tmp/lhr-live2.log; do
  [ -f "$log" ] || continue
  cand=$(tr -cd '\11\12\15\40-\176' < "$log" | grep -oE 'https://[a-z0-9]+\.lhr\.life' | tail -1 || true)
  add_if_healthy "${cand:-}"
done

for log in /tmp/b1.log /tmp/bore-d.log /tmp/bore-up.log /tmp/bore-now2.log /tmp/bore-live.log; do
  [ -f "$log" ] || continue
  host=$(grep -oE 'bore\.pub:[0-9]+' "$log" | tail -1 || true)
  add_if_healthy "http://${host:-}"
done

if [ ${#URLS[@]} -eq 0 ]; then
  echo "No hay túneles sanos" >&2
  exit 1
fi

# unique preserve order
UNIQ=()
for u in "${URLS[@]}"; do
  skip=0
  for e in "${UNIQ[@]:-}"; do
    [ "$e" = "$u" ] && skip=1 && break
  done
  [ $skip -eq 1 ] || UNIQ+=("$u")
done

PRIMARY="${UNIQ[0]}"
BACKUP="${UNIQ[$(( ${#UNIQ[@]} > 1 ? 1 : 0 ))]}"

python3 - "$PRIMARY" "$BACKUP" "${UNIQ[@]}" <<'PY'
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
print("OK", data["url"])
PY

git add live.json
if git diff --cached --quiet; then
  echo "live.json sin cambios de stage (quizá igual)"; 
fi
git add entrar.html scripts/publish-live-url.sh index.html assets/js/site.js live.json
git status -sb | head -20
