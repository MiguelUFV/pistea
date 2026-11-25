"""El relieve de cada estación para dibujar encima los recorridos (mapa 2D del día y tarjetas): sombreado del terreno del
mapa 3D entero (mapas/estaciones/<id>/data/dem.u16d), en tonos de invierno, con la red de pistas en blanco y los remontes
en gris (public/seg/<id>.json). Las miniaturas de las estaciones son un recorte de ~1,8 km y en las grandes no llegan a las
pistas de fuera (Formigal, el 9 %): un día que salía de ellas se veía con la miniatura en una esquina y el resto en gris.

Escribe public/img/relieve/<id>.webp y, en public/img/estaciones.json, su recuadro en metros del mapa 3D: "rel": [0, 0,
ancho, alto]. Va después de gen_invierno.py (que reescribe las entradas) y de gen_seguimiento.js (que escribe public/seg).
Uso: python scripts/gen_relieve.py [id …]
"""
import gzip, json, math, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw

R = pathlib.Path(__file__).resolve().parent.parent
MAPAS, SEG, IMG = R / "mapas" / "estaciones", R / "public" / "seg", R / "public" / "img"
OUT = IMG / "relieve"
MAXPX, MINPX = 1600, 1100   # lado mayor de la imagen (con 5 m por celda, Formigal sale a 1.570 × 1.260)
SOL = (315, 42)       # el sol de los mapas: del noroeste, a 42º

# Colores: sombra azulada, nieve al sol y roca en lo más empinado
SOMBRA, LUZ, ROCA = np.array([84, 108, 138]), np.array([246, 249, 252]), np.array([128, 124, 120])
BAJO = np.array([170, 182, 168])   # lo más bajo del mapa, valle sin nieve: un gris verdoso apagado


def cotas(pack, id_):
    d = pack["dem"]
    q = np.frombuffer(gzip.decompress((MAPAS / id_ / "data" / "dem.u16d").read_bytes()), dtype="<u2")
    q = np.cumsum(q, dtype=np.uint16)   # diferencias con la anterior, que se envuelven en 16 bits
    return (d["base"] + q.astype(np.float32) * d["step"]).reshape(d["rows"], d["cols"]), d["cell"]


def relieve(h, cell):
    gz, gx = np.gradient(h, cell)          # por filas (z, hacia el sur) y por columnas (x, hacia el este)
    slope = np.arctan(np.hypot(gx, gz))
    az, alt = math.radians(SOL[0]), math.radians(SOL[1])
    # La normal del terreno en (este, norte, arriba) es (-dh/dx, -dh/dnorte, 1), y dh/dnorte = -dh/dz
    L = (math.sin(az) * math.cos(alt), math.cos(az) * math.cos(alt), math.sin(alt))
    shade = (-gx * L[0] + gz * L[1] + L[2]) / np.sqrt(gx * gx + gz * gz + 1)
    shade = np.clip((shade - 0.15) / 0.85, 0, 1) ** 0.8
    lo, hi = np.percentile(h, 3), np.percentile(h, 99.5)
    alto = np.clip((h - lo) / max(hi - lo, 1), 0, 1)[..., None]
    nieve = SOMBRA + (LUZ - SOMBRA) * shade[..., None]
    base = BAJO * (1 - shade[..., None] * 0.35) + LUZ * shade[..., None] * 0.35
    rgb = base + (nieve - base) * np.clip(alto * 1.6, 0, 1)   # en lo más bajo, sin nieve; a partir de un tercio, nevado
    roca = np.clip((np.degrees(slope) - 38) / 12, 0, 1)[..., None] * 0.55
    rgb = rgb * (1 - roca) + ROCA * (0.7 + 0.3 * shade[..., None]) * roca
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


def lineas(img, pack, k):
    dr = ImageDraw.Draw(img, "RGBA")
    pts = lambda f: [(f[i] * k, f[i + 1] * k) for i in range(0, len(f) - 1, 2)]
    w = max(1, round(12 * k))   # 12 m de ancho
    for p in pack["p"]:   # gris pizarra translúcido: se lee en la nieve al sol y no compite con los colores del recorrido
        if len(p[3]) >= 4:
            dr.line(pts(p[3]), fill=(62, 86, 116, 105), width=w, joint="curve")
    for l in pack["l"]:
        if len(l[3]) >= 4:
            dr.line(pts(l[3]), fill=(28, 38, 50, 170), width=max(1, w // 2))


def una(id_, si):
    pack = json.loads((SEG / f"{id_}.json").read_text(encoding="utf-8"))
    h, cell = cotas(pack, id_)
    rows, cols = h.shape
    W, H = cols * cell, rows * cell
    L = max(cols, rows)
    k = min(MAXPX, max(MINPX, L)) / L    # píxeles por celda: las estaciones pequeñas se interpolan para que no se pixelen
    size = (round(cols * k), round(rows * k))
    if k > 1:
        img = relieve(np.asarray(Image.fromarray(h, "F").resize(size, Image.BICUBIC)), cell / k)
    else:
        img = relieve(h, cell)
        if k < 1:
            img = img.resize(size, Image.LANCZOS)
    lineas(img, pack, k / cell)            # las coordenadas van en metros: píxeles por metro
    OUT.mkdir(exist_ok=True)
    f = OUT / f"{id_}.webp"
    img.save(f, "WEBP", quality=72, method=6)
    si[id_]["rel"] = [0, 0, round(W, 1), round(H, 1)]
    print(f"{id_:22} {img.width} x {img.height} px, {W / 1000:.1f} x {H / 1000:.1f} km, {f.stat().st_size // 1024} KB")


def main():
    path = IMG / "estaciones.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    lista = data if isinstance(data, list) else None
    si = {e["id"]: e for e in lista} if lista is not None else data
    ids = sys.argv[1:] or [i for i in si if (MAPAS / i / "data" / "dem.u16d").exists() and (SEG / f"{i}.json").exists()]
    for i in ids:
        una(i, si)
    path.write_text(json.dumps(lista if lista is not None else si, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
