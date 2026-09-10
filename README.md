# HELP ONLINE — VELOCÍMETROS CDMX

Plataforma técnica estática para consultas de EEPROM / UPA (autos y motos).

## Accesos

- Sitio principal: `/`
- Portal seguro (sin marca/nombre): `/portal/`
- Admin (solo tú): `/admin/` — clave inicial `adminupa2026`
- Fichas dinámicas: `/ficha/?c=motos&b=yamaha&m=mt09&v=base`

## Admin

1. Entra a `/admin/` con la clave.
2. Elige Autos/Motos → marca → modelo → versión.
3. Sube 3 fotos (tablero, conexión, conexión encendido) + EEPROM/notas.
4. Guarda: se publica en el catálogo (el usuario solo puede ver).
5. Si el modelo ya existe, se agrega otra versión automáticamente.
6. Usa **Exportar JSON** y sustituye `data/catalog.json` en el hosting para respaldo permanente.

## Notas

- El slider de fotos **no** avanza solo: solo con flechas/dots.
- El logo aparece como logotipo de marca, no encima de las fotos técnicas.
- El portal seguro oculta la identidad de la marca para compartir ayuda con menos exposición.
