# Pistea en Google Play: todo lo que hay que rellenar

Material listo en `app/store/`:
- `icono_512.png`: icono de la ficha.
- `cabecera_1024x500.png`: gráfico destacado.
- `capturas/1_estaciones.png` … `4_estacion.png`: capturas del teléfono, 1080 × 1920.

App firmada: `app/android/app/build/outputs/bundle/release/app-release.aab` (versión 1.0.0, versionCode 1, carga https://pistea.vercel.app).

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
> • Comunidad: sigue a tus amigos, da apoyos a sus días y compara temporadas.
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

## 4. Publicar una versión
1. Sube `versionCode` en `app/android/app/build.gradle` (+1 cada vez) y `versionName`.
2. `cd app` · `PISTEA_URL=https://pistea.vercel.app node sync.js` · `cd android` · `gradlew bundleRelease`.
3. Sube `app-release.aab` en Play Console → Prueba cerrada (o Producción cuando Google lo permita).

La web se actualiza sola al subir a GitHub (Vercel está conectado a `main`). La app carga la web, así que casi todos los cambios no necesitan una versión nueva en Google Play. Solo hacen falta si cambia algo de Android: permisos, grabador GPS o iconos.
