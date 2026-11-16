# Reads each hole page of the yardage book: green, tees, scale and north, in page points.
import re, subprocess, json, math, sys
PDF = sys.argv[1]; out = {}
for n in range(1, 19):
    page = 3 + 2 * n
    svg = subprocess.run(['pdftocairo', '-svg', '-f', str(page), '-l', str(page), PDF, '-'], capture_output=True, text=True).stdout
    body = svg[svg.find('</defs>'):]
    words = re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)',
                       subprocess.run(['pdftotext', '-f', str(page), '-l', str(page), '-bbox', PDF, '-'], capture_output=True, text=True).stdout)
    words = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in words]
    paths = re.findall(r'<path([^>]*?)d="([^"]+)"', body)
    num = lambda d: [float(x) for x in re.findall(r'-?\d+\.?\d*(?:e-?\d+)?', d)]
    def circ(d):  # centre and radius of a 4-curve circle path
        v = num(d); xs, ys = v[0::2], v[1::2]
        return ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(xs) - min(xs)) / 2)
    blue = [circ(d) for a, d in paths if 'rgb(19.999695%, 45.097351%, 94.902039%)' in a][0]
    green = [circ(d) for a, d in paths if 'fill="rgb(0%, 0%, 0%)" fill-opacity="0.8"' in a][0]
    arcs = sorted({round(circ(d)[2], 2) for a, d in paths if 'stroke-dasharray="0 2.6"' in a and 'stroke-opacity="0.26"' in a and abs(circ(d)[0] - green[0]) < 0.5 and abs(circ(d)[1] - green[1]) < 0.5})
    # north arrow: the shaft (2-point stroke) inside the compass circle
    comp = [circ(d) for a, d in paths if 'fill-opacity="0.92"' in a][0]
    shaft = [num(d) for a, d in paths if 'stroke-width="1.4" stroke-linecap="butt"' in a and len(num(d)) == 4 and math.dist(num(d)[:2], comp[:2]) < comp[2]][0]
    head = [num(d) for a, d in paths if 'fill="rgb(7.058716%, 9.01947%, 12.156677%)"' in a and d.strip().endswith('Z M ' + ' '.join(d.split()[1:3])) and math.dist(num(d)[:2], comp[:2]) < comp[2] + 1]
    tip = head[0][:2] if head else None
    a, b = shaft[:2], shaft[2:]
    if tip and math.dist(a, tip) < math.dist(b, tip): a, b = b, a  # a -> b points at the tip
    nl = math.dist(a, b); north = ((b[0] - a[0]) / nl, (b[1] - a[1]) / nl)
    # other tees: a short leader line ending at x=142.98; its label "−NN" is to the right, the tee is 6.8pt left of the leader
    tees = [{'d': 0, 'p': blue[:2]}]
    for at, d in paths:  # a leader runs from beside the tee (P) to a label column (Q); the tee is under the elevation label beyond P
        v = num(d)
        if 'stroke-width="0.5"' not in at or len(v) != 4: continue
        P, Q = v[:2], v[2:]; sgn = 1 if Q[0] > P[0] else -1
        lab = [w for w in words if abs((w[1] + w[3]) / 2 - Q[1]) < 2 and re.fullmatch(r'[−+-]\d+', w[4]) and 0 < sgn * ((w[0] + w[2]) / 2 - Q[0]) < 16]
        el = [w for w in words if abs((w[1] + w[3]) / 2 - P[1]) < 3 and 0 < -sgn * ((w[0] + w[2]) / 2 - P[0]) < 12]
        if lab and el: tees.append({'d': int(lab[0][4].replace('−', '-')), 'p': ((el[0][0] + el[0][2]) / 2, P[1])})
    said = [float(words[i + 2][4]) for i in range(len(words) - 3) if words[i][4] == 'TEE' and words[i + 3][4] == 'yd'][0]
    scale = arcs[0] / 100 if arcs else math.dist(blue[:2], green[:2]) / said
    out[n] = {'green': green[:2], 'ptPerYd': scale, 'said': said, 'arcs': arcs, 'north': north, 'tees': tees,
              'teeYd': round(math.dist(blue[:2], green[:2]) / scale, 1)}
    print(n, 'tee->green', out[n]['teeYd'], 'north', [round(x, 3) for x in north], 'tees', [(t['d'], round(math.dist(t['p'], green[:2]) / scale)) for t in tees], 'said', said)
json.dump(out, open('book.json', 'w'))
