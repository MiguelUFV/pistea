// Pistea · servidor sin dependencias (Node 22.5+). SQLite integrado, HTTPS opcional, recuperación de contraseña por correo.
// Uso: node --no-warnings server.js   (ver DEPLOY.md para producción)
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { promisify } = require('util'), { DatabaseSync } = require('node:sqlite');
const env = process.env, PORT = +env.PORT || 3000, PROD = env.NODE_ENV === 'production', TRUST = env.TRUST_PROXY === '1';
const APP_URL = (env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA = env.DATA_DIR || __dirname, MAPS = env.MAPS_DIR || (fs.existsSync(path.join(__dirname, 'mapas')) ? path.join(__dirname, 'mapas') : path.resolve(__dirname, '../../Estaciones3D/web/dist/app'));
const ALLOW_SIM = !PROD || env.ALLOW_SIM === '1', DAY = 864e5, HOUR = 36e5;

// Estaciones con mapa 3D disponible (mismo id que el motor Estaciones3D)
const STATIONS = [['alto-campoo','Alto Campoo','Cantábrica'],['astun','Astún','Pirineos'],['baqueira-beret','Baqueira Beret','Pirineos'],['boi-taull','Boí Taüll','Pirineos'],['candanchu','Candanchú','Pirineos'],['cerler','Cerler','Pirineos'],['espot','Espot','Pirineos'],['formigal','Formigal','Pirineos'],['fuentes-de-invierno','Fuentes de Invierno','Cantábrica'],['javalambre','Javalambre','Ibérica'],['la-covatilla','La Covatilla','Central'],['la-molina','La Molina','Pirineos'],['la-pinilla','La Pinilla','Central'],['leitariegos','Leitariegos','Cantábrica'],['manzaneda','Manzaneda','Galicia'],['masella','Masella','Pirineos'],['panticosa','Panticosa','Pirineos'],['port-aine','Port Ainé','Pirineos'],['port-del-comte','Port del Comte','Pirineos'],['san-isidro','San Isidro','Cantábrica'],['sierra-nevada','Sierra Nevada','Bética'],['valdelinares','Valdelinares','Ibérica'],['valdesqui','Valdesquí','Central'],['valdezcaray','Valdezcaray','Ibérica'],['valgrande-pajares','Valgrande-Pajares','Cantábrica'],['vall-de-nuria','Vall de Núria','Pirineos'],['vallter','Vallter','Pirineos']];
const SID = new Set(STATIONS.map(s => s[0]));
const rid = () => crypto.randomBytes(8).toString('hex'), sha = s => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = promisify(crypto.scrypt), hashPw = async (pw, salt) => (await scrypt(pw, salt, 64)).toString('hex');

// ---------- base de datos SQLite (WAL, índices, transacciones) ----------
fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'pistea.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, alias TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, demo INTEGER DEFAULT 0, created INTEGER);
CREATE TABLE IF NOT EXISTS tokens(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER);
CREATE TABLE IF NOT EXISTS resets(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER);
CREATE TABLE IF NOT EXISTS days(id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, station TEXT NOT NULL, ts INTEGER NOT NULL, desnivel REAL, km REAL, horas REAL, bajadas INTEGER, vmax REAL, vmed REAL, col TEXT, track TEXT, speed TEXT, src TEXT DEFAULT 'gps');
CREATE TABLE IF NOT EXISTS kudos(day TEXT REFERENCES days(id) ON DELETE CASCADE, uid TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(day, uid));
CREATE TABLE IF NOT EXISTS follows(a TEXT REFERENCES users(id) ON DELETE CASCADE, b TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(a, b));
CREATE INDEX IF NOT EXISTS i_days_uid ON days(uid, ts); CREATE INDEX IF NOT EXISTS i_days_st ON days(station, ts); CREATE INDEX IF NOT EXISTS i_days_ts ON days(ts);`);
const cache = new Map(), P = sql => cache.get(sql) || (cache.set(sql, db.prepare(sql)), cache.get(sql));
const tx = f => { db.exec('BEGIN'); try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const J = s => { try { return JSON.parse(s); } catch { return []; } };

function track(n = 14) { let x = 0, y = 0; const t = []; for (let i = 0; i < n; i++) { t.push([+x.toFixed(1), +y.toFixed(1)]); x += 4 + Math.random() * 8; y += 3 + Math.random() * 7 + (i % 2 ? 6 : -3); } return t; }
function insertDay(d) { P('INSERT INTO days(id,uid,station,ts,desnivel,km,horas,bajadas,vmax,vmed,col,track,speed,src) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(d.id, d.uid, d.station, d.ts, d.desnivel, d.km, d.horas, d.bajadas, d.vmax, d.vmed, JSON.stringify(d.col), JSON.stringify(d.track), JSON.stringify(d.speed || []), d.src); }
function seedDemo() {
  const names = ['Marta Ruiz','Javi Soler','Lucía Ortega','Dani Vega','Carlos Mena','Ainhoa Etxe','Pablo Rey','Irene Valle','Sergio Lara','Noa Pons','Hugo Alba','Clara Núñez','Rubén Gil','Elena Sanz','Iván Mora','Paula Ríos','Mario Díez','Sofía Cano','Tomás Ibáñez','Nerea Lozano'];
  tx(() => names.forEach((alias, i) => {
    const uid = rid(); P('INSERT INTO users(id,email,alias,salt,hash,demo,created) VALUES(?,?,?,?,?,1,?)').run(uid, `demo${i}@pistea.test`, alias, rid(), rid(), Date.now());
    const favs = STATIONS.map(s => s[0]).filter(() => Math.random() < .15); if (!favs.length) favs.push(STATIONS[i % STATIONS.length][0]);
    for (let k = 0, n = Math.ceil((0.3 + Math.random() * 1.4) * (3 + Math.random() * 9)); k < n; k++) {
      const col = { v: 3 + Math.random() * 6 | 0, a: 4 + Math.random() * 8 | 0, r: 3 + Math.random() * 8 | 0, n: Math.random() * 3 | 0 }, bj = col.v + col.a + col.r + col.n;
      insertDay({ id: rid(), uid, station: favs[k % favs.length], ts: Date.now() - (k < 2 ? k * 3 * HOUR : Math.random() * 60 * DAY) | 0, desnivel: bj * (320 + Math.random() * 250), km: bj * (1.6 + Math.random()), horas: 2.4 + Math.random() * 2.6, bajadas: bj, vmax: 55 + Math.random() * 70, vmed: 25 + Math.random() * 15, col, track: track(), src: 'seed' });
    }
  }));
}
function migrateJson() {   // importa db.json (versión anterior) una sola vez
  const f = path.join(DATA, 'db.json'); if (!fs.existsSync(f)) return false;
  const old = JSON.parse(fs.readFileSync(f, 'utf8')), map = ['baqueira-beret','sierra-nevada','formigal','valdesqui','cerler','la-molina','masella','candanchu','astun','javalambre','la-pinilla','alto-campoo'];
  tx(() => {
    for (const u of old.users) P('INSERT OR IGNORE INTO users(id,email,alias,salt,hash,demo,created) VALUES(?,?,?,?,?,?,?)').run(u.id, u.email, u.alias, u.salt, u.hash, u.demo ? 1 : 0, u.created || Date.now());
    for (const d of old.days) { insertDay({ ...d, station: typeof d.station === 'number' ? map[d.station] : d.station, src: 'seed' }); for (const k of d.kudos || []) P('INSERT OR IGNORE INTO kudos VALUES(?,?)').run(d.id, k); }
    for (const [a, bs] of Object.entries(old.follows || {})) for (const b of bs) P('INSERT OR IGNORE INTO follows VALUES(?,?)').run(a, b);
  });
  fs.renameSync(f, f + '.migrado'); return true;
}
if (!P('SELECT COUNT(*) n FROM users').get().n && !migrateJson() && (!PROD || env.SEED_DEMO === '1')) seedDemo();
const purge = () => { P('DELETE FROM tokens WHERE exp<?').run(Date.now()); P('DELETE FROM resets WHERE exp<?').run(Date.now()); };
purge(); setInterval(purge, HOUR).unref();

// ---------- estadísticas ----------
const WIN = { hoy: DAY, semana: 7 * DAY, temporada: 365 * DAY };
const MX = { desnivel: 'SUM(desnivel)', km: 'SUM(km)', horas: 'SUM(horas)', bajadas: 'SUM(bajadas)', dias: 'COUNT(*)', vmax: 'MAX(vmax)' };
const SRC = ALLOW_SIM ? '1=1' : "src!='sim'";
const rankRows = (metric, st, period, limit = 10) => P(`SELECT uid, ${MX[metric]} v FROM days WHERE ts>=? AND (? IS NULL OR station=?) AND ${SRC} GROUP BY uid ORDER BY v DESC, uid LIMIT ?`).all(Date.now() - WIN[period], st, st, limit);
function posOf(uid, metric, st, period) {
  const r = P(`WITH t AS (SELECT uid, ${MX[metric]} v FROM days WHERE ts>=? AND (? IS NULL OR station=?) AND ${SRC} GROUP BY uid)
    SELECT (SELECT v FROM t WHERE uid=?) mine, (SELECT COUNT(*) FROM t WHERE v>(SELECT v FROM t WHERE uid=?))+1 pos, (SELECT COUNT(*) FROM t) total, (SELECT MIN(v) FROM t WHERE v>(SELECT v FROM t WHERE uid=?)) nxt`).get(Date.now() - WIN[period], st, st, uid, uid, uid);
  return r.mine == null ? null : { pos: r.pos, v: r.mine, total: r.total, gap: r.nxt == null ? 0 : r.nxt - r.mine };
}
const agg = uid => P(`SELECT COALESCE(SUM(desnivel),0) desnivel, COALESCE(SUM(km),0) km, COALESCE(SUM(horas),0) horas, COALESCE(SUM(bajadas),0) bajadas, COUNT(*) dias, COALESCE(MAX(vmax),0) vmax FROM days WHERE uid=? AND ${SRC}`).get(uid);
function streak(uid) { const wk = t => Math.floor(t / (7 * DAY)), set = new Set(P('SELECT ts FROM days WHERE uid=?').all(uid).map(r => wk(r.ts))); let w = wk(Date.now()), n = 0; if (!set.has(w)) w--; while (set.has(w)) { n++; w--; } return n; }
function league(uid) { const p = posOf(uid, 'desnivel', null, 'semana'); if (!p) return { tier: null }; const f = (p.pos - 1) / p.total; return { tier: f < .1 ? 'Diamante' : f < .3 ? 'Oro' : f < .6 ? 'Plata' : 'Bronce', pos: p.pos, total: p.total, v: p.v }; }
const alias = uid => (P('SELECT alias FROM users WHERE id=?').get(uid) || {}).alias || '—';
const mapDay = d => ({ ...d, col: J(d.col), track: J(d.track), speed: J(d.speed) });

// ---------- utilidades HTTP ----------
const hits = new Map();
function limited(key, max, win) { const now = Date.now(), h = (hits.get(key) || []).filter(t => now - t < win); if (h.length >= max) { hits.set(key, h); return true; } h.push(now); hits.set(key, h); return false; }
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < HOUR)) hits.delete(k); }, HOUR).unref();
const ipOf = req => TRUST ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress : req.socket.remoteAddress;
const readBody = req => new Promise((ok, ko) => { let s = '', n = 0; req.on('data', c => { n += c.length; if (n > 2e5) { ko(new Error('big')); req.destroy(); } else s += c; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } }); req.on('error', ko); });
const send = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const bearer = req => (req.headers.authorization || '').replace(/^Bearer /, '');
const authUser = req => { const t = bearer(req); if (!t) return null; return P('SELECT u.* FROM tokens k JOIN users u ON u.id=k.uid WHERE k.th=? AND k.exp>?').get(sha(t), Date.now()) || null; };
const clean = u => ({ id: u.id, alias: u.alias, email: u.email });
const newToken = u => { const t = crypto.randomBytes(24).toString('hex'); P('INSERT INTO tokens VALUES(?,?,?)').run(sha(t), u.id, Date.now() + 30 * DAY); return t; };
const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const num = (v, max) => { v = +v; return Number.isFinite(v) ? Math.max(0, Math.min(v, max)) : 0; };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
async function sendMail(to, subject, html) {
  if (env.RESEND_API_KEY) {
    try { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM || 'Pistea <onboarding@resend.dev>', to: [to], subject, html }) }); if (!r.ok) console.error('[correo] fallo', r.status, await r.text()); return r.ok; } catch (e) { console.error('[correo] fallo', e.message); return false; }
  }
  console.log(`[correo simulado] para ${to} · ${subject}\n${html.replace(/<a [^>]*href="([^"]+)"[^>]*>/g, '$1 ').replace(/<[^>]+>/g, ' ')}`); return true;
}

