# Trees as circles: a wood becomes a cluster of round trees instead of one blob,
# which is easier to edit (move, resize or delete one tree at a time).
# circles(mask, M) packs circles into a tree mask (M: metres per pixel), biggest
# first: each goes where the trees are thickest, 4-14 m across the middle, spaced
# out so a wood is a few big trees (it needn't be exact); a lone tree gets one.
# Then 2-5 small trees close together become one bigger tree (merge_small).
#   python3 tree_circles.py course.json m19.png out.json   # a course file's trees, as circles
import json, math, sys
import cv2, numpy as np

MAX_R, MIN_R = 14.0, 4.0  # metres
SIDES = 10
SPACING = 1.35  # each circle clears this times its radius: a few big trees, not a crowd of little ones
LEFT = 0.4  # stop once less than this share of a wood is uncovered (it needn't be exact)

def circles(mask, M):
    mask = mask.astype(np.uint8)
    out = []
    k, lb, st, _ = cv2.connectedComponentsWithStats(mask)
    for i in range(1, k):
        x, y, w, h = st[i, :4]; P = 2
        sub = np.pad((lb[y:y + h, x:x + w] == i).astype(np.uint8), P)
        total = sub.sum(); first = True
        while True:
            dt = cv2.distanceTransform(sub, cv2.DIST_L2, 5)
            _, best, _, (cx, cy) = cv2.minMaxLoc(dt)
            if not first and (best * M < MIN_R * 0.5 or sub.sum() < LEFT * total): break
            if first and best * M < 1.0: break  # a speck, not a tree
            r = max(min(best, MAX_R / M), MIN_R / M if first else best)
            out.append((x + cx - P + 0.5, y + cy - P + 0.5, min(max(r, MIN_R / M), MAX_R / M)))
            cv2.circle(sub, (cx, cy), int(math.ceil(r * SPACING)), 0, -1)
            first = False
    return merge_small(out, M)  # (x, y, radius) in pixels

SMALL, GAP, GROUP, BIG = 6.0, 2.0, 5, 12.0  # metres; up to GROUP circles

def merge_small(cs, M=1.0):
    """2-5 small trees close together become one bigger tree over the same area:
    fewer circles to edit. cs: (x, y, r) in pixels (M metres per pixel). A group
    only merges if the circle round it stays under BIG metres across the middle."""
    cs = list(cs); small = [i for i, c in enumerate(cs) if c[2] * M <= SMALL]
    near = {i: [j for j in small if j != i and math.dist(cs[i][:2], cs[j][:2]) * M <= (cs[i][2] + cs[j][2]) * M + GAP] for i in small}
    def cover(g):  # a circle round the group: from the middle of its area out to the farthest edge
        w = sum(cs[i][2] ** 2 for i in g); x = sum(cs[i][0] * cs[i][2] ** 2 for i in g) / w; y = sum(cs[i][1] * cs[i][2] ** 2 for i in g) / w
        return x, y, max(math.dist((x, y), cs[i][:2]) + cs[i][2] for i in g)
    used, out = set(), []
    for i in sorted(small, key=lambda i: -cs[i][2]):  # biggest first
        if i in used: continue
        g = [i]
        while len(g) < GROUP:
            cand = {j for k in g for j in near[k] if j not in used and j not in g}
            if not cand: break
            x, y, _ = cover(g); j = min(cand, key=lambda j: math.dist((x, y), cs[j][:2]))
            if cover(g + [j])[2] * M > BIG: break
            g.append(j)
        if len(g) > 1: used.update(g); out.append(cover(g))
    return out + [c for i, c in enumerate(cs) if i not in used]

def ring(x, y, r):  # a circle as a closed ring of pixel points
    return [(x + r * math.cos(2 * math.pi * k / SIDES), y + r * math.sin(2 * math.pi * k / SIDES)) for k in range(SIDES)]

if __name__ == '__main__':
    src, img, out = sys.argv[1:4]
    d = json.load(open(src))
    meta = open(img + '.meta').read().split(); Z, X0, Y0 = map(int, meta)
    H, W = cv2.imread(img, cv2.IMREAD_GRAYSCALE).shape
    N = 256 * 2 ** Z
    M = 156543.03392 * math.cos(math.radians(d['holes'][0]['pin'][0])) / 2 ** Z
    def px(lat, lng):
        gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
        return gx - X0 * 256, gy - Y0 * 256
    def ll(x, y):
        gx, gy = x + X0 * 256, y + Y0 * 256
        return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
    mask = np.zeros((H, W), np.uint8)
    trees = [f for f in d['features'] if f['t'] == 'trees']
    for f in trees:
        cv2.fillPoly(mask, [np.array([px(*q) for q in f['p'][0]], np.int32)], 1)
        for r in f['p'][1:]: cv2.fillPoly(mask, [np.array([px(*q) for q in r], np.int32)], 0)  # clearings
    cs = circles(mask, M)
    rest = [f for f in d['features'] if f['t'] != 'trees']
    d['features'] = rest + [{'t': 'trees', 'p': [[ll(*q) for q in ring(x, y, r)] + [ll(*ring(x, y, r)[0])]]} for x, y, r in cs]
    json.dump(d, open(out, 'w'), separators=(',', ':'))
    print(len(trees), 'tree shapes ->', len(cs), 'circles')
