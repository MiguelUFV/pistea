// Páginas legales de Pistea: privacidad, condiciones, normas de la comunidad, borrar la cuenta, aviso legal y créditos y
// licencias. El titular y el contacto salen de LEGAL_NAME, LEGAL_EMAIL, LEGAL_NIF y LEGAL_ADDRESS (ver .env.example).
// Texto para una app gratuita gestionada por una persona física en España, revisado el 23-nov-2026 (ver LEGAL.md).
// Revísalo con un profesional si cambian el modelo (pagos, empresa, publicidad) o los proveedores.
const fs = require('fs'), path = require('path');
const UPDATED = '23 de noviembre de 2026';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let FOTOS = []; try { FOTOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'img', 'fotos.json'), 'utf8')); } catch {}
const NOMBRE = Object.fromEntries([['alto-campoo', 'Alto Campoo'], ['astun', 'Astún'], ['baqueira-beret', 'Baqueira Beret'], ['boi-taull', 'Boí Taüll'], ['candanchu', 'Candanchú'], ['cerler', 'Cerler'], ['espot', 'Espot'], ['formigal', 'Formigal'], ['fuentes-de-invierno', 'Fuentes de Invierno'], ['javalambre', 'Javalambre'], ['la-covatilla', 'La Covatilla'], ['la-molina', 'La Molina'], ['la-pinilla', 'La Pinilla'], ['leitariegos', 'Leitariegos'], ['manzaneda', 'Manzaneda'], ['masella', 'Masella'], ['panticosa', 'Panticosa'], ['port-aine', 'Port Ainé'], ['port-del-comte', 'Port del Comte'], ['san-isidro', 'San Isidro'], ['sierra-nevada', 'Sierra Nevada'], ['valdelinares', 'Valdelinares'], ['valdesqui', 'Valdesquí'], ['valdezcaray', 'Valdezcaray'], ['valgrande-pajares', 'Valgrande-Pajares'], ['vall-de-nuria', 'Vall de Núria'], ['vallter', 'Vallter']]);

