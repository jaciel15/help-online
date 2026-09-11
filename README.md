# HELP ONLINE — VELOCÍMETROS CDMX

Aplicación de **ayuda / soporte UPA** (autos y motos).

## Cómo funciona la ayuda al cliente

Cuando soporte da click en **Help** de una unidad, se abre **solo esa ficha**:

- Ejemplo MT-09: `/ayuda/?c=motos&b=yamaha&m=mt09&v=base`
- Ejemplo Ford Fusion: `/ayuda/?c=autos&b=ford&m=fusion&v=base`

El cliente puede ver fotos (flechas) y datos EEPROM, pero **no puede regresar al catálogo** ni ver otras ayudas.

También sirve el link de carpeta fija, p. ej. `/motos/yamaha/mt09/` (ya bloqueada).

## Accesos

| Quién | URL | Puede |
|---|---|---|
| Cliente | `/ayuda/?c=...&b=...&m=...&v=...` | Solo ver esa ficha |
| Tú (admin) | `/admin/` clave `adminupa2026` | Subir / editar / copiar links |
| Tú (interno) | `/` `/autos/` `/motos/` `/ficha/` | Navegar catálogo completo |

## Página inicial = sistema completo (creador)

Abre `/` (o `/#administrador`):

1. Entra con clave `adminupa2026`.
2. Añade auto/moto + datos + **4 fotos**.
3. Pulsa **Guardar en catálogo** → se crea la carpeta en el catálogo y **te lleva a la página del cliente** (bloqueada).
4. Si no te gusta, vuelve a `/#administrador`, pulsa **Editar** y vuelve a guardar.

El cliente solo ve su link, p. ej. `/ayuda/?c=motos&b=kawasaki&m=zr&v=base` — sin regresar ni editar.

### Almacenamiento (muchas ayudas)
- Las fotos se **comprimen** (JPEG ~1280px) al subir.
- Catálogo local en **IndexedDB**.
- Al **Guardar**, se publica en `data/help/...` por API (`python3 server.py`) para que el **link copiado funcione en cualquier teléfono**.
- Carpetas por marca: Nissan / Yamaha / Toyota… con editar y borrar.

### Servidor local / túnel (temporal)
```bash
python3 server.py
# luego un túnel (bore / localhost.run). Esas URLs CAMBIAN y se caen.
```

### URL fija (permanente) — recomendado
Los túneles gratis no sirven para producción. Para un link que **no cambie**:

1. **Render** (fácil): conecta el repo → usa `render.yaml` → te dan algo como `https://help-online.onrender.com`
2. **Fly.io**: usa `fly.toml` → `https://help-online.fly.dev`
3. (Opcional) compra un dominio y apúntalo: `https://ayuda.tudominio.com`

Archivos listos en el repo: `Dockerfile`, `render.yaml`, `fly.toml`.

`/admin/` redirige a la página inicial.

## Notas

- Slider de fotos: solo con flechas (sin autoplay).
- Logo solo como logotipo, no encima de fotos técnicas.
- Solo el administrador puede editar o subir ayudas.
- La vista `/ayuda/` carga **solo** el JSON de esa unidad (`data/help/...`), no el catálogo completo.
- `/ficha/` es interna: sin sesión admin redirige a `/ayuda/`.
