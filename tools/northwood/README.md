# The Northwood Club (Dallas, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and the 18 hole
lines (with par). Only what lies inside the course boundary (way 27811262) is kept; the practice greens,
short-game area and range tee are dropped with `trim_far.py`. The outlines sit 1.0 m east of the Esri imagery
(bunker fit; the greens agree) and are shifted onto it.

Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: winter imagery; the six
it would drop are dull or shaded sand, its finds are roofs, paths and a practice bunker, so OSM's are kept.

Scorecard from GolfPass (12693); its pars match OpenStreetMap's hole tags (par 71). Tee I (7039 yards) has no
hole-by-hole row, so the longest is I/II; the other combination tees are left out. Men's ratings, each for its
own length.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7990,32.9270,-96.7865,32.9395" -o map.json`
2. `python3 tools/northwood/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py northwood.osm.json northwood.config.json ../data/northwood.json`
   - `python3 trim_far.py ../data/northwood.json`
   - `python3 fetch_tiles.py 19 32.9283 -96.7974 32.9381 -96.7879 northwood/m19.png`
   - `python3 add_ob.py northwood.boundary.osm.json northwood.roads_houses.osm.json northwood.config.json ../data/northwood.json`
   - `python3 trees_from_imagery.py ../data/northwood.json northwood/m19.png ../data/northwood.json`
   - from the repo root: `python3 tools/soften_shapes.py data/northwood.json` and `python3 tools/elevation.py northwood`
