# Woodbridge Golf Club (Sachse, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 499185290) is kept.
The outlines sit 1 m west and 0.5 m south of the Esri imagery (fitting all bunkers to the sand) and
are shifted onto it.

Scorecard from GolfPass (1553); its pars match OpenStreetMap's hole tags. GolfPass's Combo
rating (6127 yds) is Blue/White's; Black/Blue and White/Red have none published; Red's
rating is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.5679,32.9745,-96.5494,32.9965" -o map.json`
2. `python3 tools/woodbridge/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py woodbridge.osm.json woodbridge.config.json ../data/woodbridge.json`
   - `python3 fetch_tiles.py 19 32.9761 -96.5659 32.9948 -96.5514 woodbridge/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the 18 OSM
     bunkers it drops have no sand under them (most are grass hollows; one is an oversized outline
     round a real bunker), so they are in `drop`; of the 11 it would add, two are real bunkers
     (32.980545, -96.555124 and 32.985805, -96.560819, kept), the rest houses, pools and paths.
   - `python3 add_ob.py woodbridge.boundary.osm.json woodbridge.roads_houses.osm.json woodbridge.config.json ../data/woodbridge.json`
   - `python3 trees_from_imagery.py ../data/woodbridge.json woodbridge/m19.png ../data/woodbridge.json`
   - from the repo root: `python3 tools/soften_shapes.py data/woodbridge.json` and `python3 tools/elevation.py woodbridge`

Dropped (`drop` in the config): two practice greens by the clubhouse, their four bunkers, the range tee and the 18 bunkers on grass.
