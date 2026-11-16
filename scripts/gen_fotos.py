"""Fotos de portada de cada estación desde Wikimedia Commons (licencias libres), con su autor y licencia.
1) busca candidatas por estación y las puntúa (nieve + cielo, apaisadas, sin logos ni planos)
2) guarda public/img/foto/<id>.webp (720×760) y public/img/fotos.json con el crédito de cada una
Uso: python scripts/gen_fotos.py [estacion ...]         (sin argumentos: todas)
     python scripts/gen_fotos.py --elegir estacion N     (usar la candidata N de la última búsqueda)
Las que no tengan buena foto propia usan una de montaña nevada genérica (FALLBACK)."""
import io, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageStat

RAIZ = Path(__file__).resolve().parent.parent
OUT = RAIZ / 'public' / 'img' / 'foto'; OUT.mkdir(parents=True, exist_ok=True)
CRED = RAIZ / 'public' / 'img' / 'fotos.json'
CACHE = RAIZ / 'scripts' / '.fotos_candidatas.json'
UA = {'User-Agent': 'PisteaFotos/1.0 (app de esqui; fotos con licencia libre)'}
API = 'https://commons.wikimedia.org/w/api.php'
NOMBRES = {'alto-campoo': 'Alto Campoo', 'astun': 'Astún', 'baqueira-beret': 'Baqueira Beret', 'boi-taull': 'Boí Taüll', 'candanchu': 'Candanchú', 'cerler': 'Cerler',
  'espot': 'Espot Esquí', 'formigal': 'Formigal', 'fuentes-de-invierno': 'Fuentes de Invierno', 'javalambre': 'Javalambre esquí', 'la-covatilla': 'La Covatilla', 'la-molina': 'La Molina',
  'la-pinilla': 'La Pinilla', 'leitariegos': 'Leitariegos', 'manzaneda': 'Manzaneda esquí', 'masella': 'Masella', 'panticosa': 'Panticosa', 'port-aine': 'Port Ainé', 'port-del-comte': 'Port del Comte',
  'san-isidro': 'San Isidro esquí', 'sierra-nevada': 'Sierra Nevada Pradollano', 'valdelinares': 'Valdelinares', 'valdesqui': 'Valdesquí', 'valdezcaray': 'Valdezcaray', 'valgrande-pajares': 'Valgrande-Pajares',
  'vall-de-nuria': 'Vall de Núria', 'vallter': 'Vallter 2000'}
LIBRES = re.compile(r'^(CC BY|CC BY-SA|CC0|Public domain|PD)', re.I)
MALAS = re.compile(r'logo|map|mapa|plano|escudo|coat|svg|diagram|sign|cartel|bus|train|tren|church|iglesia|hotel|panorama_?\d{5}', re.I)

def get(url, intentos=6):
    for i in range(intentos):   # Wikimedia limita la frecuencia: pausa entre peticiones y espera creciente si responde 429
        time.sleep(1.2)
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == intentos - 1: raise
            time.sleep(20 * (i + 1))

