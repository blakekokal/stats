# Rockwood Park Golf Course (Fort Worth, TX)

OpenStreetMap (way 28740221, unnamed) has all 18 hole lines with par, greens, fairways, tee boxes, bunkers and
ponds. #15's green and #16's tees lie just west of the mapped boundary, in Anderson-Campbell Park, so
`osm_to_geom.py` widens the boundary 35 m round those two holes. The outlines fit the Esri imagery as they are
(green fit). The winter imagery's sand check flags 11 bunkers, but all are tan sand by eye: OSM's bunkers are kept.
`trim_far.py` drops the practice greens; the 6-hole River's Edge course has no hole lines in OSM and is left out.

Scorecard from GolfPass (2913); its pars match OSM's (par 72). Men's ratings; White/Red's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.3880,32.7640,-97.3612,32.7825" -o map.json`
2. `python3 tools/rockwood/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py rockwood.osm.json rockwood.config.json ../data/rockwood.json`
   - `python3 trim_far.py ../data/rockwood.json`
   - `python3 fetch_tiles.py 19 32.7645 -97.3790 32.7820 -97.3618 rockwood/m19.png`
   - `python3 add_ob.py rockwood.boundary.osm.json rockwood.roads_houses.osm.json rockwood.config.json ../data/rockwood.json`
   - `python3 trees_from_imagery.py ../data/rockwood.json rockwood/m19.png ../data/rockwood.json`
   - from the repo root: `python3 tools/soften_shapes.py data/rockwood.json` and `python3 tools/elevation.py rockwood`
