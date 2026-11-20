# Old American Golf Club (The Colony, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 297401053) is kept;
The Tribute (way 297400644) is next door and built on its own.
The outlines sit 7 m west and 0.25 m south of the Esri imagery (the greens and bunkers agree) and are shifted onto it.

Scorecard from GolfPass (25964), whose holes are one off the course's: its #1 (482-yd par 4) is the
course's #2 and its #18 is #1, as OpenStreetMap's hole tags and Wikipedia's card (1: 441 yd par 4,
2: 482, 3: 556 par 5, 4: 175 par 3, 12: 229 par 3, 14: 571 par 5) have it, so GolfPass's yards and
handicaps are moved down one hole. Men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9470,33.0830,-96.9100,33.1090" -o map.json`
2. `python3 tools/oldamerican/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py oldamerican.osm.json oldamerican.config.json ../data/oldamerican.json`
   - `python3 fetch_tiles.py 19 33.0889 -96.937 33.1085 -96.9123 oldamerican/m19.png`
   - Bunkers checked by eye: most are tan, rugged waste bunkers that `bunkers_from_imagery.py` can't see
     as sand, so its verdicts were not taken as they stand. 26 OSM bunkers are on grass or are tree
     shadows (in `drop`); four white bunkers drawn off their sand are in `drop` too and replaced by the
     imagery's outlines, with six bunkers OSM lacks, in `oldamerican/imagery_bunkers.json` (appended to the
     course file's features). Its other three finds were a pool, a bridge and roofs.
   - `python3 add_ob.py oldamerican.boundary.osm.json oldamerican.roads_houses.osm.json oldamerican.config.json ../data/oldamerican.json`
   - `python3 trees_from_imagery.py ../data/oldamerican.json oldamerican/m19.png ../data/oldamerican.json`
   - from the repo root: `python3 tools/soften_shapes.py data/oldamerican.json` and `python3 tools/elevation.py oldamerican`

Dropped (`drop` in the config): the practice green south-west of hole 16 and the bunkers above.
