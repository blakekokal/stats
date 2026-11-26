# Dallas National Golf Club (Dallas, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers and the 18 hole lines
(with par and handicap). Only what lies inside the course boundary (way 28379443) is kept; the short-game
area and range east of the course (some 20 practice greens with bunkers) are dropped with `trim_far.py`.
The outlines sit 0.8 m east and 1.3 m south of the Esri imagery (bunker fit) and are shifted onto it.

Bunkers: the sand check judged by eye: seven OSM bunkers on grass are dropped (`drop`), the others it would
drop are in tree shade; two it found are added (`keep_found_bunkers.py`), one replacing a dropped OSM bunker
drawn far too big.

Scorecard from GolfPass (22677); its pars match OpenStreetMap's hole tags (par 72); its handicaps differ
from OSM's and are used. Combination tees left out. Its tee table rates other lengths except I (6862,
close to the card's 6829), so only I has a rating.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9160,32.7280,-96.8985,32.7425" -o map.json`
2. `python3 tools/dallasnational/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py dallasnational.osm.json dallasnational.config.json ../data/dallasnational.json`
   - `python3 trim_far.py ../data/dallasnational.json`
   - `python3 fetch_tiles.py 19 32.7290 -96.9148 32.7414 -96.8999 dallasnational/m19.png`
   - `hazards_from_imagery.py` + `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/dallasnational.json checked.json ../data/dallasnational.json 32.731625,-96.905823 32.74007,-96.902377`
   - `python3 add_ob.py dallasnational.boundary.osm.json dallasnational.roads_houses.osm.json dallasnational.config.json ../data/dallasnational.json`
   - `python3 trees_from_imagery.py ../data/dallasnational.json dallasnational/m19.png ../data/dallasnational.json`
   - from the repo root: `python3 tools/soften_shapes.py data/dallasnational.json` and `python3 tools/elevation.py dallasnational`
