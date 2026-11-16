# Builds data/sherrillpark1.json from the course's vector yardage book (book.py reads it):
# bunkers, water, fairways, greens, tee boxes and each hole's centre line, lined up
# on the zoom-19 Esri imagery the app shows; trees are the canopy in that imagery
# wherever the book marks a tree.
#   python3 build_book.py yardage-book.pdf m19.png ../../data/sherrillpark1.json [check.png]
# Lining up: the book places each hole round its own pin. The pin starts on the
# green as seen in the imagery (holes.py); the hole is moved until its trees and
# ponds are on dark ground (coarse), then until its bunkers are on sand and its
# green on green turf (fine; tree shadows fall north-west, so trees alone pull a
# hole a few metres north). Last, each bunker and green is moved on its own, by
# up to 3 m, if that puts it better on sand or green turf.
import json, math, sys, cv2, numpy as np
import book
from holes import HOLES, TEES, PAR, HCP, MPP
pdf, img, out = sys.argv[1:4]
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); N = 256 * 2 ** Z
M = MPP * 2 ** (18 - Z)  # metres per mosaic px
def ll(x, y):  # mosaic px -> [lat, lng]
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
def px(lat, lng):
    gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
YP = 0.9144 / M  # mosaic px per yard
pxm = lambda m: max(1, int(round(m / M)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def rings(mask, min_m2, eps_m, hole_m2=40):  # outlines of a mask as mosaic-px rings
    cs, hier = cv2.findContours(mask.astype(np.uint8) * 255, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    res, a = [], M * M
    if hier is None: return res
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * a < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * a >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        poly = []
        for r in rs:
            r = cv2.approxPolyDP(r, eps_m / M, True)[:, 0, :]
            if len(r) >= 3: poly.append([(x + 0.5, y + 0.5) for x, y in r.tolist()])
        if poly: res.append(poly)
    return res

# what the imagery shows
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A, Bc = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
Lb = cv2.blur(L, (5, 5))
dark = (Lb < 36).astype(np.float32)
sand = ((L > 68) & (A > -8) & (Bc < 30)).astype(np.float32)
g = cv2.GaussianBlur(L, (0, 0), 1); m = cv2.blur(g, (7, 7)); sd = cv2.blur(np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - m * m, 0)), (9, 9))
turf = ((cv2.blur(A, (9, 9)) < -22) & (sd < 1.2) & (cv2.blur(L, (9, 9)) > 40)).astype(np.float32)  # greens: green and smooth
tex = cv2.blur(np.abs(L - cv2.blur(L, (3, 3))), (9, 9))
canopy = ((Lb < 36) | (Lb < cv2.blur(L, (25, 25)) - 9)) & (tex > 0.9)  # dark, or darker than round about, and leafy
canopy = cv2.morphologyEx(canopy.astype(np.uint8), cv2.MORPH_CLOSE, disk(2))
canopy = cv2.morphologyEx(canopy, cv2.MORPH_OPEN, disk(2)) > 0

B = book.read(pdf)
def from18(x, y):  # holes.py is in pixels of the zoom-18 mosaic in the README (top-left tile 60660, 105594)
    n = 256 * 2 ** 18; gx, gy = x + 60660 * 256, y + 105594 * 256
    return px(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / n)))), gx / n * 360 - 180)
pin = {n: from18(*l[-1]) for n, l in HOLES.items()}

def mask_of(polys):
    mk = np.zeros((H, W), np.uint8)
    for r in polys: cv2.fillPoly(mk, [np.array(r, np.int32)], 1)
    return mk
def search(score, R, step):
    return max((score(dx, dy), dx, dy) for dy in range(-R, R + 1, step) for dx in range(-R, R + 1, step))
def inside(img_, ys, xs, dx, dy):
    yy, xx = ys + dy, xs + dx; ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
    return img_[yy[ok], xx[ok]].mean() if ok.any() else 0
for n, h in B.items():
    at = lambda g_, o=(0, 0): [(pin[n][0] + o[0] + e * YP, pin[n][1] + o[1] - nn * YP) for e, nn in g_]
    # coarse: trees and ponds on dark ground
    tm = np.zeros((H, W), np.uint8)
    for k, gg, *r in h['shapes']:
        if k == 'tree': x, y = at(gg)[0]; cv2.circle(tm, (int(x), int(y)), max(1, int(r[0] * YP * 0.7)), 1, -1)
        if k == 'water':
            for ring in gg: cv2.fillPoly(tm, [np.array(at(ring), np.int32)], 1)
    ys, xs = np.nonzero(tm)
    c = search(lambda dx, dy: inside(dark, ys, xs, dx, dy) - 0.001 * math.hypot(dx, dy) * M, pxm(15), pxm(1))
    pin[n] = (pin[n][0] + c[1], pin[n][1] + c[2])
    # fine: bunkers on sand, the green on green turf (inside, less a ring round it)
    bun = [np.nonzero(mask_of([at(ring) for ring in gg])) for k, gg, *_ in h['shapes'] if k == 'bunker']
    bun = [b for b in bun if len(b[0])]
    gm = mask_of([at(ring) for k, gg, *_ in h['shapes'] if k == 'green' for ring in gg])
    gy_, gx_ = np.nonzero(gm); ry, rx = np.nonzero(cv2.dilate(gm, disk(pxm(3))) - gm)
    def fine(dx, dy):
        sc = inside(turf, gy_, gx_, dx, dy) - inside(turf, ry, rx, dx, dy)
        if bun: sc += 1.5 * sum(inside(sand, by, bx, dx, dy) for by, bx in bun) / len(bun)
        return sc - 0.01 * math.hypot(dx, dy) * M
    f = search(fine, pxm(6), 2)
    pin[n] = (pin[n][0] + f[1], pin[n][1] + f[2])
    print(n, 'moved %.1f %.1f m from the green in the imagery (fine %.1f %.1f)' % ((c[1] + f[1]) * M, (c[2] + f[2]) * M, f[1] * M, f[2] * M))
