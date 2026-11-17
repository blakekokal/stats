# Texas Star Golf Course (Euless, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par, which matches the club's card). The outlines sit
1.3 m south of the Esri imagery (measured by fitting all bunkers to the sand; 80% then
on sand) and are shifted onto it.

Scorecard from GolfPass (the Euless course, 2903; the back tee is Gold on the card and
Texas in the ratings table). Green and Silver have no published rating, so they are left
out; Red is rated for women.

1. The OpenStreetMap export (the plain API):
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.1195,32.8065,-97.1030,32.8235" -o map.json`
2. From `tools/texasstar/`: `python3 osm_to_geom.py map.json` writes `../texasstar.osm.json`,
   `../texasstar.boundary.osm.json` and `../texasstar.roads_houses.osm.json`.
3. From `tools/`:
   - `python3 build_course.py texasstar.osm.json texasstar.config.json ../data/texasstar.json`
   - `python3 add_ob.py texasstar.boundary.osm.json texasstar.roads_houses.osm.json texasstar.config.json ../data/texasstar.json`
   - `python3 fetch_tiles.py 19 32.8065 -97.1195 32.8235 -97.1030 m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: one OSM bunker on bare fairway was
     dropped (the four others it flags are in tree shade, grey sand); nothing added (roofs, patios, a path).
   - `python3 trees_from_imagery.py ../data/texasstar.json m19.png ../data/texasstar.json`
   - from the repo root: `python3 tools/elevation.py texasstar`

The two practice greens by the clubhouse are dropped (`drop` in the config).
