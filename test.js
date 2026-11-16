// Pruebas de extremo a extremo: levanta el servidor con una BD temporal (fichero local, nunca la de producción) y recorre
// la API como lo haría el navegador: cookie de sesión, cabecera anti-CSRF y reinicios. Uso: node --no-warnings test.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pistea-')), PORT = 3199, B = `http://localhost:${PORT}`;
const ENV = { ...process.env, PORT, DATA_DIR: dir, NODE_ENV: 'test' }; delete ENV.TURSO_DATABASE_URL; delete ENV.TURSO_AUTH_TOKEN; delete ENV.VERCEL; delete ENV.RESEND_API_KEY;
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
  t('kudos +', (await A('POST', '/api/kudos', { id: dayId }))[1].liked === true);
  t('kudos -', (await A('POST', '/api/kudos', { id: dayId }))[1].liked === false);
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
  // --- recuperar contraseña
  t('forgot correo inexistente (misma respuesta)', (await browser()('POST', '/api/forgot', { email: 'no@existe.es' }))[0] === 200);
  t('forgot', (await browser()('POST', '/api/forgot', { email: 'ana@pistea.es' }))[0] === 200);
  const m = out.match(/\?reset=([a-f0-9]{64})/); t('correo con enlace (antes de responder)', !!m); const R = m && m[1];
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
  r = await fetch(B + '/3d/'); t('mapas 3D servidos', r.status === 200 && /html/.test(r.headers.get('content-type')), r.status);
  r = await fetch(B + '/3d/../server.js'); t('sin salida de carpeta (..)', !/createClient/.test(await r.text()));
  r = await fetch(B + '/3d/%2e%2e/%2e%2e/server.js'); t('sin salida codificada', !/createClient/.test(await r.text()));
  r = await fetch(B + '/avatars/..%2f..%2fserver.js'); t('fotos: sin salida de carpeta', r.status === 404);
  t('salud con BD', (await (await fetch(B + '/healthz')).json()).ok === true);
  // --- borrar la cuenta (derecho de supresión)
  t('borrar cuenta pide contraseña', (await A('DELETE', '/api/me', { password: 'mala' }))[0] === 403);
  t('borrar cuenta', (await A('DELETE', '/api/me', { password: 'Tercera-Clave-33' }))[0] === 200);
  t('tras borrar no hay sesión', (await A('GET', '/api/me'))[0] === 401);
  const left = (await db.execute("SELECT (SELECT COUNT(*) FROM days WHERE uid NOT IN (SELECT id FROM users)) d, (SELECT COUNT(*) FROM follows WHERE a NOT IN (SELECT id FROM users)) f, (SELECT COUNT(*) FROM users WHERE email='ana@pistea.es') u")).rows[0];
  t('no quedan sus datos', left.d === 0 && left.f === 0 && left.u === 0, JSON.stringify(left));
  // --- límites que sobreviven a un reinicio (guardados en la BD)
  const Z = browser(); for (let i = 0; i < 8; i++) await Z('POST', '/api/login', { email: 'z@z.es', password: 'x' });
  await stop(); await start();
  t('el bloqueo por intentos sigue tras reiniciar', (await Z('POST', '/api/login', { email: 'z@z.es', password: 'x' }))[0] === 429);
  db.close();
  console.log(`\n${ok} correctas, ${bad} fallidas`); await stop(); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(bad ? 1 : 0); }, 400);
})().catch(async e => { console.log('ERROR', e); console.log(out.slice(-2000)); try { await stop(); } catch {} process.exit(1); });
