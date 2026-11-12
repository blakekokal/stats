#!/usr/bin/env python3
"""Add the out-of-bounds area to the app's course file: everything outside the
golf course's boundary (OpenStreetMap leisure=golf_course).

Usage: add_ob.py boundary.osm.json roads_houses.osm.json config.json course.json
Queries used (Overpass, out geom), bbox around the course:
  nwr["leisure"="golf_course"](bbox);out geom;   (a relation or a plain way)
  (way["highway"](bbox);way["building"](bbox););out geom;

OpenStreetMap's course boundary is rough in places (it can run out to the
streets around a neighbourhood), so houses with their yards and public roads
are cut out of it: the line then follows the backyard fences and road edges.

The result is one "ob" feature: a box PAD metres around the course with the
course cut out of it, so any point outside the boundary is OB. The app draws
only the boundary itself (the inner rings), as a single line. Existing "ob"
features in course.json are replaced. Needs shapely.
"""
import json, math, sys
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union, linemerge, polygonize

PAD = 800  # metres of OB box around the course
ROADS = {"motorway": 12, "motorway_link": 8, "trunk": 12, "primary": 11, "secondary": 9, "tertiary": 8,
         "primary_link": 7, "secondary_link": 7, "tertiary_link": 7,
         "residential": 6, "unclassified": 6, "living_street": 5}  # half-width, metres
HOUSE_PAD = 12   # metres around a house: its yard, up to the fence
SKIP_NAMES = ("club house", "clubhouse")


def main(src, extra, cfg_path, dst):
    cfg = json.load(open(cfg_path))
    course = json.load(open(dst))
    k = math.cos(math.radians(course["holes"][0]["tee"][0]))
    sh = cfg.get("shift", {})
    M = 111320
    xy = lambda p: (p["lon"] * M * k + sh.get("east", 0), p["lat"] * M + sh.get("north", 0))
    back = lambda x, y: [round(y / M, 6), round(x / (M * k), 6)]

    rel = next(e for e in json.load(open(src))["elements"] if e.get("tags", {}).get("leisure") == "golf_course")
    rings = {}
    members = rel["members"] if rel["type"] == "relation" else [{"role": "outer", "geometry": rel["geometry"]}]  # a plain way works too
    for role in ("outer", "inner"):
        lines = [LineString([xy(p) for p in m["geometry"]]) for m in members if m.get("role") == role]
        rings[role] = list(polygonize(linemerge(lines))) if lines else []
    inside = unary_union(rings["outer"]).difference(unary_union(rings["inner"])) if rings["inner"] else unary_union(rings["outer"])
    # Cut out houses (with yards) and roads, then keep the pieces with golf on them.
    cut = []
    for el in json.load(open(extra))["elements"]:
        t, g = el.get("tags", {}), el.get("geometry")
        if not g:
            continue
        pts = [xy(p) for p in g]
        if t.get("highway") in ROADS and len(pts) >= 2:
            cut.append(LineString(pts).buffer(ROADS[t["highway"]], cap_style=2))
        elif "building" in t and len(pts) >= 4 and not any(n in t.get("name", "").lower() for n in SKIP_NAMES):
            cut.append(Polygon(pts).buffer(HOUSE_PAD, join_style=2))
    xy_app = lambda q: (q[1] * M * k, q[0] * M)
    golf = [Polygon([xy_app(q) for q in f["p"][0]]).buffer(0) for f in course["features"] if f["t"] in ("fairway", "green", "tee")]
    left = inside.difference(unary_union(cut).buffer(3).buffer(-3)).buffer(-2).buffer(2)  # tidy slivers
    left = unary_union([g for g in (left.geoms if hasattr(left, "geoms") else [left]) if any(g.intersects(x) for x in golf)])
    inside = unary_union([left, *golf])  # never cut into a fairway, green or tee
    ob = box(*inside.bounds).buffer(PAD, join_style=2).difference(inside).simplify(0.3)

    feats = [f for f in course["features"] if f["t"] != "ob"]
    for poly in (ob.geoms if hasattr(ob, "geoms") else [ob]):
        feats.append({"t": "ob", "p": [[back(x, y) for x, y in r.coords] for r in [poly.exterior, *poly.interiors]]})
    course["features"] = feats
    json.dump(course, open(dst, "w"), separators=(",", ":"))
    # Anything of the course that falls outside the boundary (worth checking).
    out = sorted({h["n"] for h in course["holes"] for p in (h["tee"], h["pin"]) if not inside.contains(Point(p[1] * M * k, p[0] * M))})
    print(f"{sum(f['t'] == 'ob' for f in feats)} OB feature(s); tees/pins outside the boundary: {out or 'none'}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
