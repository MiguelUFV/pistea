// Prueba de carga: N usuarios virtuales (cada uno con su cuenta) usan la app a la vez durante unos segundos y se mide cuánto
// tarda cada tipo de petición. Uso, con un servidor local ya en marcha sobre una BD de pruebas (NUNCA contra producción):
//   node scripts/carga.js [usuarios=100] [segundos=15] [http://localhost:3210]
// Siembra las cuentas saltándose el límite de altas con X-Forwarded-For (arranca el servidor con TRUST_PROXY=1).
const N = +process.argv[2] || 100, SEG = +process.argv[3] || 15, B = process.argv[4] || 'http://localhost:3210';
if (!/localhost|127\.0\.0\.1/.test(B)) { console.error('Solo contra un servidor local.'); process.exit(1); }
const lat = {}, err = {};
const rec = (k, ms, ok) => { (lat[k] ||= []).push(ms); if (!ok) err[k] = (err[k] || 0) + 1; };
const sesion = [];
async function alta(i) {
  let cookie = '';
  const call = async (m, u, body, key) => {
    const t = performance.now(); let r;
    try { r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Pistea': '1', 'X-Forwarded-For': '10.1.' + (i >> 8) + '.' + (i & 255), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); await r.arrayBuffer(); }
    catch { rec(key || u, performance.now() - t, false); return null; }
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    rec(key || u, performance.now() - t, r.status < 400); return r;
  };
  const email = `carga${i}_${Date.now()}@ejemplo.test`;
  const reg = await call('POST', '/api/register', { email, password: 'Nieve-Polvo-2026', alias: 'Carga ' + i, terms: true }, 'alta');
  if (!reg || reg.status >= 400) return;
  sesion[i] = cookie;
}
async function user(i) {
  const cookie = sesion[i]; if (!cookie) return;
  const call = async (m, u, body, key) => {
    const t = performance.now(); let r;
    try { r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Pistea': '1', 'X-Forwarded-For': '10.1.' + (i >> 8) + '.' + (i & 255), Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); await r.arrayBuffer(); }
    catch { rec(key || u, performance.now() - t, false); return null; }
    rec(key || u, performance.now() - t, r.status < 400); return r;
  };
  const fin = Date.now() + SEG * 1000;
  while (Date.now() < fin) {
    await call('GET', '/', null, 'página'); await call('GET', '/app.js', null, 'app.js');
    await Promise.all([call('GET', '/api/me', null, 'me'), call('GET', '/api/stations', null, 'stations'), call('GET', '/api/feed', null, 'feed'), call('GET', '/api/passport', null, 'passport'), call('GET', '/api/suggest', null, 'suggest')]);
    for (let k = 0; k < 4; k++) { await call('GET', '/api/rank?metric=desnivel&period=temporada', null, 'rank'); await call('GET', '/api/social', null, 'social'); await new Promise(r => setTimeout(r, 200 + Math.random() * 600)); }
  }
}
(async () => {
  let t0 = performance.now();
  await Promise.all(Array.from({ length: N }, (_, i) => alta(i)));
  console.log(`altas: ${((performance.now() - t0) / 1000).toFixed(1)} s para ${sesion.filter(Boolean).length}/${N} cuentas`);
  for (const k of Object.keys(lat)) delete lat[k];
  t0 = performance.now();
  await Promise.all(Array.from({ length: N }, (_, i) => user(i)));
  const s = (performance.now() - t0) / 1000, pc = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
  console.log(`${N} usuarios, ${s.toFixed(1)} s, ${Object.values(lat).reduce((n, a) => n + a.length, 0)} peticiones`);
  for (const [k, a] of Object.entries(lat)) console.log(k.padEnd(10), String(a.length).padStart(6), 'p50', pc(a, .5).toFixed(0).padStart(5), 'ms  p95', pc(a, .95).toFixed(0).padStart(5), 'ms  máx', Math.max(...a).toFixed(0).padStart(6), 'ms', err[k] ? `  ERRORES ${err[k]}` : '');
})();
