# Pistea · pendiente

## Correo diario con el resumen del panel (opción A, decidida el 18-nov-2026; sin hacer)
Miguel quiere recibir cada mañana un correo con las cifras del panel de datos (`/panel`). Lo dejó para más adelante.

- **Qué lleva:** las cifras del día anterior y de la semana: altas (y la diferencia con la semana anterior), verificadas, alta guiada completa, cuentas que han grabado un día, activas en 7 días, días grabados y la estación más esquiada. También los mismos avisos que el informe del panel: cuentas sin verificar de más de dos días, cuentas sin ningún día y denuncias abiertas. Al final, un botón «Abrir el panel».
- **Qué no lleva:** ni correos ni nombres ni ningún otro dato personal. La lista de personas solo se ve en el panel.
- **Cómo:**
  - Una tarea programada (*cron*) de Vercel: en el plan gratuito puede ir una vez al día, por ejemplo a las 8:00 de España.
  - La tarea llama a una ruta interna, `GET /api/cron/resumen`, protegida con `CRON_SECRET`, que Vercel manda en la cabecera `Authorization`.
  - El correo se envía con el `sendMail` que ya hay (Brevo) a las direcciones de `ADMIN_EMAILS`.
  - Las cifras se calculan en el servidor con la misma lógica que el informe de `public/panel.js`.
- **Pruebas:**
  - Sin `CRON_SECRET` correcto, la ruta responde 401.
  - El correo no contiene ningún correo de usuario.
  - Con la BD vacía sale «aún no hay cuentas».

## Descartado por ahora
- Copia automática del Excel en Google Sheets o en una carpeta del ordenador. Para ver la lista ya está el panel, y así no se duplican datos personales en más sitios.
