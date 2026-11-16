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
  - Moderadores: `ADMIN_EMAILS`.
  - Opcional: `APP_URL`, si usas un dominio propio.
  - Tras cambiar una variable hay que publicar de nuevo (Deployments → ⋯ → Redeploy).
- **Mapas 3D**: `mapas/` se sirve también desde Vercel, comprobado en producción. Cada vista del 3D descarga entre 40 y 75 MB: vigila el tráfico del plan.
- **Plan**: el plan gratuito de Vercel no permite uso comercial. Para lanzar, plan Pro o servidor propio.

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
