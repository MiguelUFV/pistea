// Añade a public/img/estaciones.json cuántas pistas de cada color tiene cada estación (nombres distintos en OpenStreetMap:
// novice = verde, easy = azul, intermediate = roja, advanced/expert = negra). Uso: node scripts/gen_dificultad.js
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), F = path.join(R, 'public', 'img', 'estaciones.json'), E = path.join(R, 'mapas', 'estaciones');
const COL = { novice: 'v', easy: 'a', intermediate: 'r', advanced: 'n', expert: 'n' };
const out = JSON.parse(fs.readFileSync(F, 'utf8'));
for (const id of fs.readdirSync(E)) {
  const f = path.join(E, id, 'data', 'features.json'); if (!fs.existsSync(f) || !out[id]) continue;
  const sets = { v: new Set(), a: new Set(), r: new Set(), n: new Set() };
  for (const [i, p] of JSON.parse(fs.readFileSync(f, 'utf8')).pistes.entries()) { const c = COL[p.difficulty]; if (c) sets[c].add(p.name || '#' + i); }
  out[id].dif = Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, s.size]));
}
fs.writeFileSync(F, JSON.stringify(out));
console.log(Object.entries(out).slice(0, 4).map(([k, v]) => k + ' ' + JSON.stringify(v.dif)).join('\n'));
