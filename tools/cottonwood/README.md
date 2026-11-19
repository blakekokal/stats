# Cottonwood Valley Golf Course (Irving, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par, which matches the club's card). TPC Four Seasons
Las Colinas is next door, so `osm_to_geom.py` keeps only what lies inside Cottonwood
Valley's own course boundary (relation 5351639). The outlines sit 0.75 m east and 0.75 m
south of the Esri imagery (fitting the bunkers to the sand; the greens agree) and are
shifted onto it.

Scorecard from GolfPass (12713, listed as The Ritz-Carlton Dallas, Las Colinas -
Cottonwood Valley). Ratings matched to tees by total yards; Silver and Orange have none
published; Diamond and Red are rated for women only.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9785,32.8557,-96.9572,32.8727" -o map.json`
2. `python3 tools/cottonwood/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py cottonwood.osm.json cottonwood.config.json ../data/cottonwood.json`
   - `python3 fetch_tiles.py 19 32.8586 -96.9838 32.8739 -96.9594 cottonwood/m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: four OSM bunkers drawn on
     trees are dropped; the five it would add are a house, a backyard, a bridge and the practice
     bunker, so nothing is added.
   - `python3 add_ob.py cottonwood.boundary.osm.json cottonwood.roads_houses.osm.json cottonwood.config.json ../data/cottonwood.json`
   - `python3 trees_from_imagery.py ../data/cottonwood.json cottonwood/m19.png ../data/cottonwood.json`
   - from the repo root: `python3 tools/soften_shapes.py data/cottonwood.json` and `python3 tools/elevation.py cottonwood`

Dropped (`drop` in the config): two practice greens, the practice fairway round one and
its bunker, and the four tree bunkers.
