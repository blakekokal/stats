"""Download Esri World Imagery tiles for a box and join them into one image.

Usage: fetch_tiles.py <zoom> <south> <west> <north> <east> out.png
Also writes out.png.meta (zoom and the top-left tile) for trace_turf.py.
"""
import io, math, os, sys, time, concurrent.futures as cf, urllib.request
from PIL import Image
z = int(sys.argv[1]); s, w, n, e = map(float, sys.argv[2:6]); out = sys.argv[6]
def tile(lat, lon):
    x = (lon + 180) / 360 * 2**z
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**z
    return x, y
x0, y0 = tile(n, w); x1, y1 = tile(s, e)
X = range(int(x0), int(x1) + 1); Y = range(int(y0), int(y1) + 1)
d = os.path.join(os.path.dirname(out), 'tiles'); os.makedirs(d, exist_ok=True)
def get(xy):
    x, y = xy; p = f'{d}/{z}_{x}_{y}.jpg'
    for attempt in range(5):  # the tile server sometimes answers 502
        if os.path.exists(p): break
        try:
            req = urllib.request.Request(f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', headers={'User-Agent': 'tile-trace'})
            data = urllib.request.urlopen(req, timeout=30).read()
            Image.open(io.BytesIO(data)).verify()  # a cut-off download is retried
            open(p, 'wb').write(data)
        except Exception:
            time.sleep(1 + 2 * attempt)
    return p
with cf.ThreadPoolExecutor(16) as ex: list(ex.map(get, [(x, y) for x in X for y in Y]))
img = Image.new('RGB', (len(X) * 256, len(Y) * 256))
for i, x in enumerate(X):
    for j, y in enumerate(Y): img.paste(Image.open(f'{d}/{z}_{x}_{y}.jpg'), (i * 256, j * 256))
img.save(out)
print(len(X) * len(Y), 'tiles', img.size, 'origin tile', X[0], Y[0])
open(out + '.meta', 'w').write(f'{z} {X[0]} {Y[0]}')
