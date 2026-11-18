// Banco de pruebas del motor del día (public/calc.js): días sintéticos con la verdad conocida, medidos con un GPS simulado
// como los de verdad, y lo que sale frente a lo que fue; también con el cálculo anterior, para comparar. Cualquier cambio en
// el motor se mide aquí antes y después. Uso: node scripts/banco_seguimiento.js [semillas = 12]
//
// El mundo: una ladera de unos 18º con ondulaciones, tres remontes (uno, C, que no está en el mapa, como un remonte nuevo
// que OpenStreetMap aún no tiene) y cuatro pistas con su anchura. El día, seis bajadas:
//   1. C (desconocido) y la verde        2. A y la roja, con un descanso de 1 min       3. A y la azul, con 40 s sin señal
//   4. B y la negra, con un tramo por su borde (a 22 m del centro: el mapa dice 25 m de ancho, pero mide 50 y es pista)
//   5. B y freeride: una ladera virgen a 200 m de cualquier pista (empieza y acaba junto a la negra)
//   6. B y la negra, con 300 m a 45 m de su centro (fuera de pista, junto a ella) y al final, en coche, 900 m por una carretera
// El freeride de verdad se mide por geometría: a más de 10 m del borde real de toda pista.
// El GPS: una posición por segundo con una deriva lenta de 2,5 m, ruido de 1 m, rebotes de 30 m en el 1,5 % de las
// posiciones, un 2 % perdidas, velocidad Doppler con 0,2 m/s de error, rumbo con 3º y altitud con una deriva de 8 m.
const { station, createDay, Calc } = require('../public/calc.js');

const SEEDS = Number(process.argv[2] || 12);
const elevation = (x, z) => 2250 - 0.32 * z + 6 * Math.sin(x / 45) + 4 * Math.cos(z / 70);
const bounds = { x0: 0, x1: 2000, z0: 0, z1: 2000 };
const line = (pts, n = 4) => {
  const out = [];
  for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], m = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / n)); for (let j = 0; j < m; j++) out.push({ x: a.x + (b.x - a.x) * j / m, z: a.z + (b.z - a.z) * j / m }); }
  out.push(pts[pts.length - 1]); return out;
};
const wave = (x0, amp, per, z0, z1) => { const p = []; for (let z = z0; z <= z1; z += 10) p.push({ x: x0 + amp * Math.sin((z - z0) / per), z }); return p; };
const liftOf = (name, type, speed, a, b) => ({ name, type, speed, a, b, pts: line([a, b], 50) });
const A = liftOf('A', 'chair_lift', 2.3, { x: 400, z: 1450 }, { x: 400, z: 150 });
const B = liftOf('B', 'drag_lift', 3.0, { x: 1000, z: 1300 }, { x: 1000, z: 400 });
const C = liftOf('C', 'chair_lift', 2.3, { x: 150, z: 1500 }, { x: 300, z: 250 });
const verde = line([{ x: 305, z: 265 }, ...wave(230, 25, 150, 300, 1400), { x: 400, z: 1460 }]);
const roja = line([{ x: 410, z: 160 }, { x: 600, z: 300 }, ...wave(600, 100, 200, 310, 1380), { x: 420, z: 1440 }]);
const azul = line([{ x: 410, z: 160 }, { x: 760, z: 350 }, ...wave(820, 70, 230, 360, 1240), { x: 990, z: 1310 }]);
const negra = line([{ x: 1000, z: 395 }, { x: 1120, z: 450 }, ...wave(1120, 30, 120, 460, 1270), { x: 1005, z: 1305 }]);
const libre = line([{ x: 1000, z: 400 }, { x: 1350, z: 420 }, ...wave(1380, 15, 100, 430, 1250), { x: 1010, z: 1320 }]);
const PISTES = [['Verde', 'v', 30, verde], ['Roja', 'r', 40, roja], ['Azul', 'a', 30, azul], ['Negra', 'n', 25, negra]];
// Metros desde (x, z) hasta el borde de la pista más cercana, con su anchura de verdad (la negra mide 50 m, no los 25 del mapa)
const REAL = PISTES.map(([n, , w, l]) => [n === 'Negra' ? 25 : w / 2, l]);
function offPiste(x, z) {
  let best = Infinity;
  for (const [half, l] of REAL) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], bx = b.x - a.x, bz = b.z - a.z, l2 = bx * bx + bz * bz, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * bx + (z - a.z) * bz) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + bx * t - x, a.z + bz * t - z) - half);
  }
  return best;
}
// Lo que sabe el motor: las pistas y los remontes A y B (C no está en el mapa)
const S = station({ pistes: PISTES.map(([name, c, w, l]) => ({ name, c, w, pts: l.map(p => [p.x, p.z]) })), lifts: [A, B].map(l => ({ name: l.name, type: l.type, speed: l.speed, pts: l.pts.map(p => [p.x, p.z]) })), elevation, bounds });

