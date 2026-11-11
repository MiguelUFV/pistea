"""Genera public/img/<estacion>.webp: ortofoto de la estación (oscurecida) con sus pistas y remontes dibujados encima.
Uso: python scripts/gen_miniaturas.py   (lee mapas/estaciones/<id>/data; necesita Pillow)"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageOps
import math

RAIZ = Path(__file__).resolve().parent.parent
SAL = RAIZ / 'public' / 'img'; SAL.mkdir(parents=True, exist_ok=True)
W, H, SS = 520, 546, 2          # salida y supermuestreo del trazo
COL = {'novice': (53, 194, 138), 'easy': (77, 141, 255), 'intermediate': (239, 83, 80),
       'advanced': (20, 20, 24), 'expert': (20, 20, 24), 'freeride': (20, 20, 24)}

DATOS = {}

def hacer(est, fondo=None):
    """fondo(caja, w, h) -> (imagen RGB, fecha) para usar otra imagen que la ortofoto de verano (ver gen_invierno.py)."""
    d = RAIZ / 'mapas' / 'estaciones' / est / 'data'
    f = json.loads((d / 'features.json').read_text(encoding='utf-8'))
    meta = json.loads((d / 'meta.json').read_text(encoding='utf-8'))
    x0, z0, x1, z1 = meta['core']                                  # recuadro (m) que cubre ortho_core
    img = Image.open(d / 'ortho_core_lite.webp').convert('RGB')
    sx, sz = img.width / (x1 - x0), img.height / (z1 - z0)
    pts = [p for l in f['pistes'] for p in l['pts'] if x0 <= p[0] <= x1 and z0 <= p[1] <= z1] or [[x0, z0], [x1, z1]]   # solo pistas dentro de la ortofoto
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    ancho = max(max(xs) - min(xs), (max(zs) - min(zs)) * W / H) * 1.18 + 200   # metros que caben de lado a lado
    ancho = min(ancho, (x1 - x0), (z1 - z0) * W / H)        # nunca más que la ortofoto
    alto = ancho * H / W
    cx = min(max(cx, x0 + ancho / 2), x1 - ancho / 2); cz = min(max(cz, z0 + alto / 2), z1 - alto / 2)   # la caja se queda dentro de la imagen
    caja = (cx - ancho / 2, cz - alto / 2, cx + ancho / 2, cz + alto / 2)
    c = [(caja[0] - x0) * sx, (caja[1] - z0) * sz, (caja[2] - x0) * sx, (caja[3] - z0) * sz]
    fecha = None
    if fondo:
        base, fecha = fondo(caja, W * SS, H * SS)
        base = ImageEnhance.Brightness(base).enhance(.82)
    else:
        base = img.crop(tuple(int(round(v)) for v in c)).resize((W * SS, H * SS), Image.LANCZOS)
        # tratamiento común: niveles automáticos (iguala teselas y estaciones), menos color y un velo azul frío de invierno
        base = ImageOps.autocontrast(base, cutoff=1.5)
        base = ImageEnhance.Color(base).enhance(.5)
        base = Image.blend(base, Image.new('RGB', base.size, (34, 58, 96)), .26)
        base = ImageEnhance.Brightness(base).enhance(.8)
    cap = Image.new('RGBA', base.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(cap)
    k = W * SS / ancho
    P = lambda pts: [((x - caja[0]) * k, (z - caja[1]) * k) for x, z in pts]
    for l in f['lifts']:
        if len(l['pts']) > 1: dr.line(P(l['pts']), fill=(25, 25, 30, 210) if fondo else (255, 255, 255, 190), width=SS)
    for l in sorted(f['pistes'], key=lambda p: p.get('difficulty') in ('advanced', 'expert')):
        if len(l['pts']) < 2: continue
        q = P(l['pts']); col = COL.get(l.get('difficulty'), (230, 230, 235))
        dr.line(q, fill=(0, 0, 0, 150) if fondo else (255, 255, 255, 235), width=int(3.8 * SS), joint='curve')
        dr.line(q, fill=col + (255,), width=int(2.2 * SS), joint='curve')
    out = Image.alpha_composite(base.convert('RGBA'), cap).convert('RGB').resize((W, H), Image.LANCZOS)
    nombres = lambda L: len({l['name'] for l in L if l.get('name')}) or len(L)   # OSM parte las pistas en tramos: se cuentan nombres distintos
    DATOS[est] = {'pistas': nombres(f['pistes']), 'remontes': nombres(f['lifts'])}
    if fecha: DATOS[est]['fecha'] = fecha
    out.save(SAL / f'{est}.webp', quality=76, method=6)
    return (SAL / f'{est}.webp').stat().st_size // 1024

if __name__ == '__main__':
    ids = sys.argv[1:] or sorted(p.name for p in (RAIZ / 'mapas' / 'estaciones').iterdir() if p.is_dir())
    for e in ids:
        try: print(e, hacer(e), 'KB')
        except Exception as ex: print(e, 'ERROR', type(ex).__name__, ex)
    (SAL / 'estaciones.json').write_text(json.dumps(DATOS, ensure_ascii=False), encoding='utf-8')   # cifras medidas: pistas, remontes y km de pista
