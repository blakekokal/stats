# Stewart Peninsula Golf Course (The Colony, TX; 9 holes)

OpenStreetMap ("Stewart Peninsula Golf Course", way 297553370; Old American is next door) has the 9 hole lines
(no par tags), greens, fairways, tee boxes, bunkers and ponds. The greens are drawn generously and hardly stand out
in the Esri imagery, so no shift is fitted (the bunkers are small brown pots the sand fit can't see); they're kept
as mapped, as are the bunkers, which sit on visible pots. Worth tidying the greens in the editor.

Scorecard from GolfPass (22176), par 33. 9-hole ratings: Back's listed rating (65.9) is an 18-hole figure, so
none is given; Front's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9260,33.0820,-96.9115,33.0945" -o map.json`
2. `python3 tools/stewartpeninsula/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py stewartpeninsula.osm.json stewartpeninsula.config.json ../data/stewartpeninsula.json`
   - `python3 trim_far.py ../data/stewartpeninsula.json`
   - `python3 fetch_tiles.py 19 33.0825 -96.9255 33.0940 -96.9120 stewartpeninsula/m19.png`
   - `python3 add_ob.py stewartpeninsula.boundary.osm.json stewartpeninsula.roads_houses.osm.json stewartpeninsula.config.json ../data/stewartpeninsula.json`
   - `python3 trees_from_imagery.py ../data/stewartpeninsula.json stewartpeninsula/m19.png ../data/stewartpeninsula.json`
   - from the repo root: `python3 tools/soften_shapes.py data/stewartpeninsula.json` and `python3 tools/elevation.py stewartpeninsula`
