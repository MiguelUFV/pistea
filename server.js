// Pistea · servidor (Node 20+). Base de datos libSQL: Turso en producción (persistente, cifrada en tránsito) o un fichero
// SQLite en local. Sesiones en cookie HttpOnly. Ver DEPLOY.md (despliegue) y SEGURIDAD.md (auditoría y decisiones).
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { promisify } = require('util'), { createClient } = require('@libsql/client');
const env = process.env, PORT = +env.PORT || 3000, PROD = env.NODE_ENV === 'production', VERCEL = !!env.VERCEL, TRUST = env.TRUST_PROXY === '1';
const APP_URL = (env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : `http://localhost:${PORT}`)).replace(/\/$/, '');
const DATA = env.DATA_DIR || __dirname, AVATARS_DIR = path.join(DATA, 'avatars');
const MAPS = env.MAPS_DIR || (fs.existsSync(path.join(__dirname, 'mapas')) ? path.join(__dirname, 'mapas') : path.resolve(__dirname, '../../Estaciones3D/web/dist/app'));
const ALLOW_SIM = !PROD || env.ALLOW_SIM === '1', MIN = 6e4, HOUR = 36e5, DAY = 864e5, SESSION = 90 * DAY;

// Estaciones con mapa 3D disponible (mismo id que el motor Estaciones3D)
const STATIONS = [['alto-campoo','Alto Campoo','Cantábrica'],['astun','Astún','Pirineos'],['baqueira-beret','Baqueira Beret','Pirineos'],['boi-taull','Boí Taüll','Pirineos'],['candanchu','Candanchú','Pirineos'],['cerler','Cerler','Pirineos'],['espot','Espot','Pirineos'],['formigal','Formigal','Pirineos'],['fuentes-de-invierno','Fuentes de Invierno','Cantábrica'],['javalambre','Javalambre','Ibérica'],['la-covatilla','La Covatilla','Central'],['la-molina','La Molina','Pirineos'],['la-pinilla','La Pinilla','Central'],['leitariegos','Leitariegos','Cantábrica'],['manzaneda','Manzaneda','Galicia'],['masella','Masella','Pirineos'],['panticosa','Panticosa','Pirineos'],['port-aine','Port Ainé','Pirineos'],['port-del-comte','Port del Comte','Pirineos'],['san-isidro','San Isidro','Cantábrica'],['sierra-nevada','Sierra Nevada','Bética'],['valdelinares','Valdelinares','Ibérica'],['valdesqui','Valdesquí','Central'],['valdezcaray','Valdezcaray','Ibérica'],['valgrande-pajares','Valgrande-Pajares','Cantábrica'],['vall-de-nuria','Vall de Núria','Pirineos'],['vallter','Vallter','Pirineos']];
const SID = new Set(STATIONS.map(s => s[0]));
const rid = () => crypto.randomBytes(8).toString('hex'), sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

