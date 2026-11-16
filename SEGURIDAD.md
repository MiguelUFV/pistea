# Pistea · Auditoría de seguridad

Revisión del 16-nov-2026 de todo `pistea/`: servidor (`server.js`), página (`public/index.html`), app de Android (`app/`), despliegue (Vercel, Docker) y secretos.

## Resumen
- **El fallo grave era de datos, no de ataque.** En Vercel la base de datos se escribía en `/tmp`, un disco temporal que se borra cada poco. Por eso las cuentas creadas «desaparecían» y no se podía volver a entrar. Ahora todo va a **Turso** (base de datos persistente con conexión cifrada) y, si falta, la API se niega a arrancar en vez de perder datos.
- Se han corregido **5 problemas críticos, 7 altos y 9 medios** (tabla abajo). `npm test` comprueba 69 casos, entre ellos reiniciar el servidor y ver que la cuenta, la sesión y los bloqueos siguen ahí.
- **Todavía no está lista para la Play Store.** Faltan cosas que dependen de ti: correo configurado, textos legales, poder denunciar y bloquear usuarios, y la ficha de privacidad de Google («Antes de publicar»).

## Cómo funciona ahora una cuenta
1. **Crear cuenta**: correo, nombre, contraseña y aceptar la política de privacidad. El servidor rechaza contraseñas comunes o que contengan tu correo o tu nombre, y guarda solo un *hash* scrypt (N=32768, sal propia): nadie, ni el administrador, puede leer la contraseña.
2. **Sesión**: al entrar, el servidor manda una cookie `HttpOnly`, `Secure` y `SameSite=Lax` (en producción, `__Host-pistea`). JavaScript no puede leerla, así que un fallo de la página no permite robarla. En la base de datos solo queda el *hash* del token.
3. **La próxima vez**: al abrir la app, la cookie entra sola. La sesión dura 90 días desde el último uso y se renueva sola. Si no hay internet, la app dice «Sin conexión» y **no** te saca de la cuenta.
4. **Si cierras sesión**, el formulario recuerda tu correo y solo pide la contraseña.
5. **Si la olvidas**, recibes un enlace de un solo uso que caduca en 1 hora. Al usarlo se cierran todas tus sesiones.
6. **Desde Perfil** puedes cambiar la contraseña (se cierran tus otros dispositivos), cerrar sesión en todos los dispositivos, descargar tus datos y borrar la cuenta (pide la contraseña y borra todo, verificado en las pruebas).

## Hallazgos corregidos
| # | Gravedad | Qué pasaba | Qué podía ocurrir | Arreglo |
|---|---|---|---|---|
| C1 | Crítica | BD SQLite en `/tmp` en Vercel | Cuentas, días y sesiones borrados al reiniciar la función | Turso (libSQL); sin `TURSO_DATABASE_URL` en Vercel la API responde 503 |
| C2 | Crítica | Fotos de perfil en `/tmp` | Fotos perdidas | Fotos dentro de la BD (≤ 400 KB) |
| C3 | Crítica | El correo de recuperación se enviaba después de responder | En Vercel el envío se cortaba: nadie recuperaba la cuenta | Se envía antes de responder |
| C4 | Crítica | Límites de intentos en memoria | En Vercel no frenaban la fuerza bruta de contraseñas | Límites en la BD: sobreviven a reinicios y valen para todas las instancias |
| C5 | Crítica | Token de sesión en `localStorage` | Cualquier inyección de código robaba la sesión | Cookie `HttpOnly`; el token antiguo se migra solo a cookie |
| A1 | Alta | IP del cliente mal leída (en Vercel, la del proxy) | Un atacante bloqueaba el inicio de sesión de todos; detrás de proxy, IP falsificable | IP de la plataforma en Vercel; último valor de `X-Forwarded-For` detrás de Caddy |
| A2 | Alta | Al pasar a cookies faltaba la defensa CSRF | Otra web podía actuar en tu nombre | Cabecera `X-Pistea` obligatoria en escrituras y rechazo de `Sec-Fetch-Site: cross-site` |
| A3 | Alta | La edad salía en el perfil público | Exposición de un dato personal | Solo la ve su dueño |
| A4 | Alta | scrypt con coste por defecto y sin filtro de contraseñas | Contraseñas débiles fáciles de adivinar | N=32768, hashes antiguos renovados al entrar, lista de comunes |
| A5 | Alta | Sin cambiar contraseña ni cerrar sesiones; sesión fija de 30 días | Un móvil robado seguía dentro | Cambio de contraseña, «cerrar en todos», sesión deslizante, máximo 20 sesiones |
| A6 | Alta | El borrado de cuenta dependía de `ON DELETE CASCADE` | En Turso podían quedar días y seguidores de cuentas borradas (RGPD) | Borrado explícito en una transacción |
| A7 | Alta | Sin Resend, el enlace de recuperación se escribía en los registros | Quien viera los registros podía entrar en cualquier cuenta | En producción nunca se escribe |
| M1 | Media | `/api/stations` hacía 27 consultas por visita | Saturar la BD con pocas peticiones | Caché de 1 minuto |
| M2 | Media | Registro de accesos sin plazo, con correo y nombre; la app decía «inmutable» | Datos de más (RGPD) y un texto falso | 180 días, sin correo; texto corregido |
| M3 | Media | Fotos: tipo según el cliente | Subir HTML o SVG disfrazado de foto | Tipo por contenido, `nosniff` y `sandbox` al servirlas; SVG prohibido |
| M4 | Media | Nombres con caracteres de control o de dirección (RTL) | Suplantar nombres en rankings | Se limpian |
| M5 | Media | Registro sin defensa ante bots | Cuentas basura en masa | Campo trampa y 10 registros/hora por IP |
| M6 | Media | Los errores internos devolvían 400 | Fallos de BD ocultos | 500 sin detalles al cliente y registro en el servidor |
| M7 | Media | Android con copia de seguridad en la nube activada | Sesión y grabaciones GPS copiadas a Google Drive | Desactivada (`allowBackup=false` y reglas de extracción) |
| M8 | Media | Faltaban cabeceras | Ataques entre ventanas y permisos de más | COOP, `Permissions-Policy` cerrada, `object-src 'none'`, `X-Frame-Options` en el 3D |
| M9 | Media | La aceptación de la política solo se comprobaba en el formulario | Cuentas sin aceptarla | El servidor la exige |

