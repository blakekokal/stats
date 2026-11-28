# The Timber Links at Denton (Denton, TX; 9 holes)

OpenStreetMap ("Timberlinks Golf Course", way 130805180) has greens, fairways, tee boxes, bunkers and ponds but no
hole lines. Its greens carry their hole number (`ref`; #1's is a multipolygon), so `osm_to_geom.py` routes the nine
hole lines: each from the tee box near the previous green whose distance to the hole's green best fits the card's
Blue yards. They are straight, so the doglegs (#1, #3 and #9) read 40-90 yards short of the card; bend them in the
editor. #5 and #6 are par 3s played in opposite directions from one tee complex between their greens. The outlines
sit 1.0 m east and 1.5 m south of the Esri imagery (bunker fit) and are shifted onto it.

Two OSM bunkers on grass are dropped (`drop`). `fill_from_imagery.py --fairways missing --tees` adds a small piece
of #4's fairway (#1's couldn't be told from the rough). Only practice greens are trimmed (`trim_far.py 15 9999`): a
tighter trim would take #3's dogleg fairway.

Scorecard from GolfPass (22688), par 35, with 9-hole ratings; Red's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0825,33.1770,-97.0725,33.1850" -o map.json`
2. `python3 tools/timberlinks/osm_to_geom.py map.json`; `timberlinks.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py timberlinks.osm.json timberlinks.config.json ../data/timberlinks.json`
   - `python3 trim_far.py ../data/timberlinks.json 15 9999`
   - `python3 fetch_tiles.py 19 33.1778 -97.0814 33.1840 -97.0738 timberlinks/m19.png`
   - `python3 fill_from_imagery.py ../data/timberlinks.json timberlinks/m19.png ../data/timberlinks.json --fairways missing --tees --paths timberlinks.paths.osm.json`
   - `python3 add_ob.py timberlinks.boundary.osm.json timberlinks.roads_houses.osm.json timberlinks.config.json ../data/timberlinks.json`
   - `python3 trees_from_imagery.py ../data/timberlinks.json timberlinks/m19.png ../data/timberlinks.json`
   - from the repo root: `python3 tools/soften_shapes.py data/timberlinks.json` and `python3 tools/elevation.py timberlinks`
