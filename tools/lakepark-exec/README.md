# Lake Park Golf Club – Executive (Lewisville, TX), 9 holes

Built with no yardage book, from OpenStreetMap: greens, tee boxes, fairways (the
short grass round each green), the pond and the nine hole lines are all mapped and
sit on the Esri imagery with no shift. The Championship course shares the grounds,
so `osm_to_geom.py` keeps only what lies inside the Executive's boundary
(way 336437861) and the hole lines with no handicap tag (the Championship's have one).
Hole lengths along the OSM lines match the Blue tees within a few yards
(#4 is 323 yd to the green's middle against 350 on the card; #9 130 against 144).

Scorecard from GolfPass and Offcourse (same yardages): par 3,3,3,4,3,3,3,3,3 = 28,
handicaps from GolfPass. No rating or slope is published for the Executive tees.
No bunkers on this course (none in the imagery either).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0140,33.0650,-97.0050,33.0725" -o map.json`
2. From `tools/lakepark-exec/`: `python3 osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py lakepark-exec.osm.json lakepark-exec.config.json ../data/lakepark-exec.json`
   - `python3 add_ob.py lakepark-exec.boundary.osm.json lakepark-exec.roads_houses.osm.json lakepark-exec.config.json ../data/lakepark-exec.json`
   - `python3 fetch_tiles.py 19 33.0655 -97.0135 33.0722 -97.0058 m19.png`, then
     `python3 trees_from_imagery.py ../data/lakepark-exec.json m19.png ../data/lakepark-exec.json`
   - from the repo root: `python3 tools/elevation.py lakepark-exec`

The practice putting green by the clubhouse is left out.