// ---------- API ----------
const PUB = new Set(['POST /api/register', 'POST /api/login', 'POST /api/forgot', 'POST /api/reset', 'GET /api/config']);
const routes = {
  'POST /api/register': async ({ req, res, b }) => {
    if (limited('reg' + ipOf(req), 10, HOUR)) return send(res, 429, { error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.' });
    const e = str(b.email, 254).trim().toLowerCase(), a = str(b.alias, 60).trim(), pw = str(b.password, 200);
    if (!EMAIL.test(e)) return send(res, 400, { error: 'Correo no válido.' });
    if (pw.length < 8 || pw.length > 128) return send(res, 400, { error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
    if (a.length < 2 || a.length > 24) return send(res, 400, { error: 'El nombre debe tener entre 2 y 24 caracteres.' });
    if (P('SELECT 1 FROM users WHERE email=?').get(e)) return send(res, 409, { error: 'Ese correo ya está registrado.' });
    const salt = rid(), u = { id: rid(), email: e, alias: a, salt, hash: await hashPw(pw, salt) };
    const token = tx(() => { P('INSERT INTO users(id,email,alias,salt,hash,created) VALUES(?,?,?,?,?,?)').run(u.id, e, a, u.salt, u.hash, Date.now()); for (const d of P('SELECT id FROM users WHERE demo=1 ORDER BY random() LIMIT 4').all()) P('INSERT INTO follows VALUES(?,?)').run(u.id, d.id); return newToken(u); });
    send(res, 200, { token, user: clean(u) });
  },
  'POST /api/login': async ({ req, res, b }) => {
    const ip = ipOf(req), e = str(b.email, 254).trim().toLowerCase();
    if (limited('log' + ip, 20, 10 * 6e4) || limited('log' + e, 8, 10 * 6e4)) return send(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
    const u = P('SELECT * FROM users WHERE email=? AND demo=0').get(e), h = await hashPw(str(b.password, 200), u ? u.salt : 'x'.repeat(16));
    if (!u || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash))) return send(res, 401, { error: 'Correo o contraseña incorrectos.' });
    send(res, 200, { token: newToken(u), user: clean(u) });
  },
  'POST /api/forgot': async ({ req, res, b }) => {
    const e = str(b.email, 254).trim().toLowerCase(), ok = { ok: true };
    if (!EMAIL.test(e)) return send(res, 400, { error: 'Correo no válido.' });
    if (limited('fg' + ipOf(req), 10, HOUR) || limited('fg' + e, 3, HOUR)) return send(res, 429, { error: 'Demasiadas solicitudes. Inténtalo en una hora.' });
    send(res, 200, ok);   // misma respuesta exista o no el correo (no revela quién tiene cuenta)
    const u = P('SELECT * FROM users WHERE email=? AND demo=0').get(e); if (!u) return;
    const t = crypto.randomBytes(32).toString('hex'); P('DELETE FROM resets WHERE uid=?').run(u.id); P('INSERT INTO resets VALUES(?,?,?)').run(sha(t), u.id, Date.now() + HOUR);
    const link = `${APP_URL}/?reset=${t}`;
    sendMail(e, 'Recupera tu contraseña de Pistea', `<p>Hola ${u.alias.replace(/[<>&"]/g, '')},</p><p>Para crear una contraseña nueva entra aquí (caduca en 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no lo has pedido tú, ignora este correo.</p>`);
  },
  'POST /api/reset': async ({ req, res, b }) => {
    if (limited('rs' + ipOf(req), 10, HOUR)) return send(res, 429, { error: 'Demasiados intentos.' });
    const pw = str(b.password, 200), r = P('SELECT * FROM resets WHERE th=? AND exp>?').get(sha(str(b.token, 100)), Date.now());
    if (!r) return send(res, 400, { error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });
    if (pw.length < 8 || pw.length > 128) return send(res, 400, { error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
    const salt = rid(), h = await hashPw(pw, salt);
    tx(() => { P('UPDATE users SET salt=?, hash=? WHERE id=?').run(salt, h, r.uid); P('DELETE FROM resets WHERE uid=?').run(r.uid); P('DELETE FROM tokens WHERE uid=?').run(r.uid); });
    send(res, 200, { ok: true });
  },
  'POST /api/logout': async ({ req, res }) => { P('DELETE FROM tokens WHERE th=?').run(sha(bearer(req))); send(res, 200, {}); },
  'GET /api/me': async ({ res, u }) => send(res, 200, { user: clean(u), totals: agg(u.id), stations: P(`SELECT DISTINCT station s FROM days WHERE uid=? AND ${SRC}`).all(u.id).map(r => r.s), days: P('SELECT id,station,ts,desnivel,km,horas,bajadas,vmax FROM days WHERE uid=? ORDER BY ts DESC LIMIT 30').all(u.id),
    pos: (posOf(u.id, 'desnivel', null, 'temporada') || {}).pos || 0, streak: streak(u.id), league: league(u.id), following: P('SELECT COUNT(*) n FROM follows WHERE a=?').get(u.id).n, followers: P('SELECT COUNT(*) n FROM follows WHERE b=?').get(u.id).n }),
  'DELETE /api/me': async ({ res, u, b }) => {
    const h = await hashPw(str(b.password, 200), u.salt); if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash))) return send(res, 403, { error: 'Contraseña incorrecta.' });
    P('DELETE FROM users WHERE id=?').run(u.id); send(res, 200, {});   // ON DELETE CASCADE borra días, sesiones, apoyos y seguidores
  },
  'GET /api/rank': async ({ res, u, q }) => {
    const metric = MX[q.get('metric')] ? q.get('metric') : 'desnivel', period = WIN[q.get('period')] ? q.get('period') : 'temporada', st = SID.has(q.get('station')) ? q.get('station') : null;
    const rows = rankRows(metric, st, period), me = posOf(u.id, metric, st, period);
    send(res, 200, { rows: rows.map((x, k) => ({ pos: k + 1, alias: alias(x.uid), v: x.v, me: x.uid === u.id })), me: me && { pos: me.pos, v: me.v }, gap: me ? me.gap : 0, total: me ? me.total : rows.length });
  },
  'GET /api/stations': async ({ res }) => {
    const out = {}, cnt = Object.fromEntries(P(`SELECT station s, COUNT(DISTINCT uid) n FROM days WHERE ts>=? AND ${SRC} GROUP BY station`).all(Date.now() - WIN.temporada).map(r => [r.s, r.n]));
    for (const s of STATIONS) out[s[0]] = { skiers: cnt[s[0]] || 0, leaders: cnt[s[0]] ? rankRows('desnivel', s[0], 'temporada', 3).map(x => ({ alias: alias(x.uid), v: x.v })) : [] };
    send(res, 200, out);
  },
  'GET /api/feed': async ({ res, u, q }) => {
    const onlyF = q.get('scope') === 'amigos', rows = P(`SELECT d.id,d.uid,d.station,d.ts,d.desnivel,d.km,d.bajadas,d.vmax,d.track,u.alias,(SELECT COUNT(*) FROM kudos k WHERE k.day=d.id) kudos,EXISTS(SELECT 1 FROM kudos k WHERE k.day=d.id AND k.uid=?) liked
      FROM days d JOIN users u ON u.id=d.uid WHERE ${SRC.replace('src', 'd.src')} AND (?=0 OR d.uid=? OR d.uid IN (SELECT b FROM follows WHERE a=?)) ORDER BY d.ts DESC LIMIT 15`).all(u.id, onlyF ? 1 : 0, u.id, u.id);
    send(res, 200, rows.map(d => ({ ...d, track: J(d.track), liked: !!d.liked })));
  },
  'POST /api/days': async ({ res, u, b }) => {
    const c = b.col && typeof b.col === 'object' ? b.col : {}, src = b.source === 'sim' ? 'sim' : 'gps';
    if (src === 'sim' && !ALLOW_SIM) return send(res, 403, { error: 'La simulación está desactivada en producción.' });
    if (!SID.has(b.station)) return send(res, 400, { error: 'Estación no válida.' });
    const d = { id: rid(), uid: u.id, station: b.station, ts: Date.now(), desnivel: num(b.desnivel, 40000), km: num(b.km, 300), horas: num(b.horas, 14), bajadas: Math.round(num(b.bajadas, 200)), vmax: num(b.vmax, 140), vmed: num(b.vmed, 100), src,
      col: { v: num(c.v, 200) | 0, a: num(c.a, 200) | 0, r: num(c.r, 200) | 0, n: num(c.n, 200) | 0 },
      track: (Array.isArray(b.track) ? b.track : []).slice(0, 60).map(p => Array.isArray(p) ? [num(p[0], 1e5), num(p[1], 1e5)] : [0, 0]), speed: (Array.isArray(b.speed) ? b.speed : []).slice(0, 400).map(v => num(v, 140)) };
    if (d.bajadas > 0 && d.desnivel / d.bajadas > 1500) return send(res, 400, { error: 'Datos incoherentes: demasiado desnivel por bajada.' });
    if (d.horas > 0 && d.km / d.horas > 90) return send(res, 400, { error: 'Datos incoherentes: velocidad media imposible.' });
    if (P('SELECT COUNT(*) n FROM days WHERE uid=? AND ts>?').get(u.id, Date.now() - DAY).n >= 5) return send(res, 429, { error: 'Máximo 5 días guardados cada 24 horas.' });
    const before = (posOf(u.id, 'desnivel', null, 'temporada') || {}).pos || 0; insertDay(d);
    send(res, 200, { day: d, before, after: posOf(u.id, 'desnivel', null, 'temporada').pos, posStation: (posOf(u.id, 'desnivel', d.station, 'temporada') || {}).pos || 0 });
  },
  'GET /api/users': async ({ res, u, q }) => { const s = str(q.get('q'), 40).trim().toLowerCase().replace(/[%_\\]/g, ''); send(res, 200, s.length < 2 ? [] : P("SELECT id,alias,EXISTS(SELECT 1 FROM follows WHERE a=? AND b=users.id) following FROM users WHERE id!=? AND lower(alias) LIKE ? ORDER BY alias LIMIT 10").all(u.id, u.id, `%${s}%`).map(x => ({ ...x, following: !!x.following }))); },
  'POST /api/follow': async ({ res, u, b }) => {
    const id = str(b.id, 40); if (id === u.id || !P('SELECT 1 FROM users WHERE id=?').get(id)) return send(res, 400, { error: 'Usuario no válido.' });
    const had = P('DELETE FROM follows WHERE a=? AND b=?').run(u.id, id).changes; if (!had) P('INSERT INTO follows VALUES(?,?)').run(u.id, id); send(res, 200, { following: !had });
  },
  'GET /api/user': async ({ res, u, q }) => {
    const t = P('SELECT id,alias FROM users WHERE id=?').get(str(q.get('id'), 40)); if (!t) return send(res, 404, { error: 'No existe.' });
    send(res, 200, { ...t, totals: agg(t.id), stations: P(`SELECT DISTINCT station s FROM days WHERE uid=? AND ${SRC}`).all(t.id).map(r => r.s), days: P('SELECT station,ts,desnivel,bajadas,track FROM days WHERE uid=? ORDER BY ts DESC LIMIT 5').all(t.id).map(d => ({ ...d, track: J(d.track) })),
      pos: (posOf(t.id, 'desnivel', null, 'temporada') || {}).pos || 0, streak: streak(t.id), followers: P('SELECT COUNT(*) n FROM follows WHERE b=?').get(t.id).n, following: !!P('SELECT 1 FROM follows WHERE a=? AND b=?').get(u.id, t.id), me: t.id === u.id });
  },
  'POST /api/kudos': async ({ res, u, b }) => {
    const id = str(b.id, 40); if (!P('SELECT 1 FROM days WHERE id=?').get(id)) return send(res, 404, { error: 'No existe.' });
    const had = P('DELETE FROM kudos WHERE day=? AND uid=?').run(id, u.id).changes; if (!had) P('INSERT INTO kudos VALUES(?,?)').run(id, u.id); send(res, 200, { kudos: P('SELECT COUNT(*) n FROM kudos WHERE day=?').get(id).n, liked: !had });
  },
  'GET /api/config': async ({ res }) => send(res, 200, { stations: STATIONS.map(s => ({ id: s[0], n: s[1], z: s[2] })), sim: ALLOW_SIM })
};

// ---------- ficheros estáticos (página y mapas 3D) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const TEXTY = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
function serveFile(req, res, root, rel) {
  let p; try { p = decodeURIComponent(rel); } catch { res.writeHead(400); return res.end(); }
  let f = path.resolve(root, '.' + path.sep + p.replace(/^\/+/, ''));
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  let s; try { s = fs.statSync(f); if (s.isDirectory()) { f = path.join(f, 'index.html'); s = fs.statSync(f); } } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('No encontrado'); }
  const ext = path.extname(f).toLowerCase(), lm = s.mtime.toUTCString();
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Last-Modified': lm, 'Cache-Control': /\/assets\//.test(f.replace(/\\/g, '/')) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  if (req.headers['if-modified-since'] === lm) { res.writeHead(304, h); return res.end(); }
  if (TEXTY.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); return fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res); }
  res.writeHead(200, { ...h, 'Content-Length': s.size }); fs.createReadStream(f).pipe(res);
}
const PAGE_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'geolocation=(self)',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'" };

