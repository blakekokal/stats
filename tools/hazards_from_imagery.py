# Replaces a course file's bunkers, ponds and trees with what the zoom-19 Esri
# imagery shows, keeping its greens, fairways, tee boxes and hole lines (from the
# yardage book). Use it when a book's hazards are wrong (Sherrill Park #2's are).
#   python3 hazards_from_imagery.py ../data/<id>.json m19.png out.json [check.png]
# Bunkers: bright, pale, warm and roundish (cart paths are long and thin).
# Ponds: dark and flat, darker than any shade. Only inside the course's outline.
# Trees come out as circles (tree_circles.py). Trees: dark or darker than round about, and leafy.
import json, math, sys, cv2, numpy as np
import tree_circles
src, img, out = sys.argv[1:4]
d = json.load(open(src))
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); N = 256 * 2 ** Z
M = 156543.03392 * math.cos(math.radians(d['holes'][0]['pin'][0])) / 2 ** Z  # metres per px
def px(lat, lng):
    gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
def ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
pxm = lambda m: max(1, int(round(m / M)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
# the course: round its greens, fairways and tee boxes, plus 30 m (not the houses and car parks beyond)
pts = np.array([px(*q) for f in d['features'] if f['t'] in ('green', 'fairway', 'tee') for r in f['p'] for q in r], np.int32)
course = np.zeros((H, W), np.uint8); cv2.fillPoly(course, [cv2.convexHull(pts)], 1)
course = cv2.dilate(course, disk(pxm(30))) > 0
# distance from the nearest hole line
li = np.full((H, W), 255, np.uint8)
for h in d['holes']: cv2.polylines(li, [np.array([px(*p) for p in h['line']], np.int32)], False, 0, 1)
dist = cv2.distanceTransform(li, cv2.DIST_L2, 3) * M
dist[~course] = 1e9
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
Lb = cv2.blur(L, (5, 5)); g = cv2.GaussianBlur(L, (0, 0), 1); mm = cv2.blur(g, (7, 7))
sd = cv2.blur(np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - mm * mm, 0)), (9, 9))
# bunkers
sand = cv2.morphologyEx(((L > 72) & (A > -10) & (B > 0) & (B < 30)).astype(np.uint8), cv2.MORPH_OPEN, disk(1))
sand = cv2.morphologyEx(sand, cv2.MORPH_CLOSE, disk(2))
k, lb, st, _ = cv2.connectedComponentsWithStats(sand)
bunk = np.zeros((H, W), bool)
for i in range(1, k):
    a = st[i, 4] * M * M
    if not 12 <= a <= 600: continue
    x, y, w, hh = st[i, :4]; sub = (lb[y:y + hh, x:x + w] == i).astype(np.uint8)
    c = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0][0]
    rw, rh = cv2.minAreaRect(c)[1]; per = cv2.arcLength(c, True)
    long_ = max(rw, rh) / max(min(rw, rh), 1)
    wide = min(rw, rh) * M >= 5  # a cart path is never this wide: a long fairway bunker
    if min(rw, rh) * M < 3 or long_ > (4.5 if wide else 2.5): continue  # bits, and cart paths
    if 4 * math.pi * st[i, 4] / per ** 2 < (0.45 if wide and long_ > 2.5 else 0.58): continue  # bunkers are roundish, or long and wide
    if dist[y:y + hh, x:x + w][sub > 0].min() > 60: continue
    bunk[y:y + hh, x:x + w] |= sub > 0
bunk = cv2.dilate(bunk.astype(np.uint8), disk(1)) > 0  # the white stops a little short of the edge
# ponds
water = cv2.morphologyEx(((Lb < 40) & (sd < 1.3)).astype(np.uint8), cv2.MORPH_OPEN, disk(pxm(1.5)))
water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, disk(pxm(2)))
k, lb, st, _ = cv2.connectedComponentsWithStats(water)
water = np.isin(lb, [i for i in range(1, k) if st[i, 4] * M * M > 200 and np.median(L[lb == i]) < 32]) & (dist < 120)  # shade on grass is never this dark
# trees
tex = cv2.blur(np.abs(L - cv2.blur(L, (3, 3))), (9, 9))
can = ((Lb < 36) | (Lb < cv2.blur(L, (25, 25)) - 9)) & (tex > 0.9) & ~(cv2.dilate(water.astype(np.uint8), disk(pxm(1.5))) > 0) & ~bunk
can = cv2.morphologyEx(cv2.morphologyEx(can.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)), cv2.MORPH_OPEN, disk(2)) > 0
can &= dist < 70
def rings(mask, min_m2, eps_m, hole_m2=40):
    cs, hier = cv2.findContours(mask.astype(np.uint8) * 255, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    res = []
    if hier is None: return res
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * M * M < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * M * M >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        poly = [[(x + 0.5, y + 0.5) for x, y in cv2.approxPolyDP(r, eps_m / M, True)[:, 0, :].tolist()] for r in rs]
        poly = [r for r in poly if len(r) >= 3]
        if poly: res.append(poly)
    return res
keep = [f for f in d['features'] if f['t'] not in ('bunker', 'water', 'trees')]
new = []
for t, mk, mn, eps in (('water', water, 200, 0.6), ('bunker', bunk, 10, 0.25)):
    for p in rings(mk, mn, eps): new.append({'t': t, 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in p]})
for x, y, r in tree_circles.circles(can, M):  # trees as circles: easier to edit one at a time
    rg = tree_circles.ring(x, y, r); new.append({'t': 'trees', 'p': [[ll(*q) for q in rg] + [ll(*rg[0])]]})
d['features'] = keep + new
d['attribution'] = 'Greens, fairways and tee boxes from the course yardage book; bunkers, ponds and trees from Esri World Imagery'
json.dump(d, open(out, 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in d['features']))
if len(sys.argv) > 4:  # a picture of the whole course
    col = {'water': (255, 140, 0), 'trees': (255, 0, 255), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 255, 255)}
    o = im.copy()
    for f in d['features']:
        if f['t'] in col:
            for r in f['p']: cv2.polylines(o, [np.array([px(*p) for p in r], np.int32)], True, col[f['t']], 3 if f['t'] in ('water', 'green') else 2)
    for h in d['holes']:
        p = np.array([px(*q) for q in h['line']], np.int32); cv2.polylines(o, [p], False, (255, 255, 255), 2, cv2.LINE_AA)
        x, y = p[len(p) // 2] if len(p) > 2 else (p[0] + p[1]) // 2
        cv2.putText(o, str(h['n']), (int(x) + 12, int(y)), cv2.FONT_HERSHEY_SIMPLEX, 2.4, (0, 0, 0), 12); cv2.putText(o, str(h['n']), (int(x) + 12, int(y)), cv2.FONT_HERSHEY_SIMPLEX, 2.4, (0, 255, 255), 5)
    cv2.imwrite(sys.argv[4], o)
