# Pistea · puesta en producción

## 1. Dónde se guardan los datos
- **Base de datos: Turso (libSQL)**, persistente, con copias automáticas y conexión cifrada (TLS). El servidor crea y pone al día las tablas solo al arrancar.
- Variables: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (ver `.env.example`). **En Vercel son obligatorias**: el disco de Vercel es temporal y, sin Turso, la API responde 503 en vez de perder cuentas.
- En local, sin esas variables, se usa un fichero `pistea.sqlite` (o el de `DATA_DIR`). Las pruebas usan siempre una BD temporal, nunca la de producción.
- Las fotos de perfil van dentro de la BD (≤ 400 KB, reducidas a 300×300 en el móvil).

## 2. Vercel (lo que hay ahora)
- `vercel.json` manda todo a `server.js` e incluye `public/`. Variables en el panel de Vercel: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `RESEND_API_KEY`, `MAIL_FROM` (y `APP_URL` si el dominio no es el de producción de Vercel).
- **Mapas 3D**: la carpeta `mapas/` (≈ 780 MB) no cabe en una función de Vercel (límite 250 MB): hay que servirla aparte (almacenamiento estático o CDN) y apuntar el iframe a esa dirección. Sin eso, la ficha no enseña el 3D en Vercel.
- El plan gratuito de Vercel no permite uso comercial: para lanzar, plan Pro o servidor propio.

## 3. Servidor propio con Docker (alternativa)
```
cp .env.example .env      # rellena DOMAIN, APP_URL, TURSO_*, RESEND_API_KEY, MAIL_FROM y descomenta TRUST_PROXY=1
docker compose up -d --build
```
- **HTTPS** con Caddy y Let's Encrypt en cuanto el dominio apunta al servidor (puertos 80 y 443). Pistea redirige a HTTPS y manda HSTS.
- Sin Turso, la BD es `/data/pistea.sqlite` en el volumen `datos`: haz copia diaria fuera del servidor.

## Antes de abrirlo al público
Ver la lista de `SEGURIDAD.md` («Antes de publicar»). Pruebas: `npm test` (69 comprobaciones; levanta el servidor con una BD temporal y lo reinicia para comprobar que nada se pierde).

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
