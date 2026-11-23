// Pruebas de extremo a extremo: levanta el servidor con una BD temporal (fichero local, nunca la de producción) y recorre
// la API como lo haría el navegador: cookie de sesión, cabecera anti-CSRF y reinicios. Uso: node --no-warnings test.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pistea-')), PORT = 3199, B = `http://localhost:${PORT}`;
const ENV = { ...process.env, PORT, DATA_DIR: dir, NODE_ENV: 'test', ADMIN_EMAILS: 'admin@pistea.es', LEGAL_NAME: 'Persona De Prueba', LEGAL_EMAIL: 'legal@pistea.es' }; delete ENV.TURSO_DATABASE_URL; delete ENV.TURSO_AUTH_TOKEN; delete ENV.VERCEL; delete ENV.RESEND_API_KEY;
let p, out = '';
const start = () => new Promise(r => { p = spawn(process.execPath, ['--no-warnings', 'server.js'], { cwd: __dirname, env: ENV }); p.stdout.on('data', d => { out += d; if (/Pistea en/.test(d)) setTimeout(r, 300); }); p.stderr.on('data', d => out += d); });
const stop = () => new Promise(r => { p.once('exit', r); p.kill(); });
let ok = 0, bad = 0;
const t = (n, c, x = '') => { c ? ok++ : bad++; console.log((c ? 'ok   ' : 'FALLA') + ' ' + n + (c ? '' : '  ' + x)); };
// Un «navegador»: guarda la cookie que manda el servidor y la devuelve
const browser = () => {
  const jar = {};
  const call = async (m, u, body, extra = {}) => {
    const h = { 'Content-Type': 'application/json', ...(m !== 'GET' ? { 'X-Pistea': '1' } : {}), ...(Object.keys(jar).length ? { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } : {}), ...extra };
    const r = await fetch(B + u, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const [kv] = sc.split(';'); const [k, v] = kv.split('='); if (v) jar[k] = v; else delete jar[k]; call.last = sc; }
    let j = {}; try { j = await r.json(); } catch {} return [r.status, j, r];
  };
  call.jar = jar; return call;
};
const day = (o = {}) => ({ station: 'valdesqui', desnivel: 9000, km: 45, horas: 4, bajadas: 20, vmax: 80, vmed: 30, col: { v: 5, a: 6, r: 8, n: 1 }, track: [[0, 0], [5, 5]], speed: [10, 20], source: 'sim', ...o });
// Último enlace (verify o reset) que el servidor «mandó» por correo a esa dirección (en local se escribe en la consola)
const linkFor = (email, kind) => { const i = out.lastIndexOf('[correo simulado] para ' + email); if (i < 0) return null; const m = out.slice(i).match(new RegExp('\\?' + kind + '=([a-f0-9]{64})')); return m && m[1]; };
// Un día sintético con verdad conocida: n bajadas de 200 s (10 m/s, -1,1 m/s) con remonte de 120 s, desde (lat, lon)
const { encodeTrace } = require('./public/calc.js');
function synthDay({ lat = 40.80, lon = -3.965, runs = 3, start = Date.now() - 3 * 36e5, jump = false, mock = false } = {}) {
  const fx = []; let t = start, la = lat, alt = 2250;
  for (let r = 0; r < runs; r++) {
    for (let k = 0; k < 200; k++) { t += 1000; la -= 0.00009; alt -= 1.1; fx.push({ t, lat: la, lon: lon + k * 1e-5, alt, acc: 5, v: 10, mock }); }
    for (let k = 0; k < 120; k++) { t += 1000; la += 0.00015; alt += 1.83; fx.push({ t, lat: la, lon, alt, acc: 5, v: 3 }); }
  }
  if (jump) for (let k = 0; k < 60; k++) { t += 1000; fx.push({ t, lat: lat + (k % 2 ? 0.05 : 0), lon, alt, acc: 5, v: null }); }
  return fx;
}
const gpsDay = (o, extra = {}) => ({ station: 'valdesqui', source: 'gps', desnivel: 39999, bajadas: 99, km: 299, vmax: 139, trace: encodeTrace(synthDay(o)), ...extra });
// Un día de verdad en Valdesquí, sobre su mapa: tres veces el telesilla Bola del Mundo (cola de 1 min) y la pista Bola II
const { toLatLon, fromPack, heights } = require('./public/calc.js'), PK = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'seg', 'valdesqui.json'), 'utf8'));
const pairs = a => a.reduce((o, v, i) => (i % 2 ? o[o.length - 1].push(v) : o.push([v]), o), []);
const BOLA = pairs(PK.l.find(l => l[0] === 'Bola del Mundo')[3]), BOLA2 = pairs(PK.p.filter(p => p[0] === 'Bola II').sort((a, b) => Math.hypot(a[3][0] - BOLA.at(-1)[0], a[3][1] - BOLA.at(-1)[1]) - Math.hypot(b[3][0] - BOLA.at(-1)[0], b[3][1] - BOLA.at(-1)[1]))[0][3]);
const VALDESQUI = fromPack(PK, heights(require('zlib').gunzipSync(fs.readFileSync(path.join(__dirname, 'mapas', 'estaciones', 'valdesqui', 'data', 'dem.u16d')))));
const DAY0 = Date.now() - 3 * 36e5;
function realDay() {
  const fx = []; let t = DAY0;
  const at = (x, z, v, dir) => { const p = toLatLon(x, z, PK.geo); fx.push({ t: t += 1000, lat: p.lat, lon: p.lon, alt: null, acc: 5, v, dir, vacc: 0.3, dacc: 5 }); };
  const go = (pts, v) => { for (let k = 1; k < pts.length; k++) { const [ax, az] = pts[k - 1], [bx, bz] = pts[k], d = Math.hypot(bx - ax, bz - az), dir = (Math.atan2(bx - ax, -(bz - az)) * 180 / Math.PI + 360) % 360; for (let q = 0; q < d; q += v) at(ax + (bx - ax) * q / d, az + (bz - az) * q / d, v, dir); } };
  const stay = ([x, z], s) => { for (let k = 0; k < s; k++) at(x, z, 0, null); };
  for (let r = 0; r < 3; r++) { stay(BOLA[0], 60); go(BOLA, 2.3); stay(BOLA.at(-1), 20); go([BOLA.at(-1), ...BOLA2], 9); go([BOLA2.at(-1), BOLA[0]], 1); }
  return fx;
}
const DROP = 3 * (VALDESQUI.elevation(...BOLA2[0]) - VALDESQUI.elevation(...BOLA2.at(-1)));   // el desnivel de verdad: tres veces Bola II
const REG = { email: 'ana@pistea.es', password: 'Nieve-Polvo-2026', alias: 'Ana Test', terms: true };
(async () => {
  await start();
  const A = browser();
  // --- registro
  t('sin aceptar condiciones', (await A('POST', '/api/register', { ...REG, terms: false }))[0] === 400);
  t('contraseña común', (await A('POST', '/api/register', { ...REG, password: '12345678' }))[0] === 400);
  t('contraseña con el correo', (await A('POST', '/api/register', { ...REG, password: 'ana@pistea.es1' }))[0] === 400);
  t('campo trampa de bots', (await A('POST', '/api/register', { ...REG, web: 'http://spam' }))[0] === 400);
  t('tipos raros no rompen', (await A('POST', '/api/register', { email: ['a'], password: {}, alias: 5 }))[0] === 400);
  t('cuerpo que no es objeto', (await A('POST', '/api/register', [1, 2]))[0] === 400);
  t('escritura sin cabecera anti-CSRF', (await A('POST', '/api/register', REG, { 'X-Pistea': '' }))[0] === 403);
  t('escritura desde otra web', (await A('POST', '/api/register', REG, { 'Sec-Fetch-Site': 'cross-site' }))[0] === 403);
  let [s, j] = await A('POST', '/api/register', REG);
  t('registro', s === 200 && j.user && j.user.email === 'ana@pistea.es', JSON.stringify(j));
  t('el token no va en la respuesta', !JSON.stringify(j).match(/[a-f0-9]{48}/));
  t('cookie HttpOnly y SameSite', /HttpOnly/.test(A.last) && /SameSite=Lax/.test(A.last));
  t('correo duplicado (mayúsculas)', (await A('POST', '/api/register', { ...REG, email: 'ANA@pistea.es' }))[0] === 409);
  t('sesión con la cookie', (await A('GET', '/api/me'))[1].user?.alias === 'Ana Test');
  // --- verificación del correo
  t('nace sin verificar', j.user.verified === false);
  const VA = linkFor('ana@pistea.es', 'verify'); t('correo de verificación enviado', !!VA);
  t('verificar con enlace falso', (await browser()('POST', '/api/verify', { token: 'f'.repeat(64) }))[0] === 400);
  t('verificar', (await browser()('POST', '/api/verify', { token: VA }))[0] === 200);
  t('el enlace sirve una vez', (await browser()('POST', '/api/verify', { token: VA }))[0] === 400);
  t('ya verificada', (await A('GET', '/api/me'))[1].user.verified === true);
  t('reenviar estando verificada', (await A('POST', '/api/verify/resend'))[1].verified === true);
  const Bx = browser(); await Bx('POST', '/api/register', { email: 'bea@pistea.es', password: 'Bea-Esquia-Mucho', alias: 'Bea Oculta', terms: true });
  await Bx('POST', '/api/days', day({ desnivel: 30000, bajadas: 40 }));
  const beaId = (await Bx('GET', '/api/me'))[1].user.id;
  t('sin verificar: fuera del ranking de los demás', !(await A('GET', '/api/rank'))[1].rows.some(r => r.alias === 'Bea Oculta'));
  t('…pero se ve a sí misma', (await Bx('GET', '/api/rank'))[1].rows.some(r => r.alias === 'Bea Oculta' && r.me));
  t('sin verificar: fuera de la búsqueda', (await A('GET', '/api/users?q=bea'))[1].length === 0);
  t('sin verificar: perfil no visible', (await A('GET', '/api/user?id=' + beaId))[0] === 404);
  t('sin verificar: fuera de la comunidad', !(await A('GET', '/api/feed?scope=todos'))[1].some(d => d.alias === 'Bea Oculta'));
  t('reenviar verificación', (await Bx('POST', '/api/verify/resend'))[0] === 200);
  for (let i = 0; i < 2; i++) await Bx('POST', '/api/verify/resend');
  t('límite de reenvíos', (await Bx('POST', '/api/verify/resend'))[0] === 429);
  await browser()('POST', '/api/verify', { token: linkFor('bea@pistea.es', 'verify') });
  t('verificada: ya sale en el ranking', (await A('GET', '/api/rank'))[1].rows.some(r => r.alias === 'Bea Oculta'));
  t('config dice si se exige verificar', (await A('GET', '/api/config'))[1].verify === true);
  // --- nombres ofensivos
  t('nombre ofensivo', (await browser()('POST', '/api/register', { ...REG, email: 'x1@pistea.es', alias: 'G1l1poll4s' }))[0] === 400);
  t('nombre normal con «puta» dentro de otra palabra', (await A('POST', '/api/me', { alias: 'Disputa Nieve' }))[0] === 200);
  t('biografía ofensiva', (await A('POST', '/api/me', { bio: 'eres un hijo de puta' }))[0] === 400);
  await A('POST', '/api/me', { alias: 'Ana Test' });
  // --- ficha de esquiador
  t('nace sin alta guiada', (await A('GET', '/api/me'))[1].user.onboarded === false);
  [s, j] = await A('POST', '/api/me', { handle: '@Ana.Esquia', since: 2009, terrain: ['pista', 'freeride', 'pista'], wish: ['formigal', 'sierra-nevada'], goal_days: 20, gear: 'Atomic Redster', club: 'CAM Madrid', onboarded: true });
  t('ficha completa', s === 200 && j.user.handle === 'ana.esquia' && j.user.since === 2009 && j.user.terrain.length === 2 && j.user.wish[1] === 'sierra-nevada' && j.user.goal_days === 20 && j.user.onboarded === true, JSON.stringify(j));
  t('@usuario ocupado', (await Bx('POST', '/api/me', { handle: 'ana.esquia' }))[0] === 409);
  t('@usuario ocupado: propone otro', (await Bx('GET', '/api/handle?h=ana.esquia'))[1].suggest?.startsWith('ana.esquia'));
  t('@usuario libre', (await Bx('GET', '/api/handle?h=bea.oculta'))[1].ok === true);
  t('@usuario de una estación', (await Bx('POST', '/api/me', { handle: 'sierra.nevada' }))[0] === 400);
  t('@usuario con formato raro', (await Bx('POST', '/api/me', { handle: 'a..b' }))[0] === 400 && (await Bx('POST', '/api/me', { handle: 'ñu' }))[0] === 400);
  t('terreno o estaciones inventados', (await A('POST', '/api/me', { terrain: ['volar'] }))[0] === 400 && (await A('POST', '/api/me', { wish: ['marte'] }))[0] === 400);
  t('reto fuera de rango', (await A('POST', '/api/me', { goal_days: 900 }))[0] === 400);
  [s, j] = await Bx('GET', '/api/user?id=' + (await A('GET', '/api/me'))[1].user.id);
  t('la ficha se ve; el reto no', j.handle === 'ana.esquia' && j.club === 'CAM Madrid' && j.goal_days === undefined, JSON.stringify(j));
  t('buscar por @usuario', (await Bx('GET', '/api/users?q=@ana.es'))[1].some(x => x.handle === 'ana.esquia'));
  // --- bloquear
  const anaId = (await A('GET', '/api/me'))[1].user.id;
  await A('POST', '/api/follow', { id: beaId });
  t('bloquear', (await A('POST', '/api/block', { id: beaId }))[1].blocked === true);
  t('bloqueada: fuera de mi comunidad', !(await A('GET', '/api/feed?scope=todos'))[1].some(d => d.alias === 'Bea Oculta'));
  t('bloqueada: fuera de mi búsqueda', (await A('GET', '/api/users?q=bea'))[1].length === 0);
  t('bloqueada: perfil no visible (y yo para ella)', (await A('GET', '/api/user?id=' + beaId))[0] === 404 && (await Bx('GET', '/api/user?id=' + anaId))[0] === 404);
  t('bloqueada: no puede seguirme', (await Bx('POST', '/api/follow', { id: anaId }))[0] === 400);
  t('bloquear deja de seguir', (await A('GET', '/api/me'))[1].following === 0);
  t('lista de bloqueados', (await A('GET', '/api/blocks'))[1].some(x => x.id === beaId));
  t('desbloquear', (await A('POST', '/api/block', { id: beaId }))[1].blocked === false && (await A('GET', '/api/users?q=bea'))[1].length === 1);
  // --- denunciar
  const beaDay = (await Bx('GET', '/api/me'))[1].days[0].id;
  t('denuncia sin motivo', (await A('POST', '/api/report', { target: beaId, reason: 'nada' }))[0] === 400);
  t('denunciarse a sí misma', (await A('POST', '/api/report', { target: anaId, reason: 'spam' }))[0] === 400);
  t('denunciar un día ajeno con otro dueño', (await A('POST', '/api/report', { target: anaId === beaId ? '' : beaId, day: 'nope', reason: 'trampas' }))[0] === 400);
  t('denunciar un día', (await A('POST', '/api/report', { target: beaId, day: beaDay, reason: 'trampas', note: 'Imposible tanto desnivel' }))[0] === 200);
  t('repetir la misma denuncia no suma', (await A('POST', '/api/report', { target: beaId, day: beaDay, reason: 'trampas' }))[0] === 200);
  const R1 = browser(), R2 = browser();
  for (const [Rb, em] of [[R1, 'r1@pistea.es'], [R2, 'r2@pistea.es']]) { await Rb('POST', '/api/register', { ...REG, email: em, alias: 'Rep ' + em[1] }); await browser()('POST', '/api/verify', { token: linkFor(em, 'verify') }); }
  await R1('POST', '/api/report', { target: beaId, reason: 'ofensivo' });
  t('dos denuncias: sigue visible', (await A('GET', '/api/users?q=bea'))[1].length === 1);
  await R2('POST', '/api/report', { target: beaId, reason: 'ofensivo' });
  t('tres personas: se oculta hasta revisarlo', (await A('GET', '/api/users?q=bea'))[1].length === 0 && !(await A('GET', '/api/rank'))[1].rows.some(r => r.alias === 'Bea Oculta'));
  t('a una cuenta oculta no se la puede seguir…', (await R1('POST', '/api/follow', { id: beaId }))[0] === 400);
  t('…ni dar apoyo a sus días', (await R1('POST', '/api/kudos', { id: beaDay }))[0] === 404);
  // --- moderación
  t('panel de moderación: no para cualquiera', (await A('GET', '/api/admin/reports'))[0] === 403);
  const M = browser(); await M('POST', '/api/register', { ...REG, email: 'admin@pistea.es', alias: 'Moderador' });
  t('moderador sin verificar no modera', (await M('GET', '/api/admin/reports'))[0] === 403);
  await browser()('POST', '/api/verify', { token: linkFor('admin@pistea.es', 'verify') });
  t('el moderador se ve como tal', (await M('GET', '/api/me'))[1].user.admin === true);
  [s, j] = await M('GET', '/api/admin/reports'); t('ve las denuncias', s === 200 && j.length === 3 && j.some(r => r.day === beaDay && r.n === 3), JSON.stringify(j).slice(0, 200));
  const dayRep = j.find(r => r.day === beaDay), other1 = j.find(r => !r.day);
  t('quitar el día denunciado', (await M('POST', '/api/admin/resolve', { id: dayRep.id, action: 'quitar_dia' }))[0] === 200 && !(await Bx('GET', '/api/me'))[1].days.some(d => d.id === beaDay));
  t('descartar: vuelve a ser visible', (await M('POST', '/api/admin/resolve', { id: other1.id, action: 'descartar' }))[0] === 200 && (await A('GET', '/api/users?q=bea'))[1].length === 1);
  t('no quedan denuncias abiertas', (await M('GET', '/api/admin/reports'))[1].length === 0);
  // Denuncias en grupo: dos cuentas recién creadas y sin verificar, más una real, no bastan para esconder a nadie
  await R1('POST', '/api/report', { target: anaId, reason: 'spam' });
  for (const em of ['u1@spam.es', 'u2@spam.es']) { const U = browser(); await U('POST', '/api/register', { ...REG, email: em, alias: 'Spam ' + em[1] }); await U('POST', '/api/report', { target: anaId, reason: 'spam' }); }
  t('cuentas sin verificar no esconden a nadie con denuncias', (await Bx('GET', '/api/users?q=ana'))[1].length === 1 && (await M('GET', '/api/admin/reports'))[1].filter(r => r.target === anaId).length === 3);
  // --- panel de datos (/panel): todas las cuentas, solo para administradores y sin contraseñas
  t('panel de datos: no para cualquiera', (await A('GET', '/api/admin/panel'))[0] === 403 && (await browser()('GET', '/api/admin/panel'))[0] === 401);
  [s, j] = await M('GET', '/api/admin/panel');
  const pj = JSON.stringify(j);
  t('el administrador ve todas las cuentas con su correo', s === 200 && j.users.length >= 4 && j.users.some(x => x.email === 'admin@pistea.es') && j.users.every(x => x.email && x.created), pj.slice(0, 200));
  t('…y los días, sin contraseñas, sesiones ni trazas', Array.isArray(j.days) && !/"(hash|salt|th|track|speed|detail|kexp)"/.test(pj) && j.users.every(x => !('avatar' in x)));
  t('…con su última actividad', j.users.find(x => x.email === 'admin@pistea.es').seen > 0);
  const pg = await fetch(B + '/panel'), ph = await pg.text();
  t('la página del panel existe y no se indexa', pg.status === 200 && ph.includes('/panel.js') && /noindex/.test(pg.headers.get('x-robots-tag') || '') && /no-store/.test(pg.headers.get('cache-control') || ''));
  t('el panel queda en la auditoría', (await M('GET', '/api/me/export'))[1].registro_de_seguridad.some(x => x.action === 'ADMIN_PANEL'));
  await R1('POST', '/api/report', { target: beaId, reason: 'spam' });
  const rep2 = (await M('GET', '/api/admin/reports'))[1][0];
  t('suspender', (await M('POST', '/api/admin/resolve', { id: rep2.id, action: 'suspender' }))[0] === 200);
  t('suspendida: pierde la sesión', (await Bx('GET', '/api/me'))[0] === 401);
  t('suspendida: no puede entrar', (await browser()('POST', '/api/login', { email: 'bea@pistea.es', password: 'Bea-Esquia-Mucho' }))[0] === 403);
  t('suspendida: fuera de todo', (await A('GET', '/api/users?q=bea'))[1].length === 0);
  // --- persistencia: se reinicia el servidor y la cuenta, la sesión y los datos siguen ahí
  await A('POST', '/api/days', day());
  await stop(); await start();
  [s, j] = await A('GET', '/api/me');
  t('tras reiniciar sigue la sesión', s === 200 && j.user?.email === 'ana@pistea.es', s);
  t('tras reiniciar siguen los días', j.totals?.dias === 1);
  const C = browser();
  t('otro dispositivo: entrar', (await C('POST', '/api/login', { email: 'Ana@Pistea.es ', password: REG.password }))[0] === 200);
  t('login mal', (await browser()('POST', '/api/login', { email: 'ana@pistea.es', password: 'mala-mala' }))[0] === 401);
  t('sin sesión', (await browser()('GET', '/api/me'))[0] === 401);
  t('token falso', (await browser()('GET', '/api/me', null, { Cookie: 'pistea_s=' + 'a'.repeat(48) }))[0] === 401);
  // --- hash antiguo (N=16384, sin prefijo): sigue entrando y se renueva
  const { createClient } = require('@libsql/client'), db = createClient({ url: 'file:' + path.join(dir, 'pistea.sqlite').split(path.sep).join('/') });
  const salt = 'abcd', old = crypto.scryptSync('Antigua-Clave-99', salt, 64).toString('hex');
  await db.execute({ sql: "INSERT INTO users(id,email,alias,salt,hash,created) VALUES('0123456789abcdef','vieja@pistea.es','Vieja',?,?,0)", args: [salt, old] });
  t('usuario con hash antiguo entra', (await browser()('POST', '/api/login', { email: 'vieja@pistea.es', password: 'Antigua-Clave-99' }))[0] === 200);
  t('y su hash se renueva', /^s2\$/.test((await db.execute("SELECT hash FROM users WHERE email='vieja@pistea.es'")).rows[0].hash));
  // --- datos y red social
  t('estación inválida', (await A('POST', '/api/days', day({ station: 'luna' })))[0] === 400);
  t('datos incoherentes', (await A('POST', '/api/days', day({ desnivel: 40000, bajadas: 2 })))[0] === 400);
  t('valores raros se limpian', (await A('POST', '/api/days', day({ km: -5, vmax: 'x', track: 'no' })))[0] === 200);
  [s, j] = await A('GET', '/api/rank?metric=desnivel&period=temporada'); t('ranking', s === 200 && j.rows.length > 0 && j.me?.pos > 0);
  t('métrica inyectada', (await A('GET', "/api/rank?metric=desnivel;DROP TABLE users&period=hoy"))[0] === 200);
  t('estaciones', (await A('GET', '/api/stations'))[1].valdesqui?.skiers > 0);
  t('feed', Array.isArray((await A('GET', '/api/feed?scope=amigos'))[1]));
  t('búsqueda con comodines', (await A('GET', '/api/users?q=%25_'))[1].length === 0);
  [s, j] = await A('GET', '/api/users?q=viej'); const other = j[0]; t('búsqueda', other?.id === '0123456789abcdef');
  t('seguir', (await A('POST', '/api/follow', { id: other.id }))[1].following === true);
  t('no seguir a quien no existe', (await A('POST', '/api/follow', { id: 'nadie' }))[0] === 400);
  await A('POST', '/api/me', { age: 30 });
  const V = browser(); await V('POST', '/api/login', { email: 'vieja@pistea.es', password: 'Antigua-Clave-99' });
  [s, j] = await V('GET', '/api/user?id=' + (await A('GET', '/api/me'))[1].user.id);
  t('la edad no sale en el perfil público', s === 200 && j.age === null && j.alias === 'Ana Test', s + ' ' + JSON.stringify(j).slice(0, 200));
  t('perfil con XSS en el nombre se limpia', (await A('POST', '/api/me', { alias: 'Ana‮<b>' }))[1].user?.alias === 'Ana <b>');
  [s, j] = await A('GET', '/api/me'); const dayId = j.days[0].id;
  // --- quién ve los días: por defecto, solo los seguidores (privacidad desde el diseño)
  t('por defecto, los días los ven tus seguidores', j.user.vis === 'seguidores');
  t('quien no te sigue no ve tus días…', (await V('GET', '/api/day?id=' + dayId))[0] === 404 && (await V('GET', '/api/user?id=' + j.user.id))[1].daysHidden === true && !(await V('GET', '/api/feed?scope=todos'))[1].some(d => d.id === dayId));
  t('…ni les da apoyo', (await V('POST', '/api/kudos', { id: dayId }))[0] === 404);
  t('valor de privacidad raro', (await A('POST', '/api/me', { vis: 'publico' }))[0] === 400);
  await A('POST', '/api/me', { vis: 'todos' });
  [s, j] = await V('GET', '/api/day?id=' + dayId);
  t('con «todos», sí, pero sin la hora del día', s === 200 && j.t0 === null && j.t1 === null && j.me === false, JSON.stringify(j).slice(0, 160));
  t('sin apoyo a un día propio', (await A('POST', '/api/kudos', { id: dayId }))[0] === 400);
  t('kudos +', (await V('POST', '/api/kudos', { id: dayId }))[1].liked === true);
  t('kudos -', (await V('POST', '/api/kudos', { id: dayId }))[1].liked === false);
  await A('POST', '/api/me', { vis: 'yo' });
  t('«solo yo»: fuera de los rankings de los demás…', !(await V('GET', '/api/rank?metric=desnivel&period=temporada'))[1].rows.some(r => /^Ana/.test(r.alias)) && (await V('GET', '/api/user?id=' + (await A('GET', '/api/me'))[1].user.id))[1].totals === null);
  t('…pero ve su propio puesto', (await A('GET', '/api/rank?metric=desnivel&period=temporada'))[1].me?.pos > 0);
  await A('POST', '/api/me', { vis: 'seguidores' });
  await V('POST', '/api/me', { age: 16 });
  t('con menos de 18 años, los días no pueden ser de todos', (await V('POST', '/api/me', { vis: 'todos' }))[0] === 400);
  await V('POST', '/api/me', { age: null });
  // --- foto de perfil en la BD
  const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(64, 1)]).toString('base64');
  [s, j] = await A('POST', '/api/avatar', { image: png }); t('subir foto', s === 200 && /^\/avatars\/[a-f0-9]{16}\?v=\d+$/.test(j.avatar), JSON.stringify(j));
  let r = await fetch(B + j.avatar); t('servir foto (tipo, nosniff, sandbox)', r.status === 200 && r.headers.get('content-type') === 'image/png' && r.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(r.headers.get('content-security-policy')));
  t('foto disfrazada (HTML como PNG)', (await A('POST', '/api/avatar', { image: 'data:image/png;base64,' + Buffer.from('<html><script>alert(1)</script>' + 'x'.repeat(40)).toString('base64') }))[0] === 400);
  t('foto SVG rechazada', (await A('POST', '/api/avatar', { image: 'data:image/svg+xml;base64,' + Buffer.from('<svg onload=alert(1)>' + 'x'.repeat(40)).toString('base64') }))[0] === 400);
  t('borrar foto', (await A('DELETE', '/api/avatar'))[0] === 200);
  // --- exportar
  [s, j, r] = await A('GET', '/api/me/export'); t('exportar mis datos', s === 200 && j.usuario?.email === 'ana@pistea.es' && /attachment/.test(r.headers.get('content-disposition')));
  for (let i = 0; i < 3; i++) await A('POST', '/api/days', day());
  t('límite de 5 días/24 h', (await A('POST', '/api/days', day()))[0] === 429);
  t('…que se mira antes de recalcular la traza (lo caro)', /Máximo 5 días/.test((await A('POST', '/api/days', gpsDay()))[1].error || ''));
  // --- antitrampas: el servidor recalcula el día desde la traza
  const G = browser(); await G('POST', '/api/register', { ...REG, email: 'gps@pistea.es', alias: 'Gps Real' });
  t('día GPS sin traza', (await G('POST', '/api/days', { station: 'valdesqui', source: 'gps', desnivel: 5000, bajadas: 10 }))[0] === 400);
  t('traza con basura', (await G('POST', '/api/days', { station: 'valdesqui', source: 'gps', trace: { v: 1, t: ['x'], la: [1], lo: [1], al: [1], ac: [1], sp: [1] } }))[0] === 400);
  t('traza de otra estación (Sierra Nevada como Valdesquí)', /no es de esta estación/.test((await G('POST', '/api/days', gpsDay({ lat: 37.08, lon: -3.39 })))[1].error || ''));
  t('ubicación simulada', /simuladas/.test((await G('POST', '/api/days', gpsDay({ mock: true })))[1].error || ''));
  t('saltos imposibles', /saltos/.test((await G('POST', '/api/days', gpsDay({ jump: true })))[1].error || ''));
  t('traza de hace un mes', (await G('POST', '/api/days', gpsDay({ start: Date.now() - 30 * 864e5 })))[0] === 400);
  const RD = realDay(), real = { station: 'valdesqui', source: 'gps', desnivel: 39999, bajadas: 99, km: 299, vmax: 139, trace: encodeTrace(RD) };
  [s, j] = await G('POST', '/api/days', real);
  t('día GPS real: se guarda', s === 200, JSON.stringify(j).slice(0, 200));
  t('…con las cifras del servidor, no las del móvil', j.day && j.day.bajadas === 3 && Math.abs(j.day.desnivel - DROP) < 0.1 * DROP && j.day.km < 6 && j.day.vmax < 45, `${JSON.stringify(j.day || {}).slice(0, 160)} desnivel de verdad ${DROP | 0}`);
  t('…con el tiempo total de la traza', j.day && Math.abs(j.day.total - (RD.at(-1).t - RD[0].t) / 36e5) < 0.01);
  const dt = j.day && j.day.detail;
  t('…con sus pistas y su remonte (motor del servidor)', dt && dt.runs.length === 3 && dt.runs.every(r => /^Bola/.test(r[5].reduce((b, g) => (g[2] > b[2] ? g : b))[1])) && dt.rides.length === 3 && dt.rides.every(r => /Bola del Mundo/.test(r[0])), JSON.stringify(dt || {}).slice(0, 300));
  t('…y sin freeride por la pista', j.day && j.day.freeride < 0.05 && dt.m.f < 50);
  t('ver el día con su desglose', (await G('GET', '/api/day?id=' + j.day.id))[1].detail?.runs?.length === 3);
  t('el mismo día dos veces', (await G('POST', '/api/days', real))[0] === 409);
  t('la traza no se guarda (solo el recorrido simplificado)', !(await db.execute('PRAGMA table_info(days)')).rows.some(r => /trace|lat|lon/.test(r.name)) && (tr => tr.length <= 500 && tr.every(p => p.length === 3))(JSON.parse((await db.execute("SELECT track FROM days WHERE src='gps' LIMIT 1")).rows[0].track)));
  t('ranking de freeride', (await G('GET', '/api/rank?metric=freeride'))[0] === 200);
  const rv = (await G('GET', '/api/rank?metric=vmax'))[1], rdv = (await G('GET', '/api/rank?metric=desnivel'))[1];
  t('no hay ranking de velocidad (se ignora la métrica)', JSON.stringify(rv.rows) === JSON.stringify(rdv.rows));
  // --- pasaporte de pistas, récords por pista y Wrapped (del desglose del día GPS: tres veces Bola II)
  t('cada tramo lleva su máxima', dt && dt.runs.every(r => r[5].every(g => g.length === 4 && g[3] >= 0)) && dt.runs.some(r => r[5].some(g => /^Bola II/.test(g[1]) && g[3] > 20 && g[3] <= r[4])), JSON.stringify(dt && dt.runs[0][5]));
  t('al guardar: pista nueva en el pasaporte', j.nov && j.nov.nuevas.some(p => p[0] === 'Bola II'), JSON.stringify(j.nov));
  const pz = (await db.execute({ sql: 'SELECT piste, n, vmax FROM passes WHERE day=?', args: [j.day.id] })).rows;
  t('…y su fila en passes (3 bajadas por Bola II, con máxima)', pz.some(r => r.piste === 'Bola II' && Number(r.n) === 3 && r.vmax > 20 && r.vmax < 60), JSON.stringify(pz));
  const pp = (await G('GET', '/api/passport'))[1];
  t('pasaporte: Bola II en Valdesquí', (pp.stations.valdesqui || []).some(p => p[0] === 'Bola II' && p[2] === 3) && pp.rank && pp.rank.pos === 1, JSON.stringify(pp).slice(0, 300));
  const ps = (await G('GET', '/api/piste?station=valdesqui&name=' + encodeURIComponent('Bola II')))[1];
  t('ficha de pista: primero en bajadas, sin clasificación de velocidad', !('speed' in ps) && ps.runs[0].v === 3 && ps.runs[0].me && ps.me.posN === 1 && ps.mine && ps.mine.n === 3 && ps.mine.v > 0 && ps.c === 'a', JSON.stringify(ps).slice(0, 300));
  t('ficha de pista sin estación', (await G('GET', '/api/piste?station=nada&name=x'))[0] === 400);
  const rc = (await G('GET', '/api/records?station=valdesqui'))[1];
  t('récords de la estación: quien más la ha bajado, sin velocidades ajenas', Array.isArray(rc) && rc.some(r => r.name === 'Bola II' && !('v' in r) && r.n.me && r.n.n === 3 && r.mine && r.mine.v > 0), JSON.stringify(rc).slice(0, 300));
  const wr = (await G('GET', '/api/wrapped'))[1];
  t('Wrapped de la temporada', wr.dias === 1 && wr.bajadas === 3 && wr.fav && wr.fav.name === 'Bola II' && wr.fast && wr.fast.v > 0 && !('pos' in wr.fast) && wr.pistes >= 1 && wr.m.a > 0, JSON.stringify(wr).slice(0, 300));
  t('Wrapped pide sesión', (await browser()('GET', '/api/wrapped'))[0] === 401);
  // …y quién sale en los récords de una pista: las cuentas públicas, la propia aunque no esté verificada, nunca un bloqueado
  const H = browser(); await H('POST', '/api/register', { ...REG, email: 'hielo@pistea.es', alias: 'Hielo Rápido' }); await browser()('POST', '/api/verify', { token: linkFor('hielo@pistea.es', 'verify') });
  t('otro esquiador con el mismo día GPS', (await H('POST', '/api/days', real))[0] === 200);
  const bola = async X => (await X('GET', '/api/piste?station=valdesqui&name=' + encodeURIComponent('Bola II')))[1].runs.map(x => x.alias);
  t('récords: sale el verificado y no el que no lo está', (await bola(G)).includes('Hielo Rápido') && !(await bola(H)).includes('Gps Real') && (await bola(G)).includes('Gps Real'));
  const hId = (await H('GET', '/api/me'))[1].user.id;
  t('récords: un bloqueado no sale (tampoco desde la caché)', (await G('POST', '/api/block', { id: hId }))[1].blocked === true && !(await bola(G)).includes('Hielo Rápido'));
  t('…ni en los récords de la estación', !JSON.stringify((await G('GET', '/api/records?station=valdesqui'))[1]).includes('Hielo Rápido'));
  await G('POST', '/api/block', { id: hId });
  // --- recuperar contraseña
  t('forgot correo inexistente (misma respuesta)', (await browser()('POST', '/api/forgot', { email: 'no@existe.es' }))[0] === 200);
  t('forgot', (await browser()('POST', '/api/forgot', { email: 'ana@pistea.es' }))[0] === 200);
  const R = linkFor('ana@pistea.es', 'reset'); t('correo con enlace (antes de responder)', !!R);
  const X = browser();
  t('reset token malo', (await X('POST', '/api/reset', { token: 'x', password: 'Otra-Clave-Larga-1' }))[0] === 400);
  t('reset contraseña débil', (await X('POST', '/api/reset', { token: R, password: '11111111' }))[0] === 400);
  t('reset ok', (await X('POST', '/api/reset', { token: R, password: 'Otra-Clave-Larga-1' }))[0] === 200);
  t('reset un solo uso', (await X('POST', '/api/reset', { token: R, password: 'Otra-Clave-Larga-2' }))[0] === 400);
  t('sesiones anteriores cerradas', (await A('GET', '/api/me'))[0] === 401 && (await C('GET', '/api/me'))[0] === 401);
  t('la cookie caducada se borra', /Max-Age=0/.test(A.last || ''));
  t('login con la vieja falla', (await A('POST', '/api/login', { email: 'ana@pistea.es', password: REG.password }))[0] === 401);
  t('login con la nueva', (await A('POST', '/api/login', { email: 'ana@pistea.es', password: 'Otra-Clave-Larga-1' }))[0] === 200);
  // --- cambiar contraseña y cerrar sesiones
  const D = browser(); await D('POST', '/api/login', { email: 'ana@pistea.es', password: 'Otra-Clave-Larga-1' });
  t('cambiar contraseña: actual mal', (await A('POST', '/api/password', { old: 'nope-nope', password: 'Tercera-Clave-33' }))[0] === 403);
  t('cambiar contraseña', (await A('POST', '/api/password', { old: 'Otra-Clave-Larga-1', password: 'Tercera-Clave-33' }))[0] === 200);
  t('…mantiene esta sesión y cierra las demás', (await A('GET', '/api/me'))[0] === 200 && (await D('GET', '/api/me'))[0] === 401);
  t('cerrar sesión', (await A('POST', '/api/logout'))[0] === 200 && (await A('GET', '/api/me'))[0] === 401);
  await A('POST', '/api/login', { email: 'ana@pistea.es', password: 'Tercera-Clave-33' });
  // --- estáticos y cabeceras
  r = await fetch(B + '/'); t('página + CSP + COOP', r.status === 200 && /default-src/.test(r.headers.get('content-security-policy')) && r.headers.get('cross-origin-opener-policy') === 'same-origin');
  const csp = r.headers.get('content-security-policy'), page = await r.text();
  const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
  t('CSP estricta: sin código inline', scriptSrc.trim() === "'self'" && !/<script>/.test(page) && !/\son(click|submit|input|change)=/.test(page));
  r = await fetch(B + '/app.js'); t('app.js servido y revalidado', r.status === 200 && r.headers.get('cache-control') === 'no-cache' && /text\/javascript/.test(r.headers.get('content-type')));
  t('app.js sin manejadores inline', !/\son(click|submit|input|change)="/.test(await r.text()));
  r = await fetch(B + '/3d/'); t('mapas 3D servidos', r.status === 200 && /html/.test(r.headers.get('content-type')), r.status);
  r = await fetch(B + '/api/config'); t('sin MAPS_URL, el 3D lo sirve este servidor', (await r.json()).maps === '/3d/');
  r = await fetch(B + '/3d/../server.js'); t('sin salida de carpeta (..)', !/createClient/.test(await r.text()));
  r = await fetch(B + '/3d/%2e%2e/%2e%2e/server.js'); t('sin salida codificada', !/createClient/.test(await r.text()));
  r = await fetch(B + '/avatars/..%2f..%2fserver.js'); t('fotos: sin salida de carpeta', r.status === 404);
  for (const [p, h] of [['/privacidad', 'Política de privacidad'], ['/condiciones', 'Condiciones de uso'], ['/normas', 'Normas de la comunidad'], ['/borrar-cuenta', 'Borrar tu cuenta']]) {
    r = await fetch(B + p); const html = await r.text();
    t('página legal ' + p, r.status === 200 && html.includes(h) && (p === '/normas' || html.includes('legal@pistea.es')) && (!['/privacidad', '/condiciones'].includes(p) || html.includes('Persona De Prueba')) && !html.includes('[falta') && /default-src 'none'/.test(r.headers.get('content-security-policy')));
  }
  t('privacidad cita encargados y AEPD', /Turso/.test(await (await fetch(B + '/privacidad')).text()) );
  t('salud con BD', (await (await fetch(B + '/healthz')).json()).ok === true);
  // --- parte social: solicitudes, listas, avisos, sugerencias
  await db.execute('DELETE FROM hits');   // el alta está limitada por conexión: se empieza de cero para sembrar cuentas
  const mk = async (em, al) => { const X = browser(); await X('POST', '/api/register', { ...REG, email: em, alias: al }); await browser()('POST', '/api/verify', { token: linkFor(em, 'verify') }); X.id = (await X('GET', '/api/me'))[1].user.id; return X; };
  const P = await mk('p@pistea.es', 'Pau Pública'), Q = await mk('q@pistea.es', 'Quim Cerrado'), W = await mk('w@pistea.es', 'Wanda Tercera'), Y = await mk('y@pistea.es', 'Yago Cuarto');
  t('seguir a una cuenta normal es directo', (await P('POST', '/api/follow', { id: W.id }))[1].following === true);
  t('seguirse a uno mismo no', (await P('POST', '/api/follow', { id: P.id }))[0] === 400);
  [s, j] = await W('GET', '/api/activity');
  t('aviso de nuevo seguidor, sin ver', j.items.length === 1 && j.items[0].kind === 'follow' && j.items[0].alias === 'Pau Pública' && j.items[0].fresh === true && j.unseen === 1 && j.items[0].iFollow === false && j.items[0].requested === false, JSON.stringify(j));
  await P('POST', '/api/follow', { id: W.id }); await P('POST', '/api/follow', { id: W.id });   // dejar de seguir y volver: el aviso no se duplica
  t('dejar y volver a seguir no duplica el aviso', (await W('GET', '/api/activity'))[1].items.length === 1);
  [s, j] = await W('POST', '/api/activity/seen'); t('marcar los avisos como vistos', s === 200 && j.unseen === 0 && (await W('GET', '/api/social'))[1].unseen === 0 && (await W('GET', '/api/activity'))[1].items[0].fresh === false);
  t('aprobar seguidores: valor no booleano', (await Q('POST', '/api/me', { approve: 'sí' }))[0] === 400);
  t('aprobar seguidores: se activa', (await Q('POST', '/api/me', { approve: true }))[1].user.approve === true);
  [s, j] = await P('POST', '/api/follow', { id: Q.id });
  t('seguir a una cuenta que aprueba: queda como solicitud', s === 200 && j.following === false && j.requested === true, JSON.stringify(j));
  [s, j] = await P('GET', '/api/user?id=' + Q.id);
  t('su perfil dice que está solicitado y que no se puede ver con quién esquía', j.requested === true && j.following === false && j.approve === true && j.canList === false && j.followers === 0);
  t('sus listas, cerradas a quien no la sigue', (await P('GET', `/api/connections?id=${Q.id}&kind=followers`))[0] === 403 && (await P('GET', `/api/connections?id=${Q.id}&kind=following`))[0] === 403);
  [s, j] = await Q('GET', '/api/requests'); t('la solicitud le llega', j.length === 1 && j[0].id === P.id && j[0].alias === 'Pau Pública', JSON.stringify(j));
  t('la solicitud suma en su campana', (await Q('GET', '/api/social'))[1].requests === 1 && (await Q('GET', '/api/me'))[1].social.requests === 1);
  t('con solicitud pendiente, el seguimiento no existe', (await Q('GET', '/api/me'))[1].followers === 0 && (await P('GET', '/api/me'))[1].following === 1);
  t('el mismo botón cancela la solicitud', (await P('POST', '/api/follow', { id: Q.id }))[1].requested === false && (await Q('GET', '/api/requests'))[1].length === 0);
  await P('POST', '/api/follow', { id: Q.id });
  t('rechazar: no hay seguimiento ni aviso', (await Q('POST', '/api/requests', { id: P.id, accept: false }))[1].requests === 0 && (await P('GET', '/api/user?id=' + Q.id))[1].following === false && (await P('GET', '/api/activity'))[1].items.every(x => x.kind !== 'accepted'));
  t('rechazar otra vez: la solicitud ya no existe', (await Q('POST', '/api/requests', { id: P.id, accept: false }))[0] === 404);
  await P('POST', '/api/follow', { id: Q.id });
  [s, j] = await Q('POST', '/api/requests', { id: P.id, accept: true });
  t('aceptar: ya la sigue', s === 200 && j.followers === 1 && j.requests === 0 && (await P('GET', '/api/user?id=' + Q.id))[1].following === true);
  [s, j] = await P('GET', '/api/activity');
  t('y le llega el aviso de que aceptó', j.items[0].kind === 'accepted' && j.items[0].alias === 'Quim Cerrado' && j.items[0].iFollow === true && j.unseen === 1, JSON.stringify(j.items[0]));
  t('quien la sigue ya ve sus listas; los demás no', (await P('GET', `/api/connections?id=${Q.id}&kind=followers`))[0] === 200 && (await W('GET', `/api/connections?id=${Q.id}&kind=followers`))[0] === 403);
  [s, j] = await Q('GET', '/api/connections?kind=followers');
  t('mis seguidores', s === 200 && j.mine === true && j.total === 1 && j.items[0].id === P.id && j.items[0].followsMe === true && j.items[0].iFollow === false, JSON.stringify(j));
  [s, j] = await P('GET', '/api/connections?kind=following');
  t('a quién sigo (con cómo me tratan ellos)', j.total === 2 && j.items.some(x => x.id === Q.id && x.approve === true && x.iFollow === true) && j.items.some(x => x.id === W.id && x.followsMe === false), JSON.stringify(j));
  t('buscar dentro de la lista', (await P('GET', '/api/connections?kind=following&q=wand'))[1].items.map(x => x.id).join() === W.id && (await P('GET', '/api/connections?kind=following&q=zzz'))[1].total === 0);
  [s, j] = await P('GET', `/api/connections?id=${Q.id}&kind=followers`); t('en la lista de otra persona me veo a mí, sin botón', j.items.length === 1 && j.items[0].me === true);
  t('lista de quien no existe', (await P('GET', '/api/connections?id=nadie&kind=followers'))[0] === 404);
  [s, j] = await W('GET', '/api/suggest'); t('sugerencias: quien te sigue y tú no', j.some(x => x.id === P.id && /Te sigue/.test(x.why)), JSON.stringify(j));
  await W('POST', '/api/follow', { id: P.id }); await Y('POST', '/api/follow', { id: W.id });
  [s, j] = await Y('GET', '/api/suggest'); t('sugerencias: amigos en común, y nadie a quien ya sigues', j.some(x => x.id === P.id && /1 amigo en común/.test(x.why)) && !j.some(x => x.id === W.id || x.id === Y.id), JSON.stringify(j));
  await Y('POST', '/api/follow', { id: Q.id });   // solicitud de Yago a Quim
  t('quitar a un seguidor', (await Q('POST', '/api/followers/remove', { id: P.id }))[1].followers === 0 && (await P('GET', '/api/user?id=' + Q.id))[1].following === false);
  t('quitarlo dos veces', (await Q('POST', '/api/followers/remove', { id: P.id }))[0] === 404);
  t('una cuenta sin seguir no se puede quitar', (await Q('POST', '/api/followers/remove', { id: Y.id }))[0] === 404);
  t('apagar la aprobación acepta las solicitudes pendientes', (await Q('POST', '/api/me', { approve: false }))[1].user.approve === false && (await Y('GET', '/api/user?id=' + Q.id))[1].following === true && (await Q('GET', '/api/requests'))[1].length === 0 && (await Y('GET', '/api/activity'))[1].items.some(x => x.kind === 'accepted'));
  await Q('POST', '/api/me', { approve: true }); await P('POST', '/api/follow', { id: Q.id });
  t('bloquear borra la solicitud y los avisos entre los dos', (await Q('POST', '/api/block', { id: P.id }))[1].blocked === true && (await Q('GET', '/api/requests'))[1].length === 0 && (await db.execute({ sql: 'SELECT COUNT(*) n FROM follow_requests WHERE (a=? AND b=?) OR (a=? AND b=?)', args: [P.id, Q.id, Q.id, P.id] })).rows[0].n === 0);
  t('el bloqueado no puede pedir seguir', (await P('POST', '/api/follow', { id: Q.id }))[0] === 400);
  await Q('POST', '/api/block', { id: P.id });
  await W('POST', '/api/me', { vis: 'todos' });
  const wd = (await W('POST', '/api/days', day()))[1].day.id;
  t('apoyo a un día: avisa a su dueña', (await P('POST', '/api/kudos', { id: wd }))[1].liked === true && (await W('GET', '/api/activity'))[1].items.some(x => x.kind === 'kudo' && x.day === wd && x.station === 'valdesqui' && x.alias === 'Pau Pública'));
  await P('POST', '/api/kudos', { id: wd });
  t('quitar el apoyo quita el aviso', !(await W('GET', '/api/activity'))[1].items.some(x => x.kind === 'kudo'));
  const exp = await (await fetch(B + '/api/me/export', { headers: { Cookie: Object.entries(W.jar).map(([k, v]) => `${k}=${v}`).join('; ') } })).json();
  t('mis datos incluyen seguidores y solicitudes', exp.seguidores.includes('Pau Pública') && Array.isArray(exp.solicitudes_de_seguimiento_pendientes));
  // Yago pide seguir a Quim (cerrado), y luego Yago borra su cuenta: no quedan ni solicitudes ni avisos huérfanos
  await Q('POST', '/api/me', { approve: true }); await Y('POST', '/api/follow', { id: Q.id }); await Y('POST', '/api/follow', { id: Q.id });   // deja de seguir y vuelve a pedirlo: solicitud pendiente
  t('Yago tiene una solicitud pendiente y un aviso a Wanda', (await Q('GET', '/api/requests'))[1].some(x => x.id === Y.id) && (await W('GET', '/api/activity'))[1].items.some(x => x.alias === 'Yago Cuarto'));
  const orf = async () => (await db.execute('SELECT (SELECT COUNT(*) FROM follow_requests WHERE a NOT IN (SELECT id FROM users) OR b NOT IN (SELECT id FROM users)) r, (SELECT COUNT(*) FROM notifs WHERE uid NOT IN (SELECT id FROM users) OR actor NOT IN (SELECT id FROM users)) n')).rows[0];
  t('borrar la cuenta se lleva solicitudes y avisos', (await Y('DELETE', '/api/me', { password: REG.password }))[0] === 200 && await orf().then(r => Number(r.r) === 0 && Number(r.n) === 0));
  // --- borrar la cuenta (derecho de supresión)
  t('borrar cuenta pide contraseña', (await A('DELETE', '/api/me', { password: 'mala' }))[0] === 403);
  t('borrar cuenta', (await A('DELETE', '/api/me', { password: 'Tercera-Clave-33' }))[0] === 200);
  t('tras borrar no hay sesión', (await A('GET', '/api/me'))[0] === 401);
  const pasLeft = async () => (await db.execute('SELECT (SELECT COUNT(*) FROM passes WHERE uid NOT IN (SELECT id FROM users)) huerf, (SELECT COUNT(*) FROM passes) n')).rows[0];
  t('borrar la cuenta del día GPS se lleva su pasaporte (y no el de otros)', (await G('DELETE', '/api/me', { password: REG.password }))[0] === 200 && await pasLeft().then(r => Number(r.huerf) === 0 && Number(r.n) > 0));
  const left = (await db.execute("SELECT (SELECT COUNT(*) FROM days WHERE uid NOT IN (SELECT id FROM users)) d, (SELECT COUNT(*) FROM follows WHERE a NOT IN (SELECT id FROM users)) f, (SELECT COUNT(*) FROM users WHERE email='ana@pistea.es') u")).rows[0];
  t('no quedan sus datos', left.d === 0 && left.f === 0 && left.u === 0, JSON.stringify(left));
  // --- límites que sobreviven a un reinicio (guardados en la BD)
  const Z = browser(); for (let i = 0; i < 8; i++) await Z('POST', '/api/login', { email: 'z@z.es', password: 'x' });
  await stop(); await start();
  t('el bloqueo por intentos sigue tras reiniciar', (await Z('POST', '/api/login', { email: 'z@z.es', password: 'x' }))[0] === 429);
  db.close();
  console.log(`\n${ok} correctas, ${bad} fallidas`); await stop(); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(bad ? 1 : 0); }, 400);
})().catch(async e => { console.log('ERROR', e); console.log(out.slice(-2000)); try { await stop(); } catch {} process.exit(1); });
