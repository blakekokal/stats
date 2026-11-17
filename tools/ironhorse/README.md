# Iron Horse Golf Course (North Richland Hills, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par and handicap, which match the club's card). The
outlines sit 1.3 m south of the Esri imagery (measured by fitting all bunkers to the
sand; 80% then on sand) and are shifted onto it.

Scorecard from GolfPass (course 3205). Its ratings table names older tees, each about
65 yd shorter than the card's: Black and Green match by name, White (5,713) is the card's
Blue and Front (5,083) its Silver. Horse Track and Red have no rating and are left out.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.2620,32.8300,-97.2470,32.8505" -o map.json`
2. From `tools/`: `python3 ironhorse/osm_to_geom.py map.json`, then
   - `python3 build_course.py ironhorse.osm.json ironhorse.config.json ../data/ironhorse.json`
   - `python3 add_ob.py ironhorse.boundary.osm.json ironhorse.roads_houses.osm.json ironhorse.config.json ../data/ironhorse.json`
   - `python3 fetch_tiles.py 19 32.8300 -97.2620 32.8505 -97.2470 m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: kept as OSM has them (the one it calls
     grass is sand among winter-dormant turf; what it would add is roofs, patios and a tower base).
   - `python3 trees_from_imagery.py ../data/ironhorse.json m19.png ../data/ironhorse.json`
   - from the repo root: `python3 tools/elevation.py ironhorse`

Two practice greens are dropped (`drop` in the config).
