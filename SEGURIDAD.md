# Pistea · Seguridad

Auditoría del 16-nov-2026 de todo `pistea/` (servidor, página, app de Android, despliegue y secretos) y de lo que se hizo después, paso a paso. `npm test` comprueba **150 casos** (17-nov-2026) contra un servidor real con BD temporal, reiniciándolo para ver que nada se pierde.

## Estado
- **Cuentas que no se pierden.** El fallo grave era que, en Vercel, la base de datos se escribía en `/tmp` y se borraba. Ahora todo va a **Turso** (persistente, con conexión cifrada). Producción (https://pistea.vercel.app) ya funciona así: `/healthz` responde y las variables de Turso están en Vercel.
- **Hecho:** sesión segura, verificación de correo, denunciar y bloquear con moderación, páginas legales, antitrampas, CSP estricta y app de Android firmada.
- **Falta** lo que solo puedes hacer tú: configurar el correo, tus datos legales, las cuentas en Google Play y la configuración de Vercel. Está al final de este documento.

## Cómo funciona una cuenta
1. **Crear cuenta**: correo, nombre, contraseña y aceptar condiciones y privacidad. El servidor rechaza contraseñas comunes o que contengan tu correo o tu nombre, y nombres ofensivos. La contraseña se guarda como *hash* scrypt (N=32768, sal propia): nadie puede leerla.
2. **Confirmar el correo**: llega un enlace válido 48 horas. Hasta confirmarlo, los días cuentan para ti pero no sales en los rankings, la comunidad ni la búsqueda. Así nadie puede llenar el ranking con cuentas falsas o con correos ajenos. Sin correo configurado no se exige, y esas cuentas se dan por buenas.
3. **Sesión**: cookie `HttpOnly`, `Secure` y `SameSite=Lax` (`__Host-pistea`). JavaScript no puede leerla. Dura 90 días desde el último uso y se renueva sola. Toda escritura exige la cabecera `X-Pistea`, que protege contra CSRF.
4. **La próxima vez** entras sin escribir nada. Si cierras sesión, el correo queda recordado. Sin internet, la app dice «Sin conexión» y no te saca.
5. **Recuperar la contraseña**: enlace de un solo uso que caduca en 1 hora. Al usarlo se cierran todas las sesiones.
6. **En Perfil**: cambiar contraseña (cierra los demás dispositivos), cerrar sesión en todos, usuarios bloqueados, descargar tus datos y borrar la cuenta.

## Lo corregido
| # | Gravedad | Problema | Arreglo |
|---|---|---|---|
| C1 | Crítica | BD en `/tmp` de Vercel: cuentas y sesiones borradas | Turso; sin él, la API responde 503 en lugar de perder datos |
| C2 | Crítica | Fotos de perfil en `/tmp` | Dentro de la BD (≤ 400 KB) |
| C3 | Crítica | El correo de recuperación se cortaba en Vercel | Se envía antes de responder |
| C4 | Crítica | Límites de intentos en memoria: no frenaban la fuerza bruta | En la BD; sobreviven a reinicios |
| C5 | Crítica | Token de sesión en `localStorage`, robable con una inyección | Cookie `HttpOnly` |
| A1 | Alta | IP del cliente mal leída: un atacante bloqueaba el inicio de sesión de todos | IP de la plataforma en Vercel; último valor de `X-Forwarded-For` detrás de proxy |
| A2 | Alta | Sin defensa CSRF | Cabecera obligatoria y rechazo de `Sec-Fetch-Site: cross-site` |
| A3 | Alta | Edad visible en el perfil público | Solo para su dueño |
| A4 | Alta | Contraseñas débiles admitidas; scrypt con coste bajo | Filtro, N=32768 y renovación de hashes antiguos |
| A5 | Alta | Sin cambiar contraseña ni cerrar sesiones | Hecho; máximo 20 sesiones |
| A6 | Alta | El borrado de cuenta dependía de `ON DELETE CASCADE` | Borrado explícito en una transacción |
| A7 | Alta | Sin proveedor de correo, el enlace de recuperación salía en los registros | Nunca en producción |
| A8 | Alta | Cualquiera podía registrarse con un correo ajeno y salir en público | Verificación del correo |
| A9 | Alta | Sin denunciar ni bloquear (lo exigen Google y Apple) | Denuncias con 6 motivos; con 3 personas distintas el usuario se oculta. Bloqueo en las dos direcciones. Panel de moderación para `ADMIN_EMAILS`. Filtro de nombres y biografías |
| A10 | Alta | El ranking se fiaba de las cifras del móvil | El servidor recalcula el día desde la traza GPS (`calc.js`, el mismo código que la app). Rechaza trazas fuera de la estación, ubicaciones simuladas, saltos de más de 150 km/h, días de hace más de una semana y repeticiones. La traza no se guarda |
| M1 | Media | `/api/stations` con 27 consultas por visita | Caché de 1 minuto |
| M2 | Media | Registro de accesos sin plazo; un texto de la app decía «inmutable» | 180 días; texto corregido |
| M3 | Media | Fotos: tipo según el cliente | Tipo por contenido, `nosniff` y `sandbox`; SVG prohibido |
| M4 | Media | Caracteres de control y RTL en los nombres | Se limpian |
| M5 | Media | Bots de registro | Campo trampa; 10 cuentas por hora y conexión |
| M6 | Media | Errores internos como 400 | 500 sin detalles |
| M7 | Media | Android copiaba la sesión y el GPS a Google Drive | Copia desactivada |
| M8 | Media | CSP con `'unsafe-inline'` y 51 `onclick` en el HTML | `script-src 'self'`: el código va en `/app.js` con una lista cerrada de acciones |
| M9 | Media | Faltaban cabeceras | COOP, `Permissions-Policy`, `object-src 'none'`, `X-Frame-Options` |
| M10 | Media | Sin textos legales | `/privacidad`, `/condiciones`, `/normas` y `/borrar-cuenta` |
| M11 | Media | Android pedía un permiso de batería que Google restringe | Quitado |
| M12 | Media | Guardar un día recalculaba la traza (lo caro) antes de mirar el límite de 5 días por 24 h: se podía cargar el servidor a peticiones | Los límites van antes del cálculo, y además 30 intentos por hora y cuenta (18-nov-2026) |
| M13 | Media | Se podía seguir a cuentas ocultas, suspendidas o sin verificar y dar apoyo a sus días | Solo a cuentas públicas; dejar de seguir vale siempre |
| M14 | Media | Ningún freno contra un bucle o un robot que lance peticiones sin parar | 1.200 peticiones por minuto y conexión en la API, en memoria (no escribe en la BD); los límites finos siguen en la BD |
| B1 | Baja | Pasaporte y récords por pista (17-nov-2026): las clasificaciones leían la tabla entera en cada petición | Lo de todos se guarda un minuto; lo propio y los bloqueos se aplican en cada petición. Solo salen cuentas públicas; el pasaporte entero lo ve solo su dueño; se borra con la cuenta y con el día quitado por moderación; va en la exportación de datos y en la política de privacidad |

**Revisado y correcto:** SQL siempre con parámetros. Todo lo que escriben los usuarios se escapa al pintarlo. Los ficheros no se pueden leer fuera de su carpeta. Los tokens se guardan como *hash*. No hay secretos en git: ni `.env.local` ni la llave de firma. Hay una sola dependencia y `npm audit` no da vulnerabilidades.

## Lo que tienes que hacer tú
| # | Qué | Dónde |
|---|---|---|
| T1 | **Correo** (Brevo, gratis): crear la cuenta, verificar tu remitente y poner `BREVO_API_KEY` y `MAIL_FROM` en Vercel | Paso a paso en el último mensaje de Claude y en `DEPLOY.md` |
| T2 | **Datos legales**: `LEGAL_NAME` (tu nombre) y `LEGAL_EMAIL` (correo de contacto) en Vercel. Hasta entonces, las páginas legales enseñan un aviso amarillo | Vercel → Settings → Environment Variables |
| T3 | **Moderador**: `ADMIN_EMAILS` con tu correo en Vercel | Ídem |
| T4 | **Google Play**: cuenta (25 USD), prueba cerrada con 12 personas durante 14 días, ficha, formulario de datos y vídeo del servicio de ubicación | `app/PLAY_STORE.md` |
| T5 | **Copia de la llave de firma**: `app/android/pistea-upload.jks` y `keystore.properties` | Fuera del ordenador |
| T6 | **Vercel**: el plan gratuito no permite uso comercial. Los mapas 3D (de 40 a 75 MB por vista) ya se sirven desde Cloudflare Pages, fuera de Vercel. Activa el Firewall o el Attack Challenge si hay ataques | Vercel → Settings |
| T7 | **Turso**: probar a restaurar una copia y elegir una región de la UE | Panel de Turso |
| T8 | **Permiso de las estaciones** para usar su nombre y su marca. El mapa 3D enseña logotipos oficiales | — |

## Recomendaciones que quedan
- **El 3D en otro dominio**: hecho el 17-nov-2026. Se sirve desde https://pistea-mapas.pages.dev (Cloudflare Pages), otro origen, en un `iframe` permitido solo por `frame-src`.
- **El registro dice «ese correo ya tiene cuenta»**: es una decisión de usabilidad. Revela qué correos están registrados, pero con un máximo de 40 intentos por hora y conexión.
- **iOS**: Apple suele rechazar apps que son solo una web en un envoltorio (guía 4.2). Además falta el proyecto de iOS y el grabador GPS nativo.
