#!/usr/bin/env python3
"""Convert an Overpass JSON export (out geom) of a golf course into the app's course file.

Usage: build_course.py feat.json config.json out.json
Query used:
  (nwr["golf"](bbox);nwr["natural"="water"](bbox););out geom;
"""
import json, sys

R = 6  # coordinate decimals (~0.1 m)

def pt(p):
    return [round(p["lat"], R), round(p["lon"], R)]

def rings_from_relation(el):
    """Assemble member ways into closed rings; returns (outers, inners)."""
    out = {"outer": [], "inner": []}
    for role in ("outer", "inner"):
        segs = [[pt(p) for p in m["geometry"]] for m in el["members"]
                if m["type"] == "way" and m.get("role", "outer") in (role, "") and "geometry" in m
                and (m.get("role") or "outer") == role]
        while segs:
            ring = segs.pop(0)
            while ring[0] != ring[-1]:
                for i, s in enumerate(segs):
                    if s[0] == ring[-1]:
                        ring += s[1:]; segs.pop(i); break
                    if s[-1] == ring[-1]:
                        ring += s[::-1][1:]; segs.pop(i); break
                else:
                    break
            if ring[0] == ring[-1] and len(ring) >= 4:
                out[role].append(ring)
    return out["outer"], out["inner"]

def inside(p, ring):
    y, x = p; c = False
    for i in range(len(ring) - 1):
        (y1, x1), (y2, x2) = ring[i], ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def centroid(ring):
    n = len(ring) - 1
    return [round(sum(p[0] for p in ring[:n]) / n, R), round(sum(p[1] for p in ring[:n]) / n, R)]

KIND = {"green": "green", "fairway": "fairway", "bunker": "bunker", "tee": "tee",
        "water_hazard": "water", "lateral_water_hazard": "water"}

def main(src, cfg_path, dst):
    els = json.load(open(src))["elements"]
    feats, holes = [], {}
    for el in els:
        t = el.get("tags", {})
        kind = KIND.get(t.get("golf")) or ("water" if t.get("natural") == "water" else None)
        if t.get("golf") == "hole" and el["type"] == "way":
            line = [pt(p) for p in el["geometry"]]
            holes.setdefault(t.get("ref", "?"), []).append(
                {"par": int(t["par"]) if t.get("par", "").isdigit() else None, "line": line})
            continue
        if not kind:
            continue
        polys = []
        if el["type"] == "way" and "geometry" in el:
            ring = [pt(p) for p in el["geometry"]]
            if ring[0] == ring[-1] and len(ring) >= 4:
                polys.append([ring])
        elif el["type"] == "relation":
            outers, inners = rings_from_relation(el)
            for o in outers:
                polys.append([o] + [i for i in inners if inside(i[0], o)])
        for p in polys:
            feats.append({"t": kind, "p": p})
    cfg = json.load(open(cfg_path))
    feats = [f for f in feats if not any(inside(d, f["p"][0]) for d in cfg.get("drop", []))]
    lines = {}
    for ref, hs in holes.items():
        if len(hs) == 1:
            lines[int(ref)] = hs[0]["line"]
    for ref, start in cfg.get("holeFix", {}).items():
        cands = [h["line"] for hs in holes.values() if len(hs) > 1 for h in hs]
        lines[int(ref)] = min(cands, key=lambda l: (l[0][0] - start[0]) ** 2 + (l[0][1] - start[1]) ** 2)
    greens = [f["p"][0] for f in feats if f["t"] == "green"]
    out_holes = []
    for n in range(1, 19):
        line = lines[n]
        end = line[-1]
        g = min(greens, key=lambda r: (centroid(r)[0] - end[0]) ** 2 + (centroid(r)[1] - end[1]) ** 2)
        out_holes.append({"n": n, "par": cfg["par"][n - 1], "hcp": cfg["hcp"][n - 1],
                          "line": line, "tee": line[0], "pin": centroid(g)})
    course = {k: cfg[k] for k in ("id", "name", "location", "tees")}
    course["holes"] = out_holes
    course["features"] = feats
    course["attribution"] = "Course outlines \u00a9 OpenStreetMap contributors (ODbL)"
    json.dump(course, open(dst, "w"), separators=(",", ":"))
    from collections import Counter
    print(Counter(f["t"] for f in feats), len(out_holes))

if __name__ == "__main__":
    main(*sys.argv[1:4])