def buscar(q, n=24):
    p = {'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'{q} filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': n,
         'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 960}   # ancho estándar de Wikimedia (ya está en su caché)
    j = json.loads(get(API + '?' + urllib.parse.urlencode(p)))
    out = []
    for pg in (j.get('query', {}).get('pages', {}) or {}).values():
        ii = (pg.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata', {})
        lic = (md.get('LicenseShortName', {}) or {}).get('value', '')
        if not LIBRES.match(lic) or MALAS.search(pg['title']) or ii.get('width', 0) < 900 or ii.get('width', 1) < ii.get('height', 1) * 0.9: continue
        autor = re.sub(r'<[^>]+>', '', (md.get('Artist', {}) or {}).get('value', '')).strip() or 'Autor desconocido'
        out.append({'title': pg['title'], 'thumb': ii['thumburl'], 'page': ii.get('descriptionurl'), 'lic': lic, 'autor': autor[:80]})
    return out

def puntua(im):   # nieve (claro y poco saturado) + cielo azul; castiga lo oscuro y lo casi todo blanco (niebla)
    s = im.convert('RGB').resize((96, 64)); hsv = s.convert('HSV')
    px = list(zip(s.get_flattened_data(), hsv.get_flattened_data())) if hasattr(s, 'get_flattened_data') else list(zip(s.getdata(), hsv.getdata()))
    nieve = sum(1 for (r, g, b), (h, sa, v) in px if v > 175 and sa < 45) / len(px)
    cielo = sum(1 for (r, g, b), (h, sa, v) in px if 130 < h < 175 and sa > 60 and v > 110) / len(px)
    oscuro = sum(1 for (r, g, b), (h, sa, v) in px if v < 50) / len(px)
    return round(min(nieve, .6) * 1.6 + min(cielo, .3) * 1.2 - oscuro * 1.5 - (0.6 if nieve > .85 else 0), 3)

def guardar(est, c, img):
    im = ImageOps.fit(img.convert('RGB'), (720, 760), Image.LANCZOS, centering=(0.5, 0.45))
    im.save(OUT / f'{est}.webp', quality=78, method=6)
    cred = json.loads(CRED.read_text(encoding='utf-8')) if CRED.exists() else {}
    cred[est] = {'autor': c['autor'], 'licencia': c['lic'], 'url': c['page'], 'titulo': c['title'].replace('File:', '')}
    CRED.write_text(json.dumps(cred, ensure_ascii=False, indent=1), encoding='utf-8')

def una(est, cache):
    cands = buscar(NOMBRES[est] + ' nieve') + buscar(NOMBRES[est] + ' ski')
    vistas, res = set(), []
    for c in cands:
        if c['title'] in vistas: continue
        vistas.add(c['title'])
        try: c['score'] = puntua(Image.open(io.BytesIO(get(c['thumb'])))); res.append(c)
        except Exception: pass
        if len(res) >= 6: break
    res.sort(key=lambda c: -c['score']); cache[est] = res
    if res and res[0]['score'] > .35: guardar(est, res[0], Image.open(io.BytesIO(get(res[0]['thumb'])))); return f"{res[0]['score']} {res[0]['title'][:60]} ({res[0]['lic']})"
    return 'SIN FOTO BUENA (' + ', '.join(str(c['score']) for c in res[:3]) + ')'

if __name__ == '__main__':
    cache = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    if len(sys.argv) == 5 and sys.argv[1] == '--ambiente':   # foto genérica de la zona: --ambiente estacion _clave N
        est, k, n = sys.argv[2], sys.argv[3], int(sys.argv[4]); c = dict(cache[k][n]); guardar(est, c, Image.open(io.BytesIO(get(c['thumb']))))
        cred = json.loads(CRED.read_text(encoding='utf-8')); cred[est]['ambiente'] = True; CRED.write_text(json.dumps(cred, ensure_ascii=False, indent=1), encoding='utf-8')
        print(est, '← ambiente:', c['title']); sys.exit()
    if len(sys.argv) >= 4 and sys.argv[1] == '--buscar':   # otra búsqueda: --buscar estacion "consulta 1" "consulta 2"
        est = sys.argv[2]; cands = sum((buscar(q) for q in sys.argv[3:]), []); vistas, res = set(), []
        for c in cands:
            if c['title'] in vistas: continue
            vistas.add(c['title'])
            try: c['score'] = puntua(Image.open(io.BytesIO(get(c['thumb'])))); res.append(c)
            except Exception: pass
            if len(res) >= 8: break
        res.sort(key=lambda c: -c['score']); cache[est] = res; CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
        for i, c in enumerate(res): print(f"  {i} {c['score']} {c['title'][5:80]}")
        sys.exit()
    if len(sys.argv) == 4 and sys.argv[1] == '--elegir':
        est, n = sys.argv[2], int(sys.argv[3]); c = cache[est][n]; guardar(est, c, Image.open(io.BytesIO(get(c['thumb'])))); print(est, '←', c['title']); sys.exit()
    for est in (sys.argv[1:] or list(NOMBRES)):
        try: print(est, una(est, cache), flush=True)
        except Exception as e: print(est, 'ERROR', e, flush=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
