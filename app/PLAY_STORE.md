# Pistea en Google Play: todo lo que hay que rellenar

Material listo en `app/store/`:
- `icono_512.png`: icono de la ficha.
- `cabecera_1024x500.png`: gráfico destacado.
- `capturas/1_estaciones.png` … `6_perfil.png`: capturas del teléfono, 1080 × 1920, hechas el 23-nov-2026 con la app actual y datos de ejemplo (sin rankings de velocidad ni logotipos de estaciones).

App firmada: `app/android/app/build/outputs/bundle/release/app-release.aab` (versión 1.0.0, versionCode 1, carga https://pistea.vercel.app).

> **Antes de subir nada, lee `LEGAL.md` (23-nov-2026).** Hay que resolver tres cosas que Google mira:
> - El aviso «Hay una versión nueva», que descarga una APK fuera de Play, no debe salir en la versión de Play (L3). Ya está resuelto: compila con `PISTEA_CANAL=play` (apartado 4).
> - La velocidad no puede ser una competición (L2).
> - Los días deben ser privados por defecto (L1).

## 0. Antes de empezar
- **Cuenta de desarrollador de Google Play**: pago único de 25 USD y verificación de identidad.
- **Cuentas personales nuevas**: Google exige una **prueba cerrada con al menos 12 personas durante 14 días** antes de poder publicar para todos. Empieza por ahí (Pruebas → Prueba cerrada).
- **Llave de subida**: `app/android/pistea-upload.jks` y su contraseña, en `app/android/keystore.properties`. **Haz copia de los dos fuera del ordenador** (gestor de contraseñas o pendrive). No están en git. Si los pierdes, Google permite cambiar la llave de subida, pero tarda días.
- Activa **Firma de apps de Google Play** (viene activada por defecto): Google guarda la llave definitiva y tú solo firmas las subidas.

## 1. Ficha de la tienda
- **Nombre**: Pistea: ranking de esquí
- **Descripción breve** (80 caracteres): Graba tus días de esquí, mira tus bajadas y compite en el ranking de España.
- **Descripción completa**:

> Pistea convierte cada día en la nieve en tu temporada.
>
> • Graba tu día con el GPS del móvil, aunque lo lleves bloqueado en el bolsillo: bajadas, desnivel, kilómetros, velocidad máxima y tiempo esquiando.
> • 27 estaciones de España con su mapa 3D: Baqueira, Sierra Nevada, Formigal, Valdesquí, Cerler, La Molina y muchas más.
> • Rankings de España y de cada estación por desnivel, kilómetros, horas o días. Liga semanal y rachas.
> • Comunidad: sigue a tus amigos, da apoyos a sus días y compara temporadas. Tú decides quién ve tus días: tus seguidores, todos o solo tú.
> • Juego limpio: cada día se comprueba con la traza GPS real. Sin simuladores ni días inflados.
> • Tus datos son tuyos: descárgalos o borra la cuenta cuando quieras.
>
> Esquía con cabeza: empieza a grabar antes de salir y guarda el móvil. Ningún récord vale un accidente.

- **Categoría**: Deportes. **Correo de contacto**: el de `LEGAL_EMAIL`.
- **Política de privacidad**: https://pistea.vercel.app/privacidad

## 2. Contenido de la aplicación (Política → Contenido de la aplicación)
| Apartado | Qué poner |
|---|---|
| Acceso a la app | «Algunas funciones necesitan cuenta». Da una cuenta de prueba (correo y contraseña) creada en https://pistea.vercel.app y explica: «Para grabar un día hay que estar en una estación; para revisar sin ir a la nieve, la cuenta ya tiene días guardados» |
| Anuncios | No |
| Clasificación de contenido | Cuestionario IARC: categoría «Social o comunicación». Los usuarios interactúan y comparten contenido (nombre, foto, biografía). Se ve la estación en la que ha esquiado cada uno. Sin violencia, sexo, apuestas ni compras |
| Público objetivo | 13-15, 16-17 y 18+ (la app admite desde 14 años). No es para niños |
| Seguridad de los datos | Tabla del apartado 3 |
| Borrado de cuenta | En la app (Perfil → Eliminar cuenta y datos) y en la web: https://pistea.vercel.app/borrar-cuenta |
| Permisos de servicio en primer plano | Tipo **location**. Texto: «Pistea graba la actividad de esquí del usuario con el GPS mientras el móvil está bloqueado. La grabación la empieza y la termina el usuario, y mientras dura hay un aviso fijo visible». Google pide un **vídeo** (YouTube oculto) que enseñe: pulsar Traquear, el aviso fijo, bloquear el móvil y terminar el día |
| Ubicación en segundo plano | No se pide (la app no usa `ACCESS_BACKGROUND_LOCATION`) |
| Divulgación destacada de la ubicación | Hecha: antes del primer permiso, la app explica para qué usa la ubicación (pantalla «Pistea usa tu ubicación») |
| Declaración de apps de salud (si Play Console la pide) | Marca «Actividad y fitness»: la app registra la actividad de esquí. No es una app médica |
| App de noticias / salud / financiera | No |

## 3. Seguridad de los datos (formulario)
- ¿Recoge o comparte datos? **Sí recoge; no comparte** (los proveedores que trabajan para ti, como Vercel, Turso y Brevo, no cuentan como compartir).
- ¿Cifrados en tránsito? **Sí** (HTTPS).
- ¿El usuario puede pedir que se borren? **Sí**.

| Tipo de dato (Google) | ¿Obligatorio? | Para qué |
|---|---|---|
| Ubicación precisa | Opcional (solo al grabar) | Funcionalidad de la app; prevención de fraude |
| Correo electrónico | Obligatorio | Gestión de la cuenta; funcionalidad; comunicaciones (verificar y recuperar la cuenta) |
| Nombre (nombre público) | Obligatorio | Funcionalidad de la app |
| ID de usuario | Obligatorio | Gestión de la cuenta |
| Otra información personal (edad) | Opcional | Funcionalidad de la app |
| Fotos (foto de perfil) | Opcional | Funcionalidad de la app |
| Información de actividad física (desnivel, distancia, velocidad) | Opcional | Funcionalidad de la app |
| Otro contenido generado por el usuario (biografía, denuncias) | Opcional | Funcionalidad de la app; seguridad |
| Interacciones con la app (seguir, apoyos, bloqueos) | Opcional | Funcionalidad de la app |
| ID del dispositivo u otros (IP y tipo de dispositivo del registro de seguridad) | Obligatorio | Prevención de fraude, seguridad y cumplimiento |

## APK fuera de la tienda (enlace `/android`)
- Versión vigente: **1.2.0 (versionCode 3)**, del 23-nov-2026. Está en Google Drive y `/android` lleva a ella (`APK.url` en `server.js`).
- Huella SHA-256 de esa APK: `84f7a5dd3f7dec032fa44222e8ccfbd71e3e48e464862ad70fb9a8c91c42fcf0`. Sirve para comprobar que nadie la ha cambiado en Drive.
- Las APK anteriores (versiones 1 y 2) siguen públicas en Drive: bórralas cuando quieras.
- `APK_MIN` sigue en 2: quien tenga la 2 no ve el aviso. Súbelo a 3 si quieres que todos se actualicen.

- **1.3.0 (versionCode 4), 25-nov-2026, sin publicar aún.** Novedades del grabador: si Android lo cierra, vuelve solo y sigue en el mismo día (si no puede, avisa y se sigue con un toque); para solo al irse de la estación o antes de las 16 horas, y lo avisa; «Retomar» sigue en el mismo día. Texto para «Novedades» de Play: «La grabación del día aguanta mejor: si el teléfono la cierra, sigue sola sin perder lo grabado, y termina sola cuando te vas de la estación.»

## 4. Publicar una versión
1. Sube `versionCode` en `app/android/app/build.gradle` (+1 cada vez) y `versionName`.
2. `cd app` · `PISTEA_CANAL=play PISTEA_URL=https://pistea.vercel.app node sync.js` · `cd android` · `gradlew bundleRelease`. **`PISTEA_CANAL=play` es obligatorio**: así la app no enseña el aviso «Hay una versión nueva» (descarga una APK fuera de Play), que Google prohíbe. La APK que se reparte por el enlace `/android` se hace sin esa variable.
3. Sube `app-release.aab` en Play Console → Prueba cerrada (o Producción cuando Google lo permita).

La web se actualiza sola al subir a GitHub (Vercel está conectado a `main`). La app carga la web, así que casi todos los cambios no necesitan una versión nueva en Google Play. Solo hacen falta si cambia algo de Android: permisos, grabador GPS o iconos.
