"""Miniaturas con imagen de INVIERNO: Sentinel-2 L2A (Copernicus/ESA) del invierno 2025-26, desde Microsoft Planetary Computer.
Para cada estación busca las escenas de dic-mar con pocas nubes, elige la que más nieve tiene en el recuadro de la miniatura
y la reproyecta a las coordenadas locales de la estación; encima se dibujan sus pistas (gen_miniaturas.py).
Uso: python scripts/gen_invierno.py [estacion ...]     (sin argumentos: todas; necesita internet, numpy, scipy y Pillow)"""
import io, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MOTOR = RAIZ.parent.parent / 'Estaciones3D' / 'scripts'          # ficha de cada estación (huso y origen local)
PC = 'https://planetarycomputer.microsoft.com/api'
PERIODO = '2025-11-15/2026-04-20'

def http(url, data=None, tries=4):
    for i in range(tries):
        try:
            rq = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'User-Agent': 'pistea-miniaturas'})
            return urllib.request.urlopen(rq, timeout=60).read()
        except Exception:
            if i == tries - 1: return None

def hijo(est):
    import numpy as np
    from PIL import Image
    from scipy.ndimage import map_coordinates
    os.environ['ESTACION'] = est; sys.path.insert(0, str(MOTOR))
    import station as S
    import gen_miniaturas as G

    def rejilla(caja, w, h):
        X, Z = np.meshgrid(np.linspace(caja[0], caja[2], w), np.linspace(caja[1], caja[3], h))
        return S.geo(X + S.NEAR['xmin'], S.NEAR['ymax'] - Z)           # lat, lon de cada píxel de salida

    def mercator(lat, lon, z):
        n = 256 * 2 ** z
        return (lon + 180) / 360 * n, (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n

    def tesela(item, z, x, y, scl=False):
        a = 'assets=SCL&asset_bidx=SCL%7C1&nodata=0&unscale=false' if scl else 'assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0'
        b = http(f'{PC}/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?collection=sentinel-2-l2a&item={item}&{a}')
        if not b: return np.zeros((256, 256) if scl else (256, 256, 3), np.uint8)
        return np.asarray(Image.open(io.BytesIO(b)).convert('L' if scl else 'RGB'))

    def muestrea(item, lat, lon, z, scl=False):
        px, py = mercator(lat, lon, z)
        tx0, tx1, ty0, ty1 = int(px.min() // 256), int(px.max() // 256), int(py.min() // 256), int(py.max() // 256)
        pos = [(x, y) for y in range(ty0, ty1 + 1) for x in range(tx0, tx1 + 1)]
        with ThreadPoolExecutor(8) as ex: ts = list(ex.map(lambda p: tesela(item, z, *p, scl), pos))
        mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256) + (() if scl else (3,)), np.uint8)
        for (x, y), t in zip(pos, ts): mos[(y - ty0) * 256:(y - ty0 + 1) * 256, (x - tx0) * 256:(x - tx0 + 1) * 256] = t
        cy, cx = py - ty0 * 256 - .5, px - tx0 * 256 - .5
        if scl: return map_coordinates(mos, [cy, cx], order=0, mode='nearest')
        return np.stack([map_coordinates(mos[..., c].astype(float), [cy, cx], order=3, mode='nearest') for c in range(3)], -1)

    def relieve(img, caja, w, h):
        import gzip
        d = RAIZ / 'mapas' / 'estaciones' / est / 'data'; m = json.loads((d / 'meta.json').read_text(encoding='utf-8'))
        q = np.frombuffer(gzip.decompress((d / 'dem.u16d').read_bytes()), np.uint16).cumsum(dtype=np.uint16)
        e = q.reshape(m['rows'], m['cols']).astype(float) * m['dem_q'][1] + m['dem_q'][0]
        gz, gx = np.gradient(e, m['cell_m'])                                   # filas = z (sur), columnas = x (este)
        n = np.stack([-gx, np.ones_like(gx), -gz], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
        alt = np.radians(32); L = np.array([-np.cos(alt) * .707, np.sin(alt), -np.cos(alt) * .707])   # sol del noroeste
        sombra = n @ L
        X, Z = np.meshgrid(np.linspace(caja[0], caja[2], w), np.linspace(caja[1], caja[3], h))
        v = map_coordinates(sombra, [Z / m['cell_m'], X / m['cell_m']], order=1, mode='nearest')
        k = np.clip((v / np.sin(alt)) ** 1.5, .38, 1.3)[..., None]
        return img * k

    def fondo(caja, w, h):
        lat, lon = rejilla(caja, 40, 40)
        busca = {'collections': ['sentinel-2-l2a'], 'bbox': [float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())],
                 'datetime': PERIODO, 'query': {'eo:cloud_cover': {'lt': 30}}, 'limit': 60}
        its = json.loads(http(f'{PC}/stac/v1/search', json.dumps(busca).encode()))['features']
        if not its: raise RuntimeError('sin escenas de invierno')
        la, lo = rejilla(caja, 130, 136); mejor = None
        for it in its:
            c = muestrea(it['id'], la, lo, 12, True)       # clasificación de la escena (SCL): 11 = nieve, 3/8/9/10 = sombra y nube
            vacio, nube, nieve = (c == 0).mean(), np.isin(c, (3, 8, 9, 10)).mean(), (c == 11).mean()
            if vacio < .03 and nube < .02 and (mejor is None or nieve > mejor[0]): mejor = (nieve, it)
        if not mejor: raise RuntimeError('escenas sin cobertura')
        la, lo = rejilla(caja, w, h)
        img = np.clip(muestrea(mejor[1]['id'], la, lo, 14), 0, 255) / 255
        img = relieve(np.power(img, 1.35) * 1.04, caja, w, h)        # la nieve sale quemada (blanco puro): se baja y se le devuelve el relieve con el MDT de 5 m
        img = (np.clip(img, 0, 1) * 255).astype(np.uint8)
        print(f'   escena {mejor[1]["properties"]["datetime"][:10]} · nieve local {mejor[0]*100:.0f}% · nubes escena {mejor[1]["properties"]["eo:cloud_cover"]:.0f}%')
        return Image.fromarray(img), mejor[1]['properties']['datetime'][:10]

    kb = G.hacer(est, fondo)
    print(est, kb, 'KB')
    (G.SAL / f'{est}.json').write_text(json.dumps(G.DATOS[est], ensure_ascii=False), encoding='utf-8')

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--hijo':
        sys.path.insert(0, str(Path(__file__).parent)); hijo(sys.argv[2]); sys.exit()
    ids = sys.argv[1:] or sorted(p.name for p in (RAIZ / 'mapas' / 'estaciones').iterdir() if p.is_dir())
    for e in ids:
        r = subprocess.run([sys.executable, __file__, '--hijo', e], capture_output=True, text=True)
        print(r.stdout.strip() or e, ('ERROR: ' + r.stderr.strip().splitlines()[-1]) if r.returncode else '')
    # une las cifras de cada estación en estaciones.json
    d = {}
    for e in ids:
        p = RAIZ / 'public' / 'img' / f'{e}.json'
        if p.exists(): d[e] = json.loads(p.read_text(encoding='utf-8')); p.unlink()
    f = RAIZ / 'public' / 'img' / 'estaciones.json'
    old = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    old.update(d); f.write_text(json.dumps(old, ensure_ascii=False), encoding='utf-8')
