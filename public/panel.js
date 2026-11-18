// Panel de datos de Pistea (/panel), solo para las cuentas de ADMIN_EMAILS. Pide todo a /api/admin/panel y calcula aquí
// las cifras, el informe, las gráficas (SVG a mano: la CSP no deja cargar librerías de fuera) y la tabla de cuentas.
// Las cuentas de prueba (demo) salen en la tabla pero no cuentan en las cifras.
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Europe/Madrid', DAY = 864e5;
const dkey = ts => new Date(ts).toLocaleDateString('sv-SE', { timeZone: TZ });   // AAAA-MM-DD en hora de España
const fdate = ts => ts ? new Date(ts).toLocaleDateString('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fdt = ts => ts ? new Date(ts).toLocaleString('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const short = k => { const [, m, d] = k.split('-'); return `${+d}/${+m}`; };
const NF = new Intl.NumberFormat('es-ES'), n = x => NF.format(Math.round(x || 0));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const ago = ts => { if (!ts) return '—'; const d = Math.floor((Date.now() - ts) / DAY); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };
const LVL = { debutante: 'Debutante', intermedio: 'Intermedio', avanzado: 'Avanzado', experto: 'Experto' };
const MOD = { ski: 'Esquí', snowboard: 'Snowboard', ambos: 'Esquí y snowboard' };
const TER = { pista: 'Pistas pisadas', carving: 'Carving', baches: 'Baches', park: 'Snowpark', freeride: 'Fuera de pista', travesia: 'Travesía' };
const WD = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const device = ua => !ua ? '—' : /; wv\)/.test(ua) ? 'App Android' : /iPhone|iPad/.test(ua) ? 'iPhone o iPad' : /Android|Mobile/.test(ua) ? 'Móvil (web)' : 'Ordenador';
const madrid = ts => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts)); return { wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.find(x => x.type === 'weekday').value), h: +p.find(x => x.type === 'hour').value }; };

let D = null, RANGE = 30, Q = '', F = 'todas', SORT = { k: 'created', d: -1 }, SHOW = 50, timer = 0;

async function load() {
  let r;
  try { r = await fetch('/api/admin/panel', { credentials: 'same-origin', cache: 'no-store' }); }
  catch { return msg('No hay conexión con Pistea. Vuelve a intentarlo en un momento.'); }
  if (r.status === 401) return msg('Entra primero en Pistea con tu cuenta de administrador y vuelve a esta página.', true);
  if (r.status === 403) return msg('Tu cuenta no es de administrador. El panel solo se abre con los correos que estén en la variable ADMIN_EMAILS de Vercel.');
  if (!r.ok) return msg('El servidor no ha podido dar los datos. Vuelve a intentarlo en un momento.');
  D = await r.json(); prepare(); render();
}
function msg(t, login) { $('#app').innerHTML = `<div class="msg"><h1>Panel de Pistea</h1><p>${esc(t)}</p>${login ? '<p><a href="/">Ir a Pistea</a></p>' : ''}</div>`; }

// Cifras de cada cuenta a partir de sus días
function prepare() {
  const by = new Map(D.users.map(u => [u.id, u]));
  for (const u of D.users) Object.assign(u, { nd: 0, des: 0, km: 0, sts: new Set(), first: null, last: null, dev: device(u.ua) });
  D.dayRows = D.days.map(([uid, station, ts, des, km, baj, vmax, fr, src]) => ({ uid, station, ts, des: des || 0, km: km || 0, baj: baj || 0, vmax: vmax || 0, fr: fr || 0, src }));
  for (const d of D.dayRows) {
    const u = by.get(d.uid); if (!u) continue;
    u.nd++; u.des += d.des; u.km += d.km; u.sts.add(d.station);
    if (!u.first || d.ts < u.first) u.first = d.ts; if (!u.last || d.ts > u.last) u.last = d.ts;
  }
  D.by = by;
  D.real = D.users.filter(u => !u.demo);
}
const stName = id => (D.stations || {})[id] || id || '—';
const status = u => u.banned ? ['Suspendida', 'bad'] : u.hidden ? ['Oculta', 'bad'] : u.demo ? ['Prueba', ''] : u.verified ? ['Verificada', 'ok'] : ['Sin verificar', 'no'];

