# Pistea · Seguridad

Auditorías del 16-nov-2026 y del **23-nov-2026** de todo `pistea/` (servidor, página, app de Android, despliegue y secretos) y de lo que se hizo después, paso a paso. `npm test` comprueba **228 casos** (23-nov-2026) contra un servidor real con BD temporal, reiniciándolo para ver que nada se pierde. Lo legal y lo que piden Google Play y la App Store está en `LEGAL.md`.

## Estado
- **Cuentas que no se pierden.** El fallo grave era que, en Vercel, la base de datos se escribía en `/tmp` y se borraba. Ahora todo va a **Turso** (persistente, con conexión cifrada). Producción (https://pistea.vercel.app) ya funciona así: `/healthz` responde y las variables de Turso están en Vercel.
- **Hecho:** sesión segura, verificación de correo (activa en producción), denunciar y bloquear con moderación, páginas legales con tus datos, antitrampas, CSP estricta y app de Android firmada.
- **23-nov-2026:** 33 pruebas de ataque contra un servidor local: nadie puede leer datos de otras cuentas, inyectar código ni entrar sin contraseña. Ese mismo día se arreglaron y publicaron S1 a S5, S8 a S11 y S13 a S15, incluida la privacidad de los días (S4). Quedan S6, S7 y S12, y las tareas T.
- **Falta** lo que solo puedes hacer tú: está al final de este documento.

## Cómo funciona una cuenta
1. **Crear cuenta**: correo, nombre, contraseña y aceptar condiciones y privacidad. El servidor rechaza contraseñas comunes o que contengan tu correo o tu nombre, y nombres ofensivos. La contraseña se guarda como *hash* scrypt (N=32768, sal propia): nadie puede leerla.
2. **Confirmar el correo**: llega un enlace válido 48 horas. Hasta confirmarlo, los días cuentan para ti pero no sales en los rankings, la comunidad ni la búsqueda. Así nadie puede llenar el ranking con cuentas falsas o con correos ajenos. Sin correo configurado no se exige, y esas cuentas se dan por buenas.
3. **Sesión**: cookie `HttpOnly`, `Secure` y `SameSite=Lax` (`__Host-pistea`). JavaScript no puede leerla. Dura 90 días desde el último uso y se renueva sola. Toda escritura exige la cabecera `X-Pistea`, que protege contra CSRF.
4. **La próxima vez** entras sin escribir nada. Si cierras sesión, el correo queda recordado. Sin internet, la app dice «Sin conexión» y no te saca.
5. **Recuperar la contraseña**: enlace de un solo uso que caduca en 1 hora. Al usarlo se cierran todas las sesiones.
6. **Panel de datos** (`/panel`): solo lo abren las cuentas de `ADMIN_EMAILS` con el correo verificado de verdad (desde el 23-nov-2026, una cuenta creada cuando no se podía verificar ya no basta: ve el aviso «Confirma tu correo» y, al confirmarlo, recupera el panel). Enseña correo, ficha y días de todas las cuentas, pero nunca contraseñas, sesiones ni trazas GPS. Cada apertura queda en la auditoría. Los CSV que descarga son datos personales: guardarlos en local y borrarlos cuando ya no hagan falta.
7. **En Perfil**: cambiar contraseña (cierra los demás dispositivos), cerrar sesión en todos, usuarios bloqueados, descargar tus datos y borrar la cuenta.

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
| M15 | Media | Parte social (18-nov-2026): seguir en masa para hacer spam o acosar; ver con quién esquía una cuenta que aprueba a sus seguidores; avisos y solicitudes que sobreviven a un bloqueo o a borrar la cuenta | Seguir nuevo: 60 por hora y cuenta (dejar de seguir y cancelar valen siempre); las listas de una cuenta que aprueba solo las ve quien ya la sigue; en las listas, avisos y sugerencias no salen cuentas ocultas, suspendidas, sin verificar ni bloqueadas; bloquear y borrar la cuenta limpian solicitudes y avisos; rechazar no avisa a nadie |
| M14 | Media | Ningún freno contra un bucle o un robot que lance peticiones sin parar | 1.200 peticiones por minuto y conexión en la API, en memoria (no escribe en la BD); los límites finos siguen en la BD |
| B1 | Baja | Pasaporte y récords por pista (17-nov-2026): las clasificaciones leían la tabla entera en cada petición | Lo de todos se guarda un minuto; lo propio y los bloqueos se aplican en cada petición. Solo salen cuentas públicas; el pasaporte entero lo ve solo su dueño; se borra con la cuenta y con el día quitado por moderación; va en la exportación de datos y en la política de privacidad |

**Revisado y correcto:** SQL siempre con parámetros. Todo lo que escriben los usuarios se escapa al pintarlo. Los ficheros no se pueden leer fuera de su carpeta. Los tokens se guardan como *hash*. No hay secretos en git: ni `.env.local` ni la llave de firma. Hay una sola dependencia y `npm audit` no da vulnerabilidades.

## Auditoría del 23-nov-2026
**Cómo se hizo:**
- Lectura entera de `server.js`, de las partes de `app.js` y `panel.js` que pintan datos de usuarios, de `legal.js` y de la app de Android (manifiesto, configuración de Capacitor y grabador GPS).
- 33 pruebas de ataque contra un Pistea local con BD temporal, nunca contra producción. Incluyen un navegador real que abre las pantallas de la víctima y del moderador con nombres, biografías y denuncias llenas de HTML.
- Las cabeceras de seguridad de producción, revisadas desde fuera.

**Lo que resiste (probado):**
- Inyección de código (XSS) en todas las pantallas, también en Moderación y en `/panel`.
- CSRF y sesiones inventadas.
- Acceso a datos ajenos: panel, denuncias, moderación, edad, correo y exportación.
- Inyección SQL y salir de las carpetas de ficheros.
- Fotos: SVG con script, ficheros políglotas y tamaño.
- Cuerpos raros o enormes, fuerza bruta y ráfagas de peticiones (1.200 por minuto).
- Coste del antitrampas: un día de 7 h se recalcula en 0,7 s.
- Cabeceras de producción: CSP, HSTS, COOP, `nosniff`, `X-Frame-Options` y `Referrer-Policy`.
- Secretos fuera de git y `npm audit` sin vulnerabilidades.
- Android: sin copias en la nube, sin ubicación en segundo plano, servicio no exportado y grabaciones en memoria privada.

**Arreglado y publicado el 23-nov-2026:**
| # | Gravedad | Problema (probado) | Arreglo |
|---|---|---|---|
| S1 | Alta, latente | Si en producción faltaba el proveedor de correo, las cuentas nuevas se daban por verificadas. Quien registrara antes que tú un correo de `ADMIN_EMAILS` entraba al panel con los correos de todos (en local: 200) | El panel exige `verified = 1`. Un administrador antiguo sin verificar ve «Confirma tu correo» y lo recupera al confirmarlo (en local: 403) |
| S2 | Media | Tres cuentas recién creadas y **sin verificar** escondían a cualquiera con tres denuncias | Para ocultar solo cuentan denunciantes visibles (verificados, ni ocultos ni suspendidos). Las demás denuncias le llegan igual al moderador |
| S3 | Media | 8 contraseñas malas con tu correo, desde cualquier conexión, te dejaban 15 min sin poder entrar | 8 fallos cada 15 min por correo **y conexión**, y 50 por hora por correo en total |

**Lo demás de la auditoría** (todo publicado el 23-nov-2026, salvo lo que se indica):
| # | Gravedad | Problema | Estado |
|---|---|---|---|
| S4 | **Alta (privacidad)** | Cualquier cuenta abría los días de otra con el recorrido (pasable a GPS exacto con `/seg`), la hora de cada bajada y los remontes. Hasta un 20 % podía quedar fuera de la estación (el alojamiento) | **Arreglado.** Ajuste «Quién ve tus días»: todos, seguidores (por defecto) o solo yo. Con menos de 18 años no se puede elegir «todos». Los demás no ven las horas. El recorrido se recorta a la estación y sin lo anterior al primer remonte ni lo posterior a la última bajada, también en los días antiguos. «Solo yo» no sale en rankings ni récords |
| S5 | Media | Se podía gastar el cupo de 300 correos al día de Brevo registrando cuentas con correos ajenos | **Arreglado** con un tope de 280 al día (`MAIL_DAY_MAX`) y aviso al administrador al 80 %. **Falta tu parte:** activar Cloudflare Turnstile en el alta y en recuperar contraseña poniendo `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET` (T11) |
| S6 | Media | Cada intento limitado escribe en la BD (`hits`): un ataque desde muchas conexiones gasta la cuota de Turso | **Tuyo** (T6): regla de límite de peticiones en el Firewall de Vercel para `/api/register`, `/api/login` y `/api/forgot` |
| S7 | Baja | El alta dice si un correo ya tiene cuenta | Decisión de usabilidad que se mantiene; con el tope de correos y Turnstile sale caro abusar |
| S8 | Baja | Un día repetido se recalculaba entero antes de ver que ya estaba guardado | **Arreglado:** se mira con las horas de la traza antes del cálculo |
| S9 | Baja | A la exportación le faltaban la foto, los apoyos, los bloqueos, las denuncias enviadas y los avisos | **Arreglado** |
| S10 | Baja | Rankings y líderes de cada estación enseñaban a usuarios bloqueados | **Arreglado** |
| S11 | Baja | `init_turso.js` se conectaba a la Turso de producción con `.env.local` | **Arreglado:** está en la papelera de reciclaje |
| S12 | Baja | Función de Vercel y base de datos en EE. UU. (`iad1` y `aws-us-east-1`) | **Tuyo** (T7): mover las dos juntas a la UE. Mover solo la función ralentizaría cada consulta |
| S13 | Baja | La APK de Drive no tenía forma de comprobarse | **Arreglado:** huella SHA-256 de cada APK en `app/PLAY_STORE.md`. Activa la verificación en dos pasos de Google (T9) |
| S14 | Media (tiendas) | El aviso «Hay una versión nueva» descarga una APK fuera de Google Play, y Play lo prohíbe | **Arreglado:** la versión de Play se compila con `PISTEA_CANAL=play` y no lo enseña |
| S15 | Baja | Las grabaciones que nunca se guardaban se quedaban en el móvil para siempre | **Arreglado** en Android 1.2.0: se borran a los 30 días |

## Lo que tienes que hacer tú
| # | Qué | Dónde |
|---|---|---|
| T1 | ~~**Correo**~~ Hecho: la verificación está activa en producción (23-nov-2026) | — |
| T2 | ~~**Datos legales**~~ Hecho: las páginas legales ya llevan tu nombre y tu correo | — |
| T3 | **Moderador**: `ADMIN_EMAILS` con tu correo en Vercel | Ídem |
| T4 | **Google Play**: cuenta (25 USD), prueba cerrada con 12 personas durante 14 días, ficha, formulario de datos y vídeo del servicio de ubicación | `app/PLAY_STORE.md` |
| T5 | **Copia de la llave de firma**: `app/android/pistea-upload.jks` y `keystore.properties` | Fuera del ordenador |
| T6 | **Vercel**: el plan gratuito no permite uso comercial. Los mapas 3D (de 40 a 75 MB por vista) ya se sirven desde Cloudflare Pages, fuera de Vercel. Crea una regla de límite de peticiones en el Firewall para `/api/register`, `/api/login` y `/api/forgot` (S6), y usa el Attack Challenge si hay ataques | Vercel → Settings |
| T7 | **Turso**: probar a restaurar una copia y elegir una región de la UE | Panel de Turso |
| T8 | ~~**Logotipos de las estaciones**~~ Hecho el 23-nov-2026: el 3D ya no lleva logotipos, iconos, tipografías ni fotos oficiales (compilación `build:pistea` de Estaciones3D). El nombre de cada estación se usa solo para decir dónde se esquía. Pedirles permiso sigue siendo buena idea si queréis colaborar | — |
| T9 | **Verificación en dos pasos** en todas las cuentas que dan acceso a datos o al código: Google (Drive, Play), GitHub, Vercel, Turso, Brevo y Cloudflare | Ajustes de seguridad de cada una |
| T10 | **Ya publicado S1**: entra con tu cuenta de administrador. Si no ves el panel, pulsa «Confirma tu correo» y abre el enlace | Perfil |
| T11 | **Cloudflare Turnstile** (gratis): crea un widget para `pistea.vercel.app` y pon `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET` en Vercel. Hasta entonces, el alta funciona sin CAPTCHA | Cloudflare → Turnstile; Vercel → Environment Variables |
| T12 | **APK antiguas**: borra de Google Drive las versiones 1 y 2 (`Pistea.apk` de los días 18 y 19). La vigente es la 1.2.0, la del 23-nov-2026 | Google Drive |

## Recomendaciones que quedan
- **El 3D en otro dominio**: hecho el 17-nov-2026. Se sirve desde https://pistea-mapas.pages.dev (Cloudflare Pages), otro origen, en un `iframe` permitido solo por `frame-src`.
- **El registro dice «ese correo ya tiene cuenta»**: es una decisión de usabilidad. Revela qué correos están registrados, pero con un máximo de 40 intentos por hora y conexión.
- **iOS**: Apple suele rechazar apps que son solo una web en un envoltorio (guía 4.2). Además falta el proyecto de iOS y el grabador GPS nativo.
