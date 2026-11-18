// Páginas legales de Pistea: política de privacidad, condiciones de uso, normas de la comunidad y cómo borrar la cuenta.
// El responsable y el correo de contacto salen de LEGAL_NAME y LEGAL_EMAIL (ver .env.example).
// Texto redactado para una app gratuita gestionada por una persona física en España. Revísalo con un profesional si cambian
// el modelo (pagos, empresa, publicidad) o los proveedores.
const UPDATED = '18 de noviembre de 2026';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body, env) {
  const name = env.LEGAL_NAME ? esc(env.LEGAL_NAME) : '<mark>[falta LEGAL_NAME: tu nombre y apellidos]</mark>';
  const mail = env.LEGAL_EMAIL ? `<a href="mailto:${esc(env.LEGAL_EMAIL)}">${esc(env.LEGAL_EMAIL)}</a>` : '<mark>[falta LEGAL_EMAIL: correo de contacto]</mark>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Pistea</title>
<style>body{margin:0;background:#0b0c0f;color:#e9ebef;font:16px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif}main{max-width:720px;margin:auto;padding:32px 20px 64px}
a{color:#8ab4ff}h1{font-size:30px;line-height:1.2;margin:8px 0 4px}h2{font-size:19px;margin:32px 0 8px}small,.mu{color:#8a909c}table{border-collapse:collapse;width:100%;font-size:14.5px}
td,th{border:1px solid #242832;padding:8px;text-align:left;vertical-align:top}th{background:#13151a}mark{background:#ffd54a;color:#000;padding:0 4px}nav a{margin-right:14px}li{margin:4px 0}</style></head>
<body><main><nav><a href="/">← Pistea</a><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a><a href="/normas">Normas</a><a href="/borrar-cuenta">Borrar cuenta</a></nav>
<h1>${esc(title)}</h1><small>Última actualización: ${UPDATED}</small>${body.replace(/\{RESPONSABLE\}/g, name).replace(/\{CONTACTO\}/g, mail)}</main></body></html>`;
}

const PAGES = {
  privacidad: ['Política de privacidad', `
<h2>1. Quién es el responsable</h2>
<p>{RESPONSABLE}, persona física con domicilio en España, es responsable del tratamiento de los datos de Pistea. Contacto para cualquier asunto de privacidad: {CONTACTO}.</p>

<h2>2. Qué datos tratamos y para qué</h2>
<table><tr><th>Datos</th><th>Para qué</th><th>Base legal (RGPD)</th></tr>
<tr><td>Correo electrónico, nombre público y contraseña (guardada cifrada con <i>scrypt</i>: nadie puede leerla)</td><td>Crear y proteger tu cuenta, dejarte entrar y recuperar la contraseña</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Perfil opcional: foto, edad, biografía, estación habitual, modalidad y nivel</td><td>Mostrar tu perfil. La edad solo la ves tú</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Ubicación GPS mientras grabas un día</td><td>Calcular tus bajadas, desnivel, distancia y velocidad. La grabación solo funciona cuando tú la empiezas y se para cuando la terminas; nunca en segundo plano sin tu acción</td><td>Consentimiento (art. 6.1.a), que das al pulsar «Traquear» y conceder el permiso de ubicación. Puedes retirarlo en los ajustes del teléfono</td></tr>
<tr><td>Días de esquí: estación, fecha, cifras del día y un recorrido simplificado sin coordenadas geográficas</td><td>Tu historial, los rankings y la comunidad</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Pistas que has bajado en cada día (calculadas desde la grabación): cuántas veces, metros y velocidad máxima en cada una</td><td>Tu pasaporte de pistas, los récords por pista y tu resumen de temporada</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Traza GPS completa del día</td><td>Comprobar en el servidor que el día es real (antitrampas). Se usa para recalcular las cifras y <b>no se guarda</b></td><td>Interés legítimo en un ranking justo (art. 6.1.f)</td></tr>
<tr><td>Seguidores, apoyos, bloqueos y denuncias</td><td>Funciones sociales y moderación</td><td>Ejecución del contrato (art. 6.1.b) e interés legítimo en una comunidad segura (art. 6.1.f)</td></tr>
<tr><td>Registro de seguridad: fecha, dirección IP y tipo de dispositivo de los accesos y cambios en tu cuenta</td><td>Detectar accesos indebidos y frenar ataques</td><td>Interés legítimo en la seguridad (art. 6.1.f)</td></tr></table>
<p>No vendemos tus datos, no hay publicidad y no hacemos perfiles comerciales.</p>

<h2>3. Qué ven los demás</h2>
<p>Tu nombre público, foto, biografía, estación habitual, modalidad, nivel, tus cifras y tus días (con el recorrido simplificado) son visibles para otros usuarios. En los récords de cada pista salen tu nombre, tu foto, tu velocidad máxima en ella y cuántas veces la has bajado en la temporada; tu pasaporte completo (todas las pistas que has bajado) solo lo ves tú. Tu correo, tu edad y tus registros de seguridad no. Hasta que confirmas tu correo no apareces en los rankings ni en la comunidad. Puedes bloquear a cualquier usuario.</p>

<h2>4. Cuánto tiempo los guardamos</h2>
<ul><li>Datos de la cuenta, perfil y días: mientras tengas la cuenta. Al borrarla se eliminan todos en el momento.</li>
<li>Registro de seguridad: 180 días.</li><li>Enlaces de verificación y de recuperación: 48 horas y 1 hora.</li><li>Sesiones abiertas: 90 días desde el último uso.</li></ul>

<h2>5. Quién trata los datos por nosotros</h2>
<p>Usamos proveedores que solo tratan los datos siguiendo nuestras instrucciones (encargados del tratamiento, art. 28 RGPD):</p>
<ul><li><b>Vercel Inc.</b>: alojamiento de la aplicación.</li><li><b>Turso (ChiselStrike Inc.)</b>: base de datos.</li><li><b>Brevo (Sendinblue SAS, Francia)</b> o <b>Resend Inc.</b>: envío de los correos de la cuenta.</li></ul>
<p>Algunos están en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo de la Comisión Europea (art. 45 y 46 RGPD).</p>

<h2>6. Tus derechos</h2>
<p>Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, portabilidad, limitación y oposición, y retirar tu consentimiento:</p>
<ul><li>Desde la app, en <b>Perfil</b>: editar tus datos, descargar todos tus datos (JSON) y eliminar la cuenta.</li><li>Escribiendo a {CONTACTO}.</li></ul>
<p>Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>

<h2>7. Menores</h2>
<p>Pistea es para mayores de 14 años, la edad mínima para consentir en España (art. 7 LOPDGDD). Si sabemos que una cuenta es de un menor de 14, la borramos.</p>

<h2>8. Seguridad</h2>
<p>Conexión cifrada (HTTPS), contraseñas cifradas, sesiones en una cookie inaccesible para el código de la página, límite de intentos de acceso, registro de accesos y copias de la base de datos.</p>

<h2>9. Cookies y almacenamiento en el dispositivo</h2>
<p>Solo usamos una cookie técnica para mantener tu sesión abierta. No necesita consentimiento (art. 22.2 LSSI). En tu dispositivo guardamos el correo con el que entraste, para no tener que escribirlo, y el día que estás grabando, para no perderlo si se cierra la app. No usamos cookies de analítica ni de publicidad.</p>

<h2>10. Cambios</h2>
<p>Si cambiamos esta política de forma importante, te avisaremos en la app antes de que se aplique.</p>`],

  condiciones: ['Condiciones de uso', `
<h2>1. Qué es Pistea</h2>
<p>Pistea es una aplicación gratuita para registrar tus días de esquí y snowboard, ver tus estadísticas y compararte con otros esquiadores. La ofrece {RESPONSABLE} (contacto: {CONTACTO}). Al crear una cuenta aceptas estas condiciones y la <a href="/privacidad">política de privacidad</a>.</p>

<h2>2. Tu cuenta</h2>
<ul><li>Tienes que tener al menos 14 años.</li><li>Los datos que das deben ser ciertos y la cuenta es personal: no la compartas.</li>
<li>Eres responsable de guardar tu contraseña. Si crees que alguien ha entrado en tu cuenta, cámbiala y cierra la sesión en todos los dispositivos desde Perfil.</li></ul>

<h2>3. Seguridad en la montaña</h2>
<p><b>No uses la app mientras te deslizas.</b> Empieza la grabación antes de esquiar y guarda el móvil. Respeta las normas de la estación y la señalización. Los rankings no premian la imprudencia: esquía a una velocidad segura para ti y para los demás. Los récords de velocidad de cada pista son una curiosidad del GPS, no una competición: una pista no es un circuito cerrado, y quien va delante tiene preferencia. Pistea no se hace responsable de accidentes durante la práctica del deporte.</p>

<h2>4. Datos y rankings</h2>
<p>Las cifras salen del GPS del teléfono y pueden tener errores. Están pensadas para el ocio, no para uso deportivo profesional ni de seguridad. Hacer trampas (datos falsos, simuladores de GPS, días que no has esquiado) está prohibido. Podemos quitar días sospechosos y suspender la cuenta.</p>

<h2>5. Lo que publicas</h2>
<p>Lo que publicas (nombre, foto, biografía, días) sigue siendo tuyo. Nos das permiso para mostrarlo dentro de Pistea mientras tengas la cuenta. Debes cumplir las <a href="/normas">normas de la comunidad</a>. Podemos retirar contenido o suspender cuentas que las incumplan, y puedes denunciar a cualquier usuario desde su perfil.</p>

<h2>6. Disponibilidad</h2>
<p>Intentamos que Pistea funcione siempre, pero puede haber cortes o cambios. El servicio es gratuito y se ofrece «tal cual». Podemos cambiar o cerrar funciones avisando con antelación razonable.</p>

<h2>7. Baja</h2>
<p>Puedes borrar tu cuenta cuando quieras desde Perfil o como se explica en <a href="/borrar-cuenta">Borrar cuenta</a>. Podemos cerrar cuentas que incumplan estas condiciones.</p>

<h2>8. Responsabilidad</h2>
<p>No respondemos de los daños derivados del uso de la app salvo en los casos en que la ley no permite limitarlo (dolo, culpa grave o daños a personas). Nada de esto limita tus derechos como consumidor.</p>

<h2>9. Ley y tribunales</h2>
<p>Se aplica la ley española. Si eres consumidor, son competentes los tribunales de tu domicilio.</p>`],

  normas: ['Normas de la comunidad', `
<p>Pistea es para disfrutar de la nieve y picarse sanamente. Para que siga así:</p>
<ul><li><b>Respeto.</b> Nada de insultos, acoso, amenazas, odio o discriminación, ni en el nombre, ni en la foto, ni en la biografía.</li>
<li><b>Juego limpio.</b> Solo días que hayas esquiado tú, grabados con el GPS real. Nada de simuladores, ni de días ajenos, ni de cifras infladas.</li>
<li><b>Seguridad primero.</b> Ningún récord vale un accidente. No grabes ni publiques nada que anime a esquiar de forma peligrosa o fuera de pista sin las condiciones adecuadas.</li>
<li><b>Sé tú.</b> No te hagas pasar por otra persona, marca o estación.</li>
<li><b>Privacidad.</b> No publiques datos personales de otros.</li>
<li><b>Nada de spam</b> ni de publicidad.</li></ul>
<p>Si ves algo que no cumple estas normas, <b>denúncialo</b> desde el perfil del usuario o desde su día en Comunidad, o <b>bloquéalo</b>. Una persona revisa cada denuncia. Según la gravedad, podemos quitar el contenido, limpiar el perfil o suspender la cuenta.</p>`],

  'borrar-cuenta': ['Borrar tu cuenta y tus datos', `
<p>Puedes borrar tu cuenta de Pistea y <b>todos</b> tus datos cuando quieras. Se eliminan en el momento: perfil, foto, días, seguidores, apoyos y sesiones.</p>
<h2>Desde la app o la web</h2>
<ol><li>Entra en Pistea con tu cuenta (en la app o en <a href="/">esta web</a>).</li><li>Abre <b>Perfil</b> y baja hasta el final.</li><li>Pulsa <b>Eliminar cuenta y datos</b> y escribe tu contraseña para confirmar.</li></ol>
<h2>Si no puedes entrar</h2>
<p>Recupera tu contraseña con «¿Olvidaste tu contraseña?» en la pantalla de entrada. Si tampoco puedes, escribe a {CONTACTO} desde el correo de la cuenta pidiendo el borrado. Lo haremos en un plazo máximo de 30 días.</p>
<h2>Qué se conserva</h2>
<p>Nada personal. Solo queda constancia de que se borró una cuenta, sin tu correo ni tu nombre. Las copias de seguridad de la base de datos se renuevan solas y, como mucho, desaparecen en 30 días.</p>`]
};

const LEGAL_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" };
module.exports = { legal: (name, env) => PAGES[name] ? page(PAGES[name][0], PAGES[name][1], env) : null, LEGAL_HEADERS };
