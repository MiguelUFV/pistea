// Escribe public/img/pistas.json: las pistas con nombre de cada estación (las mismas que lista el mapa 3D, las marcadas como
// oficiales) con su color. La ficha de estación las enseña y abre el 3D en cada una (?pista=).
// Colores: novice = verde, easy = azul, intermediate = roja, advanced/expert = negra, e «i» los itinerarios (marcados en
// build_assets.py de Estaciones3D). Nombre y color salen de las fuentes oficiales de cada estación
// (Estaciones3D/scripts/estaciones/correcciones_pistas.json). Uso: node scripts/gen_pistas.js
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), E = path.join(R, 'mapas', 'estaciones'), F = path.join(R, 'public', 'img', 'pistas.json');
const COL = { novice: 'v', easy: 'a', intermediate: 'r', advanced: 'n', expert: 'n' };
const out = {};
for (const id of fs.readdirSync(E).sort()) {
  const f = path.join(E, id, 'data', 'features.json'); if (!fs.existsSync(f)) continue;
  const p = new Map();
  // Solo las de la estación: el mapa de La Molina lleva también las de Masella (y Astún las de Candanchú…), marcadas con su `station`
  for (const x of JSON.parse(fs.readFileSync(f, 'utf8')).pistes) if (x.official && x.name && COL[x.difficulty] && (!x.station || x.station === id) && !p.has(x.name)) p.set(x.name, x.itinerary ? 'i' : COL[x.difficulty]);
  out[id] = [...p].sort((a, b) => 'varni'.indexOf(a[1]) - 'varni'.indexOf(b[1]) || a[0].localeCompare(b[0], 'es'));   // de verde a negra, itinerarios al final, y por nombre
}
fs.writeFileSync(F, JSON.stringify(out));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length} pistas`).join('\n'));
