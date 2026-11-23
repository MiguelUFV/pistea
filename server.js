// Pistea · servidor (Node 20+). Base de datos libSQL: Turso en producción (persistente, cifrada en tránsito) o un fichero
// SQLite en local. Sesiones en cookie HttpOnly. Ver DEPLOY.md (despliegue) y SEGURIDAD.md (auditoría y decisiones).
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { promisify } = require('util'), { createClient } = require('@libsql/client'), { legal, LEGAL_HEADERS } = require('./legal');
const { Calc, decodeTrace, fromPack, heights, toLocal } = require('./public/calc.js'), GEO = require('./estaciones_geo.json');   // el mismo cálculo que la app; centro y radio de cada estación
const env = process.env, PORT = +env.PORT || 3000, PROD = env.NODE_ENV === 'production', VERCEL = !!env.VERCEL, TRUST = env.TRUST_PROXY === '1';
const APP_URL = (env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : `http://localhost:${PORT}`)).replace(/\/$/, '');
const DATA = env.DATA_DIR || __dirname, AVATARS_DIR = path.join(DATA, 'avatars');
const MAPS = env.MAPS_DIR || (fs.existsSync(path.join(__dirname, 'mapas')) ? path.join(__dirname, 'mapas') : path.resolve(__dirname, '../Estaciones3D/web/dist/app'));
// En producción el 3D se sirve desde Cloudflare Pages (MAPS_URL): sin límite de tráfico y fuera de la función de Vercel, que
// solo lleva el relieve (dem.u16d) para el motor del día. Sin MAPS_URL (en local o con Docker), lo sirve este servidor.
const MAPS_URL = (env.MAPS_URL || (VERCEL ? 'https://pistea-mapas.pages.dev' : '')).replace(/\/$/, ''), MAPS_ORIGIN = MAPS_URL && new URL(MAPS_URL).origin;
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
  `CREATE TABLE IF NOT EXISTS days(id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, station TEXT NOT NULL, ts INTEGER NOT NULL, desnivel REAL, km REAL, horas REAL, bajadas INTEGER, vmax REAL, vmed REAL, col TEXT, track TEXT, speed TEXT, src TEXT DEFAULT 'gps', total REAL, t0 INTEGER, t1 INTEGER)`,
  `CREATE TABLE IF NOT EXISTS kudos(day TEXT REFERENCES days(id) ON DELETE CASCADE, uid TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(day, uid))`,
  `CREATE TABLE IF NOT EXISTS follows(a TEXT REFERENCES users(id) ON DELETE CASCADE, b TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(a, b))`,
  // Solicitudes de seguimiento a cuentas que aprueban a sus seguidores (a pide seguir a b) y avisos de actividad (follow, accepted, kudo)
  `CREATE TABLE IF NOT EXISTS follow_requests(a TEXT NOT NULL, b TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(a, b))`,
  `CREATE TABLE IF NOT EXISTS notifs(id TEXT PRIMARY KEY, uid TEXT NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL, day TEXT, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY, uid TEXT, action TEXT NOT NULL, ip TEXT NOT NULL, ua TEXT, details TEXT, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS avatars(uid TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, updated INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hits(k TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS blocks(a TEXT NOT NULL, b TEXT NOT NULL, ts INTEGER, PRIMARY KEY(a, b))`,
  `CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, reporter TEXT NOT NULL, target TEXT NOT NULL, day TEXT, reason TEXT NOT NULL, note TEXT, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolved_by TEXT, resolved_at INTEGER, action TEXT)`,
  `CREATE TABLE IF NOT EXISTS verifs(th TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER)`,
  // Pasaporte y récords por pista: una fila por pista bajada en cada día GPS (de su desglose, calculado en el servidor):
  // cuántas bajadas la tocaron, metros por ella y la máxima en ella (km/h; null en días antiguos sin máxima por tramo)
  `CREATE TABLE IF NOT EXISTS passes(day TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE, uid TEXT NOT NULL, station TEXT NOT NULL, piste TEXT NOT NULL, c TEXT, n INTEGER NOT NULL, m REAL, vmax REAL, ts INTEGER NOT NULL, PRIMARY KEY(day, piste))`];
const ALTERS = [['users', 'avatar TEXT'], ['users', 'age INTEGER'], ['users', 'bio TEXT'], ['users', 'station_home TEXT'], ['users', "modality TEXT DEFAULT 'ski'"], ['users', "level TEXT DEFAULT 'intermedio'"],
  ['users', 'terms_accepted_at INTEGER'], ['users', 'updated_at INTEGER'], ['days', 'total REAL'], ['tokens', 'created INTEGER'], ['tokens', 'ua TEXT'], ['users', 'verified INTEGER'], ['days', 't0 INTEGER'], ['days', 't1 INTEGER'], // Ficha de esquiador: @usuario, desde qué año esquía, terreno (JSON), estaciones que quiere esquiar (JSON), reto de días,
  // equipo, club o escuela y si ya pasó el alta guiada
  ['users', 'handle TEXT'], ['users', 'since INTEGER'], ['users', 'terrain TEXT'], ['users', 'wish TEXT'], ['users', 'goal_days INTEGER'], ['users', 'gear TEXT'], ['users', 'club TEXT'], ['users', 'onboarded INTEGER'],
  ['days', 'freeride REAL'], ['days', 'detail TEXT'],   // km fuera de pista y el desglose del día (bajadas con sus pistas, remontes, metros por color)
  ['users', 'approve INTEGER'], ['users', 'notif_seen INTEGER'], ['follows', 'ts INTEGER'],   // aprobar seguidores; hasta cuándo ha visto sus avisos; cuándo empezó a seguir
  ['users', 'hidden INTEGER'], ['users', 'banned INTEGER'],
  ['users', 'vis TEXT']];   // quién ve los días: todos, seguidores (por defecto, también si es NULL) o yo   // hidden: oculto por denuncias hasta revisarlo; banned: cuenta suspendida   // verified NULL = cuenta anterior a la verificación (se da por buena)
const INDEXES = ['CREATE INDEX IF NOT EXISTS i_days_uid ON days(uid, ts)', 'CREATE INDEX IF NOT EXISTS i_days_st ON days(station, ts)', 'CREATE INDEX IF NOT EXISTS i_days_ts ON days(ts)',
  'CREATE INDEX IF NOT EXISTS i_tokens_uid ON tokens(uid)', 'CREATE INDEX IF NOT EXISTS i_audit_uid ON audit_logs(uid, ts)', 'CREATE INDEX IF NOT EXISTS i_audit_ts ON audit_logs(ts)',
  'CREATE INDEX IF NOT EXISTS i_hits ON hits(k, ts)', 'CREATE INDEX IF NOT EXISTS i_follows_b ON follows(b)', 'CREATE INDEX IF NOT EXISTS i_kudos_uid ON kudos(uid)', 'CREATE INDEX IF NOT EXISTS i_blocks_b ON blocks(b)', 'CREATE INDEX IF NOT EXISTS i_reports ON reports(status, target)',
  'CREATE UNIQUE INDEX IF NOT EXISTS u_users_handle ON users(handle)', 'CREATE INDEX IF NOT EXISTS i_follows_a ON follows(a)',
  'CREATE INDEX IF NOT EXISTS i_freq_b ON follow_requests(b, ts)', 'CREATE INDEX IF NOT EXISTS i_notifs ON notifs(uid, ts)',
  'CREATE INDEX IF NOT EXISTS i_passes_st ON passes(station, piste, ts)', 'CREATE INDEX IF NOT EXISTS i_passes_uid ON passes(uid, station)'];   // el @usuario es único (NULL, sin elegir, se puede repetir)
