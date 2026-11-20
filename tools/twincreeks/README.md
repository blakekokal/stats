# The Golf Club at Twin Creeks (Allen, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 374107296) is kept.
The outlines sit 1 m west and 1.5 m south of the Esri imagery (fitting all bunkers to the sand; the
imagery is winter, but the fairways are green, so the fit holds) and are shifted onto it.

Scorecard from GolfPass (2724), whose nines are the other way round from the club's current
card: Greenskeeper's card starts with the 336-yard par 4, as OpenStreetMap's hole tags do,
so GolfPass's yards, pars and handicaps are swapped nine for nine. Red is rated for women only.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7298,33.0985,-96.7063,33.1182" -o map.json`
2. `python3 tools/twincreeks/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py twincreeks.osm.json twincreeks.config.json ../data/twincreeks.json`
   - `python3 fetch_tiles.py 19 33.1002 -96.7278 33.1165 -96.7083 twincreeks/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the 11 OSM
     bunkers it drops have no sand under them (they are in `drop`); of the 16 it would add, one is a
     real bunker (33.111368, -96.726439, kept), the rest are houses, roads and rough.
   - `python3 add_ob.py twincreeks.boundary.osm.json twincreeks.roads_houses.osm.json twincreeks.config.json ../data/twincreeks.json`
   - `python3 trees_from_imagery.py ../data/twincreeks.json twincreeks/m19.png ../data/twincreeks.json`
   - from the repo root: `python3 tools/soften_shapes.py data/twincreeks.json` and `python3 tools/elevation.py twincreeks`

Dropped (`drop` in the config): two practice greens by the clubhouse and the 11 bunkers on grass.
