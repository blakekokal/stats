# Builds data/sherrillpark2.json.
#   m18.png      Esri imagery (fetch_tiles.py): greens, bunkers and ponds are traced from it
#   book.json    the yardage book's tees, green, scale and north for each hole (parse_book.py)
#   book/im-NNN.png  the book's own picture of each hole (pdfimages -png): fairways are traced from it
import cv2, numpy as np, json, math, sys
from holes import GREENS, TEES, PAR, HCP, MPP, NOT_SAND
im = cv2.imread('m18.png'); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open('m18.png.meta').read().split()); N = 256 * 2 ** Z
BOOK = {int(k): v for k, v in json.load(open('book.json')).items()}
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
g = cv2.GaussianBlur(L, (0, 0), 1.0); m = cv2.blur(g, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(g * g, (9, 9)) - m * m, 0))
Lb, Ab, sb = cv2.blur(L, (7, 7)), cv2.blur(A, (7, 7)), cv2.blur(sd, (7, 7))
px = lambda v: max(1, int(round(v / MPP)))
YD = 0.9144 / MPP  # mosaic px per yard
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
u8 = lambda a: a.astype(np.uint8) * 255
def ll(x, y):  # mosaic px -> [lat, lng]
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
            r = cv2.approxPolyDP(r, max(0.6, eps_m / MPP), True)[:, 0, :]
            if len(r) >= 3: poly.append([[float(x), float(y)] for x, y in r.tolist()])
        if poly: out.append(poly)
    return out
cenr = lambda r: (sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))
# ---- from the Esri imagery: greens, ponds, bunkers ----
gc = cv2.morphologyEx(u8((Lb > 53) & (Ab < -17) & (sb < 1.3)), cv2.MORPH_OPEN, disk(6)) > 0
k, lb, st, cen = cv2.connectedComponentsWithStats(u8(gc))
gof = {}
for n, p in GREENS.items():  # the brightest, smoothest turf at each green's point
    i = min(range(1, k), key=lambda i: math.dist(cen[i], p))
    assert math.dist(cen[i], p) * MPP < 20, n
    gm = cv2.morphologyEx(u8(lb == i), cv2.MORPH_CLOSE, disk(px(2.5))) > 0
    gof[n] = cv2.dilate(u8(gm), disk(px(1.5))) > 0  # the mask stops short of the collar
greens = np.any(list(gof.values()), axis=0)
near = cv2.distanceTransform(u8(~greens), cv2.DIST_L2, 3) * MPP  # metres to the nearest green
water = cv2.morphologyEx(u8(((Lb < 34.5) & (sb < 1.6)) | (Lb < 17)), cv2.MORPH_OPEN, disk(px(3))) > 0  # flat and dark, or darker than any shadow
k, lb, st, _ = cv2.connectedComponentsWithStats(u8(water))
water = np.isin(lb, [i for i in range(1, k) if st[i, 4] * MPP * MPP > 250]) & (near < 330)
water = cv2.morphologyEx(u8(water), cv2.MORPH_CLOSE, disk(px(7)))
cs, _ = cv2.findContours(water, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)  # algae and reflections leave gaps
flat = ((Lb < 34.5) & (sb < 1.6)).astype(np.uint8)
def pond(c):  # tree shadow is as dark as a pond but never flat
    one = cv2.drawContours(np.zeros((H, W), np.uint8), [c], -1, 1, -1)
    return cv2.contourArea(c) * MPP * MPP > 300 and (flat & one).sum() / one.sum() > 0.3
