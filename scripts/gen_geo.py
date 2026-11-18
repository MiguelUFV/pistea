"""Escribe estaciones_geo.json: centro (lat, lon) y radio (km) de cada estación, a partir de su recinto NEAR de Estaciones3D.
El servidor lo usa para comprobar que un día grabado está de verdad en la estación elegida (antitrampas).
Uso: python scripts/gen_geo.py"""
import importlib, json, math, os, subprocess, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MOTOR = RAIZ.parent / 'Estaciones3D' / 'scripts'

def uno(est):
    os.environ['ESTACION'] = est; sys.path.insert(0, str(MOTOR))
    import station as S
    n = S.NEAR
    lat, lon = S.geo((n['xmin'] + n['xmax']) / 2, (n['ymin'] + n['ymax']) / 2)
    r = math.hypot(n['xmax'] - n['xmin'], n['ymax'] - n['ymin']) / 2 / 1000      # media diagonal del recinto, en km
    print(json.dumps({'lat': round(float(lat), 5), 'lon': round(float(lon), 5), 'km': round(r + 3, 1)}))   # 3 km de margen (aparcamiento, accesos)

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--uno': uno(sys.argv[2]); sys.exit()
    ids = sorted(p.name for p in (RAIZ / 'mapas' / 'estaciones').iterdir() if p.is_dir())
    out = {}
    for e in ids:
        r = subprocess.run([sys.executable, __file__, '--uno', e], capture_output=True, text=True)
        if r.returncode: print(e, 'ERROR', r.stderr.strip().splitlines()[-1]); continue
        out[e] = json.loads(r.stdout.strip().splitlines()[-1]); print(e, out[e])
    (RAIZ / 'estaciones_geo.json').write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
