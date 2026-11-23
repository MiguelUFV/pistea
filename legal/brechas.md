# Qué hacer si hay una brecha de datos (art. 33 y 34 RGPD)

Una brecha es cualquier acceso, pérdida, cambio o difusión de datos personales sin permiso. Ejemplos:
- Alguien entra en la base de datos o en el panel.
- Se filtra el token de Turso.
- Se publica una exportación por error.
- Se pierden datos sin copia.

## En la primera hora: parar el daño
1. **Cerrar la puerta:**
   - Si se ha filtrado un secreto (`TURSO_AUTH_TOKEN`, claves de Brevo o de Turnstile), **rota** ese secreto en su panel y actualízalo en Vercel → Environment Variables.
   - Después, vuelve a desplegar.
2. **Echar a todos** si hace falta: en la consola de Turso, `DELETE FROM tokens;` cierra todas las sesiones.
3. **Guardar pruebas** sin tocar nada más:
   - Registros de Vercel (Logs).
   - `audit_logs` de Turso.
   - Qué se vio o se sacó y cuándo.

## En 72 horas: decidir y avisar a la AEPD
- **Si es probable que haya riesgo para las personas**, hay que notificarlo a la AEPD **en 72 horas** desde que lo sabes. Se hace en su sede electrónica: https://sedeagpd.gob.es → «Notificación de brechas de datos personales». Para decidirlo, la AEPD tiene la herramienta «Comunica-Brecha RGPD».
- **Si hay riesgo alto** (por ejemplo, correos con contraseñas débiles o recorridos de menores), hay que avisar también a los **usuarios afectados**, con lenguaje claro:
  - Qué ha pasado.
  - Qué datos.
  - Qué hemos hecho.
  - Qué pueden hacer ellos (cambiar la contraseña, etc.).
  - Contacto.
- **Si no hay riesgo** (por ejemplo, datos cifrados y sin la clave), no hace falta notificar, pero sí apuntarlo abajo.

## Siempre: apuntarlo aquí
| Fecha | Qué pasó | Datos y personas afectadas | Medidas | ¿Notificada a la AEPD? | ¿Avisados los usuarios? |
|---|---|---|---|---|---|
| | | | | | |
