# Reads the course's vector yardage book (a PDF: cover, plan, notes, then a green
# page and a hole page for each hole) into shapes in yards around each hole's pin.
# On a hole page the dashed rings are 50-yard steps centred on the pin, and the
# north arrow gives the turn, so every point can be put on the ground.
import math, re, sys
import pymupdf

KINDS = {  # fill colour -> what it is
    (0.89, 0.94, 0.87): 'fairway',  # also the tee boxes, which are four-sided
    (0.80, 0.89, 0.97): 'water',
    (0.94, 0.88, 0.72): 'bunker',
    (0.94, 0.97, 0.93): 'green',
    (0.50, 0.70, 0.42): 'tree',
}
near = lambda a, b, tol=0.015: all(abs(x - y) < tol for x, y in zip(a, b))
def kind(fill):
    return next((k for c, k in KINDS.items() if fill and near(fill, c)), None)

def rings_of(d):  # a drawing's outline(s) as point lists, curves sampled
    out, cur, last = [], [], None
    for it in d['items']:
        op = it[0]
        if op == 're':
            r = it[1]; out.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]); continue
        if op == 'qu':
            q = it[1]; out.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]); continue
        a = it[1]
        if last is None or math.dist((a.x, a.y), last) > 0.01:
            if len(cur) >= 3: out.append(cur)
            cur = [(a.x, a.y)]
        if op == 'l':
            b = it[2]; cur.append((b.x, b.y)); last = (b.x, b.y)
        elif op == 'c':
            p0, p1, p2, p3 = it[1:5]
            for k in range(1, 7):
                t = k / 6; u = 1 - t
                cur.append((u**3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t**3 * p3.x,
                            u**3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t**3 * p3.y))
            last = (p3.x, p3.y)
    if len(cur) >= 3: out.append(cur)
    return out

def inside(p, ring):
    x, y = p; c = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): c = not c
    return c

