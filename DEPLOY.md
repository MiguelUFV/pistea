# Pistea · puesta en producción

## 1. Qué necesitas
- Un servidor (VPS) con Docker y un **dominio** apuntando a su IP (registro A).
- Una cuenta en [Resend](https://resend.com) (gratis hasta 3.000 correos/mes) para el correo de recuperación de contraseña. Verifica tu dominio y crea una API key.
- Los mapas 3D ya van en el repositorio (`mapas/`, ≈ 780 MB) y se copian a la imagen de Docker: no hay que subirlos aparte.

## 2. Configuración
```
cp .env.example .env      # y rellena DOMAIN, APP_URL, RESEND_API_KEY, MAIL_FROM
docker compose up -d --build
```
- **HTTPS**: lo da Caddy solo, con certificado de Let's Encrypt, en cuanto el dominio apunta al servidor (puertos 80 y 443 abiertos). El servidor de Pistea redirige a HTTPS y manda HSTS.
- **Base de datos**: SQLite en el volumen `datos` (`pistea.sqlite`, modo WAL). **Copia de seguridad**: `docker compose exec pistea node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/pistea.sqlite').exec(\"VACUUM INTO '/data/copia.sqlite'\")"` y guarda `copia.sqlite` fuera del servidor (cron diario).
- **Producción** (`NODE_ENV=production`): no se crean usuarios de ejemplo y se **desactiva la simulación**: solo cuentan días grabados con el GPS real.
- Sin `RESEND_API_KEY` el enlace de recuperación solo sale en el log (`docker compose logs pistea`): vale para pruebas, no para usuarios.

## 3. Antes de abrirlo al público
- Texto legal: política de privacidad y condiciones (la ubicación es un dato personal, RGPD). La cuenta ya se puede borrar desde Perfil.
- Permiso de las estaciones para usar su nombre y marca en la app.
- Cuando haya miles de usuarios: pasar de SQLite a PostgreSQL (el SQL de `server.js` es estándar salvo `random()` y `INSERT OR IGNORE`), y Redis para los límites de intentos si hay varias réplicas.
- Pruebas: `node --no-warnings test.js` (46 comprobaciones, usa una BD temporal).

## 4. App de Android (`app/`)
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
