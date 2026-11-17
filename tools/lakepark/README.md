# Lake Park Golf Course – Championship (Lewisville, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes,
bunkers, ponds and the 18 hole lines (with par and handicap, which match the
club's card). The Executive course next door is left out. The outlines sit on the
Esri imagery as they are (no shift needed). The detector in
`hazards_from_imagery.py` found no real bunkers OSM is missing (only dirt patches,
a car park and a roof), so OSM's five bunkers are kept.

Scorecard (tees, ratings, slopes) from GolfPass; Red has only a women's rating.

1. The OpenStreetMap export (the plain API; Overpass was down):
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0135,33.0635,-96.9935,33.0765" -o map.json`
2. From `tools/lakepark/`: `python3 osm_to_geom.py map.json` writes
   `../lakepark.osm.json`, `../lakepark.boundary.osm.json` and `../lakepark.roads_houses.osm.json`.
3. From `tools/`:
   - `python3 build_course.py lakepark.osm.json lakepark.config.json ../data/lakepark.json`
   - `python3 add_ob.py lakepark.boundary.osm.json lakepark.roads_houses.osm.json lakepark.config.json ../data/lakepark.json`
   - `python3 fetch_tiles.py 19 33.0648 -97.0100 33.0753 -96.9945 m19.png`, then
     `python3 trees_from_imagery.py ../data/lakepark.json m19.png ../data/lakepark.json`
   - from the repo root: `python3 tools/elevation.py lakepark`

The practice putting green by the clubhouse is dropped (`drop` in the config).
