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

## Admin

1. Entra a `/admin/`.
2. Sube Autos/Motos → marca → modelo → versión + 3 fotos + EEPROM.
3. Si el modelo ya existe, se agrega **otra versión** sola.
4. Copia el **link cliente** (botón en el catálogo del admin) y envíaselo al usuario.
5. Exporta JSON y reemplaza `data/catalog.json` en el hosting para respaldo.

## Notas

- Slider de fotos: solo con flechas (sin autoplay).
- Logo solo como logotipo, no encima de fotos técnicas.
- Solo el administrador puede editar o subir ayudas.