function page(title, body, env) {
  const falta = t => `<mark>[falta ${t}]</mark>`;
  const name = env.LEGAL_NAME ? esc(env.LEGAL_NAME) : falta('LEGAL_NAME: tu nombre y apellidos');
  const mail = env.LEGAL_EMAIL ? `<a href="mailto:${esc(env.LEGAL_EMAIL)}">${esc(env.LEGAL_EMAIL)}</a>` : falta('LEGAL_EMAIL: correo de contacto');
  const nif = env.LEGAL_NIF ? esc(env.LEGAL_NIF) : falta('LEGAL_NIF: tu NIF');
  const dom = env.LEGAL_ADDRESS ? esc(env.LEGAL_ADDRESS) : falta('LEGAL_ADDRESS: domicilio a efectos de notificaciones');
  const bot = !!env.TURNSTILE_SITE_KEY;   // protección contra robots en el alta (Cloudflare Turnstile)
  const fill = s => s.replace(/\{RESPONSABLE\}/g, name).replace(/\{CONTACTO\}/g, mail).replace(/\{NIF\}/g, nif).replace(/\{DOMICILIO\}/g, dom)
    .replace(/\{BOT:([^}]*)\}/g, (m, t) => bot ? t : '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Pistea</title>
<style>body{margin:0;background:#0b0c0f;color:#e9ebef;font:16px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif}main{max-width:720px;margin:auto;padding:32px 20px 64px}
a{color:#8ab4ff}h1{font-size:30px;line-height:1.2;margin:8px 0 4px}h2{font-size:19px;margin:32px 0 8px}small,.mu{color:#8a909c}table{border-collapse:collapse;width:100%;font-size:14.5px}
td,th{border:1px solid #242832;padding:8px;text-align:left;vertical-align:top}th{background:#13151a}mark{background:#ffd54a;color:#000;padding:0 4px}nav a{margin-right:14px;display:inline-block}li{margin:4px 0}</style></head>
<body><main><nav><a href="/">← Pistea</a><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a><a href="/normas">Normas</a><a href="/borrar-cuenta">Borrar cuenta</a><a href="/aviso-legal">Aviso legal</a><a href="/licencias">Licencias</a></nav>
<h1>${esc(title)}</h1><small>Última actualización: ${UPDATED}</small>${fill(body)}</main></body></html>`;
}

const fotosHtml = () => FOTOS.length ? `<table><tr><th>Estación</th><th>Imagen</th><th>Licencia</th></tr>${FOTOS.map(f => {
  const ia = /ilustrativa/i.test(f.licencia || '');
  return `<tr><td>${esc(NOMBRE[f.id] || f.id)}</td><td>${ia ? 'Imagen ilustrativa generada con IA (no es una foto real de la estación)' : `${f.url ? `<a href="${esc(f.url)}">${esc(f.titulo || 'Foto')}</a>` : esc(f.titulo || 'Foto')}, de ${esc(f.autor || 'autor desconocido')}`}</td><td>${esc(f.licencia || '')}${/SA/.test(f.licencia || '') ? '. La versión recortada y con degradado que usa Pistea se comparte con la misma licencia' : ''}</td></tr>`;
}).join('')}</table>` : '';

const PAGES = {
  privacidad: ['Política de privacidad', `
<h2>1. Quién es el responsable</h2>
<p>{RESPONSABLE}, persona física con domicilio en España, es responsable del tratamiento de los datos de Pistea. Sus datos completos están en el <a href="/aviso-legal">aviso legal</a>. Contacto para cualquier asunto de privacidad: {CONTACTO}.</p>

<h2>2. Qué datos tratamos y para qué</h2>
<table><tr><th>Datos</th><th>Para qué</th><th>Base legal (RGPD)</th></tr>
<tr><td>Correo electrónico, nombre público y contraseña (guardada cifrada con <i>scrypt</i>: nadie puede leerla)</td><td>Crear y proteger tu cuenta, dejarte entrar, confirmar tu correo y recuperar la contraseña</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Perfil opcional: foto, @usuario, edad, biografía, estación habitual, estaciones que quieres esquiar, modalidad, nivel, terreno, desde cuándo esquías, club y equipo</td><td>Mostrar tu perfil. La edad y tu reto de días solo los ves tú; la edad sirve además para proteger a los menores (ver el punto 9)</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Ubicación GPS mientras grabas un día</td><td>Calcular tus bajadas, remontes, pistas, desnivel, distancia y velocidad. Solo funciona cuando tú empiezas a grabar y hasta que terminas. Mientras grabas se guarda en tu dispositivo; al guardar el día se envía al servidor</td><td>Consentimiento (art. 6.1.a), que das al pulsar «Traquear» y conceder el permiso de ubicación. Puedes retirarlo en los ajustes del teléfono</td></tr>
<tr><td>Traza GPS completa del día</td><td>Recalcular el día en el servidor y comprobar que es real (antitrampas). <b>No se guarda</b></td><td>Interés legítimo en un ranking justo (art. 6.1.f)</td></tr>
<tr><td>Días de esquí: estación, fecha, cifras, el desglose de bajadas y remontes con sus horas, y el <b>recorrido</b> sobre el mapa de la estación. El recorrido es tu ubicación durante el día, recortado: sin lo de antes del primer remonte ni lo de después de la última bajada, y solo dentro de la estación</td><td>Tu historial, los rankings y la comunidad, según quién quieras que los vea (punto 3)</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Pistas que has bajado cada día (calculadas desde la grabación): cuántas veces, metros y tu velocidad máxima en cada una</td><td>Tu pasaporte de pistas, la clasificación de quién más baja cada pista y tu resumen de temporada. Tu velocidad solo la ves tú</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Seguidores, solicitudes de seguimiento, avisos de actividad, apoyos y bloqueos</td><td>Funciones sociales</td><td>Ejecución del contrato (art. 6.1.b)</td></tr>
<tr><td>Denuncias que haces o que recibes y las decisiones de moderación</td><td>Mantener la comunidad segura, avisarte de cada decisión con sus motivos y atender tus reclamaciones</td><td>Obligación legal del Reglamento de Servicios Digitales (art. 6.1.c) e interés legítimo en una comunidad segura (art. 6.1.f)</td></tr>
<tr><td>Registro de seguridad: fecha, dirección IP y tipo de dispositivo de los accesos y cambios en tu cuenta</td><td>Detectar accesos indebidos y frenar ataques</td><td>Interés legítimo en la seguridad (art. 6.1.f)</td></tr>
{BOT:<tr><td>Señales técnicas del navegador al crear la cuenta o pedir una contraseña nueva (Cloudflare Turnstile)</td><td>Distinguir personas de robots que crean cuentas falsas o envían correos a direcciones ajenas</td><td>Interés legítimo en la seguridad (art. 6.1.f)</td></tr>}
</table>
<p>No vendemos tus datos, no hay publicidad ni analítica y no hacemos perfiles comerciales.</p>

<h2>3. Qué ven los demás</h2>
<ul><li><b>Tu perfil</b> (nombre público, @usuario, foto, biografía, estación habitual, nivel, modalidad, terreno, desde cuándo esquías, club y equipo): las personas con cuenta en Pistea.</li>
<li><b>Tus días</b> (cifras, desglose y recorrido): según lo que elijas en Perfil → Quién ve tus días. Las opciones son <i>Tus seguidores</i> (la de partida), <i>Todos</i> (solo para mayores de 18 años) y <i>Solo tú</i>. Los demás nunca ven la hora de cada bajada ni de cada remonte.</li>
<li><b>Rankings y clasificaciones de pista</b>: tu nombre, tu foto, tus totales (desnivel, kilómetros, horas, bajadas, días y freeride) y cuántas veces has bajado cada pista, salvo que elijas <i>Solo tú</i>. No hay clasificaciones de velocidad.</li>
<li><b>Nadie más ve</b> tu correo, tu edad, tu velocidad en cada pista, tu pasaporte completo ni tu registro de seguridad.</li>
<li>Hasta que confirmas tu correo no apareces en los rankings ni en la comunidad. Puedes bloquear a cualquier usuario.</li></ul>

<h2>4. Decisiones automáticas</h2>
<p>Dos decisiones las toma un programa sin intervención humana. El <b>antitrampas</b> rechaza un día si la grabación no es de la estación, tiene ubicaciones simuladas o saltos imposibles. Y si <b>tres personas verificadas</b> denuncian una cuenta, se oculta hasta que una persona la revisa; te avisamos por correo. Puedes pedir que una persona revise cualquiera de las dos escribiendo a {CONTACTO}.</p>

<h2>5. Cuánto tiempo los guardamos</h2>
<ul><li>Cuenta, perfil y días: mientras tengas la cuenta. Al borrarla se eliminan en el momento.</li>
<li>Registro de seguridad: 180 días. Al borrar la cuenta queda un registro técnico del borrado (fecha, IP y tipo de dispositivo) durante esos 180 días, sin tu correo ni tu nombre.</li>
<li>Avisos de actividad: 60 días. Denuncias: hasta 180 días después de resolverlas, o hasta que se borre una de las dos cuentas.</li>
<li>Enlaces de verificación y de recuperación: 48 horas y 1 hora. Sesiones abiertas: 90 días desde el último uso.</li>
<li>Copias de seguridad de la base de datos: se renuevan solas y desaparecen, como mucho, a los 30 días.</li></ul>

<h2>6. Quién trata los datos por nosotros</h2>
<p>Usamos proveedores que solo tratan los datos siguiendo nuestras instrucciones (encargados del tratamiento, art. 28 RGPD):</p>
<ul><li><b>Vercel Inc.</b> (EE. UU.): alojamiento de la aplicación y del servidor.</li><li><b>Turso (ChiselStrike Inc.)</b> (EE. UU.): base de datos.</li><li><b>Brevo (Sendinblue SAS, Francia)</b> o <b>Resend Inc.</b> (EE. UU.): envío de los correos de la cuenta y de moderación.</li><li><b>Cloudflare Inc.</b> (EE. UU.): los mapas 3D{BOT: y la protección contra robots}.</li></ul>
<p>El servidor y la base de datos están en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo de la Comisión Europea (art. 45 y 46 RGPD).</p>
<p>La app de Android que se descarga fuera de Google Play está guardada en Google Drive: esa descarga la trata Google según su propia política de privacidad.</p>

<h2>7. Tus derechos</h2>
<p>Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, portabilidad, limitación y oposición, y retirar tu consentimiento:</p>
<ul><li>Desde la app, en <b>Perfil</b>: editar tus datos, elegir quién ve tus días, descargar todos tus datos (JSON) y eliminar la cuenta.</li><li>Escribiendo a {CONTACTO}. Te contestamos en un mes como máximo (art. 12.3 RGPD).</li></ul>
<p>Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>

<h2>8. Seguridad</h2>
<p>Conexión cifrada (HTTPS), contraseñas cifradas, sesiones en una cookie inaccesible para el código de la página, límite de intentos de acceso, registro de accesos y copias de la base de datos.</p>

<h2>9. Menores</h2>
<p>Pistea es para mayores de 14 años, la edad mínima para consentir en España (art. 7 LOPDGDD). Si sabemos que una cuenta es de un menor de 14, la borramos. Con menos de 18 años, tus días solo pueden verlos tus seguidores, y no te sugerimos a desconocidos por tu estación habitual.</p>

<h2>10. Cookies y almacenamiento en el dispositivo</h2>
<p>Solo usamos una cookie técnica para mantener tu sesión abierta. No necesita consentimiento (art. 22.2 LSSI). En tu dispositivo guardamos el correo con el que entraste, para no tener que escribirlo, y el día que estás grabando, para no perderlo si se cierra la app. No usamos cookies de analítica ni de publicidad.{BOT: Al crear la cuenta o pedir una contraseña nueva, Cloudflare Turnstile comprueba que eres una persona; no se usa para publicidad.}</p>

<h2>11. Cambios</h2>
<p>Si cambiamos esta política de forma importante, te avisaremos en la app antes de que se aplique.</p>`],

  condiciones: ['Condiciones de uso', `
<h2>1. Qué es Pistea</h2>
<p>Pistea es una aplicación gratuita para registrar tus días de esquí y snowboard, ver tus estadísticas y compararte con otros esquiadores. La ofrece {RESPONSABLE} (datos completos en el <a href="/aviso-legal">aviso legal</a>; contacto: {CONTACTO}). Al crear una cuenta aceptas estas condiciones, las <a href="/normas">normas de la comunidad</a> y la <a href="/privacidad">política de privacidad</a>.</p>

<h2>2. Tu cuenta</h2>
<ul><li>Tienes que tener al menos 14 años. Con menos de 18, tus días solo pueden verlos tus seguidores.</li><li>Los datos que das deben ser ciertos y la cuenta es personal: no la compartas.</li>
<li>Eres responsable de guardar tu contraseña. Si crees que alguien ha entrado en tu cuenta, cámbiala y cierra la sesión en todos los dispositivos desde Perfil.</li></ul>

<h2>3. Seguridad en la montaña</h2>
<p><b>No uses la app mientras te deslizas.</b> Empieza la grabación antes de esquiar y guarda el móvil. Respeta las normas de la estación y la señalización. <b>Pistea no organiza competiciones de velocidad</b>: no hay rankings ni récords de velocidad, y tu máxima solo la ves tú. Una pista no es un circuito: esquía a una velocidad que puedas controlar, y quien va delante tiene preferencia. Ningún ranking vale un accidente.</p>

<h2>4. Datos y rankings</h2>
<p>Las cifras salen del GPS del teléfono y pueden tener errores; las pistas de cada bajada y el freeride son una interpretación del GPS. Están pensadas para el ocio, no para uso deportivo profesional ni de seguridad. Hacer trampas (datos falsos, simuladores de GPS, días que no has esquiado) está prohibido. Podemos quitar días sospechosos y suspender la cuenta.</p>

<h2>5. Lo que publicas</h2>
<p>Lo que publicas (nombre, foto, biografía, días) sigue siendo tuyo. Nos das permiso para mostrarlo dentro de Pistea, según lo que elijas en «Quién ve tus días», mientras tengas la cuenta. No lo usaremos en publicidad sin tu permiso expreso. Debes cumplir las normas de la comunidad.</p>

<h2>6. Cómo moderamos</h2>
<ul><li><b>Filtro automático</b>: los nombres, los @usuario y las biografías con insultos u odio se rechazan al escribirlos.</li>
<li><b>Denuncias</b>: cualquiera puede denunciar un perfil o un día desde la app, y también sin cuenta, escribiendo a {CONTACTO} (ver las <a href="/normas">normas</a>).</li>
<li><b>Ocultación automática</b>: si tres personas con el correo verificado denuncian una cuenta, se oculta de los rankings, la comunidad y la búsqueda hasta que una persona la revisa.</li>
<li><b>Revisión humana</b>: una persona revisa cada denuncia y decide: dejarlo como está, quitar un día, limpiar el perfil (nombre, @usuario, foto, biografía, club y equipo) o suspender la cuenta.</li>
<li><b>Aviso y reclamación</b>: te avisamos por correo de cada medida, con su motivo. Si no estás de acuerdo, escribe a {CONTACTO}: lo revisará una persona y te contestaremos. También puedes acudir a los tribunales.</li></ul>

<h2>7. Disponibilidad</h2>
<p>Intentamos que Pistea funcione siempre, pero puede haber cortes o cambios. El servicio es gratuito y se ofrece «tal cual». Podemos cambiar o cerrar funciones avisando con antelación razonable.</p>

<h2>8. Baja</h2>
<p>Puedes borrar tu cuenta cuando quieras desde Perfil o como se explica en <a href="/borrar-cuenta">Borrar cuenta</a>. Podemos cerrar cuentas que incumplan estas condiciones.</p>

<h2>9. Responsabilidad</h2>
<p>No respondemos de los daños derivados del uso de la app salvo en los casos en que la ley no permite limitarlo (dolo, culpa grave o daños a personas). Nada de esto limita tus derechos como consumidor.</p>

<h2>10. Contacto, ley y tribunales</h2>
<p>Punto de contacto para usuarios y autoridades (Reglamento de Servicios Digitales, art. 11 y 12): {CONTACTO}, en español. Se aplica la ley española. Si eres consumidor, son competentes los tribunales de tu domicilio.</p>`],

  normas: ['Normas de la comunidad', `
<p>Pistea es para disfrutar de la nieve y picarse sanamente. Para que siga así:</p>
<ul><li><b>Respeto.</b> Nada de insultos, acoso, amenazas, odio o discriminación, ni en el nombre, ni en la foto, ni en la biografía.</li>
<li><b>Juego limpio.</b> Solo días que hayas esquiado tú, grabados con el GPS real. Nada de simuladores, ni de días ajenos, ni de cifras infladas.</li>
<li><b>Seguridad primero.</b> Ningún récord vale un accidente. No grabes ni publiques nada que anime a esquiar de forma peligrosa o fuera de pista sin las condiciones adecuadas.</li>
<li><b>Sé tú.</b> No te hagas pasar por otra persona, marca o estación.</li>
<li><b>Privacidad.</b> No publiques datos personales de otros.</li>
<li><b>Nada de spam</b> ni de publicidad.</li>
<li><b>Nada ilegal.</b> Ningún contenido que vulnere la ley o los derechos de otros (por ejemplo, una foto de la que no tienes permiso).</li></ul>

<h2>Cómo denunciar</h2>
<ul><li><b>Con cuenta</b>: desde el perfil del usuario o desde su día en Comunidad. También puedes <b>bloquearlo</b>.</li>
<li><b>Sin cuenta</b>, o si se trata de contenido ilegal: escribe a {CONTACTO} con el nombre o el @usuario de la cuenta, qué día o qué parte del perfil es, por qué crees que incumple las normas o la ley, y tu nombre y correo (salvo que denuncies abusos a menores, que puedes hacerlo sin identificarte).</li>
<li>Si alguien corre peligro, llama al <b>112</b>.</li></ul>

<h2>Qué pasa después</h2>
<ul><li>Te confirmamos que hemos recibido la denuncia (en la app, al momento; por correo, al contestarte).</li>
<li>Una persona revisa cada denuncia. Si tres personas con el correo verificado denuncian una cuenta, se oculta automáticamente hasta esa revisión.</li>
<li>Según la gravedad, podemos dejarlo como está, quitar un día, limpiar el perfil o suspender la cuenta.</li>
<li>A la persona afectada le explicamos por correo qué hemos hecho y por qué. A quien denunció le decimos si hemos tomado medidas.</li>
<li>Si no estás de acuerdo con una decisión, escribe a {CONTACTO}: la revisará una persona.</li></ul>`],

  'borrar-cuenta': ['Borrar tu cuenta y tus datos', `
<p>Puedes borrar tu cuenta de Pistea y <b>todos</b> tus datos cuando quieras. Se eliminan en el momento: perfil, foto, días, pasaporte, seguidores, apoyos, avisos, denuncias y sesiones.</p>
<h2>Desde la app o la web</h2>
<ol><li>Entra en Pistea con tu cuenta (en la app o en <a href="/">esta web</a>).</li><li>Abre <b>Perfil</b> y baja hasta el final.</li><li>Pulsa <b>Eliminar cuenta y datos</b> y escribe tu contraseña para confirmar.</li></ol>
<h2>Si no puedes entrar</h2>
<p>Recupera tu contraseña con «¿Olvidaste tu contraseña?» en la pantalla de entrada. Si tampoco puedes, escribe a {CONTACTO} desde el correo de la cuenta pidiendo el borrado. Lo haremos en un plazo máximo de 30 días.</p>
<h2>Qué se conserva</h2>
<p>Nada que te identifique por tu nombre o tu correo. Durante 180 días queda un registro técnico del borrado (fecha, dirección IP y tipo de dispositivo), por seguridad. Las copias de seguridad de la base de datos se renuevan solas y, como mucho, desaparecen en 30 días.</p>`],

  'aviso-legal': ['Aviso legal', `
<h2>Titular</h2>
<table><tr><th>Titular</th><td>{RESPONSABLE}</td></tr><tr><th>NIF</th><td>{NIF}</td></tr><tr><th>Domicilio</th><td>{DOMICILIO}</td></tr><tr><th>Correo</th><td>{CONTACTO}</td></tr><tr><th>Servicio</th><td>Pistea, red social para registrar y comparar días de esquí y snowboard, en la web y en la app</td></tr></table>
<p>Información exigida por el art. 10 de la Ley 34/2002 de servicios de la sociedad de la información (LSSI-CE).</p>
<h2>Punto de contacto</h2>
<p>Para usuarios y autoridades, a efectos del Reglamento (UE) 2022/2065 de Servicios Digitales (art. 11 y 12): {CONTACTO}, en español.</p>
<h2>Independencia</h2>
<p>Pistea es un proyecto independiente: no está vinculado a ninguna estación de esquí ni patrocinado por ellas. Los nombres de las estaciones y de sus pistas se usan solo para indicar dónde se esquía, y pertenecen a sus titulares.</p>
<h2>Propiedad intelectual</h2>
<p>El nombre, el diseño y el código de Pistea son de su titular. Los mapas, los datos de pistas y las fotos de terceros se usan con sus licencias, que están en <a href="/licencias">Créditos y licencias</a>. Lo que publican los usuarios es suyo (ver las <a href="/condiciones">condiciones</a>).</p>`],

  licencias: ['Créditos y licencias', `
<h2>Mapas y relieve</h2>
<ul><li><b>Instituto Geográfico Nacional (IGN/CNIG)</b>: modelo digital del terreno y ortofotografía, con licencia <a href="https://creativecommons.org/licenses/by/4.0/deed.es">CC BY 4.0</a>. © Instituto Geográfico Nacional. Pistea los ha procesado para el relieve y las miniaturas.</li>
<li><b>Copernicus Sentinel-2</b> (ESA), a través de Microsoft Planetary Computer: contiene datos modificados de Copernicus Sentinel (2025-2026), de uso libre con atribución.</li></ul>
<h2>Pistas y remontes</h2>
<p>Los trazados de pistas y remontes salen de <b>OpenStreetMap</b>: © colaboradores de OpenStreetMap, con licencia <a href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL) 1.0</a> (<a href="https://www.openstreetmap.org/copyright">más información</a>). El nombre y el color de cada pista se han corregido con la información pública de cada estación.</p>
<p>Los datos de pistas y remontes que usa Pistea son una base de datos derivada de OpenStreetMap y <b>se ofrecen con la misma licencia ODbL 1.0</b>: el de cada estación en <code>/seg/&lt;estación&gt;.json</code> (por ejemplo, <a href="/seg/baqueira-beret.json">/seg/baqueira-beret.json</a>) y la lista de pistas en <a href="/img/pistas.json">/img/pistas.json</a>.</p>
<h2>Fotos de las estaciones</h2>
${fotosHtml()}
<p class="mu">Wikimedia Commons y sus autores. Las licencias CC BY y CC BY-SA permiten el uso con atribución; las imágenes de Pistea están recortadas y llevan un degradado.</p>
<h2>Tipografía y software</h2>
<ul><li>Tipografías <b>Barlow</b> y <b>Barlow Semi Condensed</b>, de Jeremy Tribby, con licencia <a href="https://openfontlicense.org">SIL Open Font License 1.1</a>.</li>
<li><b>@libsql/client</b> (MIT) en el servidor y <b>Capacitor</b> (MIT) en la app de Android.</li></ul>`]
};

const LEGAL_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" };
module.exports = { legal: (name, env) => PAGES[name] ? page(PAGES[name][0], PAGES[name][1], env) : null, LEGAL_HEADERS, LEGAL_UPDATED: UPDATED };
