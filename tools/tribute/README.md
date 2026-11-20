# The Tribute Golf Club (The Colony, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 297400644) is kept;
Old American (way 297401053) is next door and built on its own. OSM tags hole 5's green as a tee box
(way 1093013410); `osm_to_geom.py` makes it a green.
The outlines sit 0.75 m east and 1.5 m south of the Esri imagery (fitting all bunkers to the sand) and are shifted onto it.

Scorecard from GolfPass (22175); its pars match OpenStreetMap's hole tags. Men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9470,33.0830,-96.9100,33.1090" -o map.json`
2. `python3 tools/tribute/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py tribute.osm.json tribute.config.json ../data/tribute.json`
   - `python3 fetch_tiles.py 19 33.0929 -96.9439 33.107 -96.9265 tribute/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: four OSM bunkers
     are on grass and 11 are drawn a few metres off their sand; all 15 are in `drop`, and the imagery's
     outlines of those 11 bunkers (the only real ones it found; the 12th was a water tank) are in
     `tribute/imagery_bunkers.json`, appended to the course file's features. Five small pot bunkers the
     check would drop are real and kept.
   - `python3 add_ob.py tribute.boundary.osm.json tribute.roads_houses.osm.json tribute.config.json ../data/tribute.json`
   - `python3 trees_from_imagery.py ../data/tribute.json tribute/m19.png ../data/tribute.json`
   - from the repo root: `python3 tools/soften_shapes.py data/tribute.json` and `python3 tools/elevation.py tribute`

Dropped (`drop` in the config): the putting green by the clubhouse, the practice area east of hole 1
(OSM draws it as a fairway with a green and three bunkers) and the bunkers above. A drop point can name its
type (`[lat, lng, "bunker"]`) so a bunker inside a fairway goes without the fairway.
