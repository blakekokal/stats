# Builds a course file from the course's vector yardage book (yardage_book.py reads it):
# bunkers, water, fairways, greens, tee boxes and each hole's centre line, lined up
# on the zoom-19 Esri imagery the app shows; trees are the canopy in that imagery
# wherever the book marks a tree, as circles (tree_circles.py).
#   python3 build_from_book.py <course dir> yardage-book.pdf m19.png ../data/<id>.json [check.png]
# The course dir holds a course.py with ID, NAME, LOCATION, the club's scorecard
# (TEES, PAR, HCP) and GREENS: a point on each green in the imagery, as
# [lat, lng] (see sherrillpark1/course.py).
# Lining up: the book places each hole round its own pin. The pin starts on the
# green as seen in the imagery; the hole is moved until its trees and ponds are
# on dark ground (coarse), then until its bunkers are on sand and its green on
# green turf (fine; tree shadows fall north-west, so trees alone pull a hole a
# few metres north). Last, each bunker and green is moved on its own, by up to
# 3 m, if that puts it better on sand or green turf.
import importlib.util, json, math, os, sys, cv2, numpy as np
import yardage_book, tree_circles
cdir, pdf, img, out = sys.argv[1:5]
spec = importlib.util.spec_from_file_location('course', os.path.join(cdir, 'course.py')); C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
TEES, PAR, HCP = C.TEES, C.PAR, C.HCP
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); N = 256 * 2 ** Z
M = 156543.03392 * math.cos(math.radians(C.GREENS[1][0])) / 2 ** Z  # metres per mosaic px
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

B = yardage_book.read(pdf)
pin = {n: px(*p) for n, p in C.GREENS.items()}

def mask_of(polys):
    mk = np.zeros((H, W), np.uint8)
    for r in polys: cv2.fillPoly(mk, [np.array(r, np.int32)], 1)
    return mk
def search(score, R, step):
    return max((score(dx, dy), dx, dy) for dy in range(-R, R + 1, step) for dx in range(-R, R + 1, step))
def inside(img_, ys, xs, dx, dy):
    yy, xx = ys + dy, xs + dx; ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
    return img_[yy[ok], xx[ok]].mean() if ok.any() else 0
# The book is one map: a bunker or pond drawn on two pages is the same shape, so the
# pages' pins can be placed on one plan (to a fraction of a yard).
def sig(ring):
    a_ = 0.5 * sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))
    return len(ring), abs(a_), complex(sum(q[0] for q in ring) / len(ring), sum(q[1] for q in ring) / len(ring))
sigs = {n: [(k,) + sig(gg[0]) for k, gg, *_ in h['shapes'] if k in ('bunker', 'water', 'green', 'fairway') and len(gg[0]) > 5] for n, h in B.items()}
ids = sorted(B); rows, rhs, links = [], [], 0
for n in ids:
    for m_ in ids:
        if m_ <= n: continue
        offs = [z - z2 for k, c, a_, z in sigs[n] for k2, c2, a2, z2 in sigs[m_] if k == k2 and c == c2 and abs(a_ - a2) < 0.01 * a_ + 0.5]
        if not offs: continue
        best = max(offs, key=lambda o: sum(abs(o - q) < 1 for q in offs)); sup = [q for q in offs if abs(q - best) < 1]
        if len(sup) < 3: continue  # one shape alike on two pages can be chance
        r_ = np.zeros(len(ids)); r_[ids.index(m_)] = len(sup); r_[ids.index(n)] = -len(sup); rows.append(r_); rhs.append(sum(sup)); links += 1
r_ = np.zeros(len(ids)); r_[0] = 100; rows.append(r_); rhs.append(0)
sol = np.linalg.lstsq(np.array(rows), np.array(rhs), rcond=None)[0]
plan = {n: sol[i] for i, n in enumerate(ids)}  # each pin on the book's plan, yards east + north (as a complex number)
worst = max(abs(plan[m_] - plan[n] - o / w) for (n, m_), o, w in [((ids[list(r_).index(-max(r_))], ids[list(r_).index(max(r_))]), q, max(r_)) for r_, q in zip(rows[:-1], rhs[:-1])])
print(links, 'pairs of pages share shapes; they agree to %.2f yd' % worst)
assert worst < 1, 'the pages do not make one map'