async function init() {
  if (DB_URL.startsWith('file:')) await run('PRAGMA journal_mode=WAL').catch(() => {});
  await atomic(SCHEMA.map(s => [s]));
  for (const [t, c] of ALTERS) await run(`ALTER TABLE ${t} ADD COLUMN ${c}`).catch(() => {});   // BD creadas con versiones anteriores
  await atomic(INDEXES.map(s => [s]));
  // Una sola vez: el pasaporte de los días guardados antes de que existiera (los que tienen desglose de pistas)
  if (!(await one('SELECT 1 x FROM passes LIMIT 1'))) {
    const rows = (await all("SELECT id, uid, station, ts, detail FROM days WHERE detail IS NOT NULL AND src='gps'")).flatMap(d => passRows(d, J(d.detail, null)));
    for (let i = 0; i < rows.length; i += 200) await atomic(rows.slice(i, i + 200));
  }
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
const MX = { desnivel: 'SUM(desnivel)', km: 'SUM(km)', freeride: 'SUM(COALESCE(freeride,0))', horas: 'SUM(horas)', bajadas: 'SUM(bajadas)', dias: 'COUNT(*)', vmax: 'MAX(vmax)' };   // lista cerrada: nunca entra texto del usuario en el SQL
// ---------- antitrampas: el día se recalcula en el servidor desde la traza GPS (que no se guarda) ----------
const distKm = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.hypot(x, y) * 6371; };
function checkTrace(trace, station) {
  if (trace && trace.mk > 0) return { error: 'La grabación tiene ubicaciones simuladas. Desactiva las apps que falsean el GPS.' };
  let fx; try { fx = decodeTrace(trace); } catch { return { error: 'La grabación GPS no es válida.' }; }
  const t0 = fx[0].t, t1 = fx[fx.length - 1].t, g = GEO[station], good = fx.filter(f => f.acc <= 40);
  if (fx.length < 60 || t1 - t0 < 5 * MIN) return { error: 'La grabación es demasiado corta para guardarla.' };
  if (t1 - t0 > 16 * HOUR) return { error: 'Una grabación no puede durar más de 16 horas.' };
  if (t1 > Date.now() + 5 * MIN || t0 < Date.now() - 7 * DAY) return { error: 'La fecha de la grabación no es válida (como mucho, días de la última semana).' };
  if (!g || good.length < 30) return { error: 'La grabación no tiene suficiente señal GPS.' };
  if (good.filter(f => distKm(f, g) <= g.km).length / good.length < .8) return { error: 'La grabación no es de esta estación. Elige la estación en la que has esquiado.' };
  let jumps = 0; for (let i = 1; i < good.length; i++) { const dt = (good[i].t - good[i - 1].t) / 1000; if (dt > 0 && distKm(good[i], good[i - 1]) * 1000 / dt > 42) jumps++; }
  if (jumps / good.length > .02) return { error: 'La grabación tiene saltos imposibles (más de 150 km/h).' };
  const C = new Calc(stationOf(station)); for (const f of fx) C.add(f);
  const p = C.payload({ id: station }); if (!p) return { error: 'No se ha detectado ninguna bajada en la grabación.' };
  return { p, t0, t1 };
}
// Lo que el motor del día sabe de cada estación: pistas, remontes y proyección (public/seg, de scripts/gen_seguimiento.js)
// y el relieve del mapa 3D. Se guardan las 6 últimas pedidas (unos 4 MB cada una)
const PACKS = new Map();
function stationOf(id) {
  if (PACKS.has(id)) { const s = PACKS.get(id); PACKS.delete(id); PACKS.set(id, s); return s; }
  let s = null;
  try {
    const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'seg', id + '.json'), 'utf8')), dem = path.join(MAPS, 'estaciones', id, 'data', 'dem.u16d');
    s = fromPack(pack, fs.existsSync(dem) ? heights(zlib.gunzipSync(fs.readFileSync(dem))) : null);
  } catch (e) { console.error('[estación]', id, e.message); }
  PACKS.set(id, s); if (PACKS.size > 6) PACKS.delete(PACKS.keys().next().value);
  return s;
}
// El recorrido que se guarda y se enseña: sin lo de antes del primer remonte o bajada ni lo de después de la última (salir
// del alojamiento, aparcar) y solo dentro del círculo de la estación (estaciones_geo.json). Puntos [x, z, clase]; clase 6 =
// parado, andando o sin mapa. Para los días guardados antes del recorte se aplica al enseñarlos a otros
const GEOLOC = new Map();
function trimTrack(track, station) {
  if (!Array.isArray(track) || !track.length) return [];
  const isMove = p => Array.isArray(p) && (p.length < 3 || p[2] !== 6);
  let a = 0, b = track.length - 1; while (a <= b && !isMove(track[a])) a++; while (b >= a && !isMove(track[b])) b--;
  let out = track.slice(a, b + 1);
  const g = GEO[station];
  if (g && out.length && out[0].length >= 3) {
    if (!GEOLOC.has(station)) { let c = null; try { const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'seg', station + '.json'), 'utf8')).geo; c = geo ? toLocal(g.lat, g.lon, geo) : null; } catch {} GEOLOC.set(station, c); }
    const c = GEOLOC.get(station), r = g.km * 1000; if (c) out = out.filter(p => Math.hypot(p[0] - c.x, p[1] - c.z) <= r);
  }
  return out.length >= 2 ? out : [];
}
const SRC = ALLOW_SIM ? '1=1' : "src!='sim'", SRC_D = ALLOW_SIM ? '1=1' : "d.src!='sim'";
const pubCond = p => `${VERIFY ? `COALESCE(${p}verified,1)=1 AND ` : ''}COALESCE(${p}hidden,0)=0 AND COALESCE(${p}banned,0)=0`;   // ver VERIFY
const pubU = () => pubCond('u.'), pubUid = c => `${c} IN (SELECT id FROM users WHERE ${pubCond('')})`;
const notBlocked = c => `${c} NOT IN (SELECT b FROM blocks WHERE a=?) AND ${c} NOT IN (SELECT a FROM blocks WHERE b=?)`;   // en las dos direcciones
// Quién ve los días (recorrido, bajadas y remontes): «todos», «seguidores» (por defecto: privacidad desde el diseño, art. 25
// RGPD) o «yo». Quien elige «yo» tampoco sale en los rankings ni en los récords de pista; los demás salen con sus totales
const VIS = ['todos', 'seguidores', 'yo'], visOf = u => VIS.includes(u && u.vis) ? u.vis : 'seguidores';
const V_ = p => `COALESCE(${p}vis,'seguidores')`;
const listed = p => `${V_(p)}!='yo'`, listedUid = c => `${c} IN (SELECT id FROM users WHERE ${pubCond('')} AND ${listed('')})`;
// Días de x.uid que puede ver quien mira (?): los suyos, los de «todos» y los de «seguidores» si les sigue
const daysVisible = (p, uidCol) => `(${uidCol}=? OR ${V_(p)}='todos' OR (${V_(p)}='seguidores' AND ${uidCol} IN (SELECT b FROM follows WHERE a=?)))`;
const canSeeDays = async (viewer, owner) => owner.id === viewer || visOf(owner) === 'todos' || (visOf(owner) === 'seguidores' && !!(await one('SELECT 1 x FROM follows WHERE a=? AND b=?', [viewer, owner.id])));
const rankRows = (metric, st, period, limit = 10, self = '') => all(`SELECT d.uid uid, u.alias alias, u.avatar avatar, ${MX[metric]} v FROM days d JOIN users u ON u.id=d.uid WHERE d.ts>=? AND (? IS NULL OR d.station=?) AND ${SRC_D} AND ((${pubU()} AND ${listed('u.')}) OR d.uid=?) AND ${notBlocked('d.uid')} GROUP BY d.uid ORDER BY v DESC, d.uid LIMIT ?`, [Date.now() - WIN[period], st, st, self, self, self, limit]);   // sin cuentas «solo yo» ni bloqueos
async function posOf(uid, metric, st, period) {
  const r = await one(`WITH t AS (SELECT uid, ${MX[metric]} v FROM days WHERE ts>=? AND (? IS NULL OR station=?) AND ${SRC} AND (${listedUid('uid')} OR uid=?) GROUP BY uid)
    SELECT (SELECT v FROM t WHERE uid=?) mine, (SELECT COUNT(*) FROM t WHERE v>(SELECT v FROM t WHERE uid=?))+1 pos, (SELECT COUNT(*) FROM t) total, (SELECT MIN(v) FROM t WHERE v>(SELECT v FROM t WHERE uid=?)) nxt`, [Date.now() - WIN[period], st, st, uid, uid, uid, uid]);
  return !r || r.mine == null ? null : { pos: r.pos, v: r.mine, total: r.total, gap: r.nxt == null ? 0 : r.nxt - r.mine };
}
const agg = uid => one(`SELECT COALESCE(SUM(desnivel),0) desnivel, COALESCE(SUM(km),0) km, COALESCE(SUM(horas),0) horas, COALESCE(SUM(bajadas),0) bajadas, COUNT(*) dias, COALESCE(MAX(vmax),0) vmax, COALESCE(SUM(freeride),0) freeride FROM days WHERE uid=? AND ${SRC}`, [uid]);
async function streak(uid) { const wk = t => Math.floor(t / (7 * DAY)), set = new Set((await all('SELECT ts FROM days WHERE uid=?', [uid])).map(r => wk(r.ts))); let w = wk(Date.now()), n = 0; if (!set.has(w)) w--; while (set.has(w)) { n++; w--; } return n; }
async function league(uid) { const p = await posOf(uid, 'desnivel', null, 'semana'); if (!p) return { tier: null }; const f = (p.pos - 1) / p.total; return { tier: f < .1 ? 'Diamante' : f < .3 ? 'Oro' : f < .6 ? 'Plata' : 'Bronce', pos: p.pos, total: p.total, v: p.v }; }
const stationsDistinct = async uid => (await all(`SELECT DISTINCT station s FROM days WHERE uid=? AND ${SRC}`, [uid])).map(r => r.s);
const count = async (sql, args) => (await one(sql, args)).n;
let stationsCache = { t: 0, v: null };   // la portada la pide mucho y cuesta 27 clasificaciones: se guarda un minuto

// ---------- pasaporte de pistas y récords por pista ----------
const PASS_MIN = 100;   // metros por una pista para contarla bajada: cruzarla o rozarla no cuenta
// Las pistas de un desglose (detail.runs: [t0, t1, desnivel, metros, máx., [[color, pista, metros, máx.]]]): nombre ->
// { color, bajadas que la tocaron, metros, máxima }. Los días anteriores al desglose v3 no tienen máxima por tramo: vale
// la de la bajada si fue casi entera por esa pista
function passesOf(detail) {
  const out = new Map(); if (!detail || !Array.isArray(detail.runs)) return out;
  for (const r of detail.runs) {
    const segs = (Array.isArray(r[5]) ? r[5] : []).filter(g => Array.isArray(g) && typeof g[1] === 'string' && g[1] && /^[varnf]$/.test(g[0]) && +g[2] >= PASS_MIN);
    const solo = segs.length === 1 && +segs[0][2] >= 0.7 * (+r[3] || 0), seen = new Set();
    for (const g of segs) {
      const name = g[1].slice(0, 80), o = out.get(name) || { c: g[0], n: 0, m: 0, v: 0 };
      if (!seen.has(name)) { o.n++; seen.add(name); }
      const v = g.length > 3 ? +g[3] : solo ? +r[4] : 0;
      o.m += +g[2]; if (Number.isFinite(v) && v > o.v && v < 145) o.v = v;   // el motor no da más de 144 km/h (MAX_SPEED)
      out.set(name, o);
    }
  }
  return out;
}
const passRows = (d, detail) => [...passesOf(detail)].map(([name, o]) => ['INSERT OR REPLACE INTO passes(day,uid,station,piste,c,n,m,vmax,ts) VALUES(?,?,?,?,?,?,?,?,?)',
  [d.id, d.uid, d.station, name, o.c, o.n, Math.round(o.m), o.v ? Math.round(o.v * 10) / 10 : null, d.ts]]);
// Dominios compartidos: el mapa de La Molina lleva las pistas de Masella (y Astún las de Candanchú). Un día grabado en una
// puede pasar por pistas de la otra; las que se llaman como una propia llevan detrás el nombre de su estación
// («Panoràmica (Masella)»). La lista de cada estación es la de su ficha (public/img/pistas.json, de gen_pistas.js)
const DOMAIN = { 'la-molina': 'masella', masella: 'la-molina', astun: 'candanchu', candanchu: 'astun', 'fuentes-de-invierno': 'san-isidro', 'san-isidro': 'fuentes-de-invierno' }, SNAME = Object.fromEntries(STATIONS.map(s => [s[0], s[1]]));
let PIST = null;
const pisteList = id => { if (!PIST) { try { PIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'img', 'pistas.json'), 'utf8')); } catch { PIST = {}; } }
  if (!PIST[id]) return null; if (!PIST[id].set) PIST[id].set = new Map(PIST[id].map(p => [p[0], p[1]])); return PIST[id].set; };
