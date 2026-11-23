# Registro de actividades de tratamiento (art. 30 RGPD)

**Responsable:** el titular de Pistea (ver `/aviso-legal`). Contacto de privacidad: el correo de `LEGAL_EMAIL`. No hay delegado de protección de datos: no es obligatorio (art. 37 RGPD y art. 34 LOPDGDD).
**Última revisión:** 23-nov-2026. Revisar cada vez que cambie un tratamiento, un proveedor o la app.

Es obligatorio aunque Pistea sea pequeña: el tratamiento no es ocasional e incluye la ubicación (art. 30.5 RGPD). No se publica, pero hay que enseñarlo si la AEPD lo pide.

## Actividades

| # | Actividad | Finalidad | Base jurídica | Interesados | Datos | Plazo |
|---|---|---|---|---|---|---|
| A1 | Cuentas y perfil | Crear, proteger y mostrar la cuenta | Contrato (6.1.b) | Usuarios (14 años o más) | Correo, nombre público, contraseña cifrada (scrypt), @usuario, foto, edad, biografía, estaciones, nivel, terreno, club, equipo, reto de días, ajustes de privacidad | Mientras exista la cuenta |
| A2 | Grabación y cálculo de días | Calcular bajadas, remontes, pistas, desnivel, distancia y velocidad | Consentimiento (6.1.a) para la ubicación; contrato para el día calculado | Usuarios que graban | Ubicación GPS mientras se graba (la traza completa no se guarda), días con su desglose y su recorrido recortado, pasaporte de pistas | Traza: solo durante el cálculo. Días: mientras exista la cuenta |
| A3 | Antitrampas | Que el ranking sea justo | Interés legítimo (6.1.f) | Usuarios que guardan días | Traza GPS, que se recalcula y se descarta | Solo durante la comprobación |
| A4 | Comunidad, rankings y funciones sociales | Rankings, comunidad, seguir, apoyos y avisos | Contrato (6.1.b) | Usuarios | Totales, días según «Quién ve tus días», seguidores, solicitudes, apoyos, avisos y bloqueos | Mientras exista la cuenta; avisos 60 días |
| A5 | Moderación (Reglamento de Servicios Digitales) | Atender denuncias, decidir y avisar con los motivos | Obligación legal (6.1.c) e interés legítimo (6.1.f) | Usuarios denunciados y denunciantes; quien denuncia sin cuenta por correo | Denuncias (motivo y nota), decisiones, correos enviados | 180 días tras resolverlas, o hasta borrar una de las cuentas |
| A6 | Seguridad | Detectar accesos indebidos y frenar ataques | Interés legítimo (6.1.f) | Usuarios y cualquiera que intente entrar | IP, tipo de dispositivo y fecha de accesos y cambios; contadores de intentos con el correo cifrado (hash) | 180 días; contadores 24 horas |
| A7 | Correos de la cuenta | Verificar el correo, recuperar la contraseña y avisar de la moderación | Contrato y obligación legal | Usuarios | Correo, nombre público y el enlace o el aviso | Lo que guarde el proveedor de correo (Brevo: ver su política) |
| A8 | Panel de datos (uso interno) | Ver la evolución de la app y moderar | Interés legítimo (6.1.f) | Usuarios | Fichas y días, sin contraseñas, sesiones ni trazas; cada apertura queda registrada | Los CSV descargados: borrarlos cuando ya no hagan falta |
| A9 | Protección contra robots (si se activa Turnstile) | Distinguir personas de robots en el alta y en recuperar la contraseña | Interés legítimo (6.1.f) | Quien se registra o pide contraseña | Señales técnicas del navegador e IP (las trata Cloudflare) | Lo que diga Cloudflare |

**Datos especialmente protegidos:** no se tratan. La ubicación no lo es, pero se trata con cuidado (ver `legal/evaluacion_impacto.md`).
**Decisiones automatizadas:** el antitrampas rechaza días y tres denuncias de cuentas verificadas ocultan una cuenta hasta revisarla. Se informa en la política de privacidad y se puede pedir revisión humana. No producen efectos jurídicos ni significativos (art. 22).

## Encargados del tratamiento y transferencias
| Proveedor | Para qué | Dónde | Contrato de encargo (art. 28) | Transferencia (art. 44-46) |
|---|---|---|---|---|
| Vercel Inc. | Alojamiento y servidor (función en `iad1`, Virginia) | EE. UU. | DPA de Vercel: **aceptar en la cuenta** | Comprobar que está en el Marco de Privacidad UE-EE. UU.; si no, cláusulas tipo del DPA |
| Turso (ChiselStrike Inc.) | Base de datos (`aws-us-east-1`) | EE. UU. | DPA de Turso: **pedirlo o aceptarlo** | Ídem |
| Brevo (Sendinblue SAS) | Correos | Francia (UE) | DPA de Brevo: **aceptar en la cuenta** | No hay transferencia fuera de la UE |
| Cloudflare Inc. | Mapas 3D (Pages) y Turnstile si se activa | EE. UU. y red mundial | DPA de Cloudflare: **aceptar en la cuenta** | Cloudflare está en el Marco de Privacidad; comprobarlo |
| GitHub (Microsoft) | Código, sin datos de usuarios | EE. UU. | No trata datos personales de usuarios | — |
| Google (Drive) | Descarga de la APK fuera de Play | EE. UU. | No es encargado: Google trata la descarga como responsable | — |

**Mejor aún:** pasar la base de datos y la función a la UE (Turso `aws-eu-west-1` y `"regions": ["fra1"]` en `vercel.json`). Así desaparecen casi todas las transferencias (ver T7 en `SEGURIDAD.md`).

## Medidas de seguridad (art. 32)
Están descritas y probadas en `SEGURIDAD.md`. Las principales:
- HTTPS y contraseñas con scrypt.
- Cookie de sesión `HttpOnly`, defensa CSRF y CSP estricta.
- Límites de intentos en la base de datos.
- Verificación del correo y panel solo para administradores verificados.
- Registro de accesos.
- Borrado completo de la cuenta y exportación de datos.
- Copias de la base de datos en Turso.
- 228 pruebas automáticas.
