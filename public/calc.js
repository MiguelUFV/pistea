// Cálculo de un día de esquí a partir de posiciones GPS. Lo usan la app (para enseñar las cifras en directo) y el servidor
// (antitrampas: recalcula el día desde la traza y descarta lo que mande el móvil). Mismo código en los dos lados.
// Una posición: { t (ms), lat, lon, alt (m o null), acc (m), v (m/s o null) }.
(function (root) {
  'use strict';
  const downs = (a, n) => a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round(i * (a.length - 1) / (n - 1))]);

  // Desnivel con la altitud suavizada y solo bajando; una bajada termina tras 8 s sin bajar (un salto o un parón del GPS no
  // la corta). El color de cada bajada es una ESTIMACIÓN por su pendiente media (no se compara con las pistas del catálogo).
  function Calc() { Object.assign(this, { last: null, o: null, alt: null, desc: 0, km: 0, max: 0, sv: 0, nv: 0, tSki: 0, runs: 0, skiing: false, still: 0, drop: 0, len: 0, col: { v: 0, a: 0, r: 0, n: 0 }, tr: [], sp: [], v: 0, lastT: 0 }); }
  Calc.prototype.endRun = function () { if (this.len > 150 && this.drop > 30) { this.runs++; const g = this.drop / this.len * 100; this.col[g < 10 ? 'v' : g < 18 ? 'a' : g < 27 ? 'r' : 'n']++; } this.drop = 0; this.len = 0; this.skiing = false; this.still = 0; };
  Calc.prototype.add = function (f) {
    if (f.acc > 40) return;
    const o = this.o || (this.o = f), x = (f.lon - o.lon) * 111320 * Math.cos(o.lat * Math.PI / 180), y = -(f.lat - o.lat) * 110540, l = this.last;
    const a = f.alt == null ? null : this.alt == null ? f.alt : this.alt + .15 * (f.alt - this.alt); let v = f.v != null ? f.v * 3.6 : 0;
    if (l) {
      const dt = (f.t - l.t) / 1000; if (dt <= 0) return;
      if (dt > 30) this.endRun();   // se perdió la señal: no se unen las dos posiciones
      else {
        const dd = Math.hypot(x - l.x, y - l.y), dh = a != null && this.alt != null ? a - this.alt : 0; if (!v) v = dd / dt * 3.6;
        if (v > 8 && dh < -.05) { this.skiing = true; this.still = 0; this.desc -= dh; this.km += dd / 1000; this.tSki += dt; this.drop -= dh; this.len += dd; this.sv += v; this.nv++; this.max = Math.max(this.max, v); }
        else if (this.skiing && (this.still += dt) > 8) this.endRun();
      }
    }
    if (a != null) this.alt = a; this.last = { x, y, t: f.t }; this.lastT = f.t; this.tr.push([x, y]); this.sp.push(Math.round(v)); this.v = v;
  };
  Calc.prototype.payload = function (s) {
    this.endRun(); if (this.desc < 20) return null; let mx = 1e9, my = 1e9; for (const p of this.tr) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1]; }
    return { station: s.id, desnivel: this.desc, km: this.km, horas: this.tSki / 3600, bajadas: this.runs, vmax: this.max, vmed: this.nv ? this.sv / this.nv : 0, col: this.col, track: downs(this.tr.map(p => [p[0] - mx, p[1] - my]), 60), speed: downs(this.sp, 400), source: 'gps' };
  };

  // Traza compacta para subirla: tiempo (s), latitud y longitud (millonésimas de grado) en diferencias con la anterior;
  // altitud en decímetros, precisión en metros, velocidad en cm/s. mk: posiciones marcadas por Android como simuladas.
  function encodeTrace(fx) {
    const r = { v: 1, t: [], la: [], lo: [], al: [], ac: [], sp: [], mk: 0 }; let pt = 0, pla = 0, plo = 0;
    for (const f of fx) {
      const t = Math.round(f.t / 1000), la = Math.round(f.lat * 1e6), lo = Math.round(f.lon * 1e6);
      r.t.push(t - pt); r.la.push(la - pla); r.lo.push(lo - plo); pt = t; pla = la; plo = lo;
      r.al.push(f.alt == null ? null : Math.round(f.alt * 10)); r.ac.push(Math.min(999, Math.round(f.acc == null ? 99 : f.acc))); r.sp.push(f.v == null ? null : Math.round(f.v * 100)); if (f.mock) r.mk++;
    }
    return r;
  }
  // Lo inverso, comprobando todo (lo usa el servidor con datos que no son de fiar): lanza un error si algo no cuadra
  function decodeTrace(r, max = 60000) {
    const bad = () => { throw new Error('traza'); }, int = v => Number.isInteger(v), intN = v => v === null || int(v);
    if (!r || typeof r !== 'object' || r.v !== 1) bad();
    const n = Array.isArray(r.t) ? r.t.length : -1; if (n < 1 || n > max) bad();
    for (const k of ['la', 'lo', 'al', 'ac', 'sp']) if (!Array.isArray(r[k]) || r[k].length !== n) bad();
    const out = new Array(n); let t = 0, la = 0, lo = 0;
    for (let i = 0; i < n; i++) {
      if (!int(r.t[i]) || !int(r.la[i]) || !int(r.lo[i]) || !intN(r.al[i]) || !int(r.ac[i]) || !intN(r.sp[i])) bad();
      if (i && r.t[i] < 0) bad();   // el tiempo no puede ir hacia atrás
      t += r.t[i]; la += r.la[i]; lo += r.lo[i];
      if (Math.abs(la) > 90e6 || Math.abs(lo) > 180e6) bad();
      const v = r.sp[i] === null ? null : r.sp[i] / 100;
      out[i] = { t: t * 1000, lat: la / 1e6, lon: lo / 1e6, alt: r.al[i] === null ? null : r.al[i] / 10, acc: r.ac[i], v: v !== null && v >= 0 && v <= 41.7 ? v : null };   // >150 km/h: se ignora la velocidad del GPS
    }
    return out;
  }
  const api = { Calc, downs, encodeTrace, decodeTrace };
  if (typeof module === 'object' && module.exports) module.exports = api; else Object.assign(root, api);
})(this);
