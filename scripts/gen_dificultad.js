// Añade a public/img/estaciones.json cuántas pistas de cada color tiene cada estación: las mismas que lista su ficha
// (gen_pistas.js), con nombre y el color de la fuente oficial (el de su primer tramo, que build_assets.py de Estaciones3D
// deja con el color de la lista). Los itinerarios no entran en la mezcla. Uso: node scripts/gen_dificultad.js
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), F = path.join(R, 'public', 'img', 'estaciones.json'), E = path.join(R, 'mapas', 'estaciones');
const COL = { novice: 'v', easy: 'a', intermediate: 'r', advanced: 'n', expert: 'n' };
const out = JSON.parse(fs.readFileSync(F, 'utf8'));
for (const id of fs.readdirSync(E)) {
  const f = path.join(E, id, 'data', 'features.json'); if (!fs.existsSync(f) || !out[id]) continue;
  const first = new Map();
  for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).pistes) if (p.official && p.name && COL[p.difficulty] && (!p.station || p.station === id) && !first.has(p.name)) first.set(p.name, p.itinerary ? 'i' : COL[p.difficulty]);
  out[id].dif = { v: 0, a: 0, r: 0, n: 0 };
  for (const c of first.values()) if (c in out[id].dif) out[id].dif[c]++;
}
fs.writeFileSync(F, JSON.stringify(out));
console.log(Object.entries(out).slice(0, 4).map(([k, v]) => k + ' ' + JSON.stringify(v.dif)).join('\n'));
