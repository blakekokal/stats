# Shady Oaks Country Club (Fort Worth, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and the 18 hole lines
(with par), named "SOCC 1" to "SOCC 18" (#6 has no ref tag: taken from the name). Only what lies inside the course
boundary (way 28320368) is kept; Hawks Creek next door is left out. The 9-hole par-3 course in the middle of the
site shares the boundary: its hole lines are left out and `trim_par3.py` drops its shapes (and the practice
greens). The outlines sit 0.3 m east and 1.3 m south of the Esri imagery (bunker fit; the greens agree).

OSM's bunkers predate the 2020 renovation: the sand check, judged by eye, finds 58 of them on grass (dropped with
`drop`) and 14 new bunkers in the imagery (added with `keep_found_bunkers.py`).

Scorecard from GolfPass (2927, the Shady Oaks Course); its pars match OpenStreetMap's hole tags (par 71). The Hybrid
tee is left out. Ratings matched by total yards (within about 1%): Tee I = Black (6855), Tee II = White (6465),
Tee III = Green (5835); Tee IV has none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4295,32.7465,-97.4110,32.7590" -o map.json`
2. `python3 tools/shadyoaks/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py shadyoaks.osm.json shadyoaks.config.json ../data/shadyoaks.json`
   - `python3 fetch_tiles.py 19 32.7474 -97.4283 32.7580 -97.4122 shadyoaks/m19.png`
   - `hazards_from_imagery.py` + `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/shadyoaks.json checked.json ../data/shadyoaks.json 32.749106,-97.41469 32.750069,-97.416744 32.750271,-97.419461 32.750291,-97.416557 32.750354,-97.416726 32.751169,-97.416418 32.751354,-97.420528 32.752028,-97.417245 32.752492,-97.422232 32.753106,-97.424266 32.754144,-97.422342 32.754517,-97.422716 32.754528,-97.421234 32.754549,-97.421505`
   - `python3 shadyoaks/trim_par3.py map.json ../data/shadyoaks.json`
   - `python3 add_ob.py shadyoaks.boundary.osm.json shadyoaks.roads_houses.osm.json shadyoaks.config.json ../data/shadyoaks.json`
   - `python3 trees_from_imagery.py ../data/shadyoaks.json shadyoaks/m19.png ../data/shadyoaks.json`
   - from the repo root: `python3 tools/soften_shapes.py data/shadyoaks.json` and `python3 tools/elevation.py shadyoaks`