async function handler(req, res) {
  try {
    if (PROD && TRUST && req.headers['x-forwarded-proto'] === 'http') { res.writeHead(301, { Location: APP_URL + req.url }); return res.end(); }
    if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const url = new URL(req.url, 'http://x'), key = `${req.method} ${url.pathname}`;
    if (url.pathname.startsWith('/api/')) {
      const r = routes[key]; if (!r) return send(res, 404, { error: 'No existe.' });
      const u = PUB.has(key) ? null : authUser(req);
      if (!PUB.has(key) && !u && key !== 'POST /api/logout') return send(res, 401, { error: 'Sesión caducada.' });
      const b = req.method === 'POST' || req.method === 'DELETE' ? await readBody(req) : {};
      return await r({ req, res, u, q: url.searchParams, b });
    }
    if (url.pathname === '/3d') { res.writeHead(301, { Location: '/3d/' + url.search }); return res.end(); }
    if (url.pathname.startsWith('/3d/')) return fs.existsSync(MAPS) ? serveFile(req, res, MAPS, url.pathname.slice(3)) : send(res, 404, { error: 'Mapas 3D no instalados (MAPS_DIR).' });
    if (url.pathname === '/manifest.json') { res.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return res.end(JSON.stringify({ name: 'Pistea', short_name: 'Pistea', start_url: '/', display: 'standalone', background_color: '#0b0c0f', theme_color: '#0b0c0f', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] })); }
    if (url.pathname === '/icon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0c0f"/><path d="M14 74l24-40 16 24 12-16 20 32z" fill="none" stroke="#f4f5f7" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>'); }
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    res.writeHead(200, PAGE_HEADERS); res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  } catch (e) { if (!res.headersSent) send(res, e.message === 'big' ? 413 : 400, { error: e.message === 'big' ? 'Petición demasiado grande.' : 'Petición no válida.' }); else res.end(); if (!['big'].includes(e.message) && !(e instanceof SyntaxError)) console.error(e); }
}
const server = env.TLS_CERT && env.TLS_KEY ? https.createServer({ cert: fs.readFileSync(env.TLS_CERT), key: fs.readFileSync(env.TLS_KEY) }, handler) : http.createServer(handler);
server.headersTimeout = 15000; server.requestTimeout = 30000;
server.listen(PORT, () => console.log(`Pistea en ${APP_URL} (${PROD ? 'producción' : 'desarrollo'}${env.TLS_CERT ? ', HTTPS' : ''}) · BD ${path.join(DATA, 'pistea.sqlite')} · mapas 3D ${fs.existsSync(MAPS) ? 'ok' : 'NO ENCONTRADOS'}`));
const bye = () => { server.close(); try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); } catch {} process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
