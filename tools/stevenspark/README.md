# Stevens Park Golf Course (Dallas, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers and
the 18 hole lines. The outlines sit 0.5 m east of the Esri imagery (measured by fitting all
bunkers to the sand; 97% then on sand) and are shifted onto it.

Scorecard from GolfPass (2870). OpenStreetMap tags #1 as a par 5; the card has it a 449-yd
par 4 (handicap 8), which is kept. Every other par matches. Men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8620,32.7515,-96.8405,32.7650" -o map.json`
2. From `tools/stevenspark/`: `python3 osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py stevenspark.osm.json stevenspark.config.json ../data/stevenspark.json`
   - `python3 fetch_tiles.py 19 32.7527 -96.8596 32.7638 -96.8442 stevenspark/m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: kept as OSM has them (the one it calls grass
     is in tree shade; what it would add is two roofs, a footbridge and a creek bank).
   - `python3 add_ob.py stevenspark.boundary.osm.json stevenspark.roads_houses.osm.json stevenspark.config.json ../data/stevenspark.json`
   - `python3 trees_from_imagery.py ../data/stevenspark.json stevenspark/m19.png ../data/stevenspark.json`
   - from the repo root: `python3 tools/soften_shapes.py data/stevenspark.json` and `python3 tools/elevation.py stevenspark`

Five practice greens and a practice bunker are dropped (`drop` in the config).