function simulateDay(seed) {
  let s = seed * 7919 + 13;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const truth = [], DT = 0.1;
  let t = new Date('2026-01-10T09:30:00').getTime(), run = 0;
  const push = (x, z, vh, dir, kind, piste = null, v3 = vh) => { truth.push({ t, x, z, vh, v3, dir, kind, piste, run }); t += DT * 1000; };
  const stand = (p, secs, kind) => { for (let k = 0; k < secs / DT; k++) push(p.x + 0.3 * Math.sin(k / 40), p.z + 0.3 * Math.cos(k / 50), 0.05, 0, kind); };
  const go = (a, b, speed, kind) => { const d = Math.hypot(b.x - a.x, b.z - a.z), dir = Math.atan2(b.x - a.x, -(b.z - a.z)) * 180 / Math.PI; for (let q = 0; q < d; q += speed * DT) push(a.x + (b.x - a.x) * q / d, a.z + (b.z - a.z) * q / d, speed, dir, kind); };
  const ride = l => go(l.a, l.b, l.speed, 'lift');
  // Esquiar una línea con curvas de ±amp m; off(u): separación de su centro; label(u): la pista de verdad
  function ski(path, label, target, amp, per, { rest, off = () => 0 } = {}) {
    run++;
    const dense = []; let q = 0;
    path.forEach((p, k) => { if (k) q += Math.hypot(p.x - path[k - 1].x, p.z - path[k - 1].z); dense.push({ ...p, s: q }); });
    const total = q, at = u => {
      let i = 1; while (i < dense.length - 1 && dense[i].s < u) i++;
      const a = dense[i - 1], b = dense[i], k = (u - a.s) / ((b.s - a.s) || 1), nx = -(b.z - a.z), nz = b.x - a.x, l = Math.hypot(nx, nz) || 1;
      const o = amp * Math.sin(2 * Math.PI * u / per) * Math.min(1, u / 40, (total - u) / 40) + off(u);
      return { x: a.x + (b.x - a.x) * k + nx / l * o, z: a.z + (b.z - a.z) * k + nz / l * o };
    };
    let u = 0, v = 2, p = at(0), rested = false;
    while (u < total) {
      if (rest && !rested && u > rest.at) { rested = true; stand(p, rest.secs, 'stop'); v = 1; }
      v += (target(u) - v) / 3 * DT;
      let du = v * DT, n = at(u + du);
      du *= v * DT / (Math.hypot(Math.hypot(n.x - p.x, n.z - p.z), elevation(n.x, n.z) - elevation(p.x, p.z)) || 1);
      n = at(u + du);
      const dh = Math.hypot(n.x - p.x, n.z - p.z);
      push(n.x, n.z, dh / DT, Math.atan2(n.x - p.x, -(n.z - p.z)) * 180 / Math.PI, 'ski', label(u), Math.hypot(dh, elevation(n.x, n.z) - elevation(p.x, p.z)) / DT);
      u += du; p = n;
    }
    return p;
  }
  const qA = { x: 420, z: 1470 }, qB = { x: 1000, z: 1320 }, qC = { x: 160, z: 1515 };
  stand(qC, 60, 'queue'); go(qC, C.a, 0.6, 'walk'); ride(C); go(C.b, verde[0], 1, 'walk');
  let end = ski(verde, () => 'Verde', () => 9, 6, 30);
  go(end, qA, 1, 'walk'); stand(qA, 240, 'queue'); go(qA, A.a, 0.6, 'walk'); ride(A); go(A.b, roja[0], 1, 'walk');
  end = ski(roja, () => 'Roja', u => (u > 600 && u < 680 ? 19.5 : 12), 9, 32, { rest: { at: 300, secs: 60 } });
  go(end, qA, 1, 'walk'); stand(qA, 120, 'queue'); go(qA, A.a, 0.6, 'walk'); ride(A); go(A.b, azul[0], 1, 'walk');
  const gapAt = t + 40000; end = ski(azul, () => 'Azul', () => 10, 7, 28);
  go(end, qB, 1, 'walk'); stand(qB, 60, 'queue'); go(qB, B.a, 0.6, 'walk'); ride(B); go(B.b, negra[0], 1, 'walk');
  end = ski(negra, () => 'Negra', () => 14, 6, 22, { off: u => (u > 300 && u < 600 ? 22 * Math.min(1, (u - 300) / 30, (600 - u) / 30) : 0) });
  go(end, qB, 1, 'walk'); stand(qB, 45, 'queue'); go(qB, B.a, 0.6, 'walk'); ride(B); go(B.b, libre[0], 1, 'walk');
  end = ski(libre, () => 'Libre', () => 11, 8, 26);
  go(end, qB, 1, 'walk'); stand(qB, 30, 'queue'); go(qB, B.a, 0.6, 'walk'); ride(B); go(B.b, negra[0], 1, 'walk');
  const near = u => u > 200 && u < 520;
  end = ski(negra, u => (near(u) && u > 230 && u < 490 ? 'Libre' : 'Negra'), () => 13, 6, 22, { off: u => (near(u) ? 45 * Math.min(1, (u - 200) / 30, (520 - u) / 30) : 0) });
  stand(end, 60, 'stop'); go(end, { x: 1010, z: 1330 }, 1, 'walk');
  go({ x: 1010, z: 1330 }, { x: 1300, z: 1360 }, 14, 'car'); go({ x: 1300, z: 1360 }, { x: 1900, z: 1400 }, 14, 'car'); stand({ x: 1900, z: 1400 }, 30, 'stop');

  // Lo que fue: distancia, desnivel y metros de freeride (por geometría: a más de 10 m del borde de toda pista, con su
  // anchura de verdad); la máxima mantenida un segundo
  const T = { dist: 0, drop: 0, free: 0, free6: 0, vmax: 0, runs: run };
  for (let k = 1; k < truth.length; k++) {
    const a = truth[k - 1], b = truth[k];
    if (b.kind !== 'ski') continue;
    const d = Math.hypot(Math.hypot(b.x - a.x, b.z - a.z), elevation(b.x, b.z) - elevation(a.x, a.z));
    T.dist += d; T['run' + b.run] = (T['run' + b.run] || 0) + d;
    if (offPiste(b.x, b.z) > 10) { T.free += d; if (b.run === 6) T.free6 += d; }
  }
  for (let k = 10; k < truth.length; k += 10) if (truth[k].kind === 'ski' && truth[k - 10].kind === 'ski') T.drop += Math.max(0, elevation(truth[k - 10].x, truth[k - 10].z) - elevation(truth[k].x, truth[k].z));
  for (let k = 10; k < truth.length; k++) { let m = Infinity; for (let j = k - 10; j <= k; j++) m = Math.min(m, truth[j].kind === 'ski' ? truth[j].v3 : 0); T.vmax = Math.max(T.vmax, m); }

  // El GPS, a una posición por segundo
  const fixes = [], phi = Math.exp(-1 / 20), pa = Math.exp(-1 / 60);
  let bx = 0, bz = 0, ba = 0;
  for (let k = 0; k < truth.length; k += 10) {
    const p = truth[k];
    bx = phi * bx + Math.sqrt(1 - phi * phi) * 2.5 * gauss(); bz = phi * bz + Math.sqrt(1 - phi * phi) * 2.5 * gauss(); ba = pa * ba + Math.sqrt(1 - pa * pa) * 8 * gauss();
    if (rnd() < 0.02 || (p.t > gapAt && p.t < gapAt + 40000)) continue;
    let x = p.x + bx + gauss(), z = p.z + bz + gauss();
    if (rnd() < 0.015) { const a = rnd() * 2 * Math.PI; x += 30 * Math.cos(a); z += 30 * Math.sin(a); }
    const v = Math.max(0, p.vh + 0.2 * gauss());
    fixes.push({ t: p.t, x, z, acc: Math.max(3, 3.5 + 1.5 * Math.abs(gauss())), v, vacc: 0.4, dir: v >= 0.5 ? (p.dir + 3 * gauss() + 360) % 360 : null, dacc: 5, alt: elevation(p.x, p.z) + ba + 3 * gauss() });
  }
  return { T, fixes };
}

