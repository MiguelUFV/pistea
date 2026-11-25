// Pistea · el motor del día de esquí: de las posiciones del GPS, qué remontes se cogen, por dónde se baja (cada pista o
// fuera de pista, el freeride) y cuánto. Lo usan la app (las cifras en directo) y el servidor, que recalcula el día desde la
// traza (antitrampas): mismo código en los dos lados, lógica pura, sin DOM. Viene del «Mi día» de Valdesquí (filter.js y
// ski.js), llevado a todas las estaciones y con el freeride. Se mide con scripts/banco_seguimiento.js: cualquier cambio,
// antes y después.
//
// Cómo se mide
// - Cada posición pasa por un filtro de Kalman que la une con la velocidad Doppler del receptor y descarta los rebotes.
// - La altura sale del relieve del mapa 3D de la estación (MDT de 5 m), no del GPS, que en altura se equivoca 10 o 20 m;
//   fuera del mapa, la del GPS suavizada. Con ella, la velocidad y la distancia son las de sobre la nieve.
// - La distancia es la velocidad por el tiempo (unir posiciones corta las curvas). La velocidad máxima, la mantenida en dos
//   posiciones seguidas, para que un pico suelto del GPS no cuente.
//
// Cómo se decide
// - Remonte: ir pegado a su línea (25 m más la duda del GPS), avanzando cuesta arriba a su ritmo durante al menos 25 s y
//   50 m. La espera casi quieta junto a la salida, justo antes, es la cola.
// - Subida sin remonte conocido (uno que no está en el mapa, o a pie o con pieles): ganar 25 m de altura seguidos.
// - Bajada: lo que se esquía entre dos subidas, si se pierden al menos 30 m.
// - Por dónde: el algoritmo de Viterbi elige la sucesión más probable de pistas o «fuera de pista» según la distancia de
//   cada posición al borde de cada pista (con su anchura), con un coste por cambiar. Para que cuente como freeride hay que
//   separarse de verdad del borde (30 m en algún momento) durante un buen trecho (60 m): así el ruido del GPS junto a una
//   pista ancha no se cuenta como freeride. Los itinerarios que el mapa marca como freeride también lo son.
// - Coche o autobús: un trecho largo fuera de pista, rápido y casi llano (una carretera) no es esquiar y no cuenta.
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const CORRIDOR = 25, MIN_RIDE = 50, MIN_DROP = 30, NEAR_PISTE = 45, CLIMB = 25, MAX_SPEED = 40, MOVING = 1.6;
  const QUEUE_NEAR = 50, QUEUE_MAX = 40 * 60, CELL = 50, FREE_EDGE = 20, FREE_FAR = 30, FREE_MIN = 60, SEG_MIN = 30;
  // Tipos de remonte de OpenStreetMap: nombre y velocidad de viaje habitual (m/s)
  const LIFT = { chair_lift: ['telesilla', 2.3], gondola: ['telecabina', 5], cable_car: ['teleférico', 8], mixed_lift: ['telemix', 5], drag_lift: ['telesquí', 3],
    't-bar': ['telesquí', 3], 'j-bar': ['telesquí', 3], platter: ['telesquí', 3], rope_tow: ['telecuerda', 2], magic_carpet: ['cinta', 0.8] };
  // Clases del recorrido: subida, verde, azul, roja, negra, freeride y lo demás (parado, andando, sin mapa)
  const CODE = { up: 0, v: 1, a: 2, r: 3, n: 4, f: 5, x: 6 };
  const COLORS = ['v', 'a', 'r', 'n', 'f'];

  // ---------- proyección: UTM (ETRS89) al sistema local de los mapas 3D (x al este desde su borde oeste, z al sur desde su
  // borde norte), la misma cuenta que el motor 3D. geo: { zone, x0, y1, lat, lon } ----------
  function utm(lat, lon, zone) {
    const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const p = lat * RAD, l = lon * RAD, l0 = (zone * 6 - 183) * RAD;
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * (l - l0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
    const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    const Y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    return [E, Y];
  }
  const toLocal = (lat, lon, g) => { const [E, N] = utm(lat, lon, g.zone); return { x: E - g.x0, z: g.y1 - N }; };
  // Lo inverso, por aproximaciones sucesivas (para los días de prueba)
  function toLatLon(x, z, g) {
    let lat = g.lat, lon = g.lon;
    for (let k = 0; k < 8; k++) {
      const a = toLocal(lat, lon, g), b = toLocal(lat + 1e-4, lon, g), c = toLocal(lat, lon + 1e-4, g);
      const j00 = (b.x - a.x) / 1e-4, j01 = (c.x - a.x) / 1e-4, j10 = (b.z - a.z) / 1e-4, j11 = (c.z - a.z) / 1e-4, det = j00 * j11 - j01 * j10, dx = x - a.x, dz = z - a.z;
      lat += (j11 * dx - j01 * dz) / det; lon += (-j10 * dx + j00 * dz) / det;
    }
    return { lat, lon };
  }

  // ---------- relieve: dem.u16d del mapa 3D (cotas en 16 bits como diferencias entre valores seguidos), ya sin gzip ----------
  function heights(bytes) {
    const u8 = new Uint8Array(bytes), q = new Uint16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);
    for (let i = 1; i < q.length; i++) q[i] += q[i - 1];   // la suma se envuelve en 16 bits, como la resta al guardarlas
    return q;
  }
  // d: { cols, rows, cell, base, step }. Cota en (x, z), interpolada; null fuera del mapa
  function relief(d, q) {
    return (x, z) => {
      const fx = x / d.cell - 0.5, fz = z / d.cell - 0.5;
      if (!(fx >= 0 && fz >= 0 && fx <= d.cols - 1 && fz <= d.rows - 1)) return null;
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, i1 = Math.min(i + 1, d.cols - 1), j1 = Math.min(j + 1, d.rows - 1), r0 = j * d.cols, r1 = j1 * d.cols;
      return d.base + d.step * ((q[r0 + i] * (1 - u) + q[r0 + i1] * u) * (1 - v) + (q[r1 + i] * (1 - u) + q[r1 + i1] * u) * v);
    };
  }

  // ---------- filtro de Kalman (filter.js de Valdesquí): posición y velocidad en el plano, con la velocidad Doppler ----------
  function createFilter() {
    const accel = (v, doppler) => Math.min(doppler ? 4 : 2, 0.6 + 0.3 * v), GATE = 30, LOST = 4, GAP = 20, FIRST_ACC = 25;
    const known = v => typeof v === 'number' && Number.isFinite(v);
    let X = null, P = null, last = 0, misses = 0, doppler = false;
    const sigma = f => Math.max(f.acc, 2);
    function velocity(f) {
      if (!known(f.v) || f.v < 0) return null;
      const sv = Math.min(Math.max(known(f.vacc) && f.vacc > 0 ? f.vacc : 0.5, 0.15), 3);
      if (f.v < 0.6) { const s = sv + f.v; return { m: [0, 0], R: [s * s, 0, 0, s * s] }; }
      if (!known(f.dir)) return null;
      const ux = Math.sin(f.dir * RAD), uz = -Math.cos(f.dir * RAD), sc = Math.max(f.v * (known(f.dacc) && f.dacc > 0 ? f.dacc : 8) * RAD, 0.3), a = sv * sv, c = sc * sc;
      return { m: [f.v * ux, f.v * uz], R: [a * ux * ux + c * uz * uz, (a - c) * ux * uz, (a - c) * ux * uz, a * uz * uz + c * ux * ux] };
    }
    function reset(f, vel) {
      const r = sigma(f) ** 2, q = vel ? 1 : 25;
      X = [f.x, f.z, vel ? vel.m[0] : 0, vel ? vel.m[1] : 0]; P = [[r, 0, 0, 0], [0, r, 0, 0], [0, 0, q, 0], [0, 0, 0, q]]; last = f.t; misses = 0;
    }
    function predict(dt) {
      const s2 = accel(Math.hypot(X[2], X[3]), doppler) ** 2, a = dt ** 4 / 4 * s2, b = dt ** 3 / 2 * s2, c = dt * dt * s2;
      X = [X[0] + X[2] * dt, X[1] + X[3] * dt, X[2], X[3]];
      const FP = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => P[i][j] + (i < 2 ? dt * P[i + 2][j] : 0)));
      P = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => FP[i][j] + (j < 2 ? dt * FP[i][j + 2] : 0)));
      P[0][0] += a; P[1][1] += a; P[0][2] += b; P[2][0] += b; P[1][3] += b; P[3][1] += b; P[2][2] += c; P[3][3] += c;
    }
    function update(i, m, R) {
      const y0 = m[0] - X[i], y1 = m[1] - X[i + 1], s00 = P[i][i] + R[0], s01 = P[i][i + 1] + R[1], s10 = P[i + 1][i] + R[2], s11 = P[i + 1][i + 1] + R[3], det = s00 * s11 - s01 * s10;
      if (!(det > 0)) return false;
      const i00 = s11 / det, i01 = -s01 / det, i10 = -s10 / det, i11 = s00 / det;
      if (y0 * (i00 * y0 + i01 * y1) + y1 * (i10 * y0 + i11 * y1) > GATE) return false;
      const K = P.map(row => [row[i] * i00 + row[i + 1] * i10, row[i] * i01 + row[i + 1] * i11]);
      for (let r = 0; r < 4; r++) X[r] += K[r][0] * y0 + K[r][1] * y1;
      const Pi = [P[i].slice(), P[i + 1].slice()];
      P = P.map((row, r) => row.map((v, c) => v - K[r][0] * Pi[0][c] - K[r][1] * Pi[1][c]));
      for (let r = 0; r < 4; r++) for (let c = 0; c < r; c++) P[r][c] = P[c][r] = (P[r][c] + P[c][r]) / 2;
      return true;
    }
    return function step(f) {   // { t, x, z, acc, v?, vacc?, dir?, dacc? } -> { x, z, vx, vz, v, sd } o null si se descarta
      const vel = velocity(f);
      if (vel && f.v >= 0.6) doppler = true;
      if (!X || (f.t - last) / 1000 > GAP) { if (f.acc > FIRST_ACC) return null; reset(f, vel); }
      else {
        const dt = (f.t - last) / 1000; if (dt <= 0) return null;
        predict(dt); last = f.t;
        const s = sigma(f) ** 2;
        if (!update(0, [f.x, f.z], [s, 0, 0, s])) { if (++misses >= LOST) reset(f, vel); else { if (vel) update(2, vel.m, vel.R); return null; } }
        else misses = 0;
        if (vel) update(2, vel.m, vel.R);
      }
      return { x: X[0], z: X[1], vx: X[2], vz: X[3], v: Math.hypot(X[2], X[3]), sd: Math.sqrt((P[0][0] + P[1][1]) / 2) };
    };
  }

  // ---------- la estación: pistas y remontes con un índice para buscar los cercanos ----------
  const box = (pts, pad) => pts.reduce((b, p) => ({ x0: Math.min(b.x0, p.x - pad), x1: Math.max(b.x1, p.x + pad), z0: Math.min(b.z0, p.z - pad), z1: Math.max(b.z1, p.z + pad) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  const inside = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  const segDist = (a, b, x, z) => { const bx = b.x - a.x, bz = b.z - a.z, l2 = bx * bx + bz * bz, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * bx + (z - a.z) * bz) / l2)) : 0; return Math.hypot(a.x + bx * t - x, a.z + bz * t - z); };
  function project(pts, x, z) {   // punto de la polilínea más cercano: { d, s }
    let best = { d: Infinity, s: 0 };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], bx = b.x - a.x, bz = b.z - a.z, l2 = bx * bx + bz * bz, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * bx + (z - a.z) * bz) / l2)) : 0, d = Math.hypot(a.x + bx * t - x, a.z + bz * t - z);
      if (d < best.d) best = { d, s: a.s + (b.s - a.s) * t };
    }
    return best;
  }
  // pistes: [{ name, c ('v' | 'a' | 'r' | 'n' | 'f'), w (anchura, m), pts: [[x, z]] }]; lifts: [{ name, type, speed?, pts:
  // [[x, z]] de abajo arriba }]; elevation(x, z): cota o null; bounds: { x0, x1, z0, z1 }; geo: la proyección
  function station({ pistes = [], lifts = [], elevation = () => null, bounds = null, geo = null } = {}) {
    const L = lifts.filter(l => l.pts && l.pts.length > 1).map(l => {
      let s = 0; const pts = l.pts.map((p, i, a) => { if (i) s += Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]); return { x: p[0], z: p[1], s }; });
      const t = LIFT[l.type] || ['remonte', 3];
      return { name: l.name || '', type: l.type, speed: l.speed || t[1], label: l.name ? `${t[0]} ${l.name.replace(/\s*\(.*\)$/, '')}` : t[0], pts, length: s, box: box(pts, CORRIDOR + 50) };
    });
    const P = pistes.filter(p => p.pts && p.pts.length > 1).map(p => ({ name: p.name || '', c: p.c, half: (p.w > 0 ? p.w : 30) / 2, pts: p.pts.map(q => ({ x: q[0], z: q[1] })) }));
    const cells = new Map(), key = (i, j) => i * 65536 + j;
    for (const p of P) {
      const pad = p.half + NEAR_PISTE + 15;
      for (let k = 1; k < p.pts.length; k++) {
        const a = p.pts[k - 1], b = p.pts[k];
        for (let i = Math.floor((Math.min(a.x, b.x) - pad) / CELL); i <= Math.floor((Math.max(a.x, b.x) + pad) / CELL); i++)
          for (let j = Math.floor((Math.min(a.z, b.z) - pad) / CELL); j <= Math.floor((Math.max(a.z, b.z) + pad) / CELL); j++) {
            const c = key(i, j); if (!cells.has(c)) cells.set(c, []); cells.get(c).push({ p, a, b });
          }
      }
    }
    // Las pistas cerca de (x, z), de la más cercana a la menos: [[pista, metros hasta su borde (0 dentro)]], hasta 4
    function near(x, z, acc) {
      const best = new Map(), reach = NEAR_PISTE + Math.min(acc || 0, 25) / 2, list = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (list) for (const s of list) { const e = Math.max(0, segDist(s.a, s.b, x, z) - s.p.half); if (e <= reach && !(best.get(s.p) <= e)) best.set(s.p, e); }
      return [...best].sort((a, b) => a[1] - b[1]).slice(0, 4);
    }
    // Los remontes por cuya línea se va: [{ lift, d, s (metros desde la salida) }]
    function liftsAt(x, z, acc) {
      const out = [];
      for (const l of L) { if (!inside(l.box, x, z)) continue; const pr = project(l.pts, x, z); if (pr.d < CORRIDOR + Math.min(acc || 0, 30) / 2) out.push({ lift: l, d: pr.d, s: pr.s }); }
      return out;
    }
    return { P, L, near, liftsAt, elevation, bounds, geo, mapped: P.length > 0 };
  }
  // La estación desde su paquete (public/seg/<id>.json, de scripts/gen_seguimiento.js) y su relieve (heights), si lo hay
  const pairs = a => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
  function fromPack(pack, q) {
    const d = pack.dem;
    return station({ pistes: pack.p.map(([name, c, w, pts]) => ({ name, c, w, pts: pairs(pts) })), lifts: pack.l.map(([name, type, speed, pts]) => ({ name, type, speed, pts: pairs(pts) })),
      elevation: q ? relief(d, q) : () => null, bounds: { x0: 0, z0: 0, x1: d.cols * d.cell, z1: d.rows * d.cell }, geo: pack.geo });
  }

  // ---------- el día ----------
  const FREE = { name: '', c: 'f', free: true }, START = {};   // los estados de Viterbi que no son pistas
  // ¿Sigue el mismo tramo de la bajada? La misma pista, o una con el mismo nombre y color (OpenStreetMap parte las pistas en trozos)
  const same = (g, s) => g.p === s || (!!s && s !== FREE && !!g.p && g.p !== FREE && !!s.name && s.name === g.p.name && s.c === g.p.c);
  function spans(arr, val) { const out = []; let a = -1; for (let i = 0; i <= arr.length; i++) { if (i < arr.length && arr[i] === val) { if (a < 0) a = i; } else if (a >= 0) { out.push([a, i - 1]); a = -1; } } return out; }
  function createDay(S) {
    const F = [], filter = createFilter(), trend = { x: 0, z: 0, t: 0 };
    let gps = null, cache = null;
    const day = { fixes: F, last: null, outSince: null };

    // Una posición: { t (ms), x, z (locales), acc (m) y, si las hay, v, vacc, dir, dacc y alt }. true si se acepta
    function add(raw) {
      if (!(raw.acc <= 50) || !Number.isFinite(raw.x) || !Number.isFinite(raw.z) || !Number.isFinite(raw.t)) return false;
      const b = S.bounds, out = !!b && (raw.x < b.x0 - 500 || raw.x > b.x1 + 500 || raw.z < b.z0 - 500 || raw.z > b.z1 + 500);
      day.last = { t: raw.t, out };
      if (out) { if (day.outSince == null) day.outSince = raw.t; return false; }
      day.outSince = null;
      const k = filter(raw); if (!k) return false;
      const prev = F[F.length - 1];
      if (raw.alt != null && Number.isFinite(raw.alt)) gps = gps == null ? raw.alt : gps + 0.15 * (raw.alt - gps);
      let ele = S.elevation(k.x, k.z); const dem = ele != null;
      if (!dem) ele = gps != null ? gps : prev ? prev.ele : 0;
      // La cuesta hacia donde se va (±6 m), para la velocidad sobre la nieve; y la pendiente del terreno en la dirección de la
      // marcha de los últimos segundos (sin las curvas), a ±10 m, como en las fichas de pista
      const h = (dx, dz) => { const a = S.elevation(k.x + dx, k.z + dz), c = S.elevation(k.x - dx, k.z - dz); return a == null || c == null ? 0 : (a - c) / (2 * Math.hypot(dx, dz)); };
      const ux = k.v > 0.5 ? k.vx / k.v : 0, uz = k.v > 0.5 ? k.vz / k.v : 0, g = dem && k.v > 0.5 ? h(ux * 6, uz * 6) : 0;
      const w = trend.t && raw.t - trend.t < 10000 ? Math.min(1, (raw.t - trend.t) / 6000) : 1;
      trend.x += (k.vx - trend.x) * w; trend.z += (k.vz - trend.z) * w; trend.t = raw.t;
      const tv = Math.hypot(trend.x, trend.z), slope = !dem ? 0 : tv > 1 ? Math.atan(Math.abs(h(trend.x / tv * 10, trend.z / tv * 10))) / RAD : Math.atan(Math.hypot(h(10, 0), h(0, 10))) / RAD;
      // v3: la Doppler cruda mide la distancia mejor que el módulo del vector filtrado (que recorta curvas); si discrepa mucho del filtro es un pico y vale el filtro
      const f = { t: raw.t, x: k.x, z: k.z, acc: raw.acc, sd: k.sd, v: k.v, v3: (Number.isFinite(raw.v) && raw.v >= 0.6 && k.v > 0.6 && Math.abs(raw.v - k.v) < Math.max(3, 0.4 * k.v) ? raw.v : k.v) * Math.sqrt(1 + g * g), ele, slope, dist: 0, drop: 0, dt: 0, near: S.near(k.x, k.z, raw.acc), lifts: S.liftsAt(k.x, k.z, raw.acc) };
      if (prev) {
        const dt = (f.t - prev.t) / 1000, moving = f.v > MOVING, chord = Math.hypot(Math.hypot(f.x - prev.x, f.z - prev.z), ele - prev.ele), run = (f.v3 + prev.v3) / 2 * dt;
        // Tras un hueco de la señal (bajo los pinos), entre la recta y vez y media la recta
        f.dist = !moving ? 0 : dt <= 5 ? run : prev.v > MOVING && dt <= 60 ? Math.min(Math.max(run, chord), 1.5 * chord) : chord;
        f.drop = f.v > 0.9 ? Math.max(0, prev.ele - ele) : 0;   // el desnivel cuenta aunque se vaya despacio
        f.dt = dt;
      }
      F.push(f); cache = null;
      return true;
    }

    // Viajes en remontes conocidos: tramos pegados a la línea de uno, avanzando cuesta arriba a su ritmo
    function findRides(kind) {
      const cands = [], open = new Map();
      for (let i = 0; i < F.length; i++) {
        const f = F[i], here = new Map(f.lifts.map(m => [m.lift, m]));
        for (const c of [...open.values()]) {
          const m = here.get(c.lift), gap = f.t - F[c.i1].t;
          if (m && m.s >= c.top - 15 && gap <= 180000) { c.i1 = i; c.ss.push([i, m.s]); c.dsum += m.d; if (m.s > c.top) c.top = m.s; }
          else if (!m && gap <= 15000) continue;   // un momento fuera de la línea (un rebote de la señal): se espera
          else { open.delete(c.lift); cands.push(c); }
        }
        for (const m of f.lifts) if (!open.has(m.lift)) open.set(m.lift, { lift: m.lift, i1: i, ss: [[i, m.s]], dsum: m.d, top: m.s });
      }
      cands.push(...open.values());
      const ok = [];
      for (const c of cands) {
        const ss = c.ss; let a = 0, b = 0, low = Infinity;
        while (b < ss.length - 1 && ss[b][1] < c.top - 3) b++;   // ya arriba, lo que sigue junto a la llegada no es viaje
        for (let k = 0; k <= b; k++) low = Math.min(low, ss[k][1]);
        for (let k = 0; k <= b; k++) if (ss[k][1] <= low + 4) a = k;   // la salida: la última vez junto al punto más bajo; antes, la cola (o el final de una pista que acaba bajo la línea)
        const j0 = ss[a][0], j1 = ss[b][0], dt = (F[j1].t - F[j0].t) / 1000, ds = ss[b][1] - ss[a][1], v = ds / Math.max(dt, 1), nom = c.lift.speed;
        if (dt < 25 || ds < MIN_RIDE || F[j1].ele - F[j0].ele < 6 || v < Math.max(0.35, 0.45 * nom) || v > 1.8 * nom + 0.7) continue;
        ok.push({ lift: c.lift, i0: j0, i1: j1, s0: ss[a][1], s1: ss[b][1], d: c.dsum / ss.length });
      }
      // Donde dos remontes van juntos, el de la línea más cercana
      ok.sort((p, q) => p.d - q.d);
      const taken = [];
      for (const r of ok) if (!taken.some(o => r.i0 <= o.i1 && o.i0 <= r.i1)) taken.push(r);
      taken.sort((p, q) => p.i0 - q.i0);
      // El mismo viaje cortado en dos (un hueco de la señal): se une
      const rides = [];
      for (const r of taken) {
        const b = rides[rides.length - 1];
        if (b && b.lift === r.lift && r.s0 - b.s1 < 80 && F[r.i0].t - F[b.i1].t < 120000) { b.i1 = r.i1; b.s1 = r.s1; } else rides.push(r);
      }
      for (const r of rides) {
        for (let i = r.i0; i <= r.i1; i++) kind[i] = 'up';
        // La cola: casi quieto (se toleran 3 posiciones más rápidas, al avanzar) junto a la salida, justo antes
        const s0 = r.lift.pts[0]; let t0 = F[r.i0].t, quick = 0;
        for (let j = r.i0 - 1; j >= 0; j--) { const f = F[j]; if (kind[j] !== 'ski' || Math.hypot(f.x - s0.x, f.z - s0.z) > QUEUE_NEAR || t0 - f.t > 60000 || (f.v > 1.5 && ++quick > 3)) break; t0 = f.t; }
        const w = (F[r.i0].t - t0) / 1000;
        Object.assign(r, { label: r.lift.label, known: true, t0: F[r.i0].t, t1: F[r.i1].t, rise: F[r.i1].ele - F[r.i0].ele, wait: w <= QUEUE_MAX ? w : 0 });
      }
      return rides;
    }
    // Subidas sin remonte conocido: ganar CLIMB metros seguidos (con histéresis, para que el ruido no corte una bajada)
    function findUps(kind) {
      const ups = [];
      const leg = (i0, i1) => {
        const dt = (F[i1].t - F[i0].t) / 1000; if (dt < 30) return;
        let L = 0; for (let i = i0 + 1; i <= i1; i++) { L += Math.hypot(F[i].x - F[i - 1].x, F[i].z - F[i - 1].z); kind[i] = 'up'; }
        const v = L / dt;   // a más de 7 m/s, un coche; de remonte, más de 1,2 m/s; si no, a pie o con pieles
        ups.push({ known: false, car: v > 7, label: v > 7 ? 'En coche' : v > 1.2 ? 'Remonte' : 'Subida a pie', i0, i1, t0: F[i0].t, t1: F[i1].t, rise: F[i1].ele - F[i0].ele, wait: 0 });
      };
      for (const [a, b] of spans(kind, 'ski')) {
        let mode = 0, lo = a, hi = a, start = a;
        for (let i = a + 1; i <= b; i++) {
          const e = F[i].ele;
          if (mode === 1) { if (e > F[hi].ele) hi = i; else if (F[hi].ele - e >= CLIMB) { leg(start, hi); mode = -1; lo = i; } }
          else { if (e < F[lo].ele) lo = i; if (e - F[lo].ele >= CLIMB) { mode = 1; start = lo; hi = i; } }
        }
        if (mode === 1) leg(start, hi);
      }
      return ups;
    }
    // Viterbi sobre las posiciones en marcha de una bajada: para cada una, la pista o FREE (fuera de pista)
    function viterbi(steps) {
      let prev = new Map([[START, 0]]); const back = [];
      for (const i of steps) {
        const f = F[i], sig = 7 + Math.min(f.sd, 12), k = 1 / (2 * sig * sig), cur = new Map(), from = new Map();
        for (const [s, e] of [[FREE, FREE_EDGE], ...f.near]) {
          let v = -Infinity, o = null;
          for (const [ps, pv] of prev) { const c = pv + (ps === s || ps === START ? 0 : s === FREE ? -5 : -3); if (c > v) { v = c; o = ps; } }
          cur.set(s, v - e * e * k); from.set(s, o);
        }
        back.push(from); prev = cur;
      }
      let s = null, best = -Infinity; for (const [ps, pv] of prev) if (pv > best) { best = pv; s = ps; }
      const path = new Array(steps.length);
      for (let k = steps.length - 1; k >= 0; k--) { path[k] = s; s = back[k].get(s); }
      return path;
    }
    // Un tramo esquiado entre dos subidas: la bajada, o null si no se pierden MIN_DROP metros
    function runOf(a, b, cls, pis) {
      const steps = []; for (let i = a; i <= b; i++) if (F[i].dist > 0) steps.push(i);
      if (!steps.length) return null;
      const st = S.mapped ? viterbi(steps) : steps.map(() => null);
      // Freeride de verdad, o ruido junto al borde de una pista: el trecho fuera tiene que ser largo y separarse de verdad
      for (const [p, q] of spans(st, FREE)) {
        let L = 0, far = 0;
        for (let k = p; k <= q; k++) { const f = F[steps[k]]; L += f.dist; far = Math.max(far, f.near.length ? f.near[0][1] : Infinity); }
        if (far >= FREE_FAR && (L >= FREE_MIN || far === Infinity)) continue;
        const fill = p > 0 && st[p - 1] !== FREE ? st[p - 1] : q < st.length - 1 && st[q + 1] !== FREE ? st[q + 1] : null;
        for (let k = p; k <= q; k++) { const n = F[steps[k]].near[0]; st[k] = fill || (n ? n[0] : FREE); }
      }
      // Un coche o un autobús: largo, rápido y casi llano, fuera de pista
      const car = new Set();
      for (const [p, q] of spans(st, FREE)) {
        let L = 0, D = 0; for (let k = p; k <= q; k++) { L += F[steps[k]].dist; D += F[steps[k]].drop; }
        const T = (F[steps[q]].t - F[steps[p]].t) / 1000;
        if (L >= 500 && D / L < 0.1 && L / Math.max(T, 1) > 6) for (let k = p; k <= q; k++) car.add(steps[k]);
      }
      const m = { v: 0, a: 0, r: 0, n: 0, f: 0, x: 0 }, segs = [];
      let dist = 0, drop = 0, vmax = 0, moving = 0, steep = 0, top = -Infinity, bottom = Infinity, t0 = null, t1 = null;
      for (let k = 0; k < steps.length; k++) {
        const i = steps[k], f = F[i], s = st[k];
        if (car.has(i)) { cls[i] = 'x'; continue; }
        const c = s === FREE ? 'f' : s ? s.c : 'x';
        cls[i] = c; pis[i] = s; dist += f.dist; m[c] += f.dist; moving += Math.min(f.dt, 60);
        if (t0 == null) t0 = F[Math.max(a, i - 1)].t; t1 = f.t;
        const pf = F[i - 1];   // la máxima, la mantenida en dos posiciones seguidas; la pendiente, la de tres seguidas bajando
        let sv = 0;
        if (k && steps[k - 1] === i - 1 && !car.has(i - 1) && f.t - pf.t <= 3000 && f.acc <= 30) { const v = Math.min(f.v3, pf.v3); if (v < MAX_SPEED) { sv = v; if (v > vmax) vmax = v; } }
        // Cada tramo lleva su máxima (la misma regla): los récords de velocidad de cada pista
        const g = segs[segs.length - 1]; if (g && same(g, s)) { g.m += f.dist; g.v = Math.max(g.v, sv); } else segs.push({ p: s, c, name: s && s !== FREE ? s.name : '', m: f.dist, v: sv });
        if (k > 1 && steps[k - 2] === i - 2 && f.drop > 0 && pf.drop > 0) steep = Math.max(steep, Math.min(f.slope, pf.slope, F[i - 2].slope));
      }
      for (let i = a; i <= b; i++) { if (car.has(i)) continue; drop += F[i].drop; top = Math.max(top, F[i].ele); bottom = Math.min(bottom, F[i].ele); }
      if (drop < MIN_DROP || t0 == null) return null;
      // Los tramos cortos (menos de SEG_MIN metros) se juntan con el de al lado, para contar la bajada sin migas
      // (la máxima de un tramo corto no pasa al vecino: no es suya)
      for (let k = 0; k < segs.length; k++) if (segs[k].m < SEG_MIN && segs.length > 1) { const to = segs[k - 1] || segs[k + 1]; to.m += segs[k].m; segs.splice(k--, 1); }
      for (let k = 1; k < segs.length; k++) if (same(segs[k - 1], segs[k].p)) { segs[k - 1].m += segs[k].m; segs[k - 1].v = Math.max(segs[k - 1].v, segs[k].v); segs.splice(k--, 1); }
      const main = COLORS.concat('x').reduce((b, c) => (m[c] > m[b] ? c : b), 'x');
      return { t0, t1, drop, dist, vmax, moving, steep, top, bottom, m, main, segs: segs.map(g => ({ c: g.c, name: g.name, m: g.m, v: g.v })) };
    }
    function analyze() {
      if (cache) return cache;
      const kind = new Array(F.length).fill('ski'), cls = new Array(F.length).fill('x'), pis = new Array(F.length).fill(null);
      const rides = findRides(kind), ups = findUps(kind), runs = [];
      for (const [a, b] of spans(kind, 'ski')) { const r = runOf(a, b, cls, pis); if (r) runs.push(r); }
      const climbs = rides.concat(ups.filter(u => !u.car)).sort((p, q) => p.t0 - q.t0);
      return (cache = { kind, cls, pis, rides: climbs, runs });
    }

    // El resumen del día: bajadas, subidas, metros por color y freeride, distancia, desnivel, máxima, tiempos
    function summary() {
      const A = analyze(), m = { v: 0, a: 0, r: 0, n: 0, f: 0, x: 0 };
      let dist = 0, drop = 0, vmax = 0, skiTime = 0, steep = 0;
      for (const r of A.runs) { for (const c in m) m[c] += r.m[c]; dist += r.dist; drop += r.drop; skiTime += r.moving; vmax = Math.max(vmax, r.vmax); steep = Math.max(steep, r.steep); }
      return { runs: A.runs, rides: A.rides, m, dist, drop, vmax, skiTime, steep, liftTime: A.rides.reduce((t, r) => t + (r.t1 - r.t0) / 1000, 0), waitTime: A.rides.reduce((t, r) => t + r.wait, 0),
        start: F.length ? F[0].t : null, end: F.length ? F[F.length - 1].t : null, maxEle: F.reduce((x, f) => Math.max(x, f.ele), -Infinity) };
    }
    // El recorrido para dibujarlo y repasarlo: [[x, z, clase, s]] (la clase es la del tramo que llega a ese punto; s, los
    // segundos desde t0, por defecto la primera posición), simplificado por trozos de la misma clase (Douglas-Peucker) hasta
    // que quepa en max puntos. La distancia que mide es la sincronizada: dónde estabas en ese instante frente a dónde te
    // pondría ir a velocidad constante entre los dos puntos que se quedan. Así un rato parado o una cola se conservan, y la
    // posición a cualquier hora sale de interpolar entre dos puntos seguidos. Un día largo (7 h, 66 km) pide unos 760; si ni
    // con 400 m de tolerancia cabe, se quitan puntos repartidos por todo el día (nunca se corta el final)
    function track(max = 1000, t0) {
      const A = analyze(), pts = F.map((f, i) => [f.x, f.z, A.kind[i] === 'up' ? CODE.up : CODE[A.cls[i]], f.t]), base = t0 ?? (F.length ? F[0].t : 0);
      const sed = (pa, pb, p) => { const dt = pb[3] - pa[3], u = dt > 0 ? (p[3] - pa[3]) / dt : 0; return Math.hypot(p[0] - pa[0] - (pb[0] - pa[0]) * u, p[1] - pa[1] - (pb[1] - pa[1]) * u); };
      const dp = (a0, b0, tol, keep) => {   // sin recursión: un día entero son decenas de miles de puntos
        const todo = [[a0, b0]];
        while (todo.length) {
          const [a, b] = todo.pop();
          let far = -1, dm = tol;
          for (let i = a + 1; i < b; i++) { const d = sed(pts[a], pts[b], pts[i]); if (d > dm) { dm = d; far = i; } }
          if (far >= 0) { keep[far] = 1; todo.push([a, far], [far, b]); }
        }
      };
      for (let tol = 3; ; tol *= 1.6) {
        const keep = new Uint8Array(pts.length);
        for (let i = 0; i < pts.length; i++) if (!i || i === pts.length - 1 || pts[i][2] !== pts[i + 1][2] || pts[i][2] !== pts[i - 1][2]) keep[i] = 1;
        let a = 0; for (let i = 1; i < pts.length; i++) if (keep[i]) { dp(a, i, tol, keep); a = i; }
        const out = pts.filter((p, i) => keep[i]);
        if (out.length <= max || tol > 400) return downs(out, max).map(p => [Math.round(p[0]), Math.round(p[1]), p[2], Math.max(0, Math.round((p[3] - base) / 1000))]);
      }
    }
    // Lo que se está haciendo ahora, en una frase
    function status() {
      const f = F[F.length - 1], last = day.last;
      if (!last) return 'Esperando la señal del GPS…';
      if (last.out) return 'Fuera de la estación: empieza a contar cuando llegues';
      if (!f) return 'Buscando una posición más precisa…';
      const A = analyze(), i = F.length - 1, ride = A.rides.find(r => r.i1 === i || (r.i0 <= i && i <= r.i1));
      if (ride) return ride.known ? `Subiendo en ${ride.label}` : 'Subiendo';
      // La pista: la que eligió Viterbi para la última posición en marcha (donde dos pistas se tocan, la más cercana engaña)
      let p = null; for (let j = i; j >= 0 && f.t - F[j].t <= 20000; j--) if (A.pis[j]) { p = A.pis[j]; break; }
      const n = f.near[0], q = p && p !== FREE ? p : n && n[1] < FREE_FAR ? n[0] : null, name = q ? pisteName(q) : '';
      if (f.v < 0.6) return q && (!n || n[1] < 10) ? `Parado en ${name}` : 'Parado';
      if (f.v < MOVING) return 'Andando';
      let back = f; for (let j = i; j >= 0 && f.t - F[j].t <= 20000; j--) back = F[j];
      if (p === FREE || (!q && S.mapped)) return 'Freeride: fuera de pista';
      if (back.ele - f.ele < 2) return q ? `Por ${name}` : 'Esquiando';
      return q ? `Bajando por ${name}` : 'Bajando';
    }
    return { day, add, analyze, summary, track, status };
  }
  const CNAME = { v: 'verde', a: 'azul', r: 'roja', n: 'negra', f: 'de freeride' };
  const pisteName = p => p.c === 'f' ? (p.name ? `el itinerario ${p.name}` : 'un itinerario de freeride') : p.name ? `${p.name} (${CNAME[p.c]})` : `una pista ${CNAME[p.c]}`;

  // ---------- la interfaz de siempre: Calc (app y servidor) ----------
  // new Calc(estación de fromPack, o nada: sin mapa, solo con el GPS); add(posición con lat y lon); payload(estación)
  function Calc(S) {
    this.S = S && S.near ? S : station();
    this.d = createDay(this.S); this.o = null; this.lastT = 0; this.cs = null; this.ct = 0;
  }
  Calc.prototype.add = function (f) {
    let p;
    if (this.S.geo) p = toLocal(f.lat, f.lon, this.S.geo);
    else { const o = this.o || (this.o = f); p = { x: (f.lon - o.lon) * 111320 * Math.cos(o.lat * RAD), z: -(f.lat - o.lat) * 110540 }; }
    this.lastT = f.t; if (this.firstT == null) this.firstT = f.t;   // firstT: el t0 del día (la primera posición de la traza)
    return this.d.add({ t: f.t, x: p.x, z: p.z, acc: f.acc, v: f.v, vacc: f.vacc, dir: f.dir, dacc: f.dacc, alt: f.alt });
  };
  Calc.prototype.live = function () { if (!this.cs || Date.now() - this.ct > 4000) { this.cs = this.d.summary(); this.ct = Date.now(); } return this.cs; };   // en directo, como mucho cada 4 s
  Calc.prototype.status = function () { return this.d.status(); };
  Object.defineProperties(Calc.prototype, {
    v: { get() { const F = this.d.day.fixes, f = F[F.length - 1]; return f && Date.now() - f.t < 15000 ? f.v3 * 3.6 : 0; } },   // km/h sobre la nieve
    desc: { get() { return this.live().drop; } }, runs: { get() { return this.live().runs.length; } }, freeride: { get() { return this.live().m.f; } } });
  // Lo que se guarda del día; null si no hay ninguna bajada
  Calc.prototype.payload = function (s) {
    const S = this.d.summary(); if (!S.runs.length) return null;
    const col = { v: 0, a: 0, r: 0, n: 0, f: 0 }; for (const r of S.runs) if (col[r.main] != null) col[r.main]++;
    const F = this.d.day.fixes, sp = [], n = Math.min(400, F.length);
    for (let k = 0; k < n; k++) { let v = 0; for (let i = Math.floor(k * F.length / n); i < Math.floor((k + 1) * F.length / n); i++) v = Math.max(v, F[i].v3); sp.push(Math.round(v * 3.6)); }   // la más alta de cada trozo, para no perder los picos
    const R = x => Math.round(x);
    return { station: s.id, desnivel: S.drop, km: S.dist / 1000, horas: S.skiTime / 3600, bajadas: S.runs.length, vmax: S.vmax * 3.6, vmed: S.skiTime ? S.dist / S.skiTime * 3.6 : 0,
      col, freeride: S.m.f / 1000, track: this.d.track(1000, this.firstT), speed: sp, source: 'gps',
      detail: { v: 3, m: Object.fromEntries(Object.entries(S.m).map(([k, v]) => [k, R(v)])), wait: R(S.waitTime), lift: R(S.liftTime), steep: R(S.steep),
        runs: S.runs.map(r => [r.t0, r.t1, R(r.drop), R(r.dist), R(r.vmax * 3.6), r.segs.map(g => [g.c, g.name, R(g.m), R(g.v * 3.6)])]),   // tramo: color, pista, metros, máx. km/h
        rides: S.rides.map(r => [r.label, r.t0, r.t1, R(r.rise), R(r.wait), r.known ? 1 : 0]) } };
  };

  const downs = (a, n) => a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round(i * (a.length - 1) / (n - 1))]);
  // Traza compacta para subirla: tiempo (s), latitud y longitud (millonésimas de grado) en diferencias con la anterior;
  // altitud en decímetros, precisión en metros, velocidad en cm/s; desde la v2, rumbo (grados) y la duda de la velocidad
  // (cm/s) y del rumbo (grados), que el filtro de Kalman aprovecha. mk: posiciones marcadas por Android como simuladas.
  function encodeTrace(fx) {
    const r = { v: 2, t: [], la: [], lo: [], al: [], ac: [], sp: [], dr: [], va: [], da: [], mk: 0 }; let pt = 0, pla = 0, plo = 0;
    const int = (v, k, max) => v == null || !Number.isFinite(v) || v < 0 ? null : Math.min(max, Math.round(v * k));
    for (const f of fx) {
      const t = Math.round(f.t / 1000), la = Math.round(f.lat * 1e6), lo = Math.round(f.lon * 1e6);
      r.t.push(t - pt); r.la.push(la - pla); r.lo.push(lo - plo); pt = t; pla = la; plo = lo;
      r.al.push(f.alt == null ? null : Math.round(f.alt * 10)); r.ac.push(Math.min(999, Math.round(f.acc == null ? 99 : f.acc))); r.sp.push(f.v == null ? null : Math.round(f.v * 100));
      r.dr.push(int(f.dir, 1, 359)); r.va.push(int(f.vacc, 100, 5000)); r.da.push(int(f.dacc, 1, 180)); if (f.mock) r.mk++;
    }
    return r;
  }
  // Lo inverso, comprobando todo (lo usa el servidor con datos que no son de fiar): lanza un error si algo no cuadra
  function decodeTrace(r, max = 60000) {
    const bad = () => { throw new Error('traza'); }, int = v => Number.isInteger(v), intN = v => v === null || int(v);
    if (!r || typeof r !== 'object' || (r.v !== 1 && r.v !== 2)) bad();
    const n = Array.isArray(r.t) ? r.t.length : -1; if (n < 1 || n > max) bad();
    const keys = ['la', 'lo', 'al', 'ac', 'sp'].concat(r.v === 2 ? ['dr', 'va', 'da'] : []);
    for (const k of keys) if (!Array.isArray(r[k]) || r[k].length !== n) bad();
    const out = new Array(n); let t = 0, la = 0, lo = 0;
    for (let i = 0; i < n; i++) {
      if (!int(r.t[i]) || !int(r.la[i]) || !int(r.lo[i]) || !intN(r.al[i]) || !int(r.ac[i]) || !intN(r.sp[i])) bad();
      if (r.v === 2 && (!intN(r.dr[i]) || !intN(r.va[i]) || !intN(r.da[i]))) bad();
      if (i && r.t[i] < 0) bad();   // el tiempo no puede ir hacia atrás
      t += r.t[i]; la += r.la[i]; lo += r.lo[i];
      if (Math.abs(la) > 90e6 || Math.abs(lo) > 180e6) bad();
      const v = r.sp[i] === null ? null : r.sp[i] / 100, two = r.v === 2;
      out[i] = { t: t * 1000, lat: la / 1e6, lon: lo / 1e6, alt: r.al[i] === null ? null : r.al[i] / 10, acc: r.ac[i], v: v !== null && v >= 0 && v <= 41.7 ? v : null,   // >150 km/h: se ignora la velocidad del GPS
        dir: two && r.dr[i] !== null && r.dr[i] >= 0 && r.dr[i] < 360 ? r.dr[i] : null, vacc: two && r.va[i] !== null && r.va[i] > 0 ? r.va[i] / 100 : null, dacc: two && r.da[i] !== null && r.da[i] > 0 ? r.da[i] : null };
    }
    return out;
  }
  const api = { Calc, station, fromPack, heights, relief, createDay, createFilter, toLocal, toLatLon, downs, encodeTrace, decodeTrace, LIFT, CODE };
  if (typeof module === 'object' && module.exports) module.exports = api; else Object.assign(root, api);
})(this);
