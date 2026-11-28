# Waterview Golf Club (Rowlett, TX)

OpenStreetMap has greens, tee boxes, bunkers and ponds, but no hole lines and no fairways. Its greens carry their
hole number (`ref`), so `osm_to_geom.py` routes the 18 hole lines: each from the tee box near the previous green
whose distance to the hole's green best fits the card's Black yards (all within 3%). #6's green is tagged
golf=tee, ref=6 in OSM: it is made a green. Only what lies inside the course boundary (way 523314770) is kept;
the practice greens and range tees are dropped with `trim_far.py`. No shift (both fits under 1 m).

From the imagery: fairways with `fill_from_imagery.py --fairways missing` (approximate; #9's and #15's couldn't be
told from the rough), and bunkers: 21 OSM bunkers on grass dropped (`drop`), 12 white-sand bunkers added
(`fill_from_imagery.py --bunkers`, judged by eye, then `keep_found_bunkers.py`).

Scorecard from GolfPass (22920); men's ratings, each for its own length.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.5460,32.9405,-96.5220,32.9615" -o map.json`
2. `python3 tools/waterview/osm_to_geom.py map.json`; `waterview.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py waterview.osm.json waterview.config.json ../data/waterview.json`
   - `python3 trim_far.py ../data/waterview.json`
   - `python3 fetch_tiles.py 19 32.9416 -96.5450 32.9606 -96.5230 waterview/m19.png`
   - `python3 fill_from_imagery.py ../data/waterview.json waterview/m19.png ../data/waterview.json --fairways missing --paths waterview.paths.osm.json`
   - `python3 add_ob.py waterview.boundary.osm.json waterview.roads_houses.osm.json waterview.config.json ../data/waterview.json`
   - `python3 fill_from_imagery.py ../data/waterview.json waterview/m19.png found.json --bunkers --paths waterview.paths.osm.json`, then
     `python3 keep_found_bunkers.py ../data/waterview.json found.json ../data/waterview.json 32.943228,-96.532313 32.944699,-96.53595 32.945327,-96.539794 32.951329,-96.535865 32.951483,-96.538479 32.951928,-96.529208 32.953284,-96.527029 32.956173,-96.537404 32.956678,-96.538474 32.956847,-96.538311 32.956926,-96.532029 32.958559,-96.536735`
   - `python3 trees_from_imagery.py ../data/waterview.json waterview/m19.png ../data/waterview.json`
   - from the repo root: `python3 tools/soften_shapes.py data/waterview.json` and `python3 tools/elevation.py waterview`
