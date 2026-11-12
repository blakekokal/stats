"""Redraw a course's fairways and greens to fit the satellite imagery.

Usage: trace_turf.py course.json mosaic.png.meta mosaic.png out.json [fairway_reach_m=12] [green_reach_m=6]
                     [water_reach_m=0] [surround_m=0]

water_reach_m > 0 also regrows ponds to the water in the imagery (bunkers are
cut out of them). surround_m > 0 maps the mown grass around each green, out to
that many metres, as fairway, and drops old fairway outlines near greens that
couldn't be fitted.
(mosaic from tools/fetch_tiles.py: 19 <s> <w> <n> <e> mosaic.png)

Each mapped fairway and green is a seed: its turf colour is learnt from inside
it and the rough colour from a ring around it, then the outline is regrown over
the pixels that look like turf (smooth texture, turf colour), within 12 m of the
old edge for fairways and 6 m for greens. Tree-shadow notches are bridged.
Outlines whose turf can't be told from the rough are left as they were.
"""
import cv2, numpy as np, json, math, sys
course_path, mosaic_meta, mask_path, out_path = sys.argv[1:5]
z, X0, Y0 = map(int, open(mosaic_meta).read().split())
IMG = cv2.imread(mask_path)  # the mosaic itself: turf is classified per feature
Hh, Ww = IMG.shape[:2]
N = 256 * 2 ** z
def to_px(lat, lon):
    gx = (lon + 180) / 360 * N
    gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
def to_ll(px, py):
    gx, gy = px + X0 * 256, py + Y0 * 256
    lon = gx / N * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N))))
    return [round(lat, 6), round(lon, 6)]
