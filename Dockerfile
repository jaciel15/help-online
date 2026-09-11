FROM python:3.12-slim

WORKDIR /app

# App is pure stdlib + static files; no pip deps required.
COPY server.py ./
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY index.html entrar.html live.json README.md DEPLOY.md ./
COPY admin ./admin
COPY assets ./assets
COPY ayuda ./ayuda
COPY autos ./autos
COPY motos ./motos
COPY ficha ./ficha
COPY portal ./portal

# Semilla: el volumen persistente monta en /app/data y tapa este COPY.
# El entrypoint copia la semilla solo si el disco está vacío.
COPY data ./data-seed
COPY data ./data

ENV PORT=8765
ENV DATA_DIR=/app/data
ENV DATA_SEED=/app/data-seed
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3)"

ENTRYPOINT ["/entrypoint.sh"]