# The plan goes on the imagery in one piece: shift, turn and scale. First from the
# greens seen in the imagery, then fine-tuned so bunkers sit on sand and ponds and
# trees on dark ground.
img_of = lambda z: complex(z.real, -z.imag) * YP  # plan yards -> image px offset (image y points south)
Gp = {n: complex(*px(*g)) for n, g in C.GREENS.items()}
pm = sum(img_of(plan[n]) for n in ids) / len(ids); gm = sum(Gp.values()) / len(ids)
K = sum((Gp[n] - gm) * (img_of(plan[n]) - pm).conjugate() for n in ids) / sum(abs(img_of(plan[n]) - pm) ** 2 for n in ids)
T = gm - K * pm
print('from the greens: scale %.4f, turn %.2f deg; greens %.1f m apart at most' % (abs(K), math.degrees(math.atan2(K.imag, K.real)), max(abs(T + K * img_of(plan[n]) - Gp[n]) for n in ids) * M))
pts = {'bunker': [], 'dark': []}  # sample points inside shapes, on the plan
for n, h in B.items():
    for k, gg, *r in h['shapes']:
        if k == 'tree': pts['dark'].append(plan[n] + complex(*gg[0])); continue
        key = {'bunker': 'bunker', 'water': 'dark'}.get(k)
        if not key: continue
        ring = gg[0]; xs_ = [q[0] for q in ring]; ys_ = [q[1] for q in ring]
        for yy in np.arange(min(ys_), max(ys_), 0.7):
            for xx in np.arange(min(xs_), max(xs_), 0.7):
                if yardage_book.inside((xx, yy), ring): pts[key].append(plan[n] + complex(xx, yy))
rng = np.random.default_rng(1)  # a sample is plenty, and keeps the search quick
for k in pts:
    a_ = np.array(sorted(set(pts[k]), key=lambda z: (z.real, z.imag))); pts[k] = a_[rng.choice(len(a_), min(len(a_), 15000), replace=False)]
def look(img_, z):
    x, y = np.round(z.real).astype(int), np.round(z.imag).astype(int); ok = (x >= 0) & (x < W) & (y >= 0) & (y < H)
    return img_[y[ok], x[ok]].mean() if ok.any() else 0
def score(Kc, Tc):
    return 2 * look(sand, Tc + Kc * img_of_v(pts['bunker'])) + look(dark, Tc + Kc * img_of_v(pts['dark']))
img_of_v = lambda z: (z.real - 1j * z.imag) * YP
best = (score(K, T), K, T)
for size in (8, 2, 0.5):  # metres: search shifts, then turns and scales, finer each time
    K0, T0 = best[1], best[2]
    for turn in np.linspace(-1, 1, 5) * (0.6 if size == 8 else 0.15 if size == 2 else 0.04):
        for sc_ in np.linspace(-1, 1, 3) * (0.006 if size == 8 else 0.002 if size == 2 else 0.0005):
            Kc = K0 * (1 + sc_) * complex(math.cos(math.radians(turn)), math.sin(math.radians(turn)))
            Tc0 = T0 + (K0 - Kc) * pm  # turn and scale about the middle of the course
            R = pxm(size); step = max(1, pxm(size / 8))
            for dy in range(-R, R + 1, step):
                for dx in range(-R, R + 1, step):
                    sc = score(Kc, Tc0 + complex(dx, dy))
                    if sc > best[0]: best = (sc, Kc, Tc0 + complex(dx, dy))
K, T = best[1], best[2]
print('fitted: scale %.4f, turn %.2f deg, score %.3f; greens in the imagery are %.1f m from the book at most' % (abs(K), math.degrees(math.atan2(K.imag, K.real)), best[0], max(abs(T + K * img_of(plan[n]) - Gp[n]) for n in ids) * M))
def to_px(n, gg):
    z = T + K * img_of(plan[n] + complex(*gg)); return (z.real, z.imag)
