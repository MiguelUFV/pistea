"""Icono, pantalla de arranque y gráficos de Google Play de Pistea, desde el mismo dibujo que /icon.svg (montaña de línea
blanca sobre fondo casi negro). Uso: python scripts/gen_iconos.py  (necesita Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
RES = RAIZ / 'app' / 'android' / 'app' / 'src' / 'main' / 'res'
STORE = RAIZ / 'app' / 'store'; STORE.mkdir(exist_ok=True)
BG, FG = (11, 12, 15, 255), (244, 245, 247, 255)
MONTE = [(14, 74), (38, 34), (54, 58), (66, 42), (86, 74), (14, 74)]   # el trazo de icon.svg, en una caja de 100×100

def montana(size, scale=1.0, bg=BG, shape='square', stroke=5):
    k = 4; S = size * k   # se dibuja grande y se reduce: bordes suaves
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg:
        if shape == 'circle': d.ellipse([0, 0, S - 1, S - 1], fill=bg)
        elif shape == 'round': d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * .22, fill=bg)
        else: d.rectangle([0, 0, S, S], fill=bg)
    f = S / 100 * scale; off = S * (1 - scale) / 2
    pts = [(off + x * f, off + (y - 4) * f) for x, y in MONTE]   # un poco hacia arriba: centrado a la vista
    w = max(1, round(stroke * f))
    d.line(pts, fill=FG, width=w, joint='curve')
    for p in pts: d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=FG)   # puntas redondas
    return im.resize((size, size), Image.LANCZOS)

DPI = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for n, m in DPI.items():
    d = RES / f'mipmap-{n}'
    montana(round(48 * m), .78, shape='round').save(d / 'ic_launcher.png')
    montana(round(48 * m), .74, shape='circle').save(d / 'ic_launcher_round.png')
    montana(round(108 * m), .5, bg=None).save(d / 'ic_launcher_foreground.png')   # icono adaptable: el dibujo dentro de la zona segura (66 de 108)
(RES / 'values' / 'ic_launcher_background.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0C0F</color>\n</resources>\n', encoding='utf-8')

# Pantallas de arranque: fondo de la app con el dibujo en el centro
for f in RES.glob('drawable*/splash.png'):
    w, h = Image.open(f).size; s = round(min(w, h) * .32)
    im = Image.new('RGBA', (w, h), BG); im.alpha_composite(montana(s, 1, bg=None), ((w - s) // 2, (h - s) // 2)); im.convert('RGB').save(f)

# Google Play: icono 512×512 (sin transparencia) y gráfico de cabecera 1024×500
montana(512, .78, shape='square').convert('RGB').save(STORE / 'icono_512.png')
fg = Image.new('RGB', (1024, 500), BG[:3]); fg.paste(montana(300, 1, bg=None), (90, 100), montana(300, 1, bg=None))
d = ImageDraw.Draw(fg)
def fuente(t):
    for n in ('segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'):
        try: return ImageFont.truetype(n, t)
        except OSError: pass
    return ImageFont.load_default()
d.text((430, 170), 'Pistea', font=fuente(96), fill=FG[:3])
d.text((436, 292), 'Tus días de esquí, en el ranking de España', font=fuente(25), fill=(138, 144, 156))
fg.save(STORE / 'cabecera_1024x500.png')
print('iconos, arranque y gráficos de Play listos')