// La pista de la estación «id» que es una fila de passes (estación s, nombre p), o null si es de otra
function pisteOf(id, s, p) {
  const L = pisteList(id);
  if (s === id) return !L || L.has(p) ? p : null;
  if (s !== DOMAIN[id] || !L) return null;
  const sfx = ` (${SNAME[id]})`;
  if (p.endsWith(sfx)) { const k = p.slice(0, -sfx.length); return L.has(k) ? k : null; }
  const N = pisteList(s); return L.has(p) && !(N && N.has(p)) ? p : null;
}
// La estación y el nombre de ficha de una fila de passes (las de la vecina pasan a su estación); si no casa, tal cual
const canon = (s, p) => { if (pisteOf(s, s, p)) return [s, p]; const o = DOMAIN[s], k = o && pisteOf(o, s, p); return k ? [o, k] : [s, p]; };
const stationsFor = id => DOMAIN[id] ? [id, DOMAIN[id]] : [id];
// Las filas de passes de unas estaciones en la temporada móvil (y de esos nombres, si se dan), visibles para quien mira,
// por pista de ficha y por esquiador: Map(«estación\u0001pista» -> Map(uid -> { uid, alias, avatar, c, v, n, t })).
// Lo de todos (cuentas públicas) se guarda un minuto por consulta; lo de quien mira se lee siempre al momento (así se ve
// en las clasificaciones nada más guardar un día) y los bloqueos se quitan en cada petición
const GP = new Map(), GP_TTL = MIN, COLL = { t: 0, v: null };
// Tras guardar, quitar o moderar días y cuentas, lo guardado en memoria se rehace en la siguiente petición (en esta instancia;
// en las demás de Vercel, como mucho un minuto después)
const fresh = () => { stationsCache.t = 0; GP.clear(); COLL.t = 0; };
const gpAdd = (out, r) => {
  const [s, k] = canon(r.s, r.p), key = s + '\u0001' + k, us = out.get(key) || out.set(key, new Map()).get(key), o = us.get(r.uid);
  if (o) { o.v = Math.max(o.v, r.v || 0); o.n += r.n; o.t = Math.min(o.t, r.t); } else us.set(r.uid, { uid: r.uid, alias: r.alias, avatar: r.avatar, c: r.c, v: r.v || 0, n: r.n, t: r.t });
};
async function groupedPasses(sts, viewer, names) {
  const where = `p.station IN (${sts.map(() => '?').join(',')}) AND p.ts>=?${names ? ` AND p.piste IN (${names.map(() => '?').join(',')})` : ''}`, args = [...sts, Date.now() - WIN.temporada, ...(names || [])];
  const ck = sts.join(',') + '|' + (names || []).join('\u0002');
  let base = GP.get(ck);
  if (!base || Date.now() - base.t > GP_TTL) {
    const rows = await all(`SELECT p.station s, p.piste p, p.c c, p.uid uid, u.alias alias, u.avatar avatar, MAX(p.vmax) v, SUM(p.n) n, MIN(p.ts) t FROM passes p JOIN users u ON u.id=p.uid
      WHERE ${where} AND ${pubU()} AND ${listed('u.')} GROUP BY p.station, p.piste, p.uid`, args);
    base = { t: Date.now(), rows }; GP.set(ck, base); if (GP.size > 200) GP.delete(GP.keys().next().value);
  }
  const [mine, blk] = await Promise.all([
    all(`SELECT p.station s, p.piste p, p.c c, p.uid uid, u.alias alias, u.avatar avatar, MAX(p.vmax) v, SUM(p.n) n, MIN(p.ts) t FROM passes p JOIN users u ON u.id=p.uid WHERE ${where} AND p.uid=? GROUP BY p.station, p.piste`, [...args, viewer]),
    all('SELECT b x FROM blocks WHERE a=? UNION SELECT a x FROM blocks WHERE b=?', [viewer, viewer])]);
  const skip = new Set(blk.map(r => r.x)); skip.add(viewer);
  const out = new Map();
  for (const r of base.rows) if (!skip.has(r.uid)) gpAdd(out, r);
  for (const r of mine) gpAdd(out, r);
  return out;
}
const seasonStart = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear() - (n.getUTCMonth() < 6 ? 1 : 0), 6, 1); };   // 1 de julio, como la app
const isPub = u => (!VERIFY || u.verified !== 0) && !u.hidden && !u.banned;
// Lo que un día nuevo trae al pasaporte y a los récords: pistas nuevas, mejores marcas propias y pistas en las que pasa a
// ser el más rápido de la temporada (contra lo guardado antes de este día)
async function novelties(u, station, detail) {
  const P = passesOf(detail); if (!P.size) return { nuevas: [], pr: [], top: [] };
  const names = [...P.keys()], qs = names.map(() => '?').join(','), since = Date.now() - WIN.temporada;
  const [mine, others] = await Promise.all([
    all(`SELECT piste, MAX(COALESCE(vmax,0)) v FROM passes WHERE uid=? AND station=? AND piste IN (${qs}) GROUP BY piste`, [u.id, station, ...names]),
    all(`SELECT p.piste piste, MAX(p.vmax) v FROM passes p JOIN users u ON u.id=p.uid WHERE p.station=? AND p.ts>=? AND p.uid!=? AND p.piste IN (${qs}) AND ${pubU()} GROUP BY p.piste`, [station, since, u.id, ...names])]);
  const M = new Map(mine.map(r => [r.piste, r.v])), O = new Map(others.map(r => [r.piste, r.v || 0])), r1 = v => Math.round(v);
  const nuevas = names.filter(n => !M.has(n)).map(n => [n, P.get(n).c]);
  const pr = names.filter(n => M.has(n) && M.get(n) > 0 && P.get(n).v > M.get(n) + 0.5).map(n => [n, r1(P.get(n).v), r1(M.get(n))]);
  const top = isPub(u) ? names.filter(n => P.get(n).v > 0 && P.get(n).v > (O.get(n) || 0) && !(M.get(n) >= P.get(n).v)).map(n => [n, r1(P.get(n).v)]) : [];
  const crowned = new Set(top.map(x => x[0]));   // la corona ya dice que es su mejor marca
  return { nuevas, pr: pr.filter(x => !crowned.has(x[0])), top };
}

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
// Freno de ráfagas de la API por conexión, en memoria (sin escribir en la BD en cada petición): para un bucle o un robot,
// no para el uso normal. Vale por instancia; los límites de verdad (alta, entrada, días…) son los de arriba, en la BD
const BURST = new Map(), BURST_MAX = 1200;
function burst(ip) {
  const now = Date.now(), w = BURST.get(ip);
  if (!w || now - w.t > MIN) { BURST.set(ip, { t: now, n: 1 }); if (BURST.size > 20000) BURST.clear(); return false; }
  return ++w.n > BURST_MAX;
}

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
  const u = await one('SELECT u.*, k.exp kexp, k.th kth FROM tokens k JOIN users u ON u.id=k.uid WHERE k.th=? AND k.exp>? AND COALESCE(u.banned,0)=0', [sha(t), Date.now()]);
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
// Filtro básico de nombres y biografías ofensivos (insultos, odio). Lo que se escape se cubre con las denuncias.
const BAD_WORDS = new Set(['puta', 'putas', 'puto', 'putos', 'puton', 'zorra', 'zorras', 'cabron', 'cabrona', 'cabrones', 'maricon', 'maricones', 'marica', 'bollera', 'polla', 'pollas', 'mierda', 'follar', 'gilipollas', 'gilipolla', 'subnormal', 'subnormales', 'retrasado', 'retrasada', 'mongolo', 'mongola', 'nazi', 'nazis', 'hitler', 'negrata', 'sudaca', 'sudacas', 'violador', 'pederasta', 'pedofilo', 'zoofilia', 'porno', 'pornhub', 'xvideos', 'onlyfans', 'fuck', 'fucker', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore']);
const BAD_PARTS = ['hijodeputa', 'hijoputa', 'gilipoll', 'malparid', 'mecagoen', 'putamadre', 'chupamela', 'comemela', 'subnormal', 'maricon'];
function offensive(v) {
  const n = String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[0@4]/g, m => ({ 0: 'o', '@': 'a', 4: 'a' }[m])).replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's').replace(/7/g, 't');
  const words = n.split(/[^a-zñ]+/).filter(Boolean), joined = words.join('');
  return words.some(w => BAD_WORDS.has(w)) || BAD_PARTS.some(p => joined.includes(p));
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const normEmail = v => str(v, 254).trim().toLowerCase();
const safeAvatar = a => typeof a === 'string' && /^\/avatars\/[a-z0-9_.]+(\?v=\d+)?$/.test(a) ? a : null;
const clean = u => ({ id: u.id, alias: u.alias, email: u.email, avatar: safeAvatar(u.avatar), age: u.age || null, bio: u.bio || '', station_home: u.station_home || null, modality: u.modality || 'ski', level: u.level || 'intermedio', terms_accepted_at: u.terms_accepted_at || null, created: u.created || null, verified: u.verified === null || u.verified === undefined ? !ADMINS.has(u.email) : !!u.verified, admin: isAdmin(u) || undefined,   // un administrador sin verificar ve el aviso para confirmar su correo
  ...card(u), goal_days: u.goal_days || null, onboarded: !!u.onboarded, approve: !!u.approve, vis: visOf(u) });
// Lo público de la ficha de esquiador (el reto de días es solo para uno mismo)
const card = u => ({ handle: u.handle || null, since: u.since || null, terrain: J(u.terrain), wish: J(u.wish), gear: u.gear || '', club: u.club || '' });
// @usuario: 3 a 20 letras minúsculas, cifras, punto o guion bajo, empezando y acabando en letra o cifra. Los nombres de la
// app y de las estaciones quedan reservados para que nadie se haga pasar por ellas
const TERRAIN = ['pista', 'carving', 'baches', 'park', 'freeride', 'travesia', 'competicion'];
const RESERVED = new Set(['admin', 'administrador', 'pistea', 'soporte', 'ayuda', 'moderacion', 'moderador', 'oficial', 'staff', 'root', 'api', 'null', 'undefined', 'estacion', 'estaciones']);
const reservedHandle = h => RESERVED.has(h) || [...SID].some(id => id.replace(/-/g, '') === h.replace(/[._]/g, '') || id.replace(/-/g, '.') === h || id.replace(/-/g, '_') === h);
function badHandle(h) {
  if (!/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(h) || /[._]{2}/.test(h)) return 'El @usuario lleva de 3 a 20 letras sin acentos, cifras, punto o guion bajo, y empieza y acaba en letra o cifra.';
  if (reservedHandle(h)) return 'Ese @usuario está reservado. Elige otro.';
  if (offensive(h.replace(/[._]/g, ' '))) return 'Ese @usuario no está permitido. Elige otro.';
  return null;
}
const handleOf = v => str(v, 40).trim().toLowerCase().replace(/^@/, '');
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
const ADMINS = new Set(String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean));   // correos que moderan
// Solo con el correo verificado de verdad (verified = 1). Una cuenta sin verificar (NULL) se creó cuando no se podía
// verificar: sin proveedor de correo, cualquiera podría registrar antes el correo de un administrador y ver el panel
const isAdmin = u => !!u && ADMINS.has(u.email) && u.verified === 1;
const blockedEither = async (a, b) => !!(await one('SELECT 1 x FROM blocks WHERE (a=? AND b=?) OR (a=? AND b=?)', [a, b, b, a]));
// ---- parte social: avisos, solicitudes y listas de seguidores
// Un aviso por (quién, qué, de qué día): si se repite (dejar de seguir y volver a seguir) no se acumula, solo sube al principio
const notify = async (uid, kind, actor, day = null) => { if (uid === actor) return; await atomic([["DELETE FROM notifs WHERE uid=? AND kind=? AND actor=? AND COALESCE(day,'')=?", [uid, kind, actor, day || '']], ['INSERT INTO notifs(id,uid,kind,actor,day,ts) VALUES(?,?,?,?,?,?)', [rid(), uid, kind, actor, day, Date.now()]]]); };
const unnotify = (uid, kind, actor, day = null) => run("DELETE FROM notifs WHERE uid=? AND kind=? AND actor=? AND COALESCE(day,'')=?", [uid, kind, actor, day || '']);
// Lo que pinta la campana: avisos sin ver (de cuentas visibles) y solicitudes pendientes de contestar
const socialOf = async id => {
  const seen = ((await one('SELECT notif_seen s FROM users WHERE id=?', [id])) || {}).s || 0;
  const [unseen, requests] = await Promise.all([
    count(`SELECT COUNT(*) n FROM notifs n JOIN users x ON x.id=n.actor WHERE n.uid=? AND n.ts>? AND ${pubCond('x.')}`, [id, seen]),
    count(`SELECT COUNT(*) n FROM follow_requests r JOIN users x ON x.id=r.a WHERE r.b=? AND ${pubCond('x.')}`, [id])]);
  return { unseen, requests };
};
// Una persona tal como la ve la interfaz en listas y avisos
const person = r => ({ id: r.id, alias: r.alias, avatar: safeAvatar(r.avatar), handle: r.handle || null, level: r.level || null, home: r.home || null, approve: !!r.approve, iFollow: !!r.iFollow, followsMe: !!r.followsMe, requested: !!r.requested, ts: r.ts || null });
// Las tres columnas que dicen cómo está la relación entre quien mira (?) y la persona x: sigo, me sigue, he pedido seguir
const REL = 'EXISTS(SELECT 1 FROM follows WHERE a=? AND b=x.id) iFollow, EXISTS(SELECT 1 FROM follows WHERE a=x.id AND b=?) followsMe, EXISTS(SELECT 1 FROM follow_requests WHERE a=? AND b=x.id) requested';
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
// Versión mínima de la APK de Android (versionCode de app/android/app/build.gradle). Si la APK instalada es más vieja, la app avisa y enseña dónde bajar la nueva.
// Al sacar una APK nueva: sube APK_MIN (aquí o en la variable de entorno), sustituye el archivo en Drive (mismo enlace) y haz push.
const APK = { min: +process.env.APK_MIN || 2, url: process.env.APK_URL || 'https://drive.google.com/uc?export=download&id=1ree93ZAkNR2FwgKDFHDs3QFztkvNcf5f' };
const PUB = new Set(['POST /api/register', 'POST /api/login', 'POST /api/forgot', 'POST /api/reset', 'GET /api/config', 'POST /api/logout', 'POST /api/verify']);
const routes = {
  'POST /api/register': async ({ req, res, b }) => {
    // 10 cuentas creadas por hora y conexión, y 40 intentos (los fallos de validación también cuentan, pero menos)
    if (await over('reg:' + ipOf(req), 10, HOUR) || await limited('rega:' + ipOf(req), 40, HOUR)) return send(res, 429, { error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.' });
    if (str(b.web, 200)) return send(res, 400, { error: 'No se ha podido crear la cuenta.' });   // campo trampa: solo lo rellenan los bots
    const e = normEmail(b.email), a = text(b.alias, 24), pw = str(b.password, 200);
    if (!EMAIL.test(e)) return send(res, 400, { error: 'Correo no válido.' });
    if (a.length < 2) return send(res, 400, { error: 'El nombre debe tener entre 2 y 24 caracteres.' });
    if (offensive(a)) return send(res, 400, { error: 'Ese nombre no está permitido. Elige otro.' });
    const weak = weakPw(pw, e, a); if (weak) return send(res, 400, { error: weak });
    if (b.terms !== true) return send(res, 400, { error: 'Debes aceptar la Política de Privacidad y confirmar que tienes al menos 14 años.' });
    let age = null;
    if (b.age !== undefined && b.age !== null && b.age !== '') { age = parseInt(b.age, 10); if (!Number.isFinite(age) || age < 14 || age > 120) return send(res, 400, { error: 'En España la edad mínima para registrarse son 14 años (art. 7 LOPDGDD 3/2018).' }); }
    if (await one('SELECT 1 x FROM users WHERE email=?', [e])) return send(res, 409, { error: 'Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala.' });
    const { salt, hash } = await hashPw(pw), now = Date.now(), u = { id: rid(), email: e, alias: a, age, terms_accepted_at: now, created: now };
    u.verified = VERIFY ? 0 : null;   // sin correo configurado no se puede verificar: la cuenta se da por buena (no se esconde al activarlo)
    try { await run('INSERT INTO users(id,email,alias,salt,hash,age,terms_accepted_at,created,updated_at,verified) VALUES(?,?,?,?,?,?,?,?,?,?)', [u.id, e, a, salt, hash, age, now, now, now, u.verified]); }
    catch (err) { if (/UNIQUE/i.test(err.message)) return send(res, 409, { error: 'Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala.' }); throw err; }
    await hit('reg:' + ipOf(req));
    setSession(req, res, await newToken(u, req)); await audit(u.id, 'REGISTER', req);
    if (VERIFY) await sendVerify(u);
    send(res, 200, { user: clean(u) });
  },
  'POST /api/login': async ({ req, res, b }) => {
    const e = normEmail(b.email), pw = str(b.password, 200);
    if (await limited('li:' + ipOf(req), 30, 10 * MIN)) return send(res, 429, { error: 'Demasiados intentos desde esta conexión. Espera unos minutos.' });
    // Fallos con un correo: 8 cada 15 min desde una conexión y 50 por hora en total. Así un atacante no deja sin entrar a la
    // dueña de la cuenta desde otra conexión, y la fuerza bruta repartida entre muchas sigue frenada
    const kf = 'lf:' + e + '|' + ipOf(req);
    if (await over(kf, 8, 15 * MIN) || await over('lfa:' + e, 50, HOUR)) return send(res, 429, { error: 'Demasiados intentos fallidos con este correo. Espera 15 minutos o recupera tu contraseña.' });
    const u = EMAIL.test(e) ? await one('SELECT * FROM users WHERE email=?', [e]) : null;
    if (!(await checkPw(pw, u))) { await hit(kf); await hit('lfa:' + e); await audit(u && u.id, 'LOGIN_FAILED', req); return send(res, 401, { error: 'Correo o contraseña incorrectos.' }); }
    await run('DELETE FROM hits WHERE k=?', [hk(kf)]);
    if (u.banned) return send(res, 403, { error: 'Esta cuenta está suspendida por incumplir las normas. Escríbenos si crees que es un error.' });
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
    fresh(); await audit(v.uid, 'EMAIL_VERIFIED', req); send(res, 200, { ok: true });
  },
  'POST /api/verify/resend': async ({ req, res, u }) => {
    if (u.verified === 1 || (u.verified === null && !ADMINS.has(u.email))) return send(res, 200, { ok: true, verified: true });   // un administrador antiguo sin verificar sí puede pedir el correo
    if (await limited('vr:' + u.id, 3, HOUR)) return send(res, 429, { error: 'Ya te hemos mandado varios correos. Revisa también la carpeta de spam o inténtalo en una hora.' });
    if (!(await sendVerify(u))) return send(res, 503, { error: 'No se ha podido enviar el correo. Inténtalo más tarde.' });
    send(res, 200, { ok: true });
  },
  'POST /api/logout': async ({ req, res }) => { const t = tokenOf(req); if (t) await run('DELETE FROM tokens WHERE th=?', [sha(t)]); clearSession(req, res); send(res, 200, { ok: true }); },
  'POST /api/logout-all': async ({ req, res, u }) => { await run('DELETE FROM tokens WHERE uid=?', [u.id]); clearSession(req, res); await audit(u.id, 'LOGOUT_ALL', req); send(res, 200, { ok: true }); },
  'GET /api/me': async ({ res, u }) => {
    const n = new Date(), season = Date.UTC(n.getUTCFullYear() - (n.getUTCMonth() < 6 ? 1 : 0), 6, 1);   // la temporada empieza el 1 de julio, como en la app
    const [totals, stations, days, pos, stk, lg, following, followers, sessions, seasonDays] = await Promise.all([agg(u.id), stationsDistinct(u.id), all('SELECT id,station,ts,desnivel,km,horas,bajadas,vmax,freeride FROM days WHERE uid=? ORDER BY ts DESC LIMIT 30', [u.id]),
      posOf(u.id, 'desnivel', null, 'temporada'), streak(u.id), league(u.id), count('SELECT COUNT(*) n FROM follows WHERE a=?', [u.id]), count('SELECT COUNT(*) n FROM follows WHERE b=?', [u.id]), count('SELECT COUNT(*) n FROM tokens WHERE uid=? AND exp>?', [u.id, Date.now()]),
      count(`SELECT COUNT(*) n FROM days WHERE uid=? AND ts>=? AND ${SRC}`, [u.id, season])]);
    send(res, 200, { user: clean(u), totals, stations, days, pos: (pos || {}).pos || 0, streak: stk, league: lg, following, followers, sessions, seasonDays, social: await socialOf(u.id) });
  },
  'POST /api/me': async ({ req, res, u, b }) => {
    const updates = [], params = [], audited = [];
    if (b.alias !== undefined) { const a = text(b.alias, 24); if (a.length < 2) return send(res, 400, { error: 'El nombre debe tener al menos 2 caracteres.' }); if (offensive(a)) return send(res, 400, { error: 'Ese nombre no está permitido. Elige otro.' }); updates.push('alias=?'); params.push(a); audited.push('alias'); }
    if (b.age !== undefined) {
      if (b.age === null || b.age === '') updates.push('age=NULL');
      else { const age = parseInt(b.age, 10); if (!Number.isFinite(age) || age < 14 || age > 120) return send(res, 400, { error: 'La edad debe estar entre 14 y 120 años (art. 7 LOPDGDD 3/2018).' }); updates.push('age=?'); params.push(age); }
      audited.push('age');
    }
    if (b.bio !== undefined) { const bio = text(b.bio, 200); if (offensive(bio)) return send(res, 400, { error: 'La biografía tiene palabras que no están permitidas.' }); updates.push('bio=?'); params.push(bio); audited.push('bio'); }
    if (b.station_home !== undefined) { const sh = b.station_home ? str(b.station_home, 40) : null; if (sh && !SID.has(sh)) return send(res, 400, { error: 'Estación habitual no válida.' }); updates.push('station_home=?'); params.push(sh); audited.push('station_home'); }
    if (b.modality !== undefined) { const m = str(b.modality, 20); if (!['ski', 'snowboard', 'ambos'].includes(m)) return send(res, 400, { error: 'Modalidad no válida.' }); updates.push('modality=?'); params.push(m); audited.push('modality'); }
    if (b.level !== undefined) { const l = str(b.level, 20); if (!['debutante', 'intermedio', 'avanzado', 'experto'].includes(l)) return send(res, 400, { error: 'Nivel no válido.' }); updates.push('level=?'); params.push(l); audited.push('level'); }
    if (b.handle !== undefined) {
      const h = handleOf(b.handle);
      if (!h) updates.push('handle=NULL');
      else { const bad = badHandle(h); if (bad) return send(res, 400, { error: bad }); updates.push('handle=?'); params.push(h); }
      audited.push('handle');
    }
    if (b.since !== undefined) {
      if (b.since === null || b.since === '') updates.push('since=NULL');
      else { const y = parseInt(b.since, 10); if (!Number.isFinite(y) || y < 1940 || y > new Date().getFullYear()) return send(res, 400, { error: 'Año en el que empezaste a esquiar no válido.' }); updates.push('since=?'); params.push(y); }
      audited.push('since');
    }
    if (b.terrain !== undefined) { if (!Array.isArray(b.terrain) || b.terrain.some(x => !TERRAIN.includes(x))) return send(res, 400, { error: 'Terreno no válido.' }); updates.push('terrain=?'); params.push(JSON.stringify([...new Set(b.terrain)])); audited.push('terrain'); }
    if (b.wish !== undefined) { if (!Array.isArray(b.wish) || b.wish.length > 12 || b.wish.some(x => !SID.has(x))) return send(res, 400, { error: 'Elige hasta 12 estaciones de la lista.' }); updates.push('wish=?'); params.push(JSON.stringify([...new Set(b.wish)])); audited.push('wish'); }
    if (b.goal_days !== undefined) {
      if (b.goal_days === null || b.goal_days === '') updates.push('goal_days=NULL');
      else { const g = parseInt(b.goal_days, 10); if (!Number.isFinite(g) || g < 1 || g > 150) return send(res, 400, { error: 'El reto de temporada va de 1 a 150 días.' }); updates.push('goal_days=?'); params.push(g); }
      audited.push('goal_days');
    }
    for (const k of ['gear', 'club']) if (b[k] !== undefined) { const v = text(b[k], 60); if (offensive(v)) return send(res, 400, { error: k === 'gear' ? 'El equipo tiene palabras que no están permitidas.' : 'El club tiene palabras que no están permitidas.' }); updates.push(k + '=?'); params.push(v); audited.push(k); }
    if (b.approve !== undefined) { if (typeof b.approve !== 'boolean') return send(res, 400, { error: 'Valor no válido.' }); updates.push('approve=?'); params.push(b.approve ? 1 : 0); audited.push('approve'); }
    {   // quién ve los días; un menor de 18 (por la edad que haya dado) no puede enseñarlos a todos
      const ageNow = b.age !== undefined ? (b.age === null || b.age === '' ? null : parseInt(b.age, 10)) : u.age, minor = Number.isFinite(ageNow) && ageNow < 18;
      if (b.vis !== undefined) {
        if (!VIS.includes(b.vis)) return send(res, 400, { error: 'Valor no válido.' });
        if (b.vis === 'todos' && minor) return send(res, 400, { error: 'Con menos de 18 años, tus días solo los pueden ver tus seguidores.' });
        updates.push('vis=?'); params.push(b.vis); audited.push('vis');
      } else if (minor && visOf(u) === 'todos') { updates.push('vis=?'); params.push('seguidores'); audited.push('vis'); }
    }
    if (b.onboarded === true) updates.push('onboarded=1');
    if (!updates.length) return send(res, 400, { error: 'No hay campos que actualizar.' });
    updates.push('updated_at=?'); params.push(Date.now(), u.id);
    try { await run(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, params); }   // los nombres de columna son fijos; los valores van como parámetros
    catch (err) { if (/UNIQUE/i.test(err.message)) return send(res, 409, { error: 'Ese @usuario ya lo tiene otra persona. Prueba con otro.' }); throw err; }
    // Quien deja de aprobar seguidores acepta de golpe las solicitudes que tenía pendientes (como hace Instagram al pasar a pública)
    if (b.approve === false) {
      const pend = (await all(`SELECT r.a id FROM follow_requests r JOIN users x ON x.id=r.a WHERE r.b=? AND ${pubCond('x.')}`, [u.id])).map(r => r.id), now = Date.now();
      await atomic([...pend.map(id => ['INSERT OR IGNORE INTO follows(a,b,ts) VALUES(?,?,?)', [id, u.id, now]]), ['DELETE FROM follow_requests WHERE b=?', [u.id]]]);
      for (const id of pend) await notify(id, 'accepted', u.id);
    }
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
      pasaporte_de_pistas: await all('SELECT day dia, station estacion, piste pista, c color, n bajadas, m metros, vmax velocidad_max_kmh, ts FROM passes WHERE uid=? ORDER BY ts ASC', [u.id]),
      siguiendo: (await all('SELECT u.alias alias FROM follows f JOIN users u ON u.id=f.b WHERE f.a=?', [u.id])).map(r => r.alias),
      seguidores: (await all('SELECT u.alias alias FROM follows f JOIN users u ON u.id=f.a WHERE f.b=?', [u.id])).map(r => r.alias),
      solicitudes_de_seguimiento_pendientes: (await all('SELECT u.alias alias FROM follow_requests r JOIN users u ON u.id=r.b WHERE r.a=?', [u.id])).map(r => r.alias),
      sesiones_abiertas: await all('SELECT created, exp, ua FROM tokens WHERE uid=? AND exp>?', [u.id, Date.now()]),
      registro_de_seguridad: await all('SELECT action, ip, ua, ts FROM audit_logs WHERE uid=? ORDER BY ts ASC', [u.id]) };
    await audit(u.id, 'DATA_EXPORT', req);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="pistea-mis-datos-${Date.now()}.json"`, 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data, null, 2));
  },
  'DELETE /api/me': async ({ req, res, u, b }) => {   // derecho de supresión (art. 17 RGPD): se borra todo, sin depender de ON DELETE CASCADE
    if (await limited('del:' + u.id, 10, HOUR)) return send(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
    if (!(await checkPw(str(b.password, 200), u))) return send(res, 403, { error: 'Contraseña incorrecta.' });
    await atomic([['DELETE FROM kudos WHERE uid=? OR day IN (SELECT id FROM days WHERE uid=?)', [u.id, u.id]], ['DELETE FROM follows WHERE a=? OR b=?', [u.id, u.id]], ['DELETE FROM follow_requests WHERE a=? OR b=?', [u.id, u.id]], ['DELETE FROM notifs WHERE uid=? OR actor=?', [u.id, u.id]], ['DELETE FROM blocks WHERE a=? OR b=?', [u.id, u.id]], ['DELETE FROM reports WHERE reporter=? OR target=?', [u.id, u.id]],
      ['DELETE FROM passes WHERE uid=?', [u.id]], ['DELETE FROM days WHERE uid=?', [u.id]], ['DELETE FROM tokens WHERE uid=?', [u.id]], ['DELETE FROM resets WHERE uid=?', [u.id]], ['DELETE FROM verifs WHERE uid=?', [u.id]], ['DELETE FROM avatars WHERE uid=?', [u.id]],
      ['DELETE FROM audit_logs WHERE uid=?', [u.id]], ['DELETE FROM users WHERE id=?', [u.id]]]);
    fresh(); await audit(u.id, 'ACCOUNT_DELETION', req);   // solo queda constancia del borrado, sin datos personales
    clearSession(req, res); send(res, 200, { ok: true });
  },
  'GET /api/rank': async ({ res, u, q }) => {
    const metric = MX[q.get('metric')] ? q.get('metric') : 'desnivel', period = WIN[q.get('period')] ? q.get('period') : 'temporada', st = SID.has(q.get('station')) ? q.get('station') : null;
    const [rows, me] = await Promise.all([rankRows(metric, st, period, 10, u.id), posOf(u.id, metric, st, period)]);
    send(res, 200, { rows: rows.map((x, k) => ({ pos: k + 1, alias: x.alias, avatar: safeAvatar(x.avatar), v: x.v, me: x.uid === u.id })), me: me && { pos: me.pos, v: me.v }, gap: me ? me.gap : 0, total: me ? me.total : rows.length });
  },
  // Pasaporte: por estación, las pistas de su ficha que ha bajado [pista, color, bajadas, primera vez, máx. km/h]; sus coronas
  // de la temporada (pistas en las que es el más rápido, o el que más veces la ha bajado, con al menos 2) y su puesto entre
  // coleccionistas (pistas distintas)
  'GET /api/passport': async ({ res, u }) => {
    const rows = await all('SELECT station s, piste p, c, SUM(n) n, MIN(ts) t, MAX(vmax) v FROM passes WHERE uid=? GROUP BY station, piste', [u.id]);
    const out = {};
    for (const r of rows) {
      const [id, k] = canon(r.s, r.p), L = out[id] || (out[id] = {}), o = L[k];
      L[k] = o ? [k, o[1], o[2] + r.n, Math.min(o[3], r.t), Math.max(o[4], r.v || 0)] : [k, r.c, r.n, r.t, r.v || 0];
    }
    const stations = Object.fromEntries(Object.entries(out).map(([id, L]) => [id, Object.values(L).map(x => [x[0], x[1], x[2], x[3], Math.round(x[4])])]));
    const crowns = { v: [], n: [] }, sts = [...new Set(rows.map(r => r.s).flatMap(stationsFor))];
    if (sts.length && isPub(u)) {
      const per = await groupedPasses(sts, u.id);
      for (const [key, us] of per) {
        const [id, k] = key.split('\u0001'), L = [...us.values()], bv = L.filter(x => x.v > 0).sort((a, b) => b.v - a.v || a.t - b.t)[0], bn = L.sort((a, b) => b.n - a.n || a.t - b.t)[0];
        if (bv && bv.uid === u.id) crowns.v.push([id, k, Math.round(bv.v)]);
        if (bn && bn.uid === u.id && bn.n >= 2) crowns.n.push([id, k, bn.n]);
      }
    }
    // Puesto entre coleccionistas: lo de los demás (cuentas públicas) se guarda un minuto; lo propio, al momento
    if (!COLL.v || Date.now() - COLL.t > MIN) COLL.v = (await all(`SELECT uid, COUNT(DISTINCT station||'|'||piste) v FROM passes WHERE ${listedUid('uid')} GROUP BY uid`)), COLL.t = Date.now();
    const mineN = rows.length, others = COLL.v.filter(r => r.uid !== u.id);
    send(res, 200, { stations, crowns, rank: mineN ? { pos: others.filter(r => r.v > mineN).length + 1, total: others.length + 1 } : null });
  },
  // Una pista: sus clasificaciones de la temporada (velocidad máxima y bajadas) y lo mío en ella
  'GET /api/piste': async ({ res, u, q }) => {
    const id = q.get('station'), name = text(q.get('name'), 80);
    if (!SID.has(id) || !name) return send(res, 400, { error: 'Pista no válida.' });
    const per = (await groupedPasses(stationsFor(id), u.id, [name, `${name} (${SNAME[id]})`])).get(id + '\u0001' + name) || new Map();
    const L = [...per.values()], by = k => L.filter(x => x[k] > 0).sort((a, b) => b[k] - a[k] || a.t - b.t);
    const sp = by('v'), rn = by('n'), me = per.get(u.id), row = k => (x, i) => ({ pos: i + 1, alias: x.alias, avatar: safeAvatar(x.avatar), v: k === 'v' ? Math.round(x.v) : x.n, me: x.uid === u.id });
    const mine = (await all(`SELECT station s, piste p, SUM(n) n, MIN(ts) t, MAX(vmax) v FROM passes WHERE uid=? AND station IN (${stationsFor(id).map(() => '?').join(',')}) AND piste IN (?,?) GROUP BY station, piste`,
      [u.id, ...stationsFor(id), name, `${name} (${SNAME[id]})`])).filter(r => canon(r.s, r.p).join('\u0001') === id + '\u0001' + name);
    const L2 = pisteList(id);
    send(res, 200, { station: id, name, c: (L2 && L2.get(name)) || null, skiers: L.length, speed: sp.slice(0, 10).map(row('v')), runs: rn.slice(0, 10).map(row('n')),
      me: { posV: me && me.v > 0 ? sp.indexOf(me) + 1 : 0, posN: me ? rn.indexOf(me) + 1 : 0, v: me ? Math.round(me.v) : 0, n: me ? me.n : 0 },
      mine: mine.length ? { n: mine.reduce((a, r) => a + r.n, 0), t: Math.min(...mine.map(r => r.t)), v: Math.round(Math.max(...mine.map(r => r.v || 0))) } : null });
  },
  // Los récords de una estación: por pista, el más rápido y el que más la ha bajado esta temporada, y lo mío
  'GET /api/records': async ({ res, u, q }) => {
    const id = q.get('station'); if (!SID.has(id)) return send(res, 400, { error: 'Estación no válida.' });
    const per = await groupedPasses(stationsFor(id), u.id), L = pisteList(id), out = [];
    for (const [key, us] of per) {
      const [s, k] = key.split('\u0001'); if (s !== id) continue;
      const A = [...us.values()], bv = A.filter(x => x.v > 0).sort((a, b) => b.v - a.v || a.t - b.t)[0], bn = A.slice().sort((a, b) => b.n - a.n || a.t - b.t)[0], me = us.get(u.id);
      out.push({ name: k, c: (L && L.get(k)) || A[0].c, skiers: A.length, v: bv ? { alias: bv.alias, v: Math.round(bv.v), me: bv.uid === u.id } : null,
        n: { alias: bn.alias, n: bn.n, me: bn.uid === u.id }, mine: me ? { v: Math.round(me.v), n: me.n } : null });
    }
    send(res, 200, out.sort((a, b) => (b.v ? b.v.v : 0) - (a.v ? a.v.v : 0) || a.name.localeCompare(b.name, 'es')));
  },
  // Pistea Wrapped: la temporada (desde el 1 de julio) contada en cifras, con su pista favorita, la más rápida y el puesto
  'GET /api/wrapped': async ({ res, u }) => {
    const since = seasonStart();
    const days = await all(`SELECT id, station, ts, desnivel, km, horas, bajadas, vmax, freeride, detail FROM days WHERE uid=? AND ts>=? AND ${SRC} ORDER BY ts`, [u.id, since]);
    if (!days.length) return send(res, 200, { empty: true, since });
    const sum = k => days.reduce((a, d) => a + (+d[k] || 0), 0), m = { v: 0, a: 0, r: 0, n: 0, f: 0 }, byStation = {}, months = {};
    let best = days[0], fast = days[0];
    for (const d of days) {
      const D = J(d.detail, null); if (D && D.m) for (const k in m) m[k] += +D.m[k] || 0;
      byStation[d.station] = (byStation[d.station] || 0) + 1; const mo = new Date(d.ts).getUTCMonth(); months[mo] = (months[mo] || 0) + 1;
      if (d.desnivel > best.desnivel) best = d; if (d.vmax > fast.vmax) fast = d;
    }
    const top = Object.entries(byStation).sort((a, b) => b[1] - a[1])[0];
    const P = new Map();
    for (const r of await all('SELECT station s, piste p, c, SUM(n) n, MAX(vmax) v FROM passes WHERE uid=? AND ts>=? GROUP BY station, piste', [u.id, since])) {
      const [s, k] = canon(r.s, r.p), key = s + '\u0001' + k, o = P.get(key);
      if (o) { o.n += r.n; o.v = Math.max(o.v, r.v || 0); } else P.set(key, { s, p: k, c: r.c, n: r.n, v: r.v || 0 });
    }
    const PL = [...P.values()], fav = PL.slice().sort((a, b) => b.n - a.n)[0] || null, fastP = PL.filter(x => x.v > 0).sort((a, b) => b.v - a.v)[0] || null;
    let fastRank = null;
    if (fastP) {
      const per = (await groupedPasses(stationsFor(fastP.s), u.id, [fastP.p, `${fastP.p} (${SNAME[fastP.s]})`])).get(fastP.s + '\u0001' + fastP.p);
      const vs = per ? [...per.values()].map(x => x.v) : [], mine = per && per.get(u.id) ? per.get(u.id).v : 0;
      fastRank = { pos: vs.filter(v => v > mine).length + 1, total: vs.filter(v => v > 0).length };
    }
    const pos = await posOf(u.id, 'desnivel', null, 'temporada');
    send(res, 200, { since, alias: u.alias, dias: days.length, desnivel: sum('desnivel'), km: sum('km'), horas: sum('horas'), bajadas: sum('bajadas'), freeride: sum('freeride'),
      vmax: fast.vmax, vmaxAt: { station: fast.station, ts: fast.ts }, m, stations: Object.keys(byStation).length, top: { station: top[0], dias: top[1] },
      best: { station: best.station, ts: best.ts, desnivel: best.desnivel, km: best.km, bajadas: best.bajadas }, months, pistes: PL.length,
      fav: fav && { station: fav.s, name: fav.p, c: fav.c, n: fav.n }, fast: fastP && { station: fastP.s, name: fastP.p, c: fastP.c, v: Math.round(fastP.v), ...fastRank },
      pos: pos ? { pos: pos.pos, total: pos.total } : null, first: days[0].ts, last: days[days.length - 1].ts });
  },
  'GET /api/stations': async ({ res, u }) => {
    if (Date.now() - stationsCache.t > MIN || !stationsCache.v) {
      const cnt = Object.fromEntries((await all(`SELECT station s, COUNT(DISTINCT uid) n FROM days WHERE ts>=? AND ${SRC} AND ${listedUid('uid')} GROUP BY station`, [Date.now() - WIN.temporada])).map(r => [r.s, r.n]));
      const out = {};
      await Promise.all(STATIONS.map(async ([id]) => { out[id] = { skiers: cnt[id] || 0, leaders: cnt[id] ? (await rankRows('desnivel', id, 'temporada', 4)).map(x => ({ uid: x.uid, alias: x.alias, v: x.v })) : [] }; }));
      stationsCache = { t: Date.now(), v: out };
    }
    const blk = new Set((await all('SELECT b x FROM blocks WHERE a=? UNION SELECT a x FROM blocks WHERE b=?', [u.id, u.id])).map(r => r.x));
    send(res, 200, Object.fromEntries(Object.entries(stationsCache.v).map(([id, o]) => [id, { skiers: o.skiers, leaders: o.leaders.filter(x => !blk.has(x.uid)).slice(0, 3).map(x => ({ alias: x.alias, v: x.v })) }])));
  },
  'GET /api/feed': async ({ res, u, q }) => {
    const onlyF = q.get('scope') === 'amigos' ? 1 : 0;
    const rows = await all(`SELECT d.id id, d.uid uid, d.station station, d.ts ts, d.desnivel desnivel, d.km km, d.bajadas bajadas, d.vmax vmax, d.freeride freeride, d.track track, u.alias alias, u.avatar avatar,
      (SELECT COUNT(*) FROM kudos k WHERE k.day=d.id) kudos, EXISTS(SELECT 1 FROM kudos k WHERE k.day=d.id AND k.uid=?) liked
      FROM days d JOIN users u ON u.id=d.uid WHERE ${SRC_D} AND (${pubU()} OR d.uid=?) AND ${notBlocked('d.uid')} AND ${daysVisible('u.', 'd.uid')} AND (?=0 OR d.uid=? OR d.uid IN (SELECT b FROM follows WHERE a=?)) ORDER BY d.ts DESC LIMIT 15`, [u.id, u.id, u.id, u.id, u.id, u.id, onlyF, u.id, u.id]);
    send(res, 200, rows.map(d => ({ ...d, avatar: safeAvatar(d.avatar), track: d.uid === u.id ? J(d.track) : trimTrack(J(d.track), d.station), liked: !!d.liked })));
  },
  'POST /api/days': async ({ res, u, b }) => {
    const c = b.col && typeof b.col === 'object' ? b.col : {}, src = b.source === 'sim' ? 'sim' : 'gps';
    if (src === 'sim' && !ALLOW_SIM) return send(res, 403, { error: 'La simulación está desactivada en producción.' });
    if (!SID.has(b.station)) return send(res, 400, { error: 'Estación no válida.' });
    // Los límites, antes de recalcular la traza (es lo caro): 5 días guardados cada 24 h y 30 intentos por hora
    if ((await count('SELECT COUNT(*) n FROM days WHERE uid=? AND ts>?', [u.id, Date.now() - DAY])) >= 5) return send(res, 429, { error: 'Máximo 5 días guardados cada 24 horas.' });
    if (await limited('dy:' + u.id, 30, HOUR)) return send(res, 429, { error: 'Demasiados intentos de guardar. Inténtalo dentro de un rato.' });
    let t0 = null, t1 = null;
    if (src === 'gps') {
      // Repetido: se mira con las horas de la traza antes de recalcularla (decodificar es barato; el motor, no)
      let fx = null; try { fx = decodeTrace(b.trace); } catch {}
      if (fx && fx.length && await one('SELECT 1 x FROM days WHERE uid=? AND t1>? AND t0<?', [u.id, fx[0].t, fx[fx.length - 1].t])) return send(res, 409, { error: 'Ese día ya está guardado.' });
      const v = checkTrace(b.trace, b.station); if (v.error) return send(res, 400, { error: v.error });
      Object.assign(b, v.p, { total: (v.t1 - v.t0) / HOUR }); t0 = v.t0; t1 = v.t1;   // lo que mande el móvil se sustituye por lo calculado aquí
      b.track = trimTrack(b.track, b.station);   // sin el camino desde el alojamiento ni lo de fuera de la estación
    }
    // Con GPS, el recorrido y el desglose son los del motor aquí (de fiar); en la simulación (solo en desarrollo), lo que mande
    const gps = src === 'gps';
    const d = { id: rid(), uid: u.id, station: b.station, ts: t1 || Date.now(), t0, t1, desnivel: num(b.desnivel, 40000), km: num(b.km, 300), horas: num(b.horas, 14), bajadas: Math.round(num(b.bajadas, 200)), vmax: num(b.vmax, 140), vmed: num(b.vmed, 100), total: num(b.total, 24), src,
      col: { v: num(c.v, 200) | 0, a: num(c.a, 200) | 0, r: num(c.r, 200) | 0, n: num(c.n, 200) | 0, f: num(c.f, 200) | 0 }, freeride: num(b.freeride, 300),
      track: gps ? b.track : (Array.isArray(b.track) ? b.track : []).slice(0, 60).map(p => Array.isArray(p) ? [num(p[0], 1e5), num(p[1], 1e5)] : [0, 0]), speed: (Array.isArray(b.speed) ? b.speed : []).slice(0, 400).map(v => num(v, 140)),
      detail: gps ? b.detail : null };
    if (d.bajadas > 0 && d.desnivel / d.bajadas > 1500) return send(res, 400, { error: 'Datos incoherentes: demasiado desnivel por bajada.' });
    if (d.horas > 0 && d.km / d.horas > 90) return send(res, 400, { error: 'Datos incoherentes: velocidad media imposible.' });
    const [before, nov] = await Promise.all([posOf(u.id, 'desnivel', null, 'temporada'), gps ? novelties(u, d.station, d.detail) : null]);
    // El día y sus pistas (pasaporte y récords), juntos o nada
    await atomic([['INSERT INTO days(id,uid,station,ts,desnivel,km,horas,bajadas,vmax,vmed,col,track,speed,src,total,t0,t1,freeride,detail) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.id, d.uid, d.station, d.ts, d.desnivel, d.km, d.horas, d.bajadas, d.vmax, d.vmed, JSON.stringify(d.col), JSON.stringify(d.track), JSON.stringify(d.speed), d.src, d.total || null, t0, t1, d.freeride, d.detail ? JSON.stringify(d.detail) : null]],
      ...(gps ? passRows(d, d.detail) : [])]);
    fresh();
    const [after, ps] = await Promise.all([posOf(u.id, 'desnivel', null, 'temporada'), posOf(u.id, 'desnivel', d.station, 'temporada')]);
    send(res, 200, { day: d, before: (before || {}).pos || 0, after: (after || {}).pos || 0, posStation: (ps || {}).pos || 0, nov });
  },
  'GET /api/day': async ({ res, u, q }) => {   // un día con todo su desglose: el propio o el de alguien visible
    const d = await one(`SELECT d.*, u.alias alias, u.verified verified, u.hidden hidden, u.banned banned, u.vis vis FROM days d JOIN users u ON u.id=d.uid WHERE d.id=?`, [str(q.get('id'), 40)]);
    const me = !!d && d.uid === u.id;
    if (!d || (!me && ((VERIFY && d.verified === 0) || d.hidden || d.banned || await blockedEither(u.id, d.uid) || !(await canSeeDays(u.id, { id: d.uid, vis: d.vis }))))) return send(res, 404, { error: 'Ese día no existe.' });
    // A los demás, sin la hora de cada bajada ni de cada remonte, y con el recorrido recortado a la estación
    let detail = J(d.detail, null);
    if (!me && detail) detail = { ...detail, runs: (detail.runs || []).map(r => [null, null, ...r.slice(2)]), rides: (detail.rides || []).map(r => [r[0], null, null, ...r.slice(3)]) };
    send(res, 200, { id: d.id, uid: d.uid, alias: d.alias, station: d.station, ts: d.ts, t0: me ? d.t0 : null, t1: me ? d.t1 : null, desnivel: d.desnivel, km: d.km, horas: d.horas, bajadas: d.bajadas, vmax: d.vmax, vmed: d.vmed, total: d.total,
      freeride: d.freeride || 0, col: J(d.col, {}), track: me ? J(d.track) : trimTrack(J(d.track), d.station), speed: J(d.speed), detail, me });
  },
  'GET /api/handle': async ({ res, u, q }) => {   // ¿está libre este @usuario? Si no, propone uno parecido que sí lo esté
    if (await limited('hd:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const h = handleOf(q.get('h')), bad = badHandle(h), taken = async x => !!(await one('SELECT 1 x FROM users WHERE handle=? AND id!=?', [x, u.id]));
    if (!bad && !(await taken(h))) return send(res, 200, { ok: true, handle: h });
    const base = h.replace(/[^a-z0-9._]/g, '').replace(/[._]{2,}/g, '.').replace(/^[._]+|[._]+$/g, '').slice(0, 16) || 'esquiador';
    let suggest = null;
    for (const n of [base, ...Array.from({ length: 6 }, () => base + (10 + Math.floor(Math.random() * 990)))]) if (!badHandle(n) && !(await taken(n))) { suggest = n; break; }
    send(res, 200, { ok: false, error: bad || 'Ese @usuario ya lo tiene otra persona.', suggest });
  },
  'GET /api/users': async ({ res, u, q }) => {
    const s = str(q.get('q'), 40).trim().toLowerCase().replace(/^@/, '').replace(/[%_\\]/g, '');
    if (s.length < 2) return send(res, 200, []);
    const rows = await all(`SELECT x.id id, x.alias alias, x.avatar avatar, x.handle handle, x.level level, x.station_home home, x.approve approve, ${REL} FROM users x WHERE x.id!=? AND ${pubCond('x.')} AND ${notBlocked('x.id')} AND (lower(x.alias) LIKE ? OR x.handle LIKE ?) ORDER BY x.alias LIMIT 10`, [u.id, u.id, u.id, u.id, u.id, u.id, `%${s}%`, `${s}%`]);
    send(res, 200, rows.map(r => ({ ...person(r), following: !!r.iFollow })));   // «following» se mantiene por compatibilidad
  },
  // Sugerencias: quien te sigue y tú no, amigos de tus amigos y gente de tu estación de casa (sin bloqueos ni cuentas ocultas)
  'GET /api/suggest': async ({ res, u }) => {
    const [back, fof, home] = await Promise.all([
      all('SELECT a id FROM follows WHERE b=? ORDER BY COALESCE(ts,0) DESC LIMIT 30', [u.id]),
      all('SELECT f2.b id, COUNT(*) n FROM follows f1 JOIN follows f2 ON f2.a=f1.b WHERE f1.a=? AND f2.b!=? GROUP BY f2.b ORDER BY n DESC LIMIT 30', [u.id, u.id]),
      u.station_home ? all('SELECT id FROM users WHERE station_home=? AND id!=? AND (age IS NULL OR age>=18) ORDER BY (SELECT COUNT(*) FROM days WHERE uid=users.id) DESC LIMIT 30', [u.station_home, u.id]) : []]);
    const why = new Map(), add = (id, score, txt) => { const w = why.get(id) || { score: 0, txt: [] }; w.score += score; if (txt) w.txt.push(txt); why.set(id, w); };
    back.forEach(r => add(r.id, 100, 'Te sigue'));
    fof.forEach(r => add(r.id, 10 * r.n, `${r.n} ${r.n === 1 ? 'amigo' : 'amigos'} en común`));
    home.forEach(r => add(r.id, 1, 'Esquía en tu estación'));
    const ids = [...why.keys()]; if (!ids.length) return send(res, 200, []);
    const rows = await all(`SELECT x.id id, x.alias alias, x.avatar avatar, x.handle handle, x.level level, x.station_home home, x.approve approve, ${REL} FROM users x WHERE x.id IN (${ids.map(() => '?').join(',')}) AND ${pubCond('x.')} AND ${notBlocked('x.id')}`, [u.id, u.id, u.id, ...ids, u.id, u.id]);
    const asked = new Set((await all('SELECT a FROM follow_requests WHERE b=?', [u.id])).map(r => r.a));   // quien ya te ha pedido seguirte está en tus solicitudes
    send(res, 200, rows.filter(r => !r.iFollow && !r.requested && !asked.has(r.id)).map(r => ({ ...person(r), why: why.get(r.id).txt.slice(0, 2).join(' · '), score: why.get(r.id).score })).sort((a, b) => b.score - a.score).slice(0, 12).map(({ score, ...p }) => p));
  },
  // Listas de seguidores y de seguidos. La propia, siempre; la de otra persona, si su cuenta es visible y, cuando aprueba a sus seguidores, solo a quien ya la sigue
  'GET /api/connections': async ({ res, u, q }) => {
    const id = str(q.get('id'), 40) || u.id, kind = q.get('kind') === 'following' ? 'following' : 'followers', mine = id === u.id;
    const t = mine ? u : await one(`SELECT id, approve FROM users WHERE id=? AND ${pubCond('')}`, [id]);
    if (!t || (!mine && await blockedEither(u.id, id))) return send(res, 404, { error: 'No existe.' });
    if (!mine && t.approve && !(await one('SELECT 1 x FROM follows WHERE a=? AND b=?', [u.id, id]))) return send(res, 403, { error: 'Esta cuenta aprueba a sus seguidores. Síguela para ver con quién esquía.' });
    const [who, owner] = kind === 'followers' ? ['a', 'b'] : ['b', 'a'];
    const s = str(q.get('q'), 40).trim().toLowerCase().replace(/^@/, '').replace(/[%_\\]/g, ''), off = Math.max(0, Math.min(5000, parseInt(q.get('offset'), 10) || 0));
    const from = `FROM follows f JOIN users x ON x.id=f.${who} WHERE f.${owner}=? AND ${pubCond('x.')} AND ${notBlocked('x.id')}${s ? ' AND (lower(x.alias) LIKE ? OR x.handle LIKE ?)' : ''}`, wa = [id, u.id, u.id, ...(s ? [`%${s}%`, `${s}%`] : [])];
    const [rows, total] = await Promise.all([
      all(`SELECT x.id id, x.alias alias, x.avatar avatar, x.handle handle, x.level level, x.station_home home, x.approve approve, f.ts ts, ${REL} ${from} ORDER BY COALESCE(f.ts,0) DESC, x.alias LIMIT 41 OFFSET ?`, [u.id, u.id, u.id, ...wa, off]),
      count(`SELECT COUNT(*) n ${from}`, wa)]);
    send(res, 200, { kind, mine, total, more: rows.length > 40, items: rows.slice(0, 40).map(r => ({ ...person(r), me: r.id === u.id })) });
  },
  'GET /api/requests': async ({ res, u }) => send(res, 200, (await all(`SELECT x.id id, x.alias alias, x.avatar avatar, x.handle handle, x.level level, x.station_home home, x.approve approve, r.ts ts, ${REL} FROM follow_requests r JOIN users x ON x.id=r.a WHERE r.b=? AND ${pubCond('x.')} AND ${notBlocked('x.id')} ORDER BY r.ts DESC LIMIT 100`, [u.id, u.id, u.id, u.id, u.id, u.id])).map(person)),
  // Contestar solicitudes: una (id) o todas (all). Al aceptar, quien pidió empieza a seguirte y recibe un aviso; al rechazar no se le dice nada
  'POST /api/requests': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const accept = b.accept === true, all_ = b.all === true, ids = all_ ? (await all('SELECT a FROM follow_requests WHERE b=? ORDER BY ts DESC LIMIT 200', [u.id])).map(r => r.a) : [str(b.id, 40)];
    let n = 0;
    for (const id of ids) {
      if (!(await one('SELECT 1 x FROM follow_requests WHERE a=? AND b=?', [id, u.id]))) { if (all_) continue; return send(res, 404, { error: 'Esa solicitud ya no existe.' }); }
      const ok = accept && !!(await one(`SELECT 1 x FROM users WHERE id=? AND ${pubCond('')}`, [id])) && !(await blockedEither(u.id, id));
      if (ok) { await atomic([['INSERT OR IGNORE INTO follows(a,b,ts) VALUES(?,?,?)', [id, u.id, Date.now()]], ['DELETE FROM follow_requests WHERE a=? AND b=?', [id, u.id]]]); await notify(id, 'accepted', u.id); n++; }
      else { await run('DELETE FROM follow_requests WHERE a=? AND b=?', [id, u.id]); if (accept && !all_) return send(res, 404, { error: 'Esa persona ya no está disponible.' }); if (!accept) n++; }
    }
    send(res, 200, { ok: true, n, ...(await socialOf(u.id)), followers: await count('SELECT COUNT(*) n FROM follows WHERE b=?', [u.id]) });
  },
  // Quitar a un seguidor sin bloquearlo (no se le avisa; puede volver a pedir seguirte)
  'POST /api/followers/remove': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const id = str(b.id, 40), had = (await run('DELETE FROM follows WHERE a=? AND b=?', [id, u.id])).rowsAffected;
    if (!had) return send(res, 404, { error: 'Esa persona no te sigue.' });
    await unnotify(u.id, 'follow', id);
    send(res, 200, { ok: true, followers: await count('SELECT COUNT(*) n FROM follows WHERE b=?', [u.id]) });
  },
  'GET /api/social': async ({ res, u }) => send(res, 200, await socialOf(u.id)),
  'GET /api/activity': async ({ res, u }) => {
    await run('DELETE FROM notifs WHERE uid=? AND ts<?', [u.id, Date.now() - 60 * DAY]);
    const seen = u.notif_seen || 0;
    const rows = await all(`SELECT n.id nid, n.kind kind, n.ts nts, n.day day, d.station station, x.id id, x.alias alias, x.avatar avatar, x.handle handle, x.level level, x.station_home home, x.approve approve, ${REL} FROM notifs n JOIN users x ON x.id=n.actor LEFT JOIN days d ON d.id=n.day WHERE n.uid=? AND ${pubCond('x.')} AND ${notBlocked('x.id')} ORDER BY n.ts DESC LIMIT 60`, [u.id, u.id, u.id, u.id, u.id, u.id]);
    send(res, 200, { items: rows.map(r => ({ ...person({ ...r, ts: r.nts }), kind: r.kind, day: r.day || null, station: r.station || null, fresh: r.nts > seen })), ...(await socialOf(u.id)) });
  },
  'POST /api/activity/seen': async ({ res, u }) => { await run('UPDATE users SET notif_seen=? WHERE id=?', [Date.now(), u.id]); send(res, 200, { ok: true, ...(await socialOf(u.id)) }); },
  'POST /api/follow': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const id = str(b.id, 40);
    // Dejar de seguir y cancelar una solicitud pendiente valen siempre; el mismo botón hace las tres cosas
    if ((await run('DELETE FROM follows WHERE a=? AND b=?', [u.id, id])).rowsAffected) { await unnotify(id, 'follow', u.id); return send(res, 200, { following: false, requested: false }); }
    if ((await run('DELETE FROM follow_requests WHERE a=? AND b=?', [u.id, id])).rowsAffected) return send(res, 200, { following: false, requested: false });
    // Empezar a seguir: solo a cuentas visibles y sin bloqueos. Si la cuenta aprueba a sus seguidores, se queda como solicitud
    const t = id !== u.id && await one(`SELECT approve FROM users WHERE id=? AND ${pubCond('')}`, [id]);
    if (!t || await blockedEither(u.id, id)) return send(res, 400, { error: 'Usuario no válido.' });
    if (await limited('fw:' + u.id, 60, HOUR)) return send(res, 429, { error: 'Has seguido a mucha gente en poco tiempo. Inténtalo dentro de un rato.' });
    if (t.approve) { await run('INSERT OR IGNORE INTO follow_requests(a,b,ts) VALUES(?,?,?)', [u.id, id, Date.now()]); return send(res, 200, { following: false, requested: true }); }
    await run('INSERT OR IGNORE INTO follows(a,b,ts) VALUES(?,?,?)', [u.id, id, Date.now()]);
    await notify(id, 'follow', u.id);
    send(res, 200, { following: true, requested: false });
  },
  'GET /api/user': async ({ res, u, q }) => {
    const t = await one('SELECT id, alias, avatar, age, bio, station_home, modality, level, created, verified, hidden, banned, handle, since, terrain, wish, gear, club, approve, vis FROM users WHERE id=?', [str(q.get('id'), 40)]);
    if (!t || (t.id !== u.id && ((VERIFY && t.verified === 0) || t.hidden || t.banned || await blockedEither(u.id, t.id)))) return send(res, 404, { error: 'No existe.' });
    const me = t.id === u.id;
    const [totals, stations, days, pos, stk, followers, following, followingN, followsMe, requested] = await Promise.all([agg(t.id), stationsDistinct(t.id), all('SELECT id, station, ts, desnivel, bajadas, freeride, track FROM days WHERE uid=? ORDER BY ts DESC LIMIT 5', [t.id]),
      posOf(t.id, 'desnivel', null, 'temporada'), streak(t.id), count('SELECT COUNT(*) n FROM follows WHERE b=?', [t.id]), one('SELECT 1 x FROM follows WHERE a=? AND b=?', [u.id, t.id]),
      count('SELECT COUNT(*) n FROM follows WHERE a=?', [t.id]), one('SELECT 1 x FROM follows WHERE a=? AND b=?', [t.id, u.id]), one('SELECT 1 x FROM follow_requests WHERE a=? AND b=?', [u.id, t.id])]);
    delete t.verified; delete t.hidden; delete t.banned;
    // Sus días y sus estaciones, solo si los puede ver quien mira; con «solo yo», tampoco sus totales
    const vis = visOf(t), see = me || vis === 'todos' || (vis === 'seguidores' && !!following);
    send(res, 200, { ...t, ...card(t), vis, daysHidden: !see, age: me ? t.age : null, avatar: safeAvatar(t.avatar), totals: see || vis !== 'yo' ? totals : null, stations: see ? stations : [], days: see ? days.map(d => ({ ...d, track: me ? J(d.track) : trimTrack(J(d.track), d.station) })) : [], pos: see || vis !== 'yo' ? (pos || {}).pos || 0 : 0, streak: see ? stk : 0, followers, followingN, following: !!following, followsMe: !!followsMe, requested: !!requested, approve: !!t.approve, canList: me || !t.approve || !!following, me });   // la edad es privada
  },
  'POST /api/kudos': async ({ res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    // Solo días que se pueden ver: de cuentas públicas (ni ocultas ni suspendidas ni sin verificar) y sin bloqueos
    const id = str(b.id, 40), dd = await one(`SELECT d.uid uid, u.vis vis FROM days d JOIN users u ON u.id=d.uid WHERE d.id=? AND ${pubU()}`, [id]); if (!dd || await blockedEither(u.id, dd.uid) || !(await canSeeDays(u.id, { id: dd.uid, vis: dd.vis }))) return send(res, 404, { error: 'No existe.' });
    if (dd.uid === u.id) return send(res, 400, { error: 'No puedes dar apoyo a tus propios días.' });
    const had = (await run('DELETE FROM kudos WHERE day=? AND uid=?', [id, u.id])).rowsAffected;
    if (!had) { await run('INSERT OR IGNORE INTO kudos(day,uid) VALUES(?,?)', [id, u.id]); await notify(dd.uid, 'kudo', u.id, id); } else await unnotify(dd.uid, 'kudo', u.id, id);
    send(res, 200, { kudos: await count('SELECT COUNT(*) n FROM kudos WHERE day=?', [id]), liked: !had });
  },
  // ---- bloquear y denunciar
  'POST /api/block': async ({ req, res, u, b }) => {
    if (await limited('w:' + u.id, 120, MIN)) return send(res, 429, { error: 'Vas demasiado rápido. Espera un momento.' });
    const id = str(b.id, 40); if (id === u.id || !(await one('SELECT 1 x FROM users WHERE id=?', [id]))) return send(res, 400, { error: 'Usuario no válido.' });
    const had = (await run('DELETE FROM blocks WHERE a=? AND b=?', [u.id, id])).rowsAffected;
    if (!had) await atomic([['INSERT OR IGNORE INTO blocks(a,b,ts) VALUES(?,?,?)', [u.id, id, Date.now()]], ['DELETE FROM follows WHERE (a=? AND b=?) OR (a=? AND b=?)', [u.id, id, id, u.id]],
      ['DELETE FROM follow_requests WHERE (a=? AND b=?) OR (a=? AND b=?)', [u.id, id, id, u.id]], ['DELETE FROM notifs WHERE (uid=? AND actor=?) OR (uid=? AND actor=?)', [u.id, id, id, u.id]]]);
    await audit(u.id, had ? 'UNBLOCK' : 'BLOCK', req); send(res, 200, { blocked: !had });
  },
  'GET /api/blocks': async ({ res, u }) => send(res, 200, await all('SELECT u.id id, u.alias alias FROM blocks k JOIN users u ON u.id=k.b WHERE k.a=? ORDER BY k.ts DESC', [u.id])),
  'POST /api/report': async ({ req, res, u, b }) => {
    if (await limited('rp:' + u.id, 10, HOUR)) return send(res, 429, { error: 'Has enviado muchas denuncias. Inténtalo más tarde.' });
    const target = str(b.target, 40), day = b.day ? str(b.day, 40) : null, reason = str(b.reason, 20), note = text(b.note, 300);
    if (!['spam', 'ofensivo', 'trampas', 'suplantacion', 'privacidad', 'otro'].includes(reason)) return send(res, 400, { error: 'Elige un motivo.' });
    if (target === u.id || !(await one('SELECT 1 x FROM users WHERE id=?', [target]))) return send(res, 400, { error: 'Usuario no válido.' });
    if (day && !(await one('SELECT 1 x FROM days WHERE id=? AND uid=?', [day, target]))) return send(res, 400, { error: 'Día no válido.' });
    if (!(await one("SELECT 1 x FROM reports WHERE reporter=? AND target=? AND COALESCE(day,'')=? AND status='open'", [u.id, target, day || '']))) {
      await run('INSERT INTO reports(id,reporter,target,day,reason,note,ts) VALUES(?,?,?,?,?,?,?)', [rid(), u.id, target, day, reason, note, Date.now()]);
      // Para ocultar a alguien solo cuentan las denuncias de personas visibles (verificadas, ni ocultas ni suspendidas): tres
      // cuentas recién creadas sin verificar no pueden esconder a nadie. Las demás denuncias le llegan igual al moderador
      const n = await count(`SELECT COUNT(DISTINCT r.reporter) n FROM reports r JOIN users p ON p.id=r.reporter WHERE r.target=? AND r.status='open' AND ${pubCond('p.')}`, [target]);
      if (n >= 3) { await run('UPDATE users SET hidden=1 WHERE id=?', [target]); fresh(); }   // tres personas distintas: se oculta hasta revisarlo
      if (MAIL_READY) for (const a of ADMINS) sendMail(a, 'Nueva denuncia en Pistea', mail('Nueva denuncia', `Motivo: ${reason}. Denuncias abiertas contra ese usuario: ${n}.`, 'Revisar', APP_URL + '/', 'Entra con tu cuenta de administrador y abre Perfil → Moderación.')).catch(() => {});
    }
    await audit(u.id, 'REPORT', req, { reason }); send(res, 200, { ok: true });
  },
  // ---- moderación (solo ADMIN_EMAILS)
  'GET /api/admin/reports': async ({ res, u }) => {
    if (!isAdmin(u)) return send(res, 403, { error: 'Solo para moderadores.' });
    const rows = await all(`SELECT r.id id, r.reason reason, r.note note, r.ts ts, r.day day, r.target target, t.alias alias, t.bio bio, t.avatar avatar, t.hidden hidden, t.banned banned, p.alias reporter,
      (SELECT COUNT(DISTINCT reporter) FROM reports x WHERE x.target=r.target AND x.status='open') n, d.station station, d.desnivel desnivel, d.km km, d.vmax vmax, d.bajadas bajadas
      FROM reports r JOIN users t ON t.id=r.target LEFT JOIN users p ON p.id=r.reporter LEFT JOIN days d ON d.id=r.day WHERE r.status='open' ORDER BY r.ts DESC LIMIT 100`);
    send(res, 200, rows.map(r => ({ ...r, avatar: safeAvatar(r.avatar) })));
  },
  'POST /api/admin/resolve': async ({ req, res, u, b }) => {
    if (!isAdmin(u)) return send(res, 403, { error: 'Solo para moderadores.' });
    const r = await one("SELECT * FROM reports WHERE id=? AND status='open'", [str(b.id, 40)]), action = str(b.action, 20);
    if (!r) return send(res, 404, { error: 'Esa denuncia ya está resuelta.' });
    const done = (extra = []) => atomic([...extra, ["UPDATE reports SET status='resolved', resolved_by=?, resolved_at=?, action=? WHERE target=? AND status='open'" + (action === 'quitar_dia' ? ' AND day=?' : ''), [u.id, Date.now(), action, r.target, ...(action === 'quitar_dia' ? [r.day] : [])]]]);
    if (action === 'descartar') await done([['UPDATE users SET hidden=0 WHERE id=?', [r.target]]]);
    else if (action === 'quitar_dia' && r.day) await done([['DELETE FROM kudos WHERE day=?', [r.day]], ['DELETE FROM passes WHERE day=?', [r.day]], ['DELETE FROM days WHERE id=?', [r.day]]]);
    else if (action === 'limpiar_perfil') await done([["UPDATE users SET alias='Esquiador ' || substr(id,1,4), bio='', avatar=NULL, handle=NULL, gear='', club='', hidden=0 WHERE id=?", [r.target]], ['DELETE FROM avatars WHERE uid=?', [r.target]]]);
    else if (action === 'suspender') await done([['UPDATE users SET banned=1 WHERE id=?', [r.target]], ['DELETE FROM tokens WHERE uid=?', [r.target]]]);
    else return send(res, 400, { error: 'Acción no válida.' });
    fresh(); await audit(u.id, 'MODERATION', req, { action, target: r.target }); send(res, 200, { ok: true });
  },
  // Panel de datos (/panel), solo ADMIN_EMAILS: todas las cuentas con su ficha y los días grabados, sin contraseñas ni
  // trazas. Cada consulta queda en la auditoría (quién vio los datos personales y cuándo). La última actividad sale de la
  // sesión deslizante: su caducidad se renueva, como mucho una vez al día, a 90 días desde el último uso
  'GET /api/admin/panel': async ({ req, res, u }) => {
    if (!isAdmin(u)) return send(res, 403, { error: 'Solo para administradores.' });
    const [users, days, open] = await Promise.all([
      all(`SELECT u.id id, u.email email, u.alias alias, u.handle handle, u.created created, u.verified verified, u.onboarded onboarded, u.age age, u.station_home home,
        u.modality modality, u.level level, u.since since, u.club club, u.gear gear, u.terrain terrain, u.wish wish, u.goal_days goal, u.bio bio, u.hidden hidden, u.banned banned, u.demo demo,
        u.terms_accepted_at terms, CASE WHEN EXISTS(SELECT 1 FROM avatars a WHERE a.uid=u.id) OR u.avatar IS NOT NULL THEN 1 ELSE 0 END foto,
        (SELECT MAX(exp) FROM tokens k WHERE k.uid=u.id) kexp, (SELECT ua FROM tokens k WHERE k.uid=u.id ORDER BY exp DESC LIMIT 1) ua,
        (SELECT COUNT(*) FROM follows f WHERE f.b=u.id) followers, (SELECT COUNT(*) FROM follows f WHERE f.a=u.id) following FROM users u ORDER BY u.created DESC`),
      all('SELECT uid, station, ts, desnivel, km, bajadas, vmax, freeride, src FROM days ORDER BY ts'),
      count("SELECT COUNT(*) n FROM reports WHERE status='open'")]);
    const out = users.map(x => ({ ...x, terrain: J(x.terrain, []), wish: J(x.wish, []), seen: x.kexp ? Math.max(x.created || 0, x.kexp - SESSION) : null, verified: x.verified === null ? 1 : x.verified, kexp: undefined }));
    await audit(u.id, 'ADMIN_PANEL', req, { users: out.length });
    send(res, 200, { now: Date.now(), users: out, days: days.map(d => [d.uid, d.station, d.ts, d.desnivel, d.km, d.bajadas, d.vmax, d.freeride, d.src]), reports: open, stations: Object.fromEntries(STATIONS.map(s => [s[0], s[1]])) });
  },
  'GET /api/config': async ({ res }) => send(res, 200, { stations: STATIONS.map(s => ({ id: s[0], n: s[1], z: s[2] })), sim: ALLOW_SIM, verify: VERIFY, maps: MAPS_URL ? MAPS_URL + '/' : '/3d/', apk: APK })
};

// ---------- ficheros estáticos (página, fotos de perfil y mapas 3D) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const TEXTY = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
function serveFile(req, res, root, rel, cache) {
  let p; try { p = decodeURIComponent(rel); } catch { res.writeHead(400); return res.end(); }
  if (p.includes('\0')) { res.writeHead(400); return res.end(); }
  let f = path.resolve(root, '.' + path.sep + p.replace(/^\/+/, ''));
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }   // nunca fuera de la carpeta
  let s; try { s = fs.statSync(f); if (s.isDirectory()) { f = path.join(f, 'index.html'); s = fs.statSync(f); } } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('No encontrado'); }
  const ext = path.extname(f).toLowerCase(), lm = s.mtime.toUTCString();
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Last-Modified': lm, 'Cache-Control': cache || (/\/assets\//.test(f.replace(/\\/g, '/')) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600'), 'X-Content-Type-Options': 'nosniff' };
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
  'Permissions-Policy': `geolocation=(self${MAPS_ORIGIN ? ` "${MAPS_ORIGIN}"` : ''}), camera=(), microphone=(), payment=(), usb=()`,
  'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'${MAPS_ORIGIN ? ' ' + MAPS_ORIGIN : ''}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'` };

async function handler(req, res) {
  try {
    if (PROD && TRUST && !VERCEL && req.headers['x-forwarded-proto'] === 'http') { res.writeHead(301, { Location: APP_URL + req.url }); return res.end(); }
    if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const url = new URL(req.url, 'http://x'), key = `${req.method} ${url.pathname}`;
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      if (DB_ERR) { console.error('[configuración]', DB_ERR); return send(res, 503, { error: 'Servicio no disponible. Inténtalo más tarde.' }); }
      const r = routes[key]; if (!r) return send(res, 404, { error: 'No existe.' });
      if (burst(ipOf(req))) { res.setHeader('Retry-After', '60'); return send(res, 429, { error: 'Demasiadas peticiones seguidas. Espera un minuto.' }); }
      // Anti-CSRF: toda escritura lleva una cabecera propia (otra web no puede ponerla sin permiso CORS) y no viene de otro sitio
      if (req.method !== 'GET' && (req.headers['x-pistea'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site')) return send(res, 403, { error: 'Petición no permitida.' });
      await dbReady(); housekeeping().catch(() => {});
      const u = PUB.has(key) ? null : await authUser(req, res);
      if (!PUB.has(key) && !u) return send(res, 401, { error: 'Tu sesión ha caducado. Entra de nuevo.' });
      const b = req.method === 'GET' ? {} : await readBody(req, key === 'POST /api/avatar' ? 6e5 : key === 'POST /api/days' ? 25e5 : 2e5);   // un día de 8 h de traza ≈ 0,6 MB
      if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { error: 'Petición no válida.' });
      return await r({ req, res, u, q: url.searchParams, b });
    }
    if (url.pathname.startsWith('/avatars/')) return await serveAvatar(req, res, url.pathname.slice(9));
    if (url.pathname === '/calc.js' || url.pathname === '/app.js') return serveFile(req, res, path.join(__dirname, 'public'), url.pathname.slice(1), 'no-cache');   // se revalidan siempre: nunca una versión vieja con una página nueva
    if (url.pathname.startsWith('/img/')) return serveFile(req, res, path.join(__dirname, 'public', 'img'), url.pathname.slice(4));
    if (/^\/seg\/[a-z-]+\.json$/.test(url.pathname)) return serveFile(req, res, path.join(__dirname, 'public', 'seg'), url.pathname.slice(4));   // lo que el motor del día sabe de cada estación
    if (/^\/fonts\/[A-Za-z0-9-]+\.woff2$/.test(url.pathname)) return serveFile(req, res, path.join(__dirname, 'public', 'fonts'), url.pathname.slice(6), 'public, max-age=31536000, immutable');   // Barlow (licencia OFL)
    if (url.pathname === '/3d') { res.writeHead(301, { Location: '/3d/' + url.search }); return res.end(); }
    if (url.pathname.startsWith('/3d/')) {
      if (MAPS_URL && !/^\/3d\/estaciones\/[a-z-]+\/data\/dem\.u16d$/.test(url.pathname)) { res.writeHead(302, { Location: MAPS_URL + url.pathname.slice(3) + url.search }); return res.end(); }   // enlaces antiguos
      return fs.existsSync(MAPS) ? serveFile(req, res, MAPS, url.pathname.slice(3)) : send(res, 404, { error: 'Mapas 3D no instalados (MAPS_DIR).' });
    }
    if (url.pathname === '/manifest.json') { res.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return res.end(JSON.stringify({ name: 'Pistea', short_name: 'Pistea', start_url: '/', display: 'standalone', background_color: '#f3f7fb', theme_color: '#f3f7fb', description: 'Graba tus días de esquí, colecciona las pistas de cada estación y compite con la comunidad.', lang: 'es', id: '/', scope: '/', orientation: 'portrait', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] })); }
    if (/^\/(icon-192|icon-512|apple-touch-icon)\.png$/.test(url.pathname)) return serveFile(req, res, path.join(__dirname, 'public'), url.pathname.slice(1));
    if (/^\/(android|apk)\/?$/.test(url.pathname)) { res.writeHead(302, { Location: APK.url, 'Cache-Control': 'no-store' }); return res.end(); }   // enlace corto para la bio: baja la APK vigente (APK.url)
    if (url.pathname === '/sw.js') return serveFile(req, res, path.join(__dirname, 'public'), 'sw.js', 'no-cache');   // el navegador lo revisa siempre
    if (url.pathname === '/icon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0f2a44"/><path d="M14 74l24-40 16 24 12-16 20 32z" fill="none" stroke="#ff5a1f" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>'); }
    // Panel de datos para administradores: la página no lleva datos (los pide a /api/admin/panel, que comprueba quién es)
    if (url.pathname === '/panel.js') return serveFile(req, res, path.join(__dirname, 'public'), 'panel.js', 'no-store');
    if (/^\/panel\/?$/.test(url.pathname)) { res.writeHead(200, { ...PAGE_HEADERS, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY' }); return res.end(fs.readFileSync(path.join(__dirname, 'public', 'panel.html'))); }
    const lp = /^\/(privacidad|condiciones|normas|borrar-cuenta)\/?$/.exec(url.pathname);
    if (lp) { res.writeHead(200, LEGAL_HEADERS); return res.end(legal(lp[1], env)); }
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