for n in ids: pin[n] = to_px(n, (0, 0))

# a shape on several pages is taken from the page of the hole it is nearest
def line_px(n):
    h = B[n]; tees = [sum(complex(*q) for q in gg[0]) / len(gg[0]) for k, gg, *_ in h['shapes'] if k == 'tee']
    back = max(tees, key=abs); return [to_px(n, (back.real, back.imag)), to_px(n, (0, 0))]
LINES = {n: line_px(n) for n in B}
def seg_d(p, a, b):
    p, a, b = complex(*p), complex(*a), complex(*b); t = max(0, min(1, ((p - a) * (b - a).conjugate()).real / (abs(b - a) ** 2 or 1)))
    return abs(p - (a + t * (b - a)))
nearest = lambda p: min(LINES, key=lambda n: seg_d(p, *LINES[n]))
mask = {k: np.zeros((H, W), np.uint8) for k in ('water', 'treezone', 'bunker', 'fairway')}
feats, greens = [], {}
for n, h in B.items():
    for k, gg, *r in h['shapes']:
        if k == 'tree':
            x, y = to_px(n, gg[0]); cv2.circle(mask['treezone'], (int(x), int(y)), int(r[0] * YP + pxm(2)), 1, -1)
        elif k in mask:
            rs = [[to_px(n, q) for q in ring] for ring in gg]
            cx_ = sum(q[0] for q in rs[0]) / len(rs[0]); cy_ = sum(q[1] for q in rs[0]) / len(rs[0])
            if nearest((cx_, cy_)) != n: continue
            for ring in rs: cv2.fillPoly(mask[k], [np.array(ring, np.int32)], 1)
        elif k == 'green': greens[n] = mask_of([[to_px(n, q) for q in ring] for ring in gg])
        elif k == 'tee': feats.append({'t': 'tee', 'px': [[to_px(n, q) for q in ring] for ring in gg], 'h': n})
# each bunker and green on its own, by up to 3 m
def snap(mk, score, gain=0.05, least=0):
    ys, xs = np.nonzero(mk)
    s0 = score(ys, xs, 0, 0); best = search(lambda dx, dy: score(ys, xs, dx, dy), pxm(3), 1)
    if best[0] - s0 < gain or best[0] < least: return mk, 0, 0
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
    g2, dx, dy = snap(gm, sc, 0.1, 0.3); g2[bunk > 0] = 0  # only where the green clearly stands out
    if dx or dy: print('green', n, 'moved %.1f m' % (math.hypot(dx, dy) * M))
    feats.append({'t': 'green', 'px': max(rings(g2, 50, 0.3), key=lambda p: cv2.contourArea(np.array(p[0], np.float32))), 'h': n})
water = mask['water'] > 0
trees = canopy & (mask['treezone'] > 0) & ~(cv2.dilate(mask['water'], disk(pxm(1.5))) > 0) & ~(bunk > 0)
fair = (mask['fairway'] > 0) & ~(bunk > 0)
for k, mk, mn, eps in (('water', water, 100, 0.6), ('fairway', fair, 200, 0.6), ('bunker', bunk > 0, 4, 0.25)):
    for p in rings(mk, mn, eps): feats.append({'t': k, 'px': p})
for x, y, r in tree_circles.circles(trees, M):  # trees as circles: easier to edit one at a time
    feats.append({'t': 'trees', 'px': [tree_circles.ring(x, y, r)]})

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
res = {'id': C.ID, 'name': C.NAME, 'location': C.LOCATION, 'tees': TEES, 'holes': holes,
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines from the course yardage book, lined up on Esri World Imagery',
       'builtAt': int(__import__('time').time() * 1000)}  # outlines edited in the app before this are set aside
json.dump(res, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
if len(sys.argv) > 5:  # a picture to check the result by eye
    col = {'water': (255, 120, 0), 'trees': (255, 0, 255), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 255, 255)}
    for f in feats:
        for r in f['px']: cv2.polylines(im, [np.array(r, np.int32)], True, col[f['t']], 2)
    cv2.imwrite(sys.argv[5], im)