// El cálculo de antes (public/calc.js hasta el 16-nov-2026), para comparar: altitud del GPS, bajada = moverse cuesta abajo
function oldCalc(fixes) {
  const C = { o: null, last: null, alt: null, desc: 0, km: 0, runs: 0, skiing: false, still: 0, drop: 0, len: 0 };
  const end = () => { if (C.len > 150 && C.drop > 30) C.runs++; C.drop = 0; C.len = 0; C.skiing = false; C.still = 0; };
  for (const f of fixes) {
    if (f.acc > 40) continue;
    const a = f.alt == null ? null : C.alt == null ? f.alt : C.alt + .15 * (f.alt - C.alt); let v = f.v != null ? f.v * 3.6 : 0; const l = C.last;
    if (l) {
      const dt = (f.t - l.t) / 1000; if (dt <= 0) continue;
      if (dt > 30) end();
      else { const dd = Math.hypot(f.x - l.x, f.z - l.z), dh = a != null && C.alt != null ? a - C.alt : 0; if (!v) v = dd / dt * 3.6;
        if (v > 8 && dh < -.05) { C.skiing = true; C.still = 0; C.desc -= dh; C.km += dd / 1000; C.drop -= dh; C.len += dd; } else if (C.skiing && (C.still += dt) > 8) end(); }
    }
    if (a != null) C.alt = a; C.last = { x: f.x, z: f.z, t: f.t };
  }
  end(); return C;
}

