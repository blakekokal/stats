#!/usr/bin/env python3
"""Add out-of-bounds areas (public roads and houses) to the app's course file.

Usage: add_ob.py roads_buildings.osm.json config.json course.json
Query used (Overpass, out geom), bbox around the course:
  (way["highway"](bbox);way["building"](bbox););out geom;

Roads are widened into strips, houses into their lot around them; the result is
merged, kept to within REACH metres of a hole, and anything mapped as part of
the course (fairway, green, tee, bunker) is cut back out. Existing "ob"
features in course.json are replaced. Needs shapely.
"""
import json, math, sys
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROADS = {"motorway": 12, "trunk": 12, "primary": 11, "secondary": 9, "tertiary": 8,
         "primary_link": 7, "secondary_link": 7, "tertiary_link": 7,
         "residential": 6, "unclassified": 6, "living_street": 5}  # half-width, metres
HOUSE_PAD = 10   # metres around a house (its yard), counted as out of bounds
REACH = 150      # metres from a hole's line
SKIP_NAMES = ("club house", "clubhouse")


def main(src, cfg_path, dst):
    cfg = json.load(open(cfg_path))
    course = json.load(open(dst))
    lat0 = course["holes"][0]["tee"][0]
    k = math.cos(math.radians(lat0))
    sh = cfg.get("shift", {})
    dn, de = sh.get("north", 0), sh.get("east", 0)
    M = 111320
    xy = lambda lat, lon: ((lon * M * k) + de, (lat * M) + dn)          # OSM -> shifted metres
    xy_app = lambda p: (p[1] * M * k, p[0] * M)                       # course file -> metres
    back = lambda x, y: [round(y / M, 6), round(x / (M * k), 6)]

    shapes = []
    for el in json.load(open(src))["elements"]:
        t, g = el.get("tags", {}), el.get("geometry")
        if el["type"] != "way" or not g:
            continue
        pts = [xy(p["lat"], p["lon"]) for p in g]
        if t.get("highway") in ROADS and len(pts) >= 2:
            shapes.append(LineString(pts).buffer(ROADS[t["highway"]], cap_style=2))
        elif "building" in t and len(pts) >= 4 and not any(s in t.get("name", "").lower() for s in SKIP_NAMES):
            shapes.append(Polygon(pts).buffer(HOUSE_PAD, join_style=2))
    ob = unary_union(shapes)
    near = unary_union([LineString([xy_app(p) for p in h["line"]]).buffer(REACH) for h in course["holes"]])
    play = unary_union([Polygon([xy_app(p) for p in f["p"][0]]).buffer(0) for f in course["features"]
                        if f["t"] in ("fairway", "green", "tee", "bunker")])
    ob = ob.intersection(near).difference(play).simplify(0.6)

    feats = [f for f in course["features"] if f["t"] != "ob"]
    polys = list(ob.geoms) if hasattr(ob, "geoms") else [ob]
    n = 0
    for poly in polys:
        if poly.geom_type != "Polygon" or poly.area < 30:
            continue
        rings = [poly.exterior] + list(poly.interiors)
        feats.append({"t": "ob", "p": [[back(x, y) for x, y in r.coords] for r in rings]})
        n += 1
    course["features"] = feats
    json.dump(course, open(dst, "w"), separators=(",", ":"))
    print(f"{n} out-of-bounds areas")


if __name__ == "__main__":
    main(*sys.argv[1:4])
