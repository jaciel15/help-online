# HELP ONLINE — VELOCÍMETROS CDMX

Aplicación de **ayuda / soporte UPA** (autos y motos).  
Todo corre en **GitHub Pages** (no se apaga).

## Link fijo

https://jaciel15.github.io/help-online/

## Cómo funciona la ayuda al cliente

Cuando soporte pulsa **Copiar link**, el cliente recibe un link permanente:

- Ejemplo MT-09: `https://jaciel15.github.io/help-online/ayuda/?c=motos&b=yamaha&m=mt09&v=base`
- Ejemplo Ford Focus: `https://jaciel15.github.io/help-online/ayuda/?c=autos&b=ford&m=focus&v=base`

El cliente ve fotos y datos EEPROM, pero **no** puede volver al catálogo ni ver otras fichas.

## Accesos

| Quién | URL | Puede |
|---|---|---|
| Cliente | `/ayuda/?c=...&b=...&m=...&v=...` en GitHub Pages | Solo esa ficha |
| Tú (admin) | `/#administrador` + clave + token GitHub | Subir / editar / borrar |

## Admin (nunca se apaga)

1. Abre https://jaciel15.github.io/help-online/#administrador
2. Clave: `adminupa2026`
3. Pega un **Personal Access Token** de GitHub con `Contents: Read and write` en este repo (solo la primera vez por teléfono).
4. Sube auto/moto + 4 fotos → **Guardar en catálogo**.
5. Copia el link permanente y envíaselo al cliente.

Detalle del token: ver `DEPLOY.md`.

### Almacenamiento
- Fotos comprimidas (JPEG ~1024px) al subir.
- Al Guardar se escriben `data/help/...` y `data/catalog.json` en el repo vía GitHub API.
- GitHub Pages publica esos archivos; el link del cliente queda fijo.

### Prueba local (opcional)
```bash
python3 server.py
# abre http://127.0.0.1:8765/#administrador
```

## Notas

- Slider de fotos: solo flechas (sin autoplay).
- Solo el administrador puede editar o subir ayudas.
- `/ficha/` es interna: sin sesión admin redirige a `/ayuda/`.
