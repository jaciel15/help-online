#!/bin/sh
# Si el volumen persistente está vacío, copia la semilla del catálogo.
set -e
SEED="${DATA_SEED:-/app/data-seed}"
DATA="${DATA_DIR:-/app/data}"

mkdir -p "$DATA"
if [ -d "$SEED" ] && [ ! -f "$DATA/catalog.json" ]; then
  echo "[entrypoint] Inicializando data/ desde semilla…"
  cp -a "$SEED"/. "$DATA"/
fi

exec python3 server.py