c = json.load(open(course_path))
mpp = 156543.03 * math.cos(math.radians(c['holes'][0]['tee'][0])) / 2 ** z
px = lambda m: max(1, int(round(m / mpp)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def bbox(poly, pad):
    pts = np.array([to_px(*q) for q in poly[0]])
    x0, y0 = np.floor(pts.min(0)).astype(int) - pad; x1, y1 = np.ceil(pts.max(0)).astype(int) + pad
    return max(0, x0), max(0, y0), min(Ww, x1), min(Hh, y1)
def raster(poly, bb):
    x0, y0, x1, y1 = bb
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    rings = [np.array([(x - x0, y - y0) for x, y in (to_px(*q) for q in r)], np.int32) for r in poly]
    cv2.fillPoly(m, rings[:1], 1)
    if len(rings) > 1: cv2.fillPoly(m, rings[1:], 0)
    return m
def inside_view(poly):
    pts = [to_px(*q) for q in poly[0]]
    return all(0 <= x < Ww and 0 <= y < Hh for x, y in pts)
def polys(mask, bb):
    x0, y0 = bb[0], bb[1]
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 4) > 0.5
    cs, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None: return out
    for i, cnt in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(cnt) < px(4) ** 2: continue
        rings = [cnt]
        ch = hier[0][i][2]
        while ch != -1:
            if cv2.contourArea(cs[ch]) > px(3) ** 2: rings.append(cs[ch])
            ch = hier[0][ch][0]
        rings = [cv2.approxPolyDP(r, 0.35 / mpp, True).reshape(-1, 2) for r in rings]
        rings = [[to_ll(float(x) + x0, float(y) + y0) for x, y in r] for r in rings if len(r) >= 3]
        out.append([r + [r[0]] for r in rings])
    return out
def grow(seed, bb, limit_m, cut=None, open_m=0, close_m=4):
    x0, y0, x1, y1 = bb
    crop = IMG[y0:y1, x0:x1]
    lab = cv2.GaussianBlur(cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32), (0, 0), 2)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(gray, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(gray * gray, (9, 9)) - mu * mu, 0))
    # Turf colour from inside the outline, rough colour from a ring just outside it.
    inner = cv2.erode(seed, disk(px(3))) > 0
    if inner.sum() < 50: inner = seed > 0
    ring = (cv2.dilate(seed, disk(px(limit_m))) > 0) & ~(cv2.dilate(seed, disk(px(6))) > 0)
    smooth = sd < 10
    t = np.median(lab[inner & smooth], 0) if (inner & smooth).sum() > 50 else np.median(lab[inner], 0)
    rr = ring & smooth & (np.abs(lab[..., 1] - t[1]) > 2)
    o = np.median(lab[rr], 0) if rr.sum() > 50 else t + np.array([20, 10, 0])
    if abs(o[1] - t[1]) < 4 and abs(o[0] - t[0]) < 15: return np.zeros(seed.shape, bool)  # no clear turf here: keep the outline as it was
    w = np.array([0.5, 2.0, 1.0])  # weight a (green-red) most, lightness least
    dt = (((lab - t) * w) ** 2).sum(-1); do = (((lab - o) * w) ** 2).sum(-1)
    turf = (dt < do) & smooth & (lab[..., 0] > 0.55 * t[0])
    turf = cv2.medianBlur(turf.astype(np.uint8) * 255, 5) > 0
    region = turf & (cv2.dilate(seed, disk(px(limit_m))) > 0)
    if cut is not None: region &= ~cut[y0:y1, x0:x1]
    region = region.astype(np.uint8)
    if open_m: region = cv2.morphologyEx(region, cv2.MORPH_OPEN, disk(px(open_m)))
    n, lab = cv2.connectedComponents(region)
    keep = np.zeros(region.shape, bool)
    for i in range(1, n):
        comp = lab == i
        ov = (comp & (seed > 0)).sum()
        if ov > 0.15 * comp.sum() or ov > 0.3 * seed.sum():
            keep |= comp
    # Tidy: bridge notches cut by tree shadows, drop blobs that leak into trees,
    # fill small holes. Never reach past the search limit.
    k = keep.astype(np.uint8)
    k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, disk(px(close_m)))
    k = cv2.morphologyEx(k, cv2.MORPH_OPEN, disk(px(2.5)))
    cs, hier = cv2.findContours(k, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hier is not None:
        for i, cnt in enumerate(cs):
            if hier[0][i][3] != -1 and cv2.contourArea(cnt) < px(8) ** 2: cv2.drawContours(k, [cnt], -1, 1, -1)
    lim = cv2.dilate(seed, disk(px(limit_m))) > 0
    k = (k > 0) & lim
    if cut is not None: k &= ~cut[y0:y1, x0:x1]
    # keep only pieces that still touch the original outline
    n, lab = cv2.connectedComponents(k.astype(np.uint8))
    out = np.zeros(k.shape, bool)
    for i in range(1, n):
        comp = lab == i
        if (comp & (seed > 0)).any() and comp.sum() > px(5) ** 2: out |= comp
    return out
feats, new, stats = c['features'], [], {'green': [0, 0], 'fairway': [0, 0]}
greens_px = np.zeros((Hh, Ww), bool)
done = {}
greens_cut = None
FW_REACH = float(sys.argv[5]) if len(sys.argv) > 5 else 12  # how far an edge may move, metres
GR_REACH = float(sys.argv[6]) if len(sys.argv) > 6 else 6
WT_REACH = float(sys.argv[7]) if len(sys.argv) > 7 else 0
SURROUND = float(sys.argv[8]) if len(sys.argv) > 8 else 0
kept_fw = set()
passes = [('green', GR_REACH, 1.5, 3), ('fairway', FW_REACH, 0.8, 8)] + ([('water', WT_REACH, 1.0, 3)] if WT_REACH else [])
for kind, limit, open_m, close_m in passes:
    if kind == 'fairway': greens_cut = cv2.dilate(greens_px.astype(np.uint8), disk(px(0.6))) > 0
    for i, f in enumerate(feats):
        if f['t'] != kind: continue
        if not inside_view(f['p']): continue
        bb = bbox(f['p'], px(limit) + 4)
        seed = raster(f['p'], bb)
        got = grow(seed, bb, limit, greens_cut, open_m, close_m)
        ratio = got.sum() / max(1, seed.sum())
        ps = polys(got, bb) if (0.6 if kind == 'water' else 0.2) <= ratio <= 3 else []  # shaded creeks stay as mapped
        x0, y0, x1, y1 = bb
        if ps:
            done[i] = [{'t': kind, 'p': p} for p in ps]
            stats.setdefault(kind, [0, 0])[0] += 1
            if kind == 'green': greens_px[y0:y1, x0:x1] |= got
        else:
            stats.setdefault(kind, [0, 0])[1] += 1
            if kind == 'fairway': kept_fw.add(i)
            if kind == 'green': greens_px[y0:y1, x0:x1] |= seed > 0
# Mown grass around each green (collars, approaches, chipping areas): pixels
# clearly greener than the rough around the green, smooth, joined to the green.
surrounds = []
if SURROUND:
    for i, f in enumerate(feats):
        if f['t'] != 'green' or not inside_view(f['p']): continue
        gp = [g['p'] for g in done.get(i, [f])]
        bb = bbox(gp[0], px(SURROUND + 15))
        x0, y0, x1, y1 = bb
        g = np.zeros((y1 - y0, x1 - x0), np.uint8)
        for p_ in gp: g |= raster(p_, bb)
        crop = IMG[y0:y1, x0:x1]
        lab = cv2.GaussianBlur(cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32), (0, 0), 2.5)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
        mu = cv2.blur(gray, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(gray * gray, (9, 9)) - mu * mu, 0))
        smooth = sd < 10
        far = (cv2.dilate(g, disk(px(SURROUND + 12))) > 0) & ~(cv2.dilate(g, disk(px(SURROUND + 3))) > 0) & smooth
        if far.sum() < 100: continue
        rough_a = np.percentile(lab[..., 1][far], 60)   # rough: the redder (browner) smooth ground nearby
        green_a = np.median(lab[..., 1][g > 0])
        if rough_a - green_a < 4: continue              # the rough is as green as the green: can't tell
        cut_a = green_a + 0.55 * (rough_a - green_a)
        turf = (lab[..., 1] < cut_a) & smooth & (lab[..., 0] > 0.5 * np.median(lab[..., 0][g > 0]))
        near = cv2.dilate(g, disk(px(SURROUND))) > 0
        turf = (turf & near).astype(np.uint8)
        turf = cv2.morphologyEx(turf, cv2.MORPH_OPEN, disk(px(1.2)))
        turf = cv2.morphologyEx(turf, cv2.MORPH_CLOSE, disk(px(3)))
        n, labs = cv2.connectedComponents(turf | g)
        touch = set(np.unique(labs[cv2.dilate(g, disk(px(1.5))) > 0])) - {0}
        keep = np.isin(labs, list(touch)) & ~(cv2.dilate(g, disk(px(0.3))) > 0) & (near)
        if keep.sum() < px(4) ** 2: continue
        surrounds += [{'t': 'fairway', 'p': p_} for p_ in polys(keep, bb)]
