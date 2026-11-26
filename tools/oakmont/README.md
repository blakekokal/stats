# Oakmont Country Club (Corinth, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways (mostly multipolygon relations), tee boxes,
bunkers, ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 319591744) is
kept; the practice greens are dropped with `trim_far.py`.

As at Prestonwood, OSM's greens sit about 3 m west of its bunkers: everything moves 0.5 m west and 2.2 m north
(bunker fit), and the greens (and pins) a further 3.0 m east and 0.3 m north (`greenShift`; `fit_shift.py ...
green`, checked by eye). OSM's bunkers are all on sand; the sand check's finds are roofs and paths.

Scorecard from GolfPass (2835); its pars match OpenStreetMap's hole tags (par 72). The Blue/White combination
is left out. Ratings by total yards: Gold = its Black (6799), Blue, White men's; Red's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0970,33.1420,-97.0795,33.1650" -o map.json`
2. `python3 tools/oakmont/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py oakmont.osm.json oakmont.config.json ../data/oakmont.json`
   - `python3 trim_far.py ../data/oakmont.json`
   - `python3 fetch_tiles.py 19 33.1430 -97.0957 33.1638 -97.0805 oakmont/m19.png`
   - `python3 add_ob.py oakmont.boundary.osm.json oakmont.roads_houses.osm.json oakmont.config.json ../data/oakmont.json`
   - `python3 trees_from_imagery.py ../data/oakmont.json oakmont/m19.png ../data/oakmont.json`
   - from the repo root: `python3 tools/soften_shapes.py data/oakmont.json` and `python3 tools/elevation.py oakmont`