def hole_page(page):
    dr = page.get_drawings()
    dark = (0.07, 0.09, 0.12)
    ctr = lambda r: ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
    pin = [ctr(d['rect']) for d in dr if d['type'] == 'f' and d.get('fill') == (0.0, 0.0, 0.0) and len(d['items']) == 4]
    cx, cy = pin[0]
    grey = [d for d in dr if d['type'] == 's' and d.get('color') and near(d['color'], (0.7, 0.7, 0.7)) and len(d['items']) == 4]
    if grey:  # dashed rings in 50-yard steps round the pin, labelled
        radii = sorted(((d['rect'].x1 - d['rect'].x0) / 2 for d in grey))
        for d in grey: assert math.dist(ctr(d['rect']), (cx, cy)) < 0.5, 'rings not round the pin'
        scales = []
        for w in page.get_text('words'):
            if not re.fullmatch(r'\d{2,3}', w[4]) or int(w[4]) % 50: continue
            r = math.dist(((w[0] + w[2]) / 2, (w[1] + w[3]) / 2), (cx, cy))
            ring = min(radii, key=lambda q: abs(q - r))
            if abs(ring - r) < 3: scales.append(ring / int(w[4]))
        s = sorted(scales)[len(scales) // 2]  # points per yard
        for r in radii: assert abs(r / s / 50 - round(r / s / 50)) < 0.02, (r / s, 'ring not a 50-yard step')
    else:  # a par 3: no rings, but the tee's dot is "N yd to green" from the pin, straight
        dot = [ctr(d['rect']) for d in dr if d['type'] == 'f' and d.get('fill') and near(d['fill'], dark) and len(d['items']) == 4 and d['rect'].y0 > 200
               and any(e['type'] in ('s', 'fs') and e.get('color') and near(e['color'], dark) and e['rect'].width > 4 and e['rect'].contains(d['rect']) for e in dr)]
        yd = int(re.search(r'(\d+) yd to green', page.get_text()).group(1))
        s = math.dist(dot[0], (cx, cy)) / yd
    # north arrow: a dark circle, a line and a filled triangle at the north end
    circ = [d for d in dr if d['type'] == 's' and d.get('color') and near(d['color'], dark) and len(d['items']) == 4 and all(i[0] == 'c' for i in d['items'])]
    tri = [d for d in dr if d['type'] == 'f' and d.get('fill') and near(d['fill'], dark) and len(d['items']) == 3]
    c = circ[0]['rect']; ax, ay = (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2
    t = min(tri, key=lambda d: math.dist(((d['rect'].x0 + d['rect'].x1) / 2, (d['rect'].y0 + d['rect'].y1) / 2), (ax, ay)))
    tx, ty = (t['rect'].x0 + t['rect'].x1) / 2, (t['rect'].y0 + t['rect'].y1) / 2
    shaft = next(d for d in dr if d['type'] == 's' and d.get('color') and near(d['color'], dark) and len(d['items']) == 1
                 and math.dist(((d['rect'].x0 + d['rect'].x1) / 2, (d['rect'].y0 + d['rect'].y1) / 2), (ax, ay)) < 2)
    a, b = (shaft['items'][0][1], shaft['items'][0][2])
    if math.dist((a.x, a.y), (tx, ty)) < math.dist((b.x, b.y), (tx, ty)): a, b = b, a  # b is the head
    nl = math.dist((a.x, a.y), (b.x, b.y)); nx, ny = (b.x - a.x) / nl, (b.y - a.y) / nl
    ex, ey = -ny, nx
    def ground(p):  # page point -> (east, north) yards from the pin
        vx, vy = p[0] - cx, p[1] - cy
        return ((vx * ex + vy * ey) / s, (vx * nx + vy * ny) / s)
    dots = [ctr(d['rect']) for d in dr if d['type'] == 'f' and d.get('fill') and near(d['fill'], dark) and len(d['items']) == 4 and d['rect'].width < 3]
    dots += [(q.x, q.y) for d in dr if d['type'] == 's' and d.get('color') and near(d['color'], dark) and len(d['items']) == 1
             and d['items'][0][0] == 'l' and d['rect'].y0 > 200 for q in d['items'][0][1:3]]  # label leader lines end on the boxes
    small = lambda d: len(d['items']) <= 5 or max(d['rect'].width, d['rect'].height) / s < 35  # tee boxes: rectangles, or small shapes
    boxes = [d for d in dr if d['type'] in ('f', 'fs') and kind(d.get('fill')) == 'fairway' and small(d)]
    dots = [q for q in dots if math.dist(q, (cx, cy)) / s > 50]  # not the front/middle/back marks on the green
    def gap(r, q): return math.hypot(max(r.x0 - q[0], 0, q[0] - r.x1), max(r.y0 - q[1], 0, q[1] - r.y1))
    own = set()
    for q in dots:  # each label's dot or leader line points at the nearest box
        b = min(boxes, key=lambda d: gap(d['rect'], q), default=None)
        if b and gap(b['rect'], q) < 12: own.add(id(b))
    shapes = []
    for d in dr:
        if d['type'] not in ('f', 'fs'): continue
        k = kind(d.get('fill'))
        if not k: continue
        rs = rings_of(d)
        if k == 'fairway' and small(d):  # a tee box; the hole's own have a labelled dot on them
            shapes.append(('tee' if id(d) in own else 'other tee', [[ground(p) for p in ring] for ring in rs])); continue
        if k == 'tree':
            r = d['rect']; shapes.append(('tree', [ground(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))], (r.x1 - r.x0) / 2 / s)); continue
        shapes.append((k, [[ground(p) for p in ring] for ring in rs]))
    # the centre line: the book prints the slope every 50 yards along it, counted from the pin
    tees = [sum(map(lambda q: complex(*q), r[0])) / len(r[0]) for k, r, *_ in shapes if k == 'tee']
    path = []
    for w in page.get_text('words'):
        if not re.fullmatch(r'[+\u2212-]?\d{1,2}', w[4]) or w[1] < 54 or w[3] > 366: continue
        g = ground(((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)); dist = math.hypot(*g)
        if dist < 40 or abs(dist / 50 - round(dist / 50)) * 50 > 4: continue
        if any(abs(complex(*g) - t) < 22 for t in tees): continue  # a tee's own label
        if not any(inside(g, r) for k, rr, *_ in shapes if k in ('fairway', 'green') for r in rr): continue  # the tee labels sit off the fairway
        path.append(g)
    return {'scale': s, 'north': (nx, ny), 'shapes': shapes, 'path': sorted(path, key=lambda g: -math.hypot(*g))}

def read(path):
    doc = pymupdf.open(path)  # 18 holes, or 9 for a nine-hole book
    return {n: hole_page(doc[4 + 2 * (n - 1)]) for n in range(1, (len(doc) - 3) // 2 + 1)}

if __name__ == '__main__':
    from collections import Counter
    for n, h in read(sys.argv[1]).items():
        print(n, round(h['scale'], 3), [round(v, 2) for v in h['north']], Counter(s[0] for s in h['shapes']),
              'tees', [round(math.hypot(*s[1][0][0])) for s in h['shapes'] if s[0] == 'tee'], 'path', [round(math.hypot(*g)) for g in h['path']])