greens_ll = [g['p'] for i, f in enumerate(feats) if f['t'] == 'green' for g in done.get(i, [f])]
def near_green(f, m):
    r = f['p'][0]; c_ = [sum(q[0] for q in r) / len(r), sum(q[1] for q in r) / len(r)]
    return any(min(math.hypot((q[0] - c_[0]) * 111320, (q[1] - c_[1]) * 111320 * math.cos(math.radians(c_[0]))) for q in gr[0]) < m for gr in greens_ll)
out = []
for i, f in enumerate(feats):
    if SURROUND and i in kept_fw and near_green(f, 40): continue  # an old surround outline we couldn't fit
    out.extend(done.get(i, [f]))
out += surrounds
# Bunkers win over water: cut them out of the ponds' outlines.
if WT_REACH:
    from shapely.geometry import Polygon as SP
    from shapely.ops import unary_union as UU
    sand = UU([SP([(q[1], q[0]) for q in f['p'][0]]).buffer(0) for f in out if f['t'] == 'bunker'])
    res = []
    for f in out:
        if f['t'] != 'water': res.append(f); continue
        w = SP([(q[1], q[0]) for q in f['p'][0]], [[(q[1], q[0]) for q in r] for r in f['p'][1:]]).buffer(0).difference(sand)
        for g_ in (w.geoms if hasattr(w, 'geoms') else [w]):
            if g_.geom_type == 'Polygon' and not g_.is_empty:
                res.append({'t': 'water', 'p': [[[round(y, 6), round(x, 6)] for x, y in r.coords] for r in [g_.exterior, *g_.interiors]]})
    out = res
print('green surrounds added:', len(surrounds))
c['features'] = out
# A hole's default pin goes in the middle of its green if the green moved off it.
def inpoly(p, ring):
    y, x = p; ins = False
    for (y1, x1), (y2, x2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: ins = not ins
    return ins
greens = [f['p'][0] for f in out if f['t'] == 'green']
cen = lambda r: [sum(q[0] for q in r) / len(r), sum(q[1] for q in r) / len(r)]
moved = 0
for h in c['holes']:
    if greens and not any(inpoly(h['pin'], g) for g in greens):
        g = min(greens, key=lambda g: (cen(g)[0] - h['pin'][0]) ** 2 + (cen(g)[1] - h['pin'][1]) ** 2)
        h['pin'] = [round(v, 6) for v in cen(g)]; moved += 1
print('pins moved onto their greens:', moved)
json.dump(c, open(out_path, 'w'), separators=(',', ':'))
print('traced / kept as was:', stats)
