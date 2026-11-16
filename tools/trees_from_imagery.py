# Replaces a course file's trees with the tree canopy in the zoom-19 Esri imagery,
# as circles (tree_circles.py), and changes nothing else. Trees are kept near the
# holes, never in OB, and never on a green, fairway, tee box, bunker or pond.
#   python3 trees_from_imagery.py ../data/<id>.json m19.png out.json [check.png]
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
poly = lambda r: np.array([px(*q) for q in r], np.int32)
def fill(feats):  # a mask of features (first ring filled, the others cut out)
    mk = np.zeros((H, W), np.uint8)
    for f in feats:
        cv2.fillPoly(mk, [poly(f['p'][0])], 1)
        for r in f['p'][1:]: cv2.fillPoly(mk, [poly(r)], 0)
    return mk > 0
# where trees may go: near a hole, not in OB, not on the course's other shapes
li = np.full((H, W), 255, np.uint8)
for h in d['holes']: cv2.polylines(li, [poly(h['line'])], False, 0, 1)
near = cv2.distanceTransform(li, cv2.DIST_L2, 3) * M < 70
ob = fill([f for f in d['features'] if f['t'] == 'ob'])
other = cv2.dilate(fill([f for f in d['features'] if f['t'] in ('green', 'fairway', 'tee', 'bunker', 'water')]).astype(np.uint8), disk(pxm(1))) > 0
# the canopy: dark, or darker than round about, and leafy
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); L = lab[..., 0] * 100 / 255
Lb = cv2.blur(L, (5, 5)); tex = cv2.blur(np.abs(L - cv2.blur(L, (3, 3))), (9, 9))
g = cv2.GaussianBlur(L, (0, 0), 1); mm = cv2.blur(g, (7, 7)); sd = cv2.blur(np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - mm * mm, 0)), (9, 9))
pond = (Lb < 32) & (sd < 1.3)  # dark flat water the file may not have
can = ((Lb < 36) | (Lb < cv2.blur(L, (25, 25)) - 9)) & (tex > 0.9) & ~(cv2.dilate(pond.astype(np.uint8), disk(pxm(1.5))) > 0)
can = cv2.morphologyEx(cv2.morphologyEx(can.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)), cv2.MORPH_OPEN, disk(2)) > 0
can &= near & ~ob & ~other
trees = []
for x, y, r in tree_circles.circles(can, M):
    if ob[min(int(y), H - 1), min(int(x), W - 1)]: continue  # no trees in OB
    rg = tree_circles.ring(x, y, r); trees.append({'t': 'trees', 'p': [[ll(*q) for q in rg] + [ll(*rg[0])]]})
old = sum(f['t'] == 'trees' for f in d['features'])
d['features'] = [f for f in d['features'] if f['t'] != 'trees'] + trees
json.dump(d, open(out, 'w'), separators=(',', ':'))
print(old, 'tree shapes ->', len(trees), 'tree circles; nothing else changed')
if len(sys.argv) > 4:  # a picture of the whole course
    col = {'water': (255, 140, 0), 'trees': (255, 0, 255), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 255, 255), 'ob': (0, 0, 180)}
    o = im.copy()
    for f in d['features']:
        for r in f['p']: cv2.polylines(o, [poly(r)], True, col.get(f['t'], (0, 0, 0)), 3 if f['t'] in ('ob', 'trees') else 2)
    for h in d['holes']:
        p = poly(h['line']); cv2.polylines(o, [p], False, (255, 255, 255), 2, cv2.LINE_AA)
        x, y = p[len(p) // 2] if len(p) > 2 else (p[0] + p[1]) // 2
        cv2.putText(o, str(h['n']), (int(x) + 12, int(y)), cv2.FONT_HERSHEY_SIMPLEX, 2.4, (0, 0, 0), 12); cv2.putText(o, str(h['n']), (int(x) + 12, int(y)), cv2.FONT_HERSHEY_SIMPLEX, 2.4, (0, 255, 255), 5)
    cv2.imwrite(sys.argv[4], o)
