# Pistea · puesta en producción

## 1. Dónde se guardan los datos
- **Base de datos: Turso (libSQL)**, persistente, con copias automáticas y conexión cifrada (TLS). El servidor crea y pone al día las tablas solo al arrancar.
- Variables: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (ver `.env.example`). **En Vercel son obligatorias**: el disco de Vercel es temporal y, sin Turso, la API responde 503 en vez de perder cuentas.
- En local, sin esas variables, se usa un fichero `pistea.sqlite` (o el de `DATA_DIR`). Las pruebas usan siempre una BD temporal, nunca la de producción.
- Las fotos de perfil van dentro de la BD (≤ 400 KB, reducidas a 300×300 en el móvil).

## 2. Vercel (lo que hay ahora): https://pistea.vercel.app
- **Se publica solo**: Vercel está conectado al repositorio de GitHub. Cada subida a `main` publica una versión nueva en un par de minutos.
- **Variables** (Vercel → Settings → Environment Variables, entorno Production):
  - Base de datos: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`. Ya están.
  - Correo: `BREVO_API_KEY` y `MAIL_FROM`.
  - Páginas legales: `LEGAL_NAME` y `LEGAL_EMAIL`.
  - Moderadores y panel de datos: `ADMIN_EMAILS` (correos separados por comas). Esas cuentas, con el correo verificado, moderan las denuncias y abren https://pistea.vercel.app/panel: todas las cuentas con sus datos, gráficas, informe y descarga para Excel.
  - Opcional: `APP_URL`, si usas un dominio propio.
  - Tras cambiar una variable hay que publicar de nuevo (Deployments → ⋯ → Redeploy).
- **Mapas 3D: en Cloudflare Pages** (proyecto `pistea-mapas`, https://pistea-mapas.pages.dev), gratis y sin límite de tráfico; cada vista del 3D descarga entre 40 y 75 MB. A Vercel solo sube su relieve (`dem.u16d`, para el motor del día; ver `.vercelignore`): con los mapas dentro de la función, el 16-nov-2026 el «Functions Storage» llegó a unos 18 GB (el plan gratuito da 10). `/3d/…` redirige allí, salvo el relieve. Tras recompilar los mapas, **desde una carpeta fuera de Pistea**: `npx wrangler pages deploy <ruta>/pistea/mapas --project-name pistea-mapas --branch main` (la primera vez, `npx wrangler login`). Dentro de la carpeta, wrangler 4 «autoconfigura» Pistea como un Worker: cambia `package.json` y `.gitignore` y crea `wrangler.jsonc`. Para otra dirección, la variable `MAPS_URL`.
- **Plan**: el plan gratuito de Vercel no permite uso comercial. Para lanzar, plan Pro o servidor propio.
- **Pistas recalculadas (cambio de nombres o colores en Estaciones3D)**, en este orden:
  1. En Estaciones3D: `build_assets.py` de cada estación tocada y `cd web && npm run build`.
  2. Copiar `web/dist/app` a `mapas/` (en Windows, `robocopy <dist/app> <pistea/mapas> /MIR`).
  3. Aquí: `python scripts/gen_invierno.py`, `node scripts/gen_seguimiento.js`, `node scripts/gen_dificultad.js` y `node scripts/gen_pistas.js`.
  4. `npm test` y `node scripts/banco_seguimiento.js 12`.
  5. Publicar los mapas en Cloudflare (arriba) y, después, subir a GitHub. Al arrancar, el servidor crea la tabla `passes` (pasaporte y récords por pista) y la rellena una vez con los días guardados.
  Los días ya guardados conservan los nombres de pista con los que se calcularon. Si una pista cambia de nombre, sus bajadas antiguas siguen en el pasaporte con el nombre viejo y no cuentan para la ficha nueva.

## 3. Servidor propio con Docker (alternativa)
```
cp .env.example .env      # rellena DOMAIN, APP_URL, TURSO_*, RESEND_API_KEY, MAIL_FROM y descomenta TRUST_PROXY=1
docker compose up -d --build
```
- **HTTPS** con Caddy y Let's Encrypt en cuanto el dominio apunta al servidor (puertos 80 y 443). Pistea redirige a HTTPS y manda HSTS.
- Sin Turso, la BD es `/data/pistea.sqlite` en el volumen `datos`: haz copia diaria fuera del servidor.

## 4. El motor del día (traquear)
- `public/calc.js` es el mismo en la app (cifras en directo) y en el servidor, que recalcula cada día desde la traza GPS: remontes, cada bajada con sus pistas, freeride, desnivel con el relieve del mapa 3D. Está explicado al principio del fichero.
- Datos de cada estación: `node scripts/gen_seguimiento.js` escribe `public/seg/<id>.json` (pistas, remontes, proyección) y el recuadro de cada miniatura en `public/img/estaciones.json`. Necesita `../../Estaciones3D/scripts/estaciones`. Vuelve a lanzarlo si cambian los mapas o se rehacen las miniaturas. El relieve se lee de `mapas/estaciones/<id>/data/dem.u16d`: sin él, el servidor usa la altitud del GPS, peor.
- Banco de pruebas: `node scripts/banco_seguimiento.js 12` (días sintéticos con la verdad conocida, con freeride, un remonte que no está en el mapa y vuelta en coche). Pásalo antes y después de tocar el motor: a ojo se empeora fácil.
- Las pistas de la ficha de cada estación: `node scripts/gen_pistas.js`.

## Antes de abrirlo al público
Ver la lista de `SEGURIDAD.md` («Antes de publicar»). Pruebas: `npm test` (173 comprobaciones el 18-nov-2026; levanta el servidor con una BD temporal y lo reinicia para comprobar que nada se pierde).

## App de Android (`app/`)
La app es un envoltorio de Capacitor que carga Pistea desde tu servidor y añade el **grabador GPS nativo** (el mismo de «Mi día»): una posición por segundo, apuntada en un fichero del teléfono, con un servicio en primer plano. Sigue grabando con la pantalla apagada o la app cerrada, y el día se recupera desde el aviso de la portada.
```
cd app
npm install                                   # solo la primera vez
PISTEA_URL=https://pistea.tudominio.es node sync.js     # sin variable: http://10.0.2.2:3000 (emulador)
cd android && ./gradlew assembleDebug         # APK en app/build/outputs/apk/debug/app-debug.apk
```
- Java 21 y el SDK de Android (`JAVA_HOME`, `ANDROID_HOME`). No crees `android/local.properties` a mano en Windows: con la ruta mal escapada Gradle falla.
- El envoltorio de Gradle debe seguir en la 8.14.3 (`android/gradle/wrapper/gradle-wrapper.properties`).
- Para publicar en Play Store hace falta firmar la app (`assembleRelease` con un almacén de claves propio) y cambiar el icono por defecto de Capacitor.
- Probada en el emulador (`valdesqui_prueba`): la web remota carga, el plugin `Grabador` responde, graba posiciones de `adb emu geo fix` y, tras `force-stop`, la app recupera el día desde el fichero. **No probada en un teléfono real ni en la nieve.**
