# Buffalo Creek Golf Club (Heath, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (relation 9921546) is kept.
The outlines sit 0.75 m west and 1.5 m south of the Esri imagery (fitting all bunkers to the
sand; the greens agree) and are shifted onto it.

Scorecard from GolfPass (3274); its pars match OpenStreetMap's hole tags. Men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.4745,32.8570,-96.4451,32.8790" -o map.json`
2. `python3 tools/buffalocreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py buffalocreek.osm.json buffalocreek.config.json ../data/buffalocreek.json`
   - `python3 fetch_tiles.py 19 32.8586 -96.4725 32.8773 -96.4471 buffalocreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the one OSM
     bunker it drops is on grass (in `drop`); the 11 it would add are all houses and patios, so
     nothing is added.
   - `python3 add_ob.py buffalocreek.boundary.osm.json buffalocreek.roads_houses.osm.json buffalocreek.config.json ../data/buffalocreek.json`
   - `python3 trees_from_imagery.py ../data/buffalocreek.json buffalocreek/m19.png ../data/buffalocreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/buffalocreek.json` and `python3 tools/elevation.py buffalocreek`

Dropped (`drop` in the config): the driving range (OSM draws it as a fairway, relation 14044210, with its tee, nine target greens, a bunker and a target tee cut out of it; all dropped), the putting green and the bunker on grass.
