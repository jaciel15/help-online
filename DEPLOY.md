# HELP ONLINE en GitHub Pages (no se apaga)

Todo el sistema (cliente + admin) corre en **GitHub Pages**.  
No hace falta Render, Fly ni túneles para editar.

## Link fijo

- Sitio / admin: https://jaciel15.github.io/help-online/  
- Admin directo: https://jaciel15.github.io/help-online/#administrador  
- Ejemplo cliente: https://jaciel15.github.io/help-online/ayuda/?c=motos&b=yamaha&m=mt09&v=base  

## Cómo editar (una sola vez por teléfono)

1. En GitHub: **Settings → Developer settings → Personal access tokens**.
2. Crea un token (fine-grained) solo para el repo `jaciel15/help-online`.
3. Permiso: **Contents → Read and write**.
4. Abre el admin, pon la clave `adminupa2026` y **pega el token**.
5. El token se guarda en **tu teléfono** (localStorage), no en el código del repo.
6. Ya puedes **Guardar / Editar / Borrar**. Tras guardar, espera ~1 minuto a que Pages actualice el link del cliente.

## Notas

- Si cambias de teléfono, vuelve a pegar el token.
- `server.py` queda solo para pruebas locales opcionales.
- Los túneles / `live.json` ya no son necesarios para el uso diario.
