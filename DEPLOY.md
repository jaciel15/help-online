# Servidor permanente (para que no salga “apagado”)

Los túneles gratis (`.lhr.life`, Cloudflare, loca.lt) **se caen**.  
Para un link que no cambie: despliega este repo en **Render** o **Fly**.

## Opción A — Render (más fácil, gratis)

1. Crea cuenta en [render.com](https://render.com) e inicia sesión.
2. **New → Blueprint** → conecta el repo `jaciel15/help-online`.
3. Usa el `render.yaml` del repo (disco de 1 GB en `/app/data`).
4. Cuando termine, copia la URL (ej. `https://help-online.onrender.com`).
5. Actualiza `live.json`:

```json
{
  "url": "https://TU-APP.onrender.com",
  "backup": "https://TU-APP.onrender.com",
  "urls": ["https://TU-APP.onrender.com"],
  "updatedAt": "2026-09-11T00:00:00Z",
  "canonical": "https://jaciel15.github.io/help-online/entrar.html"
}
```

6. Haz commit + push a `main`. GitHub Pages actualizará `entrar.html`.
7. En el celular abre siempre:  
   **https://jaciel15.github.io/help-online/entrar.html**

## Opción B — Fly.io

```bash
fly auth login
fly apps create help-online
fly volumes create help_data --size 1 --region mia
fly deploy
```

Luego pon `https://help-online.fly.dev` en `live.json` (igual que arriba) y push a `main`.

## Mientras tanto (temporal)

Si el agente/cloud está encendido, `entrar.html` usa los túneles de `live.json`.  
Si ves “servidor apagado”, avisa para reactivar túneles **o** completa Render/Fly.

## Respaldo

Con el servidor vivo: `GET /api/backup` descarga un ZIP de `data/`.  
También puedes usar **Exportar JSON** en el admin.
