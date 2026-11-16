# Builds data/crosstimbers.json from the masks (seg.py) and the hole lines (holes.py).
import cv2, numpy as np, json, math, sys
from holes import HOLES, BUNKERS, TEES, PAR, HCP, GOLD
m = np.load('masks.npz'); f = np.load('feat.npz')
L, A = f['L'].astype(np.float32), f['A'].astype(np.float32)
H, W = L.shape; MPP = 0.25074; Z = 18; X0, Y0 = 60021, 105689; N = 256 * 2 ** Z
px = lambda v: max(1, int(round(v / MPP)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
u8 = lambda a: a.astype(np.uint8) * 255
P = lambda x, y: (int(round(2 * x - 256)), int(round(2 * y)))
def ll(x, y):  # m18 px -> [lat, lng]
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
def rings(mask, min_m2, eps_m, hole_m2=60):
    cs, hier = cv2.findContours(u8(mask), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    if hier is None: return out
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * MPP * MPP < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * MPP * MPP >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        poly = []
        for r in rs:
            r = cv2.approxPolyDP(r, max(1, eps_m / MPP), True)[:, 0, :]
            if len(r) >= 3: poly.append([[(x + 256) / 2, y / 2] for x, y in r.tolist()])
        if poly: out.append(poly)
    return out
feats = []  # {'t', 'px': [rings], 'h'?}
greens, water, fw, trees = m['greens'], m['water'], m['fw'], m['trees']
# bunkers: sand grown from each seed, within 13 m
sandy = cv2.morphologyEx(u8((L > 58) & (A > -11)), cv2.MORPH_OPEN, disk(px(0.5))) > 0
bunk = np.zeros((H, W), bool)
for s in BUNKERS:
    cx, cy = P(*s); R = px(13)
    win = np.zeros((H, W), np.uint8); cv2.circle(win, (cx, cy), R, 255, -1)
    k, lab, st, cen = cv2.connectedComponentsWithStats(u8(sandy & (win > 0)))
    if k < 2: print('no sand at', s); continue
    best = min(range(1, k), key=lambda i: math.hypot(cen[i][0] - cx, cen[i][1] - cy))
    a = st[best, 4] * MPP * MPP
    if math.hypot(cen[best][0] - cx, cen[best][1] - cy) * MPP > 8 or a < 8: print('sand far/small at', s, round(a)); continue
    bunk |= cv2.morphologyEx(u8(lab == best), cv2.MORPH_CLOSE, disk(px(1))) > 0
greens = greens & ~bunk; fw = fw & ~bunk & ~greens
# trees: cut into ~100 m tiles so no outline is the whole forest
# trees: each hole gets the trees nearest its line (within 60 m), so no outline is the whole forest
best = np.full((H, W), 1e9, np.float32); own = np.zeros((H, W), np.uint8)
for n, l in HOLES.items():
    im = np.full((H, W), 255, np.uint8); cv2.polylines(im, [np.array([P(*p) for p in l], np.int32)], False, 0, 1)
    d = cv2.distanceTransform(im, cv2.DIST_L2, 3); near = d < best; best[near] = d[near]; own[near] = n
edge = (cv2.morphologyEx(own, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0)
tr = trees & (best * MPP < 60) & ~edge
for t, mask, mn, eps in (('water', water, 500, 1.2), ('trees', tr, 40, 1.6), ('fairway', fw, 500, 1.3), ('green', greens, 80, 0.7), ('bunker', bunk, 8, 0.5)):
    for p in rings(mask, mn, eps): feats.append({'t': t, 'px': p})
# pins: the middle of each hole's green
gs = [f for f in feats if f['t'] == 'green']
cen = lambda r: (sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))
holes = []
yd = lambda a, b: math.dist(a, b) * 0.50147 / 0.9144
for n in range(1, 19):
    line = [tuple(p) for p in HOLES[n]]
    g = min(gs, key=lambda f: math.dist(cen(f['px'][0]), line[-1]))
    assert math.dist(cen(g['px'][0]), line[-1]) < 40, n
    g['h'] = n; line[-1] = cen(g['px'][0])
    # every tee sits on the first leg (the app measures a tee to the first turn, then along the line)
    need = max(GOLD[n - 1] - min(t['yards'][n - 1] for t in TEES) + 25, 0)
    while len(line) > 2 and yd(line[0], line[1]) < need: line.pop(1)
    rest = sum(yd(line[i], line[i + 1]) for i in range(1, len(line) - 1))
    ux, uy = line[0][0] - line[1][0], line[0][1] - line[1][1]; ul = math.hypot(ux, uy); ux, uy = ux / ul, uy / ul
    spots = {}
    for t in TEES:
        d = max(t['yards'][n - 1] - rest, 30) * 0.9144 / 0.50147  # px from the first turn
        if n == 17: d = min(d, ul)  # no room behind: the 16th green is there
        spots[round(d)] = (line[1][0] + ux * d, line[1][1] + uy * d)
    back = max(spots)
    line[0] = spots[back]
    for d, (cx, cy) in spots.items():  # a 9 m x 6 m box across the line
        a, b = 4.5 / 0.50147, 3 / 0.50147
        box = [(cx + ux * sa * a - uy * sb * b, cy + uy * sa * a + ux * sb * b) for sa, sb in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        feats.append({'t': 'tee', 'px': [box], 'h': n})
    holes.append({'n': n, 'par': PAR[n - 1], 'hcp': HCP[n - 1], 'line': [ll(*p) for p in line], 'tee': ll(*line[0]), 'pin': ll(*line[-1])})
    print(n, 'line', len(line), 'plays', round(yd(line[0], line[1]) + rest), GOLD[n - 1])
out = {'id': 'crosstimbers', 'name': 'Cross Timbers Golf Course', 'location': 'Azle, TX', 'tees': TEES, 'holes': holes,
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines traced from Esri World Imagery'}
json.dump(out, open(sys.argv[1], 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
json.dump([{'t': f['t'], 'px': f['px'][0]} for f in feats] + [{'t': 'line', 'n': h['n'], 'px': HOLES[h['n']]} for h in holes], open('ov2.json', 'w'))
