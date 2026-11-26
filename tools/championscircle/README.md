# The Golf Club at Champions Circle (Fort Worth, TX)

Built with no yardage book, from OpenStreetMap (the course's boundary, way 778710383, has no name):
greens, fairways, tee boxes, bunkers, ponds and the 18 hole lines (with par). Only what lies inside the
boundary is kept. The imagery is winter and the sand dull, so the bunker fit fails; the shift, 0.3 m west
and 1.3 m north, is fitted to the greens (`fit_shift.py ... green`).

Scorecard from GolfPass (22704, formerly Doral Tesoro); its pars match OpenStreetMap's hole tags (par 71)
and its handicaps are used (OSM's have #1 and #3 both 13 and #10/#11 swapped). Its tee table rates a longer
layout (Black 7027, Blue 6496, White 5841, Red 5143 yards, par 72) that matches none of the card's tees, so
no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.3080,33.0135,-97.2805,33.0280" -o map.json`
2. `python3 tools/championscircle/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py championscircle.osm.json championscircle.config.json ../data/championscircle.json`
   - `python3 fetch_tiles.py 19 33.0143 -97.3068 33.0271 -97.2817 championscircle/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the bunkers it
     would drop are tan or shaded sand, its finds are carts and paths, so OSM's are kept.
   - `python3 add_ob.py championscircle.boundary.osm.json championscircle.roads_houses.osm.json championscircle.config.json ../data/championscircle.json`
   - `python3 trees_from_imagery.py ../data/championscircle.json championscircle/m19.png ../data/championscircle.json`
   - from the repo root: `python3 tools/soften_shapes.py data/championscircle.json` and `python3 tools/elevation.py championscircle`

Dropped (`drop` in the config): the range tee.
