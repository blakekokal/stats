# Lake Arlington Golf Course (Arlington, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways (multipolygon relations), tee boxes, ponds and
the 18 hole lines (with par). Only what lies inside the course boundary (way 412547642) is kept; the practice
greens are dropped with `trim_far.py`. OSM has no bunkers, and neither does the imagery (no sand by any green;
the sand check's four finds are bare ground), so the course has none. The outlines sit 1.0 m west and 1.0 m
south of the Esri imagery (fitted to the greens) and are shifted onto it.

Scorecard from GolfPass (14572); its pars match OpenStreetMap's hole tags (par 71). Men's ratings for Blue and
White; the Red (W) rating is for 5485 yards (the card's Red is 5350), so Red, Yellow and Orange have none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.2000,32.7115,-97.1805,32.7260" -o map.json`
2. `python3 tools/lakearlington/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py lakearlington.osm.json lakearlington.config.json ../data/lakearlington.json`
   - `python3 trim_far.py ../data/lakearlington.json`
   - `python3 fetch_tiles.py 19 32.7126 -97.1987 32.7248 -97.1818 lakearlington/m19.png`
   - `python3 add_ob.py lakearlington.boundary.osm.json lakearlington.roads_houses.osm.json lakearlington.config.json ../data/lakearlington.json`
   - `python3 trees_from_imagery.py ../data/lakearlington.json lakearlington/m19.png ../data/lakearlington.json`
   - from the repo root: `python3 tools/soften_shapes.py data/lakearlington.json` and `python3 tools/elevation.py lakearlington`
