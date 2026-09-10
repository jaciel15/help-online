FROM python:3.12-slim

WORKDIR /app

# App is pure stdlib + static files; no pip deps required.
COPY server.py ./
COPY index.html ./
COPY README.md ./
COPY admin ./admin
COPY assets ./assets
COPY ayuda ./ayuda
COPY autos ./autos
COPY motos ./motos
COPY ficha ./ficha
COPY portal ./portal
COPY data ./data

ENV PORT=8765
EXPOSE 8765

CMD ["python3", "server.py"]