to_px = lambda n, gg: (pin[n][0] + gg[0] * YP, pin[n][1] - gg[1] * YP)

# shapes seen on several pages are drawn once: every page goes on the same masks
mask = {k: np.zeros((H, W), np.uint8) for k in ('water', 'treezone', 'bunker', 'fairway')}
feats, greens = [], {}
for n, h in B.items():
    for k, gg, *r in h['shapes']:
        if k == 'tree':
            x, y = to_px(n, gg[0]); cv2.circle(mask['treezone'], (int(x), int(y)), int(r[0] * YP + pxm(2)), 1, -1)
        elif k in mask:
            for ring in gg: cv2.fillPoly(mask[k], [np.array([to_px(n, p) for p in ring], np.int32)], 1)
        elif k == 'green': greens[n] = mask_of([[to_px(n, p) for p in ring] for ring in gg])
        elif k == 'tee': feats.append({'t': 'tee', 'px': [[to_px(n, p) for p in ring] for ring in gg], 'h': n})
# each bunker and green on its own, by up to 3 m
def snap(mk, score):
    ys, xs = np.nonzero(mk)
    s0 = score(ys, xs, 0, 0); best = search(lambda dx, dy: score(ys, xs, dx, dy), pxm(3), 1)
    if best[0] - s0 < 0.05: return mk, 0, 0
    return np.roll(mk, (best[2], best[1]), (0, 1)), best[1], best[2]
k_, lb, st, _ = cv2.connectedComponentsWithStats(mask['bunker'])
bunk = np.zeros((H, W), np.uint8); moved = []
for i in range(1, k_):
    x, y, w, hh, _a = st[i]; P = pxm(4)
    sub = (lb[y - P:y + hh + P, x - P:x + w + P] == i).astype(np.uint8)
    sand_s = sand[y - P:y + hh + P, x - P:x + w + P]
    def sc(ys, xs, dx, dy, s_=sand_s): yy, xx = np.clip(ys + dy, 0, s_.shape[0] - 1), np.clip(xs + dx, 0, s_.shape[1] - 1); return s_[yy, xx].mean()
    sub, dx, dy = snap(sub, sc); moved.append(math.hypot(dx, dy) * M)
    bunk[y - P:y + hh + P, x - P:x + w + P] |= sub
print('bunkers moved on their own: median %.1f m, max %.1f m' % (np.median(moved), max(moved)))
for n, gm in greens.items():
    ring_ = cv2.dilate(gm, disk(pxm(3))) - gm; ry, rx = np.nonzero(ring_)
    def sc(ys, xs, dx, dy): return inside(turf, ys, xs, dx, dy) - inside(turf, ry, rx, dx, dy)
    g2, dx, dy = snap(gm, sc); g2[bunk > 0] = 0
    if dx or dy: print('green', n, 'moved %.1f m' % (math.hypot(dx, dy) * M))
    feats.append({'t': 'green', 'px': max(rings(g2, 50, 0.3), key=lambda p: cv2.contourArea(np.array(p[0], np.float32))), 'h': n})
water = mask['water'] > 0
trees = canopy & (mask['treezone'] > 0) & ~(cv2.dilate(mask['water'], disk(pxm(1.5))) > 0) & ~(bunk > 0)
fair = (mask['fairway'] > 0) & ~(bunk > 0)
for k, mk, mn, eps in (('water', water, 100, 0.6), ('trees', trees, 5, 0.5), ('fairway', fair, 200, 0.6), ('bunker', bunk > 0, 4, 0.25)):
    for p in rings(mk, mn, eps): feats.append({'t': k, 'px': p})

def simplify(pts, tol):  # Douglas-Peucker, in yards
    if len(pts) < 3: return pts
    a, b = complex(*pts[0]), complex(*pts[-1]); Ln = abs(b - a) or 1
    d = [abs(((complex(*p) - a) * (b - a).conjugate()).imag) / Ln for p in pts[1:-1]]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] < tol: return [pts[0], pts[-1]]
    return simplify(pts[:i + 2], tol)[:-1] + simplify(pts[i + 1:], tol)
holes = []
for n, h in B.items():
    tees = [sum(complex(*p) for p in gg[0]) / len(gg[0]) for k, gg, *_ in h['shapes'] if k == 'tee']
    back = max(tees, key=abs)
    mid = [gg for gg in h['path'] if abs(complex(*gg)) < abs(back) - 25] if PAR[n - 1] > 3 else []
    line = simplify([(back.real, back.imag)] + mid + [(0.0, 0.0)], 6)
    line = [ll(*to_px(n, p)) for p in line]
    holes.append({'n': n, 'par': PAR[n - 1], 'hcp': HCP[n - 1], 'line': line, 'tee': line[0], 'pin': line[-1]})
res = {'id': 'sherrillpark1', 'name': 'Sherrill Park Golf Course – Course 1', 'location': 'Richardson, TX', 'tees': TEES, 'holes': holes,
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines from the course yardage book, lined up on Esri World Imagery'}
json.dump(res, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
if len(sys.argv) > 4:  # a picture to check the result by eye
    col = {'water': (255, 120, 0), 'trees': (255, 0, 255), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 255, 255)}
    for f in feats:
        for r in f['px']: cv2.polylines(im, [np.array(r, np.int32)], True, col[f['t']], 2)
    cv2.imwrite(sys.argv[4], im)
