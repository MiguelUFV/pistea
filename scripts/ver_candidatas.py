"""Mosaico de fotos candidatas para elegir a ojo: python scripts/ver_candidatas.py salida.jpg estacion:i,j estacion:k ..."""
import io, json, sys, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
C = json.loads((Path(__file__).parent / '.fotos_candidatas.json').read_text(encoding='utf-8'))
UA = {'User-Agent': 'PisteaFotos/1.0 (app de esqui; fotos con licencia libre)'}
items = []
for arg in sys.argv[2:]:
    e, idx = arg.split(':'); items += [(e, int(i)) for i in idx.split(',')]
w, h, c = 240, 170, 5; m = Image.new('RGB', (w * c, (h + 16) * ((len(items) + c - 1) // c)), (255, 255, 255)); d = ImageDraw.Draw(m)
for n, (e, i) in enumerate(items):
    x, y = (n % c) * w, (n // c) * (h + 16)
    try:
        time.sleep(1.2); im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(C[e][i]['thumb'], headers=UA), timeout=60).read()))
        im.thumbnail((w - 4, h)); m.paste(im.convert('RGB'), (x, y))
    except Exception as ex: d.text((x + 4, y + 4), 'ERROR ' + str(ex)[:30], fill=(200, 0, 0))
    d.text((x + 3, y + h + 2), f'{e[:18]} {i}', fill=(0, 0, 0))
m.save(sys.argv[1], quality=82)
