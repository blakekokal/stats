# Checks a course file's bunkers (from the yardage book) against the sand in the zoom-19
# imagery: keeps the book's bunkers that sit on sand, drops the ones on grass, and adds the
# bunkers hazards_from_imagery.py found that the book has none for. Use it when the book's
# bunkers are partly wrong but the imagery alone misses some (big waste areas, odd shapes).
#   python3 hazards_from_imagery.py ../data/<id>.json m19.png imagery.json
#   python3 bunkers_from_imagery.py ../data/<id>.json imagery.json m19.png ../data/<id>.json
# Nothing else in the course file changes.
import json, math, sys, cv2, numpy as np
src, found, img, out = sys.argv[1:5]
d = json.load(open(src)); f2 = json.load(open(found))
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); N = 256 * 2 ** Z
M = 156543.03392 * math.cos(math.radians(d['holes'][0]['pin'][0])) / 2 ** Z  # metres per px
def px(lat, lng):
    gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
sand = cv2.morphologyEx(((L > 68) & (A > -8) & (B < 30)).astype(np.uint8), cv2.MORPH_OPEN, disk(1))
def mask(fs):
    mk = np.zeros((H, W), np.uint8)
    for f in fs: cv2.fillPoly(mk, [np.array([px(*q) for q in f['p'][0]], np.int32)], 1)
    return mk
near_green = cv2.dilate(mask([f for f in d['features'] if f['t'] == 'green']), disk(int(15 / M))) > 0
keep, dropped = [], []
for f in d['features']:
    if f['t'] != 'bunker': continue
    mk = mask([f]) > 0; on = sand[mk].mean() if mk.any() else 0
    # on grass: hardly any sand, or not much and away from a green (greenside ones are often drawn a bit big)
    (dropped if on < 0.1 or (on < 0.4 and not near_green[mk].any()) else keep).append(f)
have = cv2.dilate(mask(keep), disk(int(2 / M))) > 0
add = [f for f in f2['features'] if f['t'] == 'bunker' and not have[mask([f]) > 0].any()]
# Big bunkers (over 600 m2, which hazards_from_imagery.py leaves out as bare ground): solid,
# compact, at least 8 m wide, within 40 m of a hole line, and no bunker there yet.
li = np.full((H, W), 255, np.uint8)
for h in d['holes']: cv2.polylines(li, [np.array([px(*p) for p in h['line']], np.int32)], False, 0, 1)
dist = cv2.distanceTransform(li, cv2.DIST_L2, 3) * M
big = cv2.morphologyEx(((L > 72) & (A > -10) & (B > 0) & (B < 30)).astype(np.uint8), cv2.MORPH_OPEN, disk(1))
big = cv2.morphologyEx(big, cv2.MORPH_CLOSE, disk(2))
have = cv2.dilate(mask(keep + add), disk(int(2 / M))) > 0
k, lb, st, _ = cv2.connectedComponentsWithStats(big)
def ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
nbig = 0
for i in range(1, k):
    if not 600 <= st[i, 4] * M * M <= 2500: continue
    x, y, w, hh = st[i, :4]; sub = (lb[y:y + hh, x:x + w] == i).astype(np.uint8)
    c = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0][0]
    rw, rh = cv2.minAreaRect(c)[1]
    if min(rw, rh) * M < 8 or 4 * math.pi * st[i, 4] / cv2.arcLength(c, True) ** 2 < 0.2 or st[i, 4] / cv2.contourArea(cv2.convexHull(c)) < 0.65: continue
    if dist[y:y + hh, x:x + w][sub > 0].min() > 40 or have[y:y + hh, x:x + w][sub > 0].any(): continue
    r = cv2.approxPolyDP(cv2.findContours(cv2.dilate(sub, disk(1)), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0][0], 0.25 / M, True)[:, 0, :]
    r = [ll(qx + x + 0.5, qy + y + 0.5) for qx, qy in r.tolist()]; add.append({'t': 'bunker', 'p': [r + [r[0]]]}); nbig += 1
d['features'] = [f for f in d['features'] if f['t'] != 'bunker'] + keep + add
d['attribution'] = d['attribution'].rstrip('.') + '; bunkers checked against the imagery'
json.dump(d, open(out, 'w'), separators=(',', ':'))
print(len(keep), 'book bunkers kept,', len(dropped), 'dropped (on grass),', len(add), 'added from the imagery (%d big)' % nbig)