water = cv2.drawContours(np.zeros((H, W), np.uint8), [c for c in cs if pond(c)], -1, 255, -1) > 0
sand = cv2.morphologyEx(u8((L > 70) & (A > -8) & (B > 2) & (B < 28)), cv2.MORPH_OPEN, disk(3))  # wider than a cart path
feats = []; holes = []; corridor = np.zeros((H, W), bool); fws = {}
# ---- from the yardage book: tees, the hole's line, fairways ----
for n in range(1, 19):
    b = BOOK[n]; gp = b['green']; nx, ny = b['north']; ex, ey = -ny, nx; kk = YD / b['ptPerYd']
    gr = max(rings(gof[n], 60, 0.7), key=lambda p: cv2.contourArea(np.array(p[0], np.float32)))
    feats.append({'t': 'green', 'px': gr, 'h': n}); pin = cenr(gr[0])
    # page points -> mosaic px: the book's green point sits on the green's middle; its north arrow turns the page
    M = np.array([[ex * kk, ey * kk], [-nx * kk, -ny * kk]]); off = np.array(pin) - M @ np.array(gp)
    world = lambda p: tuple(M @ np.array(p) + off)
    bim = cv2.imread('book/im-%03d.png' % (n - 1)); bh, bw = bim.shape[:2]
    Mi = np.hstack([M / 3, (M @ np.array([0, 54.0]) + off).reshape(2, 1)])  # book image px -> mosaic px (image is 3 px per point, 54 pt down the page)
    bl = cv2.cvtColor(bim, cv2.COLOR_BGR2LAB).astype(np.float32)
    seen = cv2.erode(u8(bim.min(axis=2) < 235), np.ones((9, 9), np.uint8))  # the picture fades to white off the hole
    tees = sorted(b['tees'], key=lambda t: t['d'], reverse=True); pro = world(tees[0]['p'])
    # the line: tee, then (on a dogleg) the middle of the pictured strip where it strays furthest from straight, then the green
    line = [pro, pin]
    T, G = np.array(tees[0]['p']), np.array(gp); u = (G - T) / np.linalg.norm(G - T); v = np.array([-u[1], u[0]])
    if b['said'] - b['teeYd'] > 6:
        bestq, besto = None, 0
        for f in np.linspace(0.25, 0.75, 26):
            c = T + (G - T) * f; hit = [o for o in np.arange(-70, 70, 0.5) if 0 <= int((c + v * o)[0] * 3) < bw and 0 <= int(((c + v * o)[1] - 54) * 3) < bh and seen[int(((c + v * o)[1] - 54) * 3), int((c + v * o)[0] * 3)]]
            if hit and abs((min(hit) + max(hit)) / 2) > abs(besto): besto = (min(hit) + max(hit)) / 2; bestq = c + v * besto
        # slide the bend along its offset until the line is as long as the book says
        base = bestq - v * besto; want = b['said'] * b['ptPerYd']
        o = min(np.arange(0, 80, 0.25) * np.sign(besto), key=lambda o: abs(np.linalg.norm(base + v * o - T) + np.linalg.norm(G - base - v * o) - want))
        line = [pro, world(base + v * o), pin]
    yd = lambda a, c: math.dist(a, c) / YD
    # tee boxes: 10 m x 7 m, lying along the first leg, at each tee the book marks
    ux, uy = line[1][0] - line[0][0], line[1][1] - line[0][1]; ul = math.hypot(ux, uy); ux, uy = ux / ul, uy / ul
    boxes = np.zeros((H, W), np.uint8); far = 0
    for t in tees:
        cx, cy = world(t['p']); a, c = 5 / MPP, 3.5 / MPP
        box = [(cx + ux * sa * a - uy * sb * c, cy + uy * sa * a + ux * sb * c) for sa, sb in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        feats.append({'t': 'tee', 'px': [box], 'h': n}); cv2.fillPoly(boxes, [np.array(box, np.int32)], 255)
        far = max(far, math.dist(pro, (cx, cy)))
    # fairway: the green winter turf in the book's picture, past the last tee and short of the green
    veg = cv2.morphologyEx(u8((cv2.GaussianBlur(bl[..., 1] - 128, (0, 0), 2) < -3.2) & (bl[..., 2] - 128 > 19) & (seen > 0)), cv2.MORPH_OPEN, disk(2))
    fw = cv2.warpAffine(veg, Mi, (W, H), flags=cv2.INTER_LINEAR) > 127
    strip = cv2.warpAffine(seen, Mi, (W, H), flags=cv2.INTER_NEAREST) > 0
    yy, xx = np.mgrid[0:H, 0:W]
    li = np.full((H, W), 255, np.uint8); cv2.polylines(li, [np.array(line, np.int32)], False, 0, 1)
    fw &= (cv2.distanceTransform(li, cv2.DIST_L2, 3) * MPP < 27)  # the picture also shows the holes next door
    fw &= (np.hypot(xx - pro[0], yy - pro[1]) > far + 25 * YD) & ~(cv2.dilate(u8(greens), disk(px(13))) > 0) & ~(cv2.dilate(u8(water), disk(px(3))) > 0) & ~(cv2.dilate(sand, disk(px(2))) > 0) & ~(cv2.dilate(boxes, disk(px(10))) > 0)
    fw = cv2.morphologyEx(u8(fw), cv2.MORPH_CLOSE, disk(px(6)))
    fw = cv2.morphologyEx(fw, cv2.MORPH_OPEN, disk(px(4.5)))
    cs, _ = cv2.findContours(fw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cs = sorted([c for c in cs if cv2.contourArea(c) * MPP * MPP > (450 if PAR[n - 1] > 3 else 1e9)], key=cv2.contourArea, reverse=True)[:3]
    fws[n] = cv2.drawContours(np.zeros((H, W), np.uint8), cs, -1, 255, -1) > 0
    corridor |= strip
    holes.append({'n': n, 'par': PAR[n - 1], 'hcp': HCP[n - 1], 'line': [ll(*p) for p in line], 'tee': ll(*line[0]), 'pin': ll(*line[-1]), '_px': line})
    print(n, 'book', b['said'], 'line', round(sum(yd(line[i], line[i + 1]) for i in range(len(line) - 1))), 'card', TEES[0]['yards'][n - 1], 'tees', len(tees), 'fairways', len(cs))
taken = np.zeros((H, W), bool)
for n in range(1, 19):  # one hole's fairway never lies on another's
    f = fws[n] & ~taken; taken |= cv2.dilate(u8(f), disk(px(2))) > 0
    for p in rings(cv2.morphologyEx(u8(f), cv2.MORPH_OPEN, disk(px(4.5))) > 0, 400, 2.2, hole_m2=1e9): feats.append({'t': 'fairway', 'px': [p[0]], 'h': n})
k, lb, st, cen = cv2.connectedComponentsWithStats(sand)
bunk = np.isin(lb, [i for i in range(1, k) if 25 <= st[i, 4] * MPP * MPP <= 450 and st[i, 4] / (st[i, 2] * st[i, 3]) > 0.4
                      and all(math.dist(cen[i], q) * MPP > 14 for q in NOT_SAND)]) & (cv2.dilate(u8(corridor), disk(px(8))) > 0)
bunk = cv2.morphologyEx(u8(bunk), cv2.MORPH_CLOSE, disk(px(1))) > 0
for t, mask, mn, eps in (('water', water, 300, 1.2), ('bunker', bunk, 8, 0.5)):
    for p in rings(mask, mn, eps): feats.append({'t': t, 'px': p})
out = {'id': 'sherrillpark2', 'name': 'Sherrill Park Golf Course – Course 2', 'location': 'Richardson, TX', 'tees': TEES,
       'holes': [{k: v for k, v in h.items() if k != '_px'} for h in holes],
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines traced from Esri World Imagery'}
json.dump(out, open(sys.argv[1], 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
if len(sys.argv) > 2:  # a picture to check the result by eye
    col = {'water': (255, 120, 0), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 0, 255)}
    for f in feats:
        for r in f['px']: cv2.polylines(im, [np.array(r, np.int32)], True, col[f['t']], 2)
    for h in holes:
        p = np.array(h['_px'], np.int32); cv2.polylines(im, [p], False, (255, 255, 255), 1)
        mx, my = p[1] if len(p) > 2 else (p[0] + p[1]) // 2
        cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 0), 6); cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 255, 255), 3)
    cv2.imwrite(sys.argv[2], im[2600:4250, 700:2300])