// ---------- gráficas ----------
// Barras verticales (con línea de acumulado opcional): s = [{k, l, v}]
function bars(s, { line = false, color = 'var(--ac)', h = 200, W = 760 } = {}) {
  if (!s.length) return '<p class="empty">Sin datos todavía.</p>';
  const L = 34, B = 26, T = 14, max = Math.max(1, ...s.map(x => x.v)), bw = (W - L) / s.length, every = Math.ceil(s.length / (W > 500 ? 12 : 8));
  const y = v => T + (h - T - B) * (1 - v / max), ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  let o = `<svg viewBox="0 0 ${W} ${h}" role="img">`;
  for (const t of ticks) o += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--ln)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${n(t)}</text>`;
  s.forEach((x, i) => {
    const bh = (h - T - B) * x.v / max, bx = L + i * bw + bw * 0.12;
    o += `<rect x="${bx}" y="${h - B - bh}" width="${Math.max(1, bw * 0.76)}" height="${bh}" rx="2" fill="${color}"><title>${esc(x.l)}: ${n(x.v)}</title></rect>`;
    if (i % every === 0) o += `<text x="${L + i * bw + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(x.l)}</text>`;
  });
  if (line) {   // acumulado, con su propia escala a la derecha
    let acc = 0; const cum = s.map(x => acc += x.v), cm = Math.max(1, acc), yc = v => T + (h - T - B) * (1 - v / cm);
    o += `<polyline fill="none" stroke="var(--or)" stroke-width="2.5" points="${cum.map((v, i) => `${L + i * bw + bw / 2},${yc(v)}`).join(' ')}"/>`;
    o += `<text x="${W}" y="${yc(acc) - 6}" text-anchor="end" class="v" style="fill:var(--or)">${n(acc)} en total</text>`;
  }
  return o + '</svg>';
}
// Barras horizontales: list = [[etiqueta, valor, color?]]
function hbars(list, { total = null, color = 'var(--ac)' } = {}) {
  if (!list.length || !list.some(x => x[1])) return '<p class="empty">Sin datos todavía.</p>';
  const W = 440, LW = 150, RH = 26, max = Math.max(1, ...list.map(x => x[1])), H = list.length * RH;
  let o = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  list.forEach(([l, v, c], i) => {
    const w = (W - LW - 92) * v / max, y = i * RH;
    o += `<text x="${LW - 10}" y="${y + 17}" text-anchor="end">${esc(String(l).length > 22 ? String(l).slice(0, 21) + '…' : l)}</text><rect x="${LW}" y="${y + 5}" width="${Math.max(v ? 2 : 0, w)}" height="${RH - 10}" rx="3" fill="${c || color}"><title>${esc(l)}: ${n(v)}</title></rect>`;
    o += `<text x="${LW + w + 6}" y="${y + 17}" class="v">${n(v)}${total ? ` · ${pct(v, total)} %` : ''}</text>`;
  });
  return o + '</svg>';
}
const tally = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (k == null || k === '') continue; for (const kk of [].concat(k)) m.set(kk, (m.get(kk) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };

// Cubos de tiempo del periodo elegido: por día, o por semana si el periodo es largo
function buckets(rows, tsOf) {
  const now = D.now, from = RANGE ? now - (RANGE - 1) * DAY : Math.min(now, ...rows.map(tsOf).filter(Boolean), ...D.real.map(u => u.created || now));
  const span = Math.ceil((now - from) / DAY) + 1, week = span > 120, keys = [], idx = new Map();
  for (let t = from; dkey(t) <= dkey(now); t += DAY) {
    const k = dkey(t); let b = k;
    if (week) { const wd = madrid(t).wd; b = dkey(t - wd * DAY); }
    if (!idx.has(b)) { idx.set(b, keys.length); keys.push({ k: b, l: (week ? 'sem. ' : '') + short(b), v: 0 }); }
    idx.set(k, idx.get(b));
  }
  for (const r of rows) { const t = tsOf(r); if (!t) continue; const i = idx.get(dkey(t)); if (i !== undefined) keys[i].v++; }
  return { keys, week, from };
}

// ---------- informe automático ----------
function report() {
  const U = D.real, now = D.now, li = [], warn = [];
  if (!U.length) return '<p class="empty">Todavía no se ha registrado nadie. El informe saldrá en cuanto entren las primeras cuentas.</p>';
  const inWin = (a, b) => U.filter(u => u.created >= now - a * DAY && u.created < now - b * DAY).length;
  const w1 = inWin(7, 0), w0 = inWin(14, 7), m1 = inWin(30, 0);
  li.push(`Esta semana se han registrado <b>${n(w1)}</b> cuentas${w0 ? (w1 === w0 ? `, las mismas que la semana anterior` : `, un ${Math.abs(pct(w1 - w0, w0))} % ${w1 > w0 ? 'más' : 'menos'} que la semana anterior (${n(w0)})`) : w1 ? ' (la semana anterior, ninguna)' : ''}. En los últimos 30 días, ${n(m1)}.`);
  const best = tally(U, u => u.created && dkey(u.created))[0];
  if (best) li.push(`El día con más altas fue el <b>${fdate(new Date(best[0] + 'T12:00:00Z').getTime())}</b>, con ${n(best[1])}.`);
  const ver = U.filter(u => u.verified).length, onb = U.filter(u => u.onboarded).length, rec = U.filter(u => u.nd).length;
  li.push(`De cada 10 cuentas, <b>${Math.round(10 * ver / U.length)}</b> verifican el correo, <b>${Math.round(10 * onb / U.length)}</b> completan el alta guiada y <b>${Math.round(10 * rec / U.length)}</b> graban al menos un día.`);
  const homes = tally(U, u => u.home);
  if (homes.length) li.push(`Estación de casa más elegida: <b>${esc(stName(homes[0][0]))}</b> (${n(homes[0][1])}, ${pct(homes[0][1], U.length)} %)${homes[1] ? `, seguida de ${esc(stName(homes[1][0]))}${homes[2] ? ` y ${esc(stName(homes[2][0]))}` : ''}` : ''}.`);
  const lv = tally(U, u => u.level)[0], md = tally(U, u => u.modality)[0], ages = U.map(u => u.age).filter(Boolean).sort((a, b) => a - b);
  li.push(`Perfil más común: ${lv ? `nivel <b>${esc(LVL[lv[0]] || lv[0])}</b>` : ''}${md ? `, ${esc((MOD[md[0]] || md[0]).toLowerCase())}` : ''}${ages.length ? `; la mitad tiene ${ages[Math.floor(ages.length / 2)]} años o menos (de ${ages[0]} a ${ages[ages.length - 1]})` : ''}.`);
  const dv = tally(U, u => u.dev !== '—' ? u.dev : null);
  if (dv.length) li.push(`Entran sobre todo desde <b>${esc(dv[0][0].toLowerCase())}</b> (${pct(dv[0][1], dv.reduce((a, x) => a + x[1], 0))} %).`);
  const dw = D.dayRows.filter(d => d.ts >= now - 7 * DAY && D.by.get(d.uid) && !D.by.get(d.uid).demo);
  if (dw.length) { const top = tally(dw, d => d.station)[0]; li.push(`Esta semana se han grabado <b>${n(dw.length)}</b> días en ${new Set(dw.map(d => d.station)).size} estaciones; la más esquiada, ${esc(stName(top[0]))} (${n(top[1])}).`); }
  else li.push('Esta semana nadie ha grabado un día todavía.');
  const act = U.filter(u => u.seen && u.seen >= now - 7 * DAY).length;
  li.push(`Activas en los últimos 7 días: <b>${n(act)}</b> (${pct(act, U.length)} % del total).`);
  const stale = U.filter(u => !u.verified && u.created < now - 2 * DAY).length;
  if (stale) warn.push(`Hay <b>${n(stale)}</b> cuentas sin verificar de hace más de dos días: quizá el correo de verificación les llegó a spam.`);
  const noday = U.filter(u => u.verified && !u.nd && u.created < now - 7 * DAY).length;
  if (noday) warn.push(`<b>${n(noday)}</b> cuentas verificadas de hace más de una semana aún no han grabado ningún día.`);
  if (D.reports) warn.push(`Hay <b>${n(D.reports)}</b> denuncias abiertas esperando revisión (en la app: Perfil → Moderación de denuncias).`);
  return `<ul class="report">${li.map(x => `<li>${x}</li>`).join('')}${warn.map(x => `<li class="warn">${x}</li>`).join('')}</ul>`;
}

// ---------- tabla ----------
const COLS = [
  ['created', 'Alta', u => fdt(u.created), u => u.created || 0],
  ['alias', 'Nombre', u => `${esc(u.alias)}${u.handle ? ` <span class="tag">@${esc(u.handle)}</span>` : ''}`, u => (u.alias || '').toLowerCase()],
  ['email', 'Correo', u => esc(u.email), u => u.email],
  ['st', 'Estado', u => { const [t, c] = status(u); return `<span class="tag ${c}">${t}</span>`; }, u => status(u)[0]],
  ['home', 'Estación de casa', u => esc(stName(u.home)), u => stName(u.home)],
  ['level', 'Nivel', u => esc(LVL[u.level] || u.level || '—'), u => Object.keys(LVL).indexOf(u.level)],
  ['modality', 'Modalidad', u => esc(MOD[u.modality] || '—'), u => u.modality || ''],
  ['age', 'Edad', u => u.age || '—', u => u.age || 0, 1],
  ['nd', 'Días', u => n(u.nd), u => u.nd, 1],
  ['des', 'Desnivel (m)', u => n(u.des), u => u.des, 1],
  ['seen', 'Última actividad', u => ago(u.seen), u => u.seen || 0],
  ['dev', 'Dispositivo', u => esc(u.dev), u => u.dev]];
const FILTERS = { todas: ['Todas las cuentas', () => true], verificadas: ['Verificadas', u => u.verified && !u.demo], sinverificar: ['Sin verificar', u => !u.verified], condias: ['Han grabado días', u => u.nd > 0], sindias: ['Sin ningún día', u => !u.nd], activas: ['Activas (7 días)', u => u.seen >= D.now - 7 * DAY], nuevas: ['Nuevas (7 días)', u => u.created >= D.now - 7 * DAY], problemas: ['Ocultas o suspendidas', u => u.hidden || u.banned], prueba: ['De prueba', u => u.demo] };
function rows() {
  const q = Q.trim().toLowerCase(), col = COLS.find(c => c[0] === SORT.k);
  return D.users.filter(FILTERS[F][1]).filter(u => !q || [u.alias, u.handle, u.email, u.club, stName(u.home), u.bio].some(x => String(x || '').toLowerCase().includes(q)))
    .sort((a, b) => { const x = col[3](a), y = col[3](b); return (x > y ? 1 : x < y ? -1 : 0) * SORT.d; });
}
function table() {
  const R = rows();
  return `<div class="tbar"><input id="q" type="search" placeholder="Buscar por nombre, @usuario, correo, club o estación" value="${esc(Q)}" aria-label="Buscar cuentas">
    <select id="f" aria-label="Filtrar cuentas">${Object.entries(FILTERS).map(([k, [l, f]]) => `<option value="${k}"${k === F ? ' selected' : ''}>${l} (${D.users.filter(f).length})</option>`).join('')}</select>
    <button class="btn" data-a="csv">Descargar Excel (${n(R.length)} cuentas)</button><button class="btn" data-a="csvdays">Descargar días grabados</button></div>
    <div class="tw"><table><thead><tr>${COLS.map(c => `<th data-k="${c[0]}" class="${c[4] ? 'num' : ''} ${SORT.k === c[0] ? 'on' : ''}">${c[1]}${SORT.k === c[0] ? (SORT.d > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
    <tbody>${R.slice(0, SHOW).map(u => `<tr data-u="${esc(u.id)}">${COLS.map(c => `<td class="${c[4] ? 'num' : ''}">${c[2](u)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${COLS.length}" class="empty">Ninguna cuenta con ese filtro.</td></tr>`}</tbody></table></div>
    ${R.length > SHOW ? `<button class="btn more" data-a="more">Ver ${n(Math.min(50, R.length - SHOW))} más (quedan ${n(R.length - SHOW)})</button>` : ''}`;
}

// ---------- página ----------
function render() {
  const U = D.real, now = D.now, since = t => U.filter(u => u.created >= now - t).length;
  const w1 = since(7 * DAY), w0 = U.filter(u => u.created >= now - 14 * DAY && u.created < now - 7 * DAY).length;
  const today = U.filter(u => u.created && dkey(u.created) === dkey(now)).length;
  const ver = U.filter(u => u.verified).length, rec = U.filter(u => u.nd).length, act = U.filter(u => u.seen >= now - 7 * DAY).length;
  const realDays = D.dayRows.filter(d => D.by.get(d.uid) && !D.by.get(d.uid).demo);
  const delta = w0 ? Math.round(100 * (w1 - w0) / w0) : null;
  const kpi = (v, l, extra = '') => `<div class="kpi"><b>${v}</b><span>${l}</span>${extra}</div>`;
  const su = buckets(U, u => u.created), sd = buckets(realDays, d => d.ts);
  const per = RANGE ? `últimos ${RANGE} días` : 'desde el principio';
  const inR = u => !RANGE || u.created >= su.from;
  const UR = U.filter(inR);
  const hours = Array.from({ length: 24 }, (_, h) => ({ l: `${h}h`, v: 0 })), wds = WD.map(l => [l, 0]);
  for (const u of UR) if (u.created) { const m = madrid(u.created); hours[m.h].v++; wds[m.wd][1]++; }
  const ages = [['Menos de 18', a => a < 18], ['18 a 24', a => a < 25], ['25 a 34', a => a < 35], ['35 a 44', a => a < 45], ['45 a 54', a => a < 55], ['55 o más', () => true]].map(([l]) => [l, 0]);
  for (const u of U) if (u.age) { const a = u.age, i = a < 18 ? 0 : a < 25 ? 1 : a < 35 ? 2 : a < 45 ? 3 : a < 55 ? 4 : 5; ages[i][1]++; }
  const funnel = [['Registradas', U.length], ['Correo verificado', ver], ['Alta guiada completa', U.filter(u => u.onboarded).length], ['Han grabado un día', rec], ['Tres días o más', U.filter(u => u.nd >= 3).length], ['Activas (7 días)', act]];
  const lvC = { debutante: 'var(--g)', intermedio: 'var(--b)', avanzado: 'var(--r)', experto: 'var(--k)' };
  $('#app').innerHTML = `<header><h1>Panel de Pistea<small>Datos de ${fdt(now)} · ${n(D.users.length)} cuentas en la base de datos${D.users.length !== U.length ? ` (${n(D.users.length - U.length)} de prueba, fuera de las cifras)` : ''}</small></h1>
    <div class="tools"><div class="seg" role="group" aria-label="Periodo de las gráficas">${[[7, '7 días'], [30, '30 días'], [90, '90 días'], [0, 'Todo']].map(([v, l]) => `<button data-r="${v}" class="${RANGE === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn" data-a="reload">Actualizar</button><a class="btn" href="/" style="text-decoration:none;color:var(--tx)">Volver a Pistea</a></div></header>
    <div class="kpis">${kpi(n(U.length), 'cuentas')}${kpi(n(today), 'nuevas hoy')}${kpi(n(w1), 'nuevas en 7 días', delta === null ? '' : `<em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} %</em>`)}${kpi(n(since(30 * DAY)), 'nuevas en 30 días')}
      ${kpi(pct(ver, U.length) + ' %', `verificadas (${n(ver)})`)}${kpi(pct(rec, U.length) + ' %', `han grabado un día (${n(rec)})`)}${kpi(n(act), 'activas en 7 días')}${kpi(n(realDays.length), 'días grabados')}${kpi(n(realDays.reduce((a, d) => a + d.des, 0) / 1000) + ' km', 'de desnivel entre todos')}</div>
    <div class="grid"><div class="card wide"><h2>Informe automático</h2>${report()}</div></div>
    <div class="grid"><div class="card wide"><h2>Altas ${su.week ? 'por semana' : 'por día'} · ${per}</h2>${bars(su.keys, { line: true })}</div></div>
    <div class="grid">
      <div class="card"><h2>Embudo: de registrarse a esquiar</h2>${hbars(funnel, { total: U.length })}</div>
      <div class="card"><h2>Estación de casa</h2>${hbars(tally(U, u => u.home).slice(0, 12).map(([k, v]) => [stName(k), v]), { total: U.length })}</div>
      <div class="card"><h2>Nivel</h2>${hbars(Object.keys(LVL).map(k => [LVL[k], U.filter(u => u.level === k).length, lvC[k]]), { total: U.length })}</div>
      <div class="card"><h2>Modalidad</h2>${hbars(Object.keys(MOD).map(k => [MOD[k], U.filter(u => (u.modality || 'ski') === k).length]), { total: U.length })}</div>
      <div class="card"><h2>Edad</h2>${hbars(ages, { total: U.filter(u => u.age).length })}</div>
      <div class="card"><h2>Qué les gusta esquiar</h2>${hbars(tally(U, u => u.terrain).map(([k, v]) => [TER[k] || k, v]), { total: U.length })}</div>
      <div class="card"><h2>Estaciones que quieren esquiar</h2>${hbars(tally(U, u => u.wish).slice(0, 12).map(([k, v]) => [stName(k), v]), { total: U.length, color: 'var(--or)' })}</div>
      <div class="card"><h2>Desde dónde entran</h2>${hbars(tally(U, u => u.dev !== '—' ? u.dev : null), { total: U.filter(u => u.dev !== '—').length })}</div>
      <div class="card"><h2>A qué hora se registran · ${per}</h2>${bars(hours, { h: 190, W: 440 })}</div>
      <div class="card"><h2>Qué día de la semana se registran · ${per}</h2>${hbars(wds)}</div>
    </div>
    <div class="grid"><div class="card wide"><h2>Días grabados ${sd.week ? 'por semana' : 'por día'} · ${per}</h2>${bars(sd.keys, { color: 'var(--g)' })}</div></div>
    <div class="grid"><div class="card"><h2>Días grabados por estación</h2>${hbars(tally(realDays, d => d.station).slice(0, 15).map(([k, v]) => [stName(k), v]), { total: realDays.length, color: 'var(--g)' })}</div>
      <div class="card"><h2>Quién graba más días</h2>${hbars(U.filter(u => u.nd).sort((a, b) => b.nd - a.nd).slice(0, 10).map(u => [u.alias, u.nd]), { color: 'var(--g)' })}</div></div>
    <div class="card"><h2>Cuentas</h2><div id="tbl">${table()}</div></div>
    <p class="note">Datos personales: no compartas esta página ni los ficheros descargados, y bórralos cuando ya no los necesites. Cada vez que se abre el panel queda apuntado quién lo abrió. Las contraseñas no se ven nunca (solo se guarda su huella cifrada) y las trazas GPS no salen aquí.</p>`;
}
const retable = () => { $('#tbl').innerHTML = table(); };

function detail(id) {
  const u = D.by.get(id); if (!u) return;
  const ds = D.dayRows.filter(d => d.uid === id).sort((a, b) => b.ts - a.ts), [st, c] = status(u);
  const row = (k, v) => v === null || v === undefined || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><button class="btn x" data-a="close" aria-label="Cerrar">Cerrar</button><h2>${esc(u.alias)}</h2><div class="sub">${u.handle ? '@' + esc(u.handle) + ' · ' : ''}<span class="tag ${c}">${st}</span></div>
    <dl class="dl">${row('Correo', `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>`)}${row('Alta', fdt(u.created))}${row('Última actividad', u.seen ? `${ago(u.seen)} (${fdt(u.seen)})` : '—')}
    ${row('Condiciones aceptadas', u.terms ? fdt(u.terms) : '—')}${row('Alta guiada', u.onboarded ? 'Completa' : 'Sin terminar')}${row('Edad', u.age ? u.age + ' años' : '')}${row('Estación de casa', esc(stName(u.home)))}
    ${row('Nivel', esc(LVL[u.level] || u.level))}${row('Modalidad', esc(MOD[u.modality] || u.modality))}${row('Esquía desde', u.since)}${row('Le gusta', esc((u.terrain || []).map(k => TER[k] || k).join(', ')))}
    ${row('Quiere esquiar en', esc((u.wish || []).map(stName).join(', ')))}${row('Reto de días', u.goal)}${row('Club o escuela', esc(u.club))}${row('Equipo', esc(u.gear))}${row('Sobre mí', esc(u.bio))}
    ${row('Foto de perfil', u.foto ? 'Sí' : 'No')}${row('Seguidores / sigue a', `${n(u.followers)} / ${n(u.following)}`)}${row('Dispositivo', esc(u.dev))}
    ${row('Días grabados', `${n(u.nd)} · ${n(u.des)} m de desnivel · ${n(u.km)} km · ${u.sts.size} ${u.sts.size === 1 ? 'estación' : 'estaciones'}`)}</dl>
    ${ds.length ? `<h2>Sus días</h2><div class="tw"><table><thead><tr><th>Fecha</th><th>Estación</th><th class="num">Desnivel</th><th class="num">Km</th><th class="num">Bajadas</th><th class="num">Máx. km/h</th></tr></thead><tbody>
    ${ds.slice(0, 100).map(d => `<tr><td>${fdate(d.ts)}${d.src === 'sim' ? ' <span class="tag">simulado</span>' : ''}</td><td>${esc(stName(d.station))}</td><td class="num">${n(d.des)} m</td><td class="num">${(d.km || 0).toFixed(1).replace('.', ',')}</td><td class="num">${n(d.baj)}</td><td class="num">${n(d.vmax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Aún no ha grabado ningún día.</p>'}</div>`;
  dlg.showModal();
}

// ---------- Excel (CSV con punto y coma, que es lo que abre bien el Excel en español) ----------
// Un texto que empiece por = + - @ se escribe con un apóstrofo delante: si no, Excel lo ejecutaría como fórmula
const cell = v => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const dec = x => x === null || x === undefined ? '' : String(Math.round(x * 10) / 10).replace('.', ',');
function download(name, head, lines) {
  const csv = '﻿' + [head, ...lines].map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csvUsers() {
  download(`pistea_cuentas_${dkey(D.now)}.csv`, ['Alta', 'Nombre', 'Usuario (@)', 'Correo', 'Estado', 'Alta guiada', 'Edad', 'Estación de casa', 'Nivel', 'Modalidad', 'Esquía desde', 'Le gusta', 'Quiere esquiar en', 'Reto de días', 'Club o escuela', 'Equipo', 'Foto', 'Días grabados', 'Desnivel total (m)', 'Km totales', 'Estaciones distintas', 'Primer día', 'Último día', 'Última actividad', 'Dispositivo', 'Seguidores', 'Sigue a', 'Condiciones aceptadas'],
    rows().map(u => [fdt(u.created), u.alias, u.handle || '', u.email, status(u)[0], u.onboarded ? 'Sí' : 'No', u.age || '', stName(u.home), LVL[u.level] || u.level || '', MOD[u.modality] || u.modality || '', u.since || '', (u.terrain || []).map(k => TER[k] || k).join(', '), (u.wish || []).map(stName).join(', '), u.goal || '', u.club || '', u.gear || '', u.foto ? 'Sí' : 'No',
      u.nd, Math.round(u.des), dec(u.km), u.sts.size, fdate(u.first), fdate(u.last), fdt(u.seen), u.dev, u.followers, u.following, fdt(u.terms)]));
}
function csvDays() {
  download(`pistea_dias_${dkey(D.now)}.csv`, ['Fecha', 'Nombre', 'Correo', 'Estación', 'Desnivel (m)', 'Km', 'Bajadas', 'Máxima (km/h)', 'Fuera de pista (km)', 'Origen'],
    D.dayRows.slice().sort((a, b) => b.ts - a.ts).map(d => { const u = D.by.get(d.uid) || {}; return [fdate(d.ts), u.alias || '', u.email || '', stName(d.station), Math.round(d.des), dec(d.km), d.baj, Math.round(d.vmax), dec(d.fr), d.src === 'sim' ? 'Simulado' : 'GPS']; }));
}

// ---------- eventos (sin onclick en el HTML: la CSP no lo permite) ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a],[data-r],[data-k],[data-u]'); if (!t) { if (e.target === $('#dlg')) $('#dlg').close(); return; }
  if (t.dataset.r !== undefined) { RANGE = +t.dataset.r; render(); }
  else if (t.dataset.k) { SORT = SORT.k === t.dataset.k ? { k: SORT.k, d: -SORT.d } : { k: t.dataset.k, d: t.dataset.k === 'alias' || t.dataset.k === 'email' ? 1 : -1 }; retable(); }
  else if (t.dataset.u) detail(t.dataset.u);
  else ({ reload: load, csv: csvUsers, csvdays: csvDays, more: () => { SHOW += 50; retable(); }, close: () => $('#dlg').close() })[t.dataset.a]?.();
});
document.addEventListener('input', e => { if (e.target.id === 'q') { Q = e.target.value; SHOW = 50; const p = e.target.selectionStart; retable(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); } });
document.addEventListener('change', e => { if (e.target.id === 'f') { F = e.target.value; SHOW = 50; retable(); } });
// Se pone al día solo cada 5 minutos mientras la pestaña está a la vista
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && Date.now() - D.now > 5 * 6e4) load(); });
timer = setInterval(() => { if (!document.hidden && D && !$('#dlg').open) load(); }, 5 * 6e4);
load();
