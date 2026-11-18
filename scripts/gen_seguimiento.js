// Escribe public/seg/<estación>.json, lo que el motor del día (public/calc.js) necesita de cada estación, y añade a
// public/img/estaciones.json el recuadro de su miniatura (caja), para dibujar encima los recorridos:
//   geo  la proyección: huso UTM y esquina noroeste del mapa 3D (de la ficha de la estación en Estaciones3D) y su centro
//   dem  cómo leer su relieve, que se pide aparte al mapa 3D (mapas/estaciones/<id>/data/dem.u16d)
//   p    pistas: [nombre, color (v, a, r, n o f, itinerario: los oficiales y el freeride de OSM), anchura (0: sin dato), [x, z, x, z…]]
//   l    remontes: [nombre, tipo, velocidad (m/s), [x, z…] de abajo arriba]
// Uso: node scripts/gen_seguimiento.js (necesita ../Estaciones3D/scripts/estaciones). Volver a ejecutarlo si cambian
// los mapas o si se rehacen las miniaturas (gen_miniaturas.py reescribe estaciones.json).
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { heights, relief, toLocal } = require('../public/calc.js');
const R = path.join(__dirname, '..'), E = path.join(R, 'mapas', 'estaciones'), OUT = path.join(R, 'public', 'seg'), FICHAS = path.join(R, '..', 'Estaciones3D', 'scripts', 'estaciones');
const SI = path.join(R, 'public', 'img', 'estaciones.json'), GEO = require('../estaciones_geo.json');
const COL = { novice: 'v', easy: 'a', intermediate: 'r', advanced: 'n', expert: 'n', extreme: 'n', freeride: 'f' };
const SPEED = { chair_lift: 2.3, gondola: 5, cable_car: 8, mixed_lift: 5, drag_lift: 3, 't-bar': 3, 'j-bar': 3, platter: 3, rope_tow: 2, magic_carpet: 0.8 };
const W = 520, H = 546;   // las miniaturas (gen_miniaturas.py)

// Douglas-Peucker a 1,5 m: menos puntos y la misma línea a efectos del GPS
function simplify(pts, tol = 1.5) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const todo = [[0, pts.length - 1]];
  while (todo.length) {
    const [a, b] = todo.pop(), [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let far = -1, dm = tol;
    for (let i = a + 1; i < b; i++) {
      const t = l2 ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / l2)) : 0, d = Math.hypot(ax + dx * t - pts[i][0], az + dz * t - pts[i][1]);
      if (d > dm) { dm = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; todo.push([a, far], [far, b]); }
  }
  return pts.filter((p, i) => keep[i]);
}
const flat = pts => simplify(pts).flatMap(([x, z]) => [Math.round(x * 2) / 2, Math.round(z * 2) / 2]);
// El recuadro de la miniatura, la misma cuenta que gen_miniaturas.py
function caja(f, meta) {
  const [x0, z0, x1, z1] = meta.core;
  let pts = f.pistes.flatMap(l => l.pts).filter(p => x0 <= p[0] && p[0] <= x1 && z0 <= p[1] && p[1] <= z1); if (!pts.length) pts = [[x0, z0], [x1, z1]];
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), mn = a => a.reduce((m, v) => Math.min(m, v), Infinity), mx = a => a.reduce((m, v) => Math.max(m, v), -Infinity);
  let cx = (mn(xs) + mx(xs)) / 2, cz = (mn(zs) + mx(zs)) / 2;
  let ancho = Math.max(mx(xs) - mn(xs), (mx(zs) - mn(zs)) * W / H) * 1.18 + 200;
  ancho = Math.min(ancho, x1 - x0, (z1 - z0) * W / H); const alto = ancho * H / W;
  cx = Math.min(Math.max(cx, x0 + ancho / 2), x1 - ancho / 2); cz = Math.min(Math.max(cz, z0 + alto / 2), z1 - alto / 2);
  return [cx - ancho / 2, cz - alto / 2, cx + ancho / 2, cz + alto / 2].map(v => Math.round(v * 10) / 10);
}

fs.mkdirSync(OUT, { recursive: true });
const si = JSON.parse(fs.readFileSync(SI, 'utf8'));
for (const id of fs.readdirSync(E).sort()) {
  const d = path.join(E, id, 'data'), py = path.join(FICHAS, id.replace(/-/g, '_') + '.py');
  if (!fs.existsSync(path.join(d, 'features.json'))) continue;
  const src = fs.readFileSync(py, 'utf8'), zone = +(src.match(/^ZONE\s*=\s*(\d+)/m) || [])[1], near = src.match(/^NEAR\s*=\s*dict\(xmin=(\d+),\s*ymin=(\d+),\s*xmax=(\d+),\s*ymax=(\d+)\)/m);
  const meta = JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8')), f = JSON.parse(fs.readFileSync(path.join(d, 'features.json'), 'utf8'));
  if (!zone || !near) throw new Error(`${id}: sin ZONE o NEAR en ${py}`);
  const [, xmin, ymin, xmax, ymax] = near.map(Number);
  if (Math.abs(xmax - xmin - meta.width_m) > 1 || Math.abs(ymax - ymin - meta.height_m) > 1) throw new Error(`${id}: NEAR no casa con el mapa`);
  const g = GEO[id], geo = { zone, x0: xmin, y1: ymax, lat: g.lat, lon: g.lon };
  const dem = { cols: meta.cols, rows: meta.rows, cell: meta.cell_m, base: meta.dem_q[0], step: meta.dem_q[1] };
  const ele = relief(dem, heights(zlib.gunzipSync(fs.readFileSync(path.join(d, 'dem.u16d')))));
  // Comprobación: el centro de la estación cae dentro de su mapa y a la cota de una estación de esquí
  const c = toLocal(g.lat, g.lon, geo), hc = ele(c.x, c.z);
  if (hc == null || hc < 600 || hc > 3600) throw new Error(`${id}: el centro (${c.x | 0}, ${c.z | 0}) no cae en el mapa (cota ${hc})`);
  // Los itinerarios (marcados en build_assets.py: los de las fuentes oficiales y el freeride de OSM) son «f»: el motor los
  // cuenta como freeride, no como pista negra
  const p = f.pistes.filter(x => COL[x.difficulty] && x.pts.length > 1).map(x => [x.name || '', x.itinerary ? 'f' : COL[x.difficulty], x.width > 4 && x.width < 200 ? Math.round(x.width) : 0, flat(x.pts)]);
  const l = f.lifts.filter(x => SPEED[x.type] && x.pts.length > 1).map(x => {
    const a = x.pts[0], b = x.pts[x.pts.length - 1], ea = ele(a[0], a[1]), eb = ele(b[0], b[1]), pts = ea != null && eb != null && ea > eb ? x.pts.slice().reverse() : x.pts;   // de abajo arriba
    return [x.name || '', x.type, x.type === 'chair_lift' && x.detachable ? 5 : SPEED[x.type], flat(pts)];
  });
  const box = caja(f, meta);
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ id, geo, dem, caja: box, p, l }));
  if (si[id]) si[id].caja = box;
  console.log(`${id}: ${p.length} tramos de pista (${p.filter(x => x[1] === 'f').length} de freeride), ${l.length} remontes, centro a ${Math.round(hc)} m, ${(fs.statSync(path.join(OUT, id + '.json')).size / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(SI, JSON.stringify(si));