// ---------- base de datos ----------
// En Vercel el disco es temporal (/tmp se borra): sin Turso las cuentas se perderían, así que la API se niega a funcionar.
const DB_ERR = VERCEL && !env.TURSO_DATABASE_URL ? 'Falta TURSO_DATABASE_URL: en Vercel el disco es temporal y los datos se perderían.' : null;
const DB_URL = env.TURSO_DATABASE_URL || 'file:' + path.join(DATA, 'pistea.sqlite').split(path.sep).join('/');
if (DB_URL.startsWith('file:')) fs.mkdirSync(DATA, { recursive: true });
const db = createClient({ url: DB_URL, authToken: env.TURSO_AUTH_TOKEN || undefined });
const rowsOf = r => r.rows.map(row => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));
const all = async (sql, args = []) => rowsOf(await db.execute({ sql, args }));
const one = async (sql, args = []) => (await all(sql, args))[0] || null;
const run = (sql, args = []) => db.execute({ sql, args });
const atomic = list => db.batch(list.map(([sql, args = []]) => ({ sql, args })), 'write');   // todo o nada (transacción)
const J = (s, d = []) => { try { return JSON.parse(s); } catch { return d; } };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, alias TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, demo INTEGER DEFAULT 0, created INTEGER, avatar TEXT, age INTEGER, bio TEXT, station_home TEXT, modality TEXT DEFAULT 'ski', level TEXT DEFAULT 'intermedio', terms_accepted_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS tokens(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER, created INTEGER, ua TEXT)`,
  `CREATE TABLE IF NOT EXISTS resets(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER)`,
  `CREATE TABLE IF NOT EXISTS days(id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, station TEXT NOT NULL, ts INTEGER NOT NULL, desnivel REAL, km REAL, horas REAL, bajadas INTEGER, vmax REAL, vmed REAL, col TEXT, track TEXT, speed TEXT, src TEXT DEFAULT 'gps', total REAL)`,
  `CREATE TABLE IF NOT EXISTS kudos(day TEXT REFERENCES days(id) ON DELETE CASCADE, uid TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(day, uid))`,
  `CREATE TABLE IF NOT EXISTS follows(a TEXT REFERENCES users(id) ON DELETE CASCADE, b TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(a, b))`,
  `CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY, uid TEXT, action TEXT NOT NULL, ip TEXT NOT NULL, ua TEXT, details TEXT, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS avatars(uid TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, updated INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hits(k TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS verifs(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER)`];
const ALTERS = [['users', 'avatar TEXT'], ['users', 'age INTEGER'], ['users', 'bio TEXT'], ['users', 'station_home TEXT'], ['users', "modality TEXT DEFAULT 'ski'"], ['users', "level TEXT DEFAULT 'intermedio'"],
  ['users', 'terms_accepted_at INTEGER'], ['users', 'updated_at INTEGER'], ['days', 'total REAL'], ['tokens', 'created INTEGER'], ['tokens', 'ua TEXT'], ['users', 'verified INTEGER']];   // verified NULL = cuenta anterior a la verificación (se da por buena)
const INDEXES = ['CREATE INDEX IF NOT EXISTS i_days_uid ON days(uid, ts)', 'CREATE INDEX IF NOT EXISTS i_days_st ON days(station, ts)', 'CREATE INDEX IF NOT EXISTS i_days_ts ON days(ts)',
  'CREATE INDEX IF NOT EXISTS i_tokens_uid ON tokens(uid)', 'CREATE INDEX IF NOT EXISTS i_audit_uid ON audit_logs(uid, ts)', 'CREATE INDEX IF NOT EXISTS i_audit_ts ON audit_logs(ts)',
  'CREATE INDEX IF NOT EXISTS i_hits ON hits(k, ts)', 'CREATE INDEX IF NOT EXISTS i_follows_b ON follows(b)', 'CREATE INDEX IF NOT EXISTS i_kudos_uid ON kudos(uid)'];
async function init() {
  if (DB_URL.startsWith('file:')) await run('PRAGMA journal_mode=WAL').catch(() => {});
  await atomic(SCHEMA.map(s => [s]));
  for (const [t, c] of ALTERS) await run(`ALTER TABLE ${t} ADD COLUMN ${c}`).catch(() => {});   // BD creadas con versiones anteriores
  await atomic(INDEXES.map(s => [s]));
  await housekeeping(true);
}
let ready = null;
const dbReady = () => ready || (ready = init().catch(e => { ready = null; throw e; }));
let lastClean = 0;
async function housekeeping(force) {   // caducidades y retención de datos (RGPD: los registros de seguridad se guardan 180 días)
  const now = Date.now(); if (!force && now - lastClean < HOUR) return; lastClean = now;
  await atomic([['DELETE FROM tokens WHERE exp<?', [now]], ['DELETE FROM resets WHERE exp<?', [now]], ['DELETE FROM verifs WHERE exp<?', [now]], ['DELETE FROM hits WHERE ts<?', [now - DAY]], ['DELETE FROM audit_logs WHERE ts<?', [now - 180 * DAY]]]).catch(e => console.error('[limpieza]', e.message));
}

// ---------- estadísticas ----------
const WIN = { hoy: DAY, semana: 7 * DAY, temporada: 365 * DAY };
const MX = { desnivel: 'SUM(desnivel)', km: 'SUM(km)', horas: 'SUM(horas)', bajadas: 'SUM(bajadas)', dias: 'COUNT(*)', vmax: 'MAX(vmax)' };   // lista cerrada: nunca entra texto del usuario en el SQL
const SRC = ALLOW_SIM ? '1=1' : "src!='sim'", SRC_D = ALLOW_SIM ? '1=1' : "d.src!='sim'";
const OK_U = 'COALESCE(u.verified,1)=1', OK_UID = c => `${c} IN (SELECT id FROM users WHERE COALESCE(verified,1)=1)`;   // ver VERIFY
const rankRows = (metric, st, period, limit = 10, self = '') => all(`SELECT d.uid uid, u.alias alias, u.avatar avatar, ${MX[metric]} v FROM days d JOIN users u ON u.id=d.uid WHERE d.ts>=? AND (? IS NULL OR d.station=?) AND ${SRC_D} AND (${VERIFY ? OK_U : '1=1'} OR d.uid=?) GROUP BY d.uid ORDER BY v DESC, d.uid LIMIT ?`, [Date.now() - WIN[period], st, st, self, limit]);
async function posOf(uid, metric, st, period) {
  const r = await one(`WITH t AS (SELECT uid, ${MX[metric]} v FROM days WHERE ts>=? AND (? IS NULL OR station=?) AND ${SRC} AND (${VERIFY ? OK_UID('uid') : '1=1'} OR uid=?) GROUP BY uid)
    SELECT (SELECT v FROM t WHERE uid=?) mine, (SELECT COUNT(*) FROM t WHERE v>(SELECT v FROM t WHERE uid=?))+1 pos, (SELECT COUNT(*) FROM t) total, (SELECT MIN(v) FROM t WHERE v>(SELECT v FROM t WHERE uid=?)) nxt`, [Date.now() - WIN[period], st, st, uid, uid, uid, uid]);
  return !r || r.mine == null ? null : { pos: r.pos, v: r.mine, total: r.total, gap: r.nxt == null ? 0 : r.nxt - r.mine };
}
const agg = uid => one(`SELECT COALESCE(SUM(desnivel),0) desnivel, COALESCE(SUM(km),0) km, COALESCE(SUM(horas),0) horas, COALESCE(SUM(bajadas),0) bajadas, COUNT(*) dias, COALESCE(MAX(vmax),0) vmax FROM days WHERE uid=? AND ${SRC}`, [uid]);
async function streak(uid) { const wk = t => Math.floor(t / (7 * DAY)), set = new Set((await all('SELECT ts FROM days WHERE uid=?', [uid])).map(r => wk(r.ts))); let w = wk(Date.now()), n = 0; if (!set.has(w)) w--; while (set.has(w)) { n++; w--; } return n; }
async function league(uid) { const p = await posOf(uid, 'desnivel', null, 'semana'); if (!p) return { tier: null }; const f = (p.pos - 1) / p.total; return { tier: f < .1 ? 'Diamante' : f < .3 ? 'Oro' : f < .6 ? 'Plata' : 'Bronce', pos: p.pos, total: p.total, v: p.v }; }
const stationsDistinct = async uid => (await all(`SELECT DISTINCT station s FROM days WHERE uid=? AND ${SRC}`, [uid])).map(r => r.s);
const count = async (sql, args) => (await one(sql, args)).n;
let stationsCache = { t: 0, v: null };   // la portada la pide mucho y cuesta 27 clasificaciones: se guarda un minuto

// ---------- utilidades HTTP, sesiones y límites ----------
// IP del cliente: en Vercel la cabecera la pone la plataforma (no se puede falsificar); detrás de Caddy/nginx, el ÚLTIMO
// valor de X-Forwarded-For (el que añade el proxy); sin proxy, la conexión.
function ipOf(req) {
  if (VERCEL) return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  if (TRUST) { const xs = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean); if (xs.length) return xs[xs.length - 1]; }
  return req.socket.remoteAddress || '?';
}
// Límite de intentos guardado en la BD: vale aunque haya varias instancias del servidor o se reinicie (en Vercel, siempre)
const hk = key => sha('pistea-rl:' + key).slice(0, 40);
const over = async (key, max, win) => (await count('SELECT COUNT(*) n FROM hits WHERE k=? AND ts>?', [hk(key), Date.now() - win])) >= max;
const hit = key => run('INSERT INTO hits(k,ts) VALUES(?,?)', [hk(key), Date.now()]);
const limited = async (key, max, win) => { if (await over(key, max, win)) return true; await hit(key); return false; };

const COOKIE = PROD ? '__Host-pistea' : 'pistea_s';
const cookies = req => { const o = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); } return o; };
const secure = req => PROD || !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
const setSession = (req, res, token) => res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION / 1000}${secure(req) ? '; Secure' : ''}`);
const clearSession = (req, res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req) ? '; Secure' : ''}`);
const tokenOf = req => { const t = cookies(req)[COOKIE] || String(req.headers.authorization || '').replace(/^Bearer /, ''); return /^[a-f0-9]{48}$/.test(t) ? t : null; };
async function newToken(u, req) {
  const t = crypto.randomBytes(24).toString('hex'), now = Date.now();
  await atomic([['INSERT INTO tokens(th,uid,exp,created,ua) VALUES(?,?,?,?,?)', [sha(t), u.id, now + SESSION, now, str(req.headers['user-agent'], 160)]],
    ['DELETE FROM tokens WHERE uid=? AND th NOT IN (SELECT th FROM tokens WHERE uid=? ORDER BY exp DESC LIMIT 20)', [u.id, u.id]]]);   // como mucho 20 sesiones abiertas
  return t;
}
async function authUser(req, res) {
  const t = tokenOf(req); if (!t) return null;
  const u = await one('SELECT u.*, k.exp kexp, k.th kth FROM tokens k JOIN users u ON u.id=k.uid WHERE k.th=? AND k.exp>?', [sha(t), Date.now()]);
  if (!u) { if (cookies(req)[COOKIE]) clearSession(req, res); return null; }
  if (u.kexp < Date.now() + SESSION - DAY) { await run('UPDATE tokens SET exp=? WHERE th=?', [Date.now() + SESSION, u.kth]); setSession(req, res, t); }   // sesión deslizante: 90 días desde el último uso
  else if (!cookies(req)[COOKIE]) setSession(req, res, t);   // venía del token antiguo en localStorage: pasa a cookie
  return u;
}
const send = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
function readBody(req, max) {
  if (+req.headers['content-length'] > max) return Promise.reject(new Error('big'));
  if (VERCEL && req.body !== undefined) return Promise.resolve(req.body && typeof req.body === 'object' ? req.body : J(req.body, {}));   // Vercel ya lo ha leído
  return new Promise((ok, ko) => { let s = '', n = 0; req.on('data', c => { n += c.length; if (n > max) { ko(new Error('big')); req.destroy(); } else s += c; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } }); req.on('error', ko); });
}
const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const text = (v, max) => str(v, max * 2).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);   // sin caracteres de control ni de dirección (RTL)
const num = (v, max) => { v = +v; return Number.isFinite(v) ? Math.max(0, Math.min(v, max)) : 0; };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const normEmail = v => str(v, 254).trim().toLowerCase();
const safeAvatar = a => typeof a === 'string' && /^\/avatars\/[a-z0-9_.]+(\?v=\d+)?$/.test(a) ? a : null;
const clean = u => ({ id: u.id, alias: u.alias, email: u.email, avatar: safeAvatar(u.avatar), age: u.age || null, bio: u.bio || '', station_home: u.station_home || null, modality: u.modality || 'ski', level: u.level || 'intermedio', terms_accepted_at: u.terms_accepted_at || null, created: u.created || null, verified: u.verified === null || u.verified === undefined ? true : !!u.verified });
const audit = (uid, action, req, details = {}) => run('INSERT INTO audit_logs(id,uid,action,ip,ua,details,ts) VALUES(?,?,?,?,?,?,?)', [rid(), uid || null, action, ipOf(req), str(req.headers['user-agent'], 200), JSON.stringify(details), Date.now()]).catch(e => console.error('[auditoría]', e.message));

// ---------- contraseñas: scrypt (N=32768) con sal propia; los hashes antiguos (N=16384) se renuevan al entrar ----------
const scrypt = promisify(crypto.scrypt), KDF = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const hashPw = async pw => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: 's2$' + (await scrypt(pw.normalize('NFKC'), salt, 64, KDF)).toString('hex') }; };
async function checkPw(pw, u) {
  if (!u) { await scrypt('x', 'pistea-sal-falsa', 64, KDF); return false; }   // mismo tiempo exista o no el correo
  const h = u.hash.startsWith('s2$') ? 's2$' + (await scrypt(pw.normalize('NFKC'), u.salt, 64, KDF)).toString('hex') : (await scrypt(pw, u.salt, 64)).toString('hex');
  const a = Buffer.from(h), b = Buffer.from(u.hash); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const COMMON = new Set(['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'password', 'password1', 'contraseña', 'contrasena', 'qwerty123', 'qwertyui', 'iloveyou', 'abc12345', 'abcd1234', '1q2w3e4r', 'asdfghjk', 'superman', 'futbol123', 'barcelona', 'realmadrid', 'esquiar1', 'pistea123', 'valdesqui', 'sierranevada', 'baqueira1', 'snowboard']);
function weakPw(pw, email, alias) {
  if (pw.length < 8 || pw.length > 128) return 'La contraseña debe tener entre 8 y 128 caracteres.';
  const l = pw.toLowerCase();
  if (COMMON.has(l) || /^(.)\1+$/.test(pw) || '01234567890123456789'.includes(l) || 'abcdefghijklmnopqrstuvwxyz'.includes(l)) return 'Esa contraseña es demasiado común. Elige otra.';
  const local = email.split('@')[0]; if (l.includes(email) || (local.length >= 4 && l.includes(local)) || (alias && alias.length >= 4 && l.includes(alias.toLowerCase()))) return 'La contraseña no puede contener tu correo ni tu nombre.';
  return null;
}
// ---------- correo ----------
// Proveedor: Brevo (BREVO_API_KEY: gratis, 300/día, basta con verificar el remitente) o Resend (RESEND_API_KEY: necesita
// dominio propio). MAIL_FROM = "Pistea <remitente@...>". Sin proveedor: en local se escribe en la consola; en producción no se envía.
const MAIL_READY = !!(env.BREVO_API_KEY || env.RESEND_API_KEY);
const VERIFY = MAIL_READY || !PROD;   // sin correo en producción no se puede exigir la verificación (nadie podría verificarse)
const FROM = (() => { const m = String(env.MAIL_FROM || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/); return m ? { name: m[1] || 'Pistea', email: m[2] } : { name: 'Pistea', email: env.MAIL_FROM || 'onboarding@resend.dev' }; })();
const htmlEsc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mail(title, intro, cta, link, outro) {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;padding:28px">
<tr><td style="font-size:12px;letter-spacing:.22em;font-weight:700">PISTEA</td></tr><tr><td style="padding-top:18px;font-size:22px;font-weight:700">${htmlEsc(title)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.55;color:#333">${htmlEsc(intro)}</td></tr>
<tr><td style="padding:24px 0"><a href="${htmlEsc(link)}" style="background:#0b0c0f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;display:inline-block">${htmlEsc(cta)}</a></td></tr>
<tr><td style="font-size:12.5px;color:#666;line-height:1.55">${htmlEsc(outro)}<br><br>Si el botón no funciona, copia este enlace en el navegador:<br><span style="word-break:break-all">${htmlEsc(link)}</span></td></tr>
</table><p style="font-size:11.5px;color:#999">Recibes este correo porque alguien usó esta dirección en Pistea.</p></td></tr></table></body></html>`;
  return { html, text: `${title}\n\n${intro}\n\n${cta}: ${link}\n\n${outro}` };
}
async function sendMail(to, subject, { html, text }) {
  try {
    if (env.BREVO_API_KEY) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ sender: FROM, to: [{ email: to }], subject, htmlContent: html, textContent: text }) });
      if (!r.ok) console.error('[correo] Brevo', r.status, (await r.text()).slice(0, 200)); return r.ok;
    }
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: `${FROM.name} <${FROM.email}>`, to: [to], subject, html, text }) });
      if (!r.ok) console.error('[correo] Resend', r.status, (await r.text()).slice(0, 200)); return r.ok;
    }
  } catch (e) { console.error('[correo] fallo', e.message); return false; }
  if (PROD) { console.error('[correo] sin BREVO_API_KEY ni RESEND_API_KEY: no se ha enviado'); return false; }   // en producción el enlace NUNCA va al registro
  console.log(`[correo simulado] para ${to} · ${subject}\n${text}`); return true;
}
async function sendVerify(u) {
  const t = crypto.randomBytes(32).toString('hex'), link = `${APP_URL}/?verify=${t}`;
  await atomic([['DELETE FROM verifs WHERE uid=?', [u.id]], ['INSERT INTO verifs(th,uid,exp) VALUES(?,?,?)', [sha(t), u.id, Date.now() + 2 * DAY]]]);
  return sendMail(u.email, 'Confirma tu correo en Pistea', mail(`Hola, ${u.alias}`, 'Confirma que este correo es tuyo para aparecer en los rankings y en la comunidad de Pistea.', 'Confirmar mi correo', link, 'El enlace caduca en 48 horas. Si no has creado una cuenta en Pistea, ignora este correo.'));
}