Además, `app/www/index.html` era una copia vieja de la web que no se usaba: se ha quitado. `sync.js` ya no deja compilar la app contra una dirección `http://` que no sea de pruebas.

**Revisado y correcto:** todo el SQL usa parámetros (la métrica del ranking sale de una lista cerrada). Todo lo que escriben los usuarios se escapa al pintarlo. Los ficheros no se pueden leer fuera de su carpeta. Los tokens de sesión y de recuperación se guardan como *hash*. Ningún secreto está en git (`.env.local` está ignorado). Hay una sola dependencia (`@libsql/client`) y `npm audit` no da vulnerabilidades.

## Pendiente
| # | Prioridad | Qué falta | Por qué |
|---|---|---|---|
| P1 | Bloquea la publicación | Poder **denunciar y bloquear** usuarios y días, y moderar nombres y biografías | Google Play y Apple lo exigen en apps con contenido de usuarios (Apple 1.2) |
| P2 | Bloquea la publicación | **`RESEND_API_KEY`** con tu dominio verificado | Sin ella, en producción no hay recuperación de contraseña |
| P3 | Bloquea la publicación | **Política de privacidad y condiciones** publicadas y enlazadas en el registro. También el registro de actividades de tratamiento y los contratos de encargado (Vercel, Turso, Resend), con la base de datos en la UE | RGPD y LOPDGDD. La ubicación es un dato personal y hay usuarios desde 14 años |
| P4 | Bloquea la publicación | En Play Console: **Seguridad de los datos** (ubicación precisa, correo, fotos), declaración del servicio en primer plano de ubicación, app **firmada**, icono propio y cuenta de prueba para revisión | Requisitos de Google Play |
| P5 | Alta | **Verificar el correo** al registrarse | Hoy cualquiera puede crear una cuenta con un correo ajeno |
| P6 | Alta | **Anti-trampas** en el servidor: recalcular el día desde la traza GPS completa | Los datos del día los manda el móvil: con límites de coherencia, pero un tramposo puede inflar el ranking |
| P7 | Media | Quitar `'unsafe-inline'` de la CSP (pasar los `onclick` a `addEventListener`) | Hoy todo se escapa, pero un descuido futuro sería explotable |
| P8 | Media | Servir el 3D desde otro subdominio o CDN | Es código grande en el mismo origen que la cuenta. Además no cabe en Vercel (780 MB, límite 250 MB) |
| P9 | Media | Activar la protección de Vercel (Firewall / Attack Challenge) o Cloudflare Turnstile en el registro | Ataques de denegación de servicio o de bots a gran escala |
| P10 | Media | Probar a restaurar una copia de Turso | Una copia que no se ha restaurado nunca no es una copia |
| P11 | Baja | El registro dice «ese correo ya tiene cuenta» | Revela si un correo está registrado. Decisión de usabilidad, limitada a 10 intentos/hora por IP |
| P12 | Para iOS | App Store | Apple suele rechazar apps que son solo una web dentro de un envoltorio (guía 4.2). Falta el proyecto de iOS y el grabador GPS nativo de iOS |

## Cómo comprobarlo
- `npm test`: 69 comprobaciones contra un servidor real con BD temporal. Cubre registro, inicio de sesión, CSRF, reinicios, hash antiguo, fotos disfrazadas, recuperación, cambio de contraseña, borrado completo y bloqueo tras reinicio.
- Con el servidor en marcha, `/healthz` dice si la BD responde.
