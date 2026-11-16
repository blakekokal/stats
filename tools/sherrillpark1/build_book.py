# Builds data/sherrillpark1.json from the course's vector yardage book (book.py reads it):
# trees, bunkers, water, fairways, greens, tee boxes and each hole's centre line.
# The book places each hole round its own pin; the pin is put on the green as seen
# in the imagery (holes.py), then the whole hole is nudged (a few metres at most)
# until its trees and ponds sit best on the dark ground in the imagery.
#   python3 build_book.py yardage-book.pdf m18.png ../../data/sherrillpark1.json [check.png]
import json, math, sys, cv2, numpy as np
import book
from holes import HOLES, TEES, PAR, HCP, MPP
pdf, img, out = sys.argv[1:4]
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); N = 256 * 2 ** Z
def ll(x, y):  # mosaic px -> [lat, lng]
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
def px(lat, lng):
    gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
YP = 0.9144 / MPP  # mosaic px per yard
SS = 2  # masks are drawn this many times finer than the imagery, so small bunkers keep their shape
def rings(mask, min_m2, eps_m, hole_m2=60):  # outlines of a mask (in fine px) as mosaic-px rings
    cs, hier = cv2.findContours(mask.astype(np.uint8) * 255, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out, a = [], (MPP / SS) ** 2
    if hier is None: return out
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * a < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * a >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        poly = []
        for r in rs:
            r = cv2.approxPolyDP(r, eps_m / MPP * SS, True)[:, 0, :]
            if len(r) >= 3: poly.append([((x + 0.5) / SS, (y + 0.5) / SS) for x, y in r.tolist()])
        if poly: out.append(poly)
    return out

B = book.read(pdf)
anchor = {n: l[-1] for n, l in HOLES.items()}  # the green as seen in the imagery

# nudge each hole onto the imagery: its trees and ponds should be dark ground
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB); L = cv2.blur(lab[..., 0].astype(np.float32) * 100 / 255, (5, 5))
dark = (L < 36).astype(np.float32)
pin = {}
for n, h in B.items():
    ax, ay = anchor[n]; m = np.zeros((H, W), np.uint8)
    for k, g, *r in h['shapes']:
        if k == 'tree': cv2.circle(m, (int(ax + g[0][0] * YP), int(ay - g[0][1] * YP)), max(1, int(r[0] * YP * 0.8)), 1, -1)
        if k == 'water':
            for ring in g: cv2.fillPoly(m, [np.array([(ax + e * YP, ay - nn * YP) for e, nn in ring], np.int32)], 1)
    ys, xs = np.nonzero(m)
    def score(dx, dy):
        yy, xx = ys + dy, xs + dx; ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
        return dark[yy[ok], xx[ok]].mean() - 0.002 * math.hypot(dx, dy)  # ties go to the green seen in the imagery
    best = max((score(dx, dy), dx, dy) for dy in range(-30, 31, 3) for dx in range(-30, 31, 3))
    best = max((score(dx, dy), dx, dy) for dy in range(best[2] - 2, best[2] + 3) for dx in range(best[1] - 2, best[1] + 3))
    pin[n] = (ax + best[1], ay + best[2])
    print(n, 'nudged', round(best[1] * MPP, 1), round(best[2] * MPP, 1), 'm')
to_px = lambda n, g: (pin[n][0] + g[0] * YP, pin[n][1] - g[1] * YP)

# shapes seen on several pages are drawn once: every page goes on the same masks
mask = {k: np.zeros((H * SS, W * SS), np.uint8) for k in ('water', 'trees', 'bunker', 'fairway')}
fine = lambda pts: np.array([(x * SS, y * SS) for x, y in pts], np.int32)
feats = []
for n, h in B.items():
    for k, g, *r in h['shapes']:
        if k == 'tree':
            x, y = to_px(n, g[0]); cv2.circle(mask['trees'], (int(x * SS), int(y * SS)), max(1, int(r[0] * YP * SS)), 1, -1)
        elif k in mask:
            for ring in g: cv2.fillPoly(mask[k], [fine([to_px(n, p) for p in ring])], 1)
        elif k == 'green':
            feats.append({'t': 'green', 'px': [[to_px(n, p) for p in ring] for ring in g], 'h': n})
        elif k == 'tee':
            feats.append({'t': 'tee', 'px': [[to_px(n, p) for p in ring] for ring in g], 'h': n})
mask['fairway'][mask['bunker'] > 0] = 0
for k, mn, eps in (('water', 100, 0.8), ('trees', 15, 0.8), ('fairway', 200, 0.8), ('bunker', 4, 0.25)):
    for p in rings(mask[k], mn, eps): feats.append({'t': k, 'px': p})

def simplify(pts, tol):  # Douglas-Peucker, in yards
    if len(pts) < 3: return pts
    a, b = complex(*pts[0]), complex(*pts[-1]); L = abs(b - a) or 1
    d = [abs(((complex(*p) - a) * (b - a).conjugate()).imag) / L for p in pts[1:-1]]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] < tol: return [pts[0], pts[-1]]
    return simplify(pts[:i + 2], tol)[:-1] + simplify(pts[i + 1:], tol)
holes = []
for n, h in B.items():
    tees = [sum(complex(*p) for p in g[0]) / len(g[0]) for k, g, *_ in h['shapes'] if k == 'tee']
    back = max(tees, key=abs)
    mid = [g for g in h['path'] if abs(complex(*g)) < abs(back) - 25] if PAR[n - 1] > 3 else []
    line = simplify([(back.real, back.imag)] + mid + [(0.0, 0.0)], 6)
    yd = sum(math.dist(line[i], line[i + 1]) for i in range(len(line) - 1))
    print(n, 'bends', len(line) - 2, 'back tee plays', round(yd), 'card', TEES[0]['yards'][n - 1])
    line = [ll(*to_px(n, p)) for p in line]
    holes.append({'n': n, 'par': PAR[n - 1], 'hcp': HCP[n - 1], 'line': line, 'tee': line[0], 'pin': line[-1]})
res = {'id': 'sherrillpark1', 'name': 'Sherrill Park Golf Course – Course 1', 'location': 'Richardson, TX', 'tees': TEES, 'holes': holes,
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines from the course yardage book, lined up on Esri World Imagery'}
json.dump(res, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
if len(sys.argv) > 4:  # a picture to check the result by eye
    col = {'water': (255, 120, 0), 'trees': (0, 90, 0), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 0, 255)}
    for f in feats:
        for r in f['px']: cv2.polylines(im, [np.array(r, np.int32)], True, col[f['t']], 2 if f['t'] != 'trees' else 1)
    for h in holes:
        p = np.array([px(*q) for q in h['line']], np.int32); cv2.polylines(im, [p], False, (255, 255, 255), 2)
        mx, my = p[len(p) // 2] if len(p) > 2 else (p[0] + p[1]) // 2
        cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 0), 6); cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 255, 255), 3)
    cv2.imwrite(sys.argv[4], cv2.resize(im[250:2700, 200:2300], None, fx=0.65, fy=0.65, interpolation=cv2.INTER_AREA))