const rows = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const { T, fixes } = simulateDay(seed);
  const t0 = Date.now(), d = createDay(S);
  for (const f of fixes) d.add(f);
  const s = d.summary(), ms = Date.now() - t0, o = oldCalc(fixes);
  const mains = s.runs.map(r => r.main).join(''), freeOn = s.runs.filter((r, k) => k !== 4 && k !== 5).reduce((a, r) => a + r.m.f, 0);
  const free6 = s.runs[5] ? s.runs[5].m.f : 0;
  rows.push({ seed, ms, runs: s.runs.length, rides: s.rides.length, mains, ok: s.runs.length === 6 && s.rides.length === 6 && mains === 'vranfn',
    dist: 100 * (s.dist - T.dist) / T.dist, drop: 100 * (s.drop - T.drop) / T.drop, vmax: (s.vmax - T.vmax) * 3.6, free: 100 * (s.m.f - T.free) / T.free, freeOn, free6,
    waits: s.rides.map(r => Math.round(r.wait)).join('/'), free6T: T.free6, last: s.runs[5] ? s.runs[5].dist - T.run6 : 0, oDist: 100 * (o.km * 1000 - T.dist) / T.dist, oDrop: 100 * (o.desc - T.drop) / T.drop, oRuns: o.runs,
    names: s.runs.map(r => r.segs.map(g => `${g.name || g.c} ${Math.round(g.m)}`).join(' > ')).join(' | ') });
}
const mean = k => rows.reduce((a, r) => a + r[k], 0) / rows.length, range = k => `${Math.min(...rows.map(r => r[k])).toFixed(1)} a ${Math.max(...rows.map(r => r[k])).toFixed(1)}`;
for (const r of rows) console.log(`semilla ${r.seed}: ${r.runs} bajadas, ${r.rides} subidas, colores ${r.mains}${r.ok ? '' : ' (MAL)'}; distancia ${r.dist.toFixed(1)} %, desnivel ${r.drop.toFixed(1)} %, máxima ${r.vmax.toFixed(1)} km/h, freeride ${r.free.toFixed(1)} %, freeride falso ${r.freeOn.toFixed(0)} m, ${r.ms} ms\n   ${r.names}`);
console.log(`\nAHORA (media de ${rows.length} días, verdad: 6 bajadas):`);
console.log(`  días bien contados (bajadas, subidas y color de cada una): ${rows.filter(r => r.ok).length} de ${rows.length}`);
console.log(`  distancia ${mean('dist').toFixed(1)} % (${range('dist')}), desnivel ${mean('drop').toFixed(1)} % (${range('drop')}), máxima ${mean('vmax').toFixed(1)} km/h (${range('vmax')})`);
console.log(`  freeride medido ${mean('free').toFixed(1)} % (${range('free')}) sobre el de verdad; freeride falso en bajadas por pista ${mean('freeOn').toFixed(0)} m; tramo junto a la negra ${mean('free6').toFixed(0)} m (de verdad ${mean('free6T').toFixed(0)})`);
console.log(`  colas (s): ${rows[0].waits} en la semilla 1; de verdad, unos 0 (C, desconocido) / 290 / 165 / 95 / 70 / 55 (la espera quieta más el avance despacio hasta la salida)`);
console.log(`  la última bajada, que acaba en coche: ${mean('last').toFixed(0)} m de más (${range('last')}); el coche son 900 m`);
console.log(`ANTES: bajadas ${range('oRuns')} (de verdad 6), distancia ${mean('oDist').toFixed(1)} % (${range('oDist')}), desnivel ${mean('oDrop').toFixed(1)} % (${range('oDrop')}), sin pistas ni freeride`);