// ---------- API ----------
const PUB = new Set(['POST /api/register', 'POST /api/login', 'POST /api/forgot', 'POST /api/reset', 'GET /api/config', 'POST /api/logout', 'POST /api/verify']);
const routes = {
  'POST /api/register': async ({ req, res, b }) => {
    if (await limited('reg:' + ipOf(req), 10, HOUR)) return send(res, 429, { error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.' });
    if (str(b.web, 200)) return send(res, 400, { error: 'No se ha podido crear la cuenta.' });   // campo trampa: solo lo rellenan los bots
    const e = normEmail(b.email), a = text(b.alias, 24), pw = str(b.password, 200);
    if (!EMAIL.test(e)) return send(res, 400, { error: 'Correo no válido.' });
    if (a.length < 2) return send(res, 400, { error: 'El nombre debe tener entre 2 y 24 caracteres.' });
    const weak = weakPw(pw, e, a); if (weak) return send(res, 400, { error: weak });
    if (b.terms !== true) return send(res, 400, { error: 'Debes aceptar la Política de Privacidad y confirmar que tienes al menos 14 años.' });
    let age = null;
    if (b.age !== undefined && b.age !== null && b.age !== '') { age = parseInt(b.age, 10); if (!Number.isFinite(age) || age < 14 || age > 120) return send(res, 400, { error: 'En España la edad mínima para registrarse son 14 años (art. 7 LOPDGDD 3/2018).' }); }
    if (await one('SELECT 1 x FROM users WHERE email=?', [e])) return send(res, 409, { error: 'Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala.' });
    const { salt, hash } = await hashPw(pw), now = Date.now(), u = { id: rid(), email: e, alias: a, age, terms_accepted_at: now, created: now };
    u.verified = 0;
    try { await run('INSERT INTO users(id,email,alias,salt,hash,age,terms_accepted_at,created,updated_at,verified) VALUES(?,?,?,?,?,?,?,?,?,0)', [u.id, e, a, salt, hash, age, now, now, now]); }
    catch (err) { if (/UNIQUE/i.test(err.message)) return send(res, 409, { error: 'Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala.' }); throw err; }
    setSession(req, res, await newToken(u, req)); await audit(u.id, 'REGISTER', req);
    if (VERIFY) await sendVerify(u);
    send(res, 200, { user: clean(u) });
  },
  'POST /api/login': async ({ req, res, b }) => {
    const e = normEmail(b.email), pw = str(b.password, 200);
    if (await limited('li:' + ipOf(req), 30, 10 * MIN)) return send(res, 429, { error: 'Demasiados intentos desde esta conexión. Espera unos minutos.' });
    if (await over('lf:' + e, 8, 15 * MIN)) return send(res, 429, { error: 'Demasiados intentos fallidos con este correo. Espera 15 minutos o recupera tu contraseña.' });
    const u = EMAIL.test(e) ? await one('SELECT * FROM users WHERE email=?', [e]) : null;
    if (!(await checkPw(pw, u))) { await hit('lf:' + e); await audit(u && u.id, 'LOGIN_FAILED', req); return send(res, 401, { error: 'Correo o contraseña incorrectos.' }); }
    await run('DELETE FROM hits WHERE k=?', [hk('lf:' + e)]);
    if (!u.hash.startsWith('s2$')) { const n = await hashPw(pw); await run('UPDATE users SET salt=?, hash=? WHERE id=?', [n.salt, n.hash, u.id]); }   // renueva hashes antiguos
    setSession(req, res, await newToken(u, req)); await audit(u.id, 'LOGIN', req);
    send(res, 200, { user: clean(u) });
  },
  'POST /api/forgot': async ({ req, res, b }) => {
    const e = normEmail(b.email);
    if (!EMAIL.test(e)) return send(res, 400, { error: 'Correo no válido.' });
    if (await limited('fg:' + ipOf(req), 10, HOUR) || await limited('fg:' + e, 3, HOUR)) return send(res, 429, { error: 'Demasiadas solicitudes. Inténtalo en una hora.' });
    const u = await one('SELECT id, alias FROM users WHERE email=?', [e]);
    if (u) {   // se envía ANTES de responder: en Vercel lo que va después de la respuesta se corta
      const t = crypto.randomBytes(32).toString('hex'), link = `${APP_URL}/?reset=${t}`;
      await atomic([['DELETE FROM resets WHERE uid=?', [u.id]], ['INSERT INTO resets(th,uid,exp) VALUES(?,?,?)', [sha(t), u.id, Date.now() + HOUR]]]);
      await sendMail(e, 'Recupera tu contraseña de Pistea', mail(`Hola, ${u.alias}`, 'Has pedido crear una contraseña nueva para tu cuenta de Pistea.', 'Crear contraseña nueva', link, 'El enlace caduca en 1 hora y sirve una sola vez. Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.'));
      await audit(u.id, 'PASSWORD_RESET_REQUEST', req);
    } else await new Promise(r => setTimeout(r, 150 + Math.random() * 250));
    send(res, 200, { ok: true });   // misma respuesta exista o no el correo
  },
  'POST /api/reset': async ({ req, res, b }) => {
    if (await limited('rs:' + ipOf(req), 10, HOUR)) return send(res, 429, { error: 'Demasiados intentos.' });
    const pw = str(b.password, 200), r = await one('SELECT r.uid uid, u.email email, u.alias alias FROM resets r JOIN users u ON u.id=r.uid WHERE r.th=? AND r.exp>?', [sha(str(b.token, 100)), Date.now()]);
    if (!r) return send(res, 400, { error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });
    const weak = weakPw(pw, r.email, r.alias); if (weak) return send(res, 400, { error: weak });
    const n = await hashPw(pw);
    await atomic([['UPDATE users SET salt=?, hash=?, updated_at=? WHERE id=?', [n.salt, n.hash, Date.now(), r.uid]], ['DELETE FROM resets WHERE uid=?', [r.uid]], ['DELETE FROM tokens WHERE uid=?', [r.uid]]]);   // cierra todas las sesiones
    await audit(r.uid, 'PASSWORD_RESET', req); send(res, 200, { ok: true });
  },
  'POST /api/password': async ({ req, res, u, b }) => {
    if (await limited('pw:' + u.id, 10, HOUR)) return send(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
    if (!(await checkPw(str(b.old, 200), u))) return send(res, 403, { error: 'La contraseña actual no es correcta.' });
    const pw = str(b.password, 200), weak = weakPw(pw, u.email, u.alias); if (weak) return send(res, 400, { error: weak });
    const n = await hashPw(pw);
    await atomic([['UPDATE users SET salt=?, hash=?, updated_at=? WHERE id=?', [n.salt, n.hash, Date.now(), u.id]], ['DELETE FROM tokens WHERE uid=? AND th!=?', [u.id, u.kth]]]);   // cierra las demás sesiones
    await audit(u.id, 'PASSWORD_CHANGE', req); send(res, 200, { ok: true });
  },
  'POST /api/verify': async ({ req, res, b }) => {   // el enlace del correo
    if (await limited('vf:' + ipOf(req), 20, HOUR)) return send(res, 429, { error: 'Demasiados intentos.' });
    const v = await one('SELECT uid FROM verifs WHERE th=? AND exp>?', [sha(str(b.token, 100)), Date.now()]);
    if (!v) return send(res, 400, { error: 'El enlace no es válido o ha caducado. Pide otro desde tu perfil.' });
    await atomic([['UPDATE users SET verified=1, updated_at=? WHERE id=?', [Date.now(), v.uid]], ['DELETE FROM verifs WHERE uid=?', [v.uid]]]);
    stationsCache.t = 0; await audit(v.uid, 'EMAIL_VERIFIED', req); send(res, 200, { ok: true });
  },
  'POST /api/verify/resend': async ({ req, res, u }) => {
    if (u.verified === null || u.verified) return send(res, 200, { ok: true, verified: true });
    if (await limited('vr:' + u.id, 3, HOUR)) return send(res, 429, { error: 'Ya te hemos mandado varios correos. Revisa también la carpeta de spam o inténtalo en una hora.' });
    if (!(await sendVerify(u))) return send(res, 503, { error: 'No se ha podido enviar el correo. Inténtalo más tarde.' });
    send(res, 200, { ok: true });
  },
  'POST /api/logout': async ({ req, res }) => { const t = tokenOf(req); if (t) await run('DELETE FROM tokens WHERE th=?', [sha(t)]); clearSession(req, res); send(res, 200, { ok: true }); },
  'POST /api/logout-all': async ({ req, res, u }) => { await run('DELETE FROM tokens WHERE uid=?', [u.id]); clearSession(req, res); await audit(u.id, 'LOGOUT_ALL', req); send(res, 200, { ok: true }); },
  'GET /api/me': async ({ res, u }) => {
    const [totals, stations, days, pos, stk, lg, following, followers, sessions] = await Promise.all([agg(u.id), stationsDistinct(u.id), all('SELECT id,station,ts,desnivel,km,horas,bajadas,vmax FROM days WHERE uid=? ORDER BY ts DESC LIMIT 30', [u.id]),
      posOf(u.id, 'desnivel', null, 'temporada'), streak(u.id), league(u.id), count('SELECT COUNT(*) n FROM follows WHERE a=?', [u.id]), count('SELECT COUNT(*) n FROM follows WHERE b=?', [u.id]), count('SELECT COUNT(*) n FROM tokens WHERE uid=? AND exp>?', [u.id, Date.now()])]);
    send(res, 200, { user: clean(u), totals, stations, days, pos: (pos || {}).pos || 0, streak: stk, league: lg, following, followers, sessions });
  },
  'POST /api/me': async ({ req, res, u, b }) => {
    const updates = [], params = [], audited = [];
    if (b.alias !== undefined) { const a = text(b.alias, 24); if (a.length < 2) return send(res, 400, { error: 'El nombre debe tener al menos 2 caracteres.' }); updates.push('alias=?'); params.push(a); audited.push('alias'); }
    if (b.age !== undefined) {
      if (b.age === null || b.age === '') updates.push('age=NULL');
      else { const age = parseInt(b.age, 10); if (!Number.isFinite(age) || age < 14 || age > 120) return send(res, 400, { error: 'La edad debe estar entre 14 y 120 años (art. 7 LOPDGDD 3/2018).' }); updates.push('age=?'); params.push(age); }
      audited.push('age');
    }
    if (b.bio !== undefined) { updates.push('bio=?'); params.push(text(b.bio, 200)); audited.push('bio'); }
    if (b.station_home !== undefined) { const sh = b.station_home ? str(b.station_home, 40) : null; if (sh && !SID.has(sh)) return send(res, 400, { error: 'Estación habitual no válida.' }); updates.push('station_home=?'); params.push(sh); audited.push('station_home'); }
    if (b.modality !== undefined) { const m = str(b.modality, 20); if (!['ski', 'snowboard', 'ambos'].includes(m)) return send(res, 400, { error: 'Modalidad no válida.' }); updates.push('modality=?'); params.push(m); audited.push('modality'); }
    if (b.level !== undefined) { const l = str(b.level, 20); if (!['debutante', 'intermedio', 'avanzado', 'experto'].includes(l)) return send(res, 400, { error: 'Nivel no válido.' }); updates.push('level=?'); params.push(l); audited.push('level'); }
    if (!updates.length) return send(res, 400, { error: 'No hay campos que actualizar.' });
    updates.push('updated_at=?'); params.push(Date.now(), u.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, params);   // los nombres de columna son fijos; los valores van como parámetros
    await audit(u.id, 'PROFILE_UPDATE', req, { campos: audited });
    send(res, 200, { ok: true, user: clean(await one('SELECT * FROM users WHERE id=?', [u.id])) });
  },
  // La foto va en la BD (no en disco: en Vercel el disco se borra). El cliente la reduce a 300×300 antes de subirla.
  'POST /api/avatar': async ({ req, res, u, b }) => {
    if (await limited('av:' + u.id, 20, HOUR)) return send(res, 429, { error: 'Demasiados cambios de foto. Inténtalo más tarde.' });
    if (typeof b.image !== 'string') return send(res, 400, { error: 'Falta la imagen.' });
    const m = b.image.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!m) return send(res, 400, { error: 'Formato no permitido. Solo se admiten fotos JPEG, PNG o WebP.' });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 32) return send(res, 400, { error: 'Archivo vacío.' });
    if (buf.length > 400 * 1024) return send(res, 400, { error: 'La foto no puede superar los 400 KB.' });
    const mime = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF ? 'image/jpeg' : buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) ? 'image/png'
      : buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP' ? 'image/webp' : null;   // se mira el contenido, no lo que dice el cliente
    if (!mime) return send(res, 400, { error: 'Formato no permitido. Solo se admiten fotos JPEG, PNG o WebP.' });
    const now = Date.now(), url = `/avatars/${u.id}?v=${now}`;
    await atomic([['INSERT INTO avatars(uid,mime,data,updated) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET mime=excluded.mime, data=excluded.data, updated=excluded.updated', [u.id, mime, buf, now]], ['UPDATE users SET avatar=?, updated_at=? WHERE id=?', [url, now, u.id]]]);
    await audit(u.id, 'AVATAR_UPDATE', req, { size: buf.length, mime }); send(res, 200, { ok: true, avatar: url });
  },
  'DELETE /api/avatar': async ({ req, res, u }) => {
    await atomic([['DELETE FROM avatars WHERE uid=?', [u.id]], ['UPDATE users SET avatar=NULL, updated_at=? WHERE id=?', [Date.now(), u.id]]]);
    await audit(u.id, 'AVATAR_DELETE', req); send(res, 200, { ok: true });
  },
  'GET /api/me/export': async ({ req, res, u }) => {   // derecho de acceso y portabilidad (art. 15 y 20 RGPD)
    const days = (await all('SELECT * FROM days WHERE uid=? ORDER BY ts ASC', [u.id])).map(d => ({ ...d, col: J(d.col, {}), track: J(d.track), speed: J(d.speed) }));
    const data = { aviso: 'Exportación de tus datos en Pistea (art. 15 y 20 RGPD).', fecha: new Date().toISOString(), usuario: clean(u), dias: days,
      siguiendo: (await all('SELECT u.alias alias FROM follows f JOIN users u ON u.id=f.b WHERE f.a=?', [u.id])).map(r => r.alias),
      sesiones_abiertas: await all('SELECT created, exp, ua FROM tokens WHERE uid=? AND exp>?', [u.id, Date.now()]),
      registro_de_seguridad: await all('SELECT action, ip, ua, ts FROM audit_logs WHERE uid=? ORDER BY ts ASC', [u.id]) };
    await audit(u.id, 'DATA_EXPORT', req);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="pistea-mis-datos-${Date.now()}.json"`, 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data, null, 2));
  },
  'DELETE /api/me': async ({ req, res, u, b }) => {   // derecho de supresión (art. 17 RGPD): se borra todo, sin depender de ON DELETE CASCADE
    if (await limited('del:' + u.id, 10, HOUR)) return send(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
    if (!(await checkPw(str(b.password, 200), u))) return send(res, 403, { error: 'Contraseña incorrecta.' });
    await atomic([['DELETE FROM kudos WHERE uid=? OR day IN (SELECT id FROM days WHERE uid=?)', [u.id, u.id]], ['DELETE FROM follows WHERE a=? OR b=?', [u.id, u.id]],
      ['DELETE FROM days WHERE uid=?', [u.id]], ['DELETE FROM tokens WHERE uid=?', [u.id]], ['DELETE FROM resets WHERE uid=?', [u.id]], ['DELETE FROM verifs WHERE uid=?', [u.id]], ['DELETE FROM avatars WHERE uid=?', [u.id]],
      ['DELETE FROM audit_logs WHERE uid=?', [u.id]], ['DELETE FROM users WHERE id=?', [u.id]]]);
    await audit(u.id, 'ACCOUNT_DELETION', req);   // solo queda constancia del borrado, sin datos personales
    clearSession(req, res); send(res, 200, { ok: true });
  },
  'GET /api/rank': async ({ res, u, q }) => {
    const metric = MX[q.get('metric')] ? q.get('metric') : 'desnivel', period = WIN[q.get('period')] ? q.get('period') : 'temporada', st = SID.has(q.get('station')) ? q.get('station') : null;
    const [rows, me] = await Promise.all([rankRows(metric, st, period, 10, u.id), posOf(u.id, metric, st, period)]);
    send(res, 200, { rows: rows.map((x, k) => ({ pos: k + 1, alias: x.alias, avatar: safeAvatar(x.avatar), v: x.v, me: x.uid === u.id })), me: me && { pos: me.pos, v: me.v }, gap: me ? me.gap : 0, total: me ? me.total : rows.length });
  },
  'GET /api/stations': async ({ res }) => {
    if (Date.now() - stationsCache.t > MIN || !stationsCache.v) {
      const cnt = Object.fromEntries((await all(`SELECT station s, COUNT(DISTINCT uid) n FROM days WHERE ts>=? AND ${SRC} AND ${VERIFY ? OK_UID('uid') : '1=1'} GROUP BY station`, [Date.now() - WIN.temporada])).map(r => [r.s, r.n]));
      const out = {};
      await Promise.all(STATIONS.map(async ([id]) => { out[id] = { skiers: cnt[id] || 0, leaders: cnt[id] ? (await rankRows('desnivel', id, 'temporada', 3)).map(x => ({ alias: x.alias, v: x.v })) : [] }; }));
      stationsCache = { t: Date.now(), v: out };
    }
    send(res, 200, stationsCache.v);
  },
  'GET /api/feed': async ({ res, u, q }) => {
    const onlyF = q.get('scope') === 'amigos' ? 1 : 0;
    const rows = await all(`SELECT d.id id, d.uid uid, d.station station, d.ts ts, d.desnivel desnivel, d.km km, d.bajadas bajadas, d.vmax vmax, d.track track, u.alias alias, u.avatar avatar,
      (SELECT COUNT(*) FROM kudos k WHERE k.day=d.id) kudos, EXISTS(SELECT 1 FROM kudos k WHERE k.day=d.id AND k.uid=?) liked
      FROM days d JOIN users u ON u.id=d.uid WHERE ${SRC_D} AND (${VERIFY ? OK_U : '1=1'} OR d.uid=?) AND (?=0 OR d.uid=? OR d.uid IN (SELECT b FROM follows WHERE a=?)) ORDER BY d.ts DESC LIMIT 15`, [u.id, u.id, onlyF, u.id, u.id]);
    send(res, 200, rows.map(d => ({ ...d, avatar: safeAvatar(d.avatar), track: J(d.track), liked: !!d.liked })));
  },
  'POST /api/days': async ({ res, u, b }) => {
    const c = b.col && typeof b.col === 'object' ? b.col : {}, src = b.source === 'sim' ? 'sim' : 'gps';
    if (src === 'sim' && !ALLOW_SIM) return send(res, 403, { error: 'La simulación está desactivada en producción.' });
    if (!SID.has(b.station)) return send(res, 400, { error: 'Estación no válida.' });
    const d = { id: rid(), uid: u.id, station: b.station, ts: Date.now(), desnivel: num(b.desnivel, 40000), km: num(b.km, 300), horas: num(b.horas, 14), bajadas: Math.round(num(b.bajadas, 200)), vmax: num(b.vmax, 140), vmed: num(b.vmed, 100), total: num(b.total, 24), src,
      col: { v: num(c.v, 200) | 0, a: num(c.a, 200) | 0, r: num(c.r, 200) | 0, n: num(c.n, 200) | 0 },
      track: (Array.isArray(b.track) ? b.track : []).slice(0, 60).map(p => Array.isArray(p) ? [num(p[0], 1e5), num(p[1], 1e5)] : [0, 0]), speed: (Array.isArray(b.speed) ? b.speed : []).slice(0, 400).map(v => num(v, 140)) };
    if (d.bajadas > 0 && d.desnivel / d.bajadas > 1500) return send(res, 400, { error: 'Datos incoherentes: demasiado desnivel por bajada.' });
    if (d.horas > 0 && d.km / d.horas > 90) return send(res, 400, { error: 'Datos incoherentes: velocidad media imposible.' });
    if ((await count('SELECT COUNT(*) n FROM days WHERE uid=? AND ts>?', [u.id, Date.now() - DAY])) >= 5) return send(res, 429, { error: 'Máximo 5 días guardados cada 24 horas.' });
    const before = ((await posOf(u.id, 'desnivel', null, 'temporada')) || {}).pos || 0;
    await run('INSERT INTO days(id,uid,station,ts,desnivel,km,horas,bajadas,vmax,vmed,col,track,speed,src,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.id, d.uid, d.station, d.ts, d.desnivel, d.km, d.horas, d.bajadas, d.vmax, d.vmed, JSON.stringify(d.col), JSON.stringify(d.track), JSON.stringify(d.speed), d.src, d.total || null]);
    stationsCache.t = 0;
    const [after, ps] = await Promise.all([posOf(u.id, 'desnivel', null, 'temporada'), posOf(u.id, 'desnivel', d.station, 'temporada')]);
    send(res, 200, { day: d, before, after: (after || {}).pos || 0, posStation: (ps || {}).pos || 0 });
  },
  'GET /api/users': async ({ res, u, q }) => {
    const s = str(q.get('q'), 40).trim().toLowerCase().replace(/[%_\\]/g, '');
    if (s.length < 2) return send(res, 200, []);
    const rows = await all(`SELECT id, alias, avatar, modality, level, EXISTS(SELECT 1 FROM follows WHERE a=? AND b=u.id) following FROM users u WHERE id!=? AND ${VERIFY ? OK_U : '1=1'} AND lower(alias) LIKE ? ORDER BY alias LIMIT 10`, [u.id, u.id, `%${s}%`]);
    send(res, 200, rows.map(x => ({ ...x, avatar: safeAvatar(x.avatar), following: !!x.following })));
  },
  'POST /api/follow': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const id = str(b.id, 40); if (id === u.id || !(await one('SELECT 1 x FROM users WHERE id=?', [id]))) return send(res, 400, { error: 'Usuario no válido.' });
    const had = (await run('DELETE FROM follows WHERE a=? AND b=?', [u.id, id])).rowsAffected; if (!had) await run('INSERT OR IGNORE INTO follows(a,b) VALUES(?,?)', [u.id, id]);
    send(res, 200, { following: !had });
  },
  'GET /api/user': async ({ res, u, q }) => {
    const t = await one('SELECT id, alias, avatar, age, bio, station_home, modality, level, created, verified FROM users WHERE id=?', [str(q.get('id'), 40)]);
    if (!t || (VERIFY && t.verified === 0 && t.id !== u.id)) return send(res, 404, { error: 'No existe.' });
    const me = t.id === u.id;
    const [totals, stations, days, pos, stk, followers, following] = await Promise.all([agg(t.id), stationsDistinct(t.id), all('SELECT station, ts, desnivel, bajadas, track FROM days WHERE uid=? ORDER BY ts DESC LIMIT 5', [t.id]),
      posOf(t.id, 'desnivel', null, 'temporada'), streak(t.id), count('SELECT COUNT(*) n FROM follows WHERE b=?', [t.id]), one('SELECT 1 x FROM follows WHERE a=? AND b=?', [u.id, t.id])]);
    delete t.verified; send(res, 200, { ...t, age: me ? t.age : null, avatar: safeAvatar(t.avatar), totals, stations, days: days.map(d => ({ ...d, track: J(d.track) })), pos: (pos || {}).pos || 0, streak: stk, followers, following: !!following, me });   // la edad es privada
  },
  'POST /api/kudos': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const id = str(b.id, 40); if (!(await one('SELECT 1 x FROM days WHERE id=?', [id]))) return send(res, 404, { error: 'No existe.' });
    const had = (await run('DELETE FROM kudos WHERE day=? AND uid=?', [id, u.id])).rowsAffected; if (!had) await run('INSERT OR IGNORE INTO kudos(day,uid) VALUES(?,?)', [id, u.id]);
    send(res, 200, { kudos: await count('SELECT COUNT(*) n FROM kudos WHERE day=?', [id]), liked: !had });
  },
  'GET /api/config': async ({ res }) => send(res, 200, { stations: STATIONS.map(s => ({ id: s[0], n: s[1], z: s[2] })), sim: ALLOW_SIM, verify: VERIFY })
};

// ---------- ficheros estáticos (página, fotos de perfil y mapas 3D) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const TEXTY = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
function serveFile(req, res, root, rel) {
  let p; try { p = decodeURIComponent(rel); } catch { res.writeHead(400); return res.end(); }
  if (p.includes('\0')) { res.writeHead(400); return res.end(); }
  let f = path.resolve(root, '.' + path.sep + p.replace(/^\/+/, ''));
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }   // nunca fuera de la carpeta
  let s; try { s = fs.statSync(f); if (s.isDirectory()) { f = path.join(f, 'index.html'); s = fs.statSync(f); } } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('No encontrado'); }
  const ext = path.extname(f).toLowerCase(), lm = s.mtime.toUTCString();
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Last-Modified': lm, 'Cache-Control': /\/assets\//.test(f.replace(/\\/g, '/')) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  if (ext === '.html') h['X-Frame-Options'] = 'SAMEORIGIN';
  if (req.headers['if-modified-since'] === lm) { res.writeHead(304, h); return res.end(); }
  if (TEXTY.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); return fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res); }
  res.writeHead(200, { ...h, 'Content-Length': s.size }); fs.createReadStream(f).pipe(res);
}
const IMG_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' };
async function serveAvatar(req, res, name) {
  if (/^[a-f0-9]{16}$/.test(name)) {
    await dbReady(); const a = await one('SELECT mime, data FROM avatars WHERE uid=?', [name]);
    if (!a) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { ...IMG_HEADERS, 'Content-Type': a.mime, 'Cache-Control': 'public, max-age=86400' }); return res.end(Buffer.from(a.data));
  }
  if (/^[a-f0-9]{16}_\d+_[a-f0-9]{12}\.(jpg|png|webp)$/.test(name) && fs.existsSync(AVATARS_DIR)) { Object.entries(IMG_HEADERS).forEach(([k, v]) => res.setHeader(k, v)); return serveFile(req, res, AVATARS_DIR, name); }   // fotos antiguas en disco (solo en local)
  res.writeHead(404); res.end();
}
const PAGE_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN', 'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'" };

async function handler(req, res) {
  try {
    if (PROD && TRUST && !VERCEL && req.headers['x-forwarded-proto'] === 'http') { res.writeHead(301, { Location: APP_URL + req.url }); return res.end(); }
    if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const url = new URL(req.url, 'http://x'), key = `${req.method} ${url.pathname}`;
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      if (DB_ERR) { console.error('[configuración]', DB_ERR); return send(res, 503, { error: 'Servicio no disponible. Inténtalo más tarde.' }); }
      const r = routes[key]; if (!r) return send(res, 404, { error: 'No existe.' });
      // Anti-CSRF: toda escritura lleva una cabecera propia (otra web no puede ponerla sin permiso CORS) y no viene de otro sitio
      if (req.method !== 'GET' && (req.headers['x-pistea'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site')) return send(res, 403, { error: 'Petición no permitida.' });
      await dbReady(); housekeeping().catch(() => {});
      const u = PUB.has(key) ? null : await authUser(req, res);
      if (!PUB.has(key) && !u) return send(res, 401, { error: 'Tu sesión ha caducado. Entra de nuevo.' });
      const b = req.method === 'GET' ? {} : await readBody(req, key === 'POST /api/avatar' ? 6e5 : 2e5);
      if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { error: 'Petición no válida.' });
      return await r({ req, res, u, q: url.searchParams, b });
    }
    if (url.pathname.startsWith('/avatars/')) return await serveAvatar(req, res, url.pathname.slice(9));
    if (url.pathname.startsWith('/img/')) return serveFile(req, res, path.join(__dirname, 'public', 'img'), url.pathname.slice(4));
    if (url.pathname === '/3d') { res.writeHead(301, { Location: '/3d/' + url.search }); return res.end(); }
    if (url.pathname.startsWith('/3d/')) return fs.existsSync(MAPS) ? serveFile(req, res, MAPS, url.pathname.slice(3)) : send(res, 404, { error: 'Mapas 3D no instalados (MAPS_DIR).' });
    if (url.pathname === '/manifest.json') { res.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return res.end(JSON.stringify({ name: 'Pistea', short_name: 'Pistea', start_url: '/', display: 'standalone', background_color: '#0b0c0f', theme_color: '#0b0c0f', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] })); }
    if (url.pathname === '/icon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0c0f"/><path d="M14 74l24-40 16 24 12-16 20 32z" fill="none" stroke="#f4f5f7" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>'); }
    if (url.pathname === '/healthz') { if (DB_ERR) return send(res, 503, { ok: false }); await dbReady(); await run('SELECT 1'); return send(res, 200, { ok: true }); }
    res.writeHead(200, PAGE_HEADERS); res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  } catch (e) {
    const client = e.message === 'big' || e instanceof SyntaxError;
    if (!client) console.error('[error]', e);   // al cliente nunca le llega el detalle interno
    if (!res.headersSent) send(res, e.message === 'big' ? 413 : client ? 400 : 500, { error: e.message === 'big' ? 'Petición demasiado grande.' : client ? 'Petición no válida.' : 'Error del servidor. Inténtalo de nuevo.' }); else res.end();
  }
}
const server = env.TLS_CERT && env.TLS_KEY ? https.createServer({ cert: fs.readFileSync(env.TLS_CERT), key: fs.readFileSync(env.TLS_KEY) }, handler) : http.createServer(handler);
server.headersTimeout = 15000; server.requestTimeout = 30000;
if (require.main === module || !VERCEL) {
  server.listen(PORT, () => console.log(`Pistea en ${APP_URL} (${PROD ? 'producción' : 'desarrollo'}${env.TLS_CERT ? ', HTTPS' : ''}) · BD ${env.TURSO_DATABASE_URL ? 'Turso' : DB_URL} · mapas 3D ${fs.existsSync(MAPS) ? 'ok' : 'NO ENCONTRADOS'}`));
  dbReady().catch(e => console.error('[BD] no se pudo preparar:', e.message));
}
const bye = () => { try { server.close(); } catch {} try { db.close(); } catch {} process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
module.exports = handler;
