# Pecan Hollow Golf Course (Plano, TX)

From OpenStreetMap: greens, bunkers, ponds and the 18 hole lines (with par). Only what lies inside the course
boundary (way 280162269) is kept; the short-game area is dropped with `trim_far.py`. The outlines sit 1.3 m
east and 0.8 m south of the Esri imagery (bunker fit; the greens agree) and are shifted onto it.

OSM has no fairways and only one tee box, and no green for #10; they come from the imagery:
- #10's green: `green_from_seed.py`, which moves #10's pin onto it.
- Fairways: `fill_from_imagery.py --fairways missing`: each hole's fairway colour is learnt from a strip along
  its line and the rough's from a band further out, and the mown band within 25 m of the line is kept, cut at
  OSM's cart paths. They are approximate (where the hole line runs off-centre they run wide); #17's fairway
  couldn't be told from its rough, so it has none. Worth tidying in the hole editor.
- Tee boxes: `fill_from_imagery.py --tees`: a 12 x 8 m box at the start of each hole line.

Bunkers: one OSM bunker on grass dropped (`drop`); the sand check's finds are roofs and a maintenance yard.

Scorecard from GolfPass (3238, formerly Plano Municipal); its pars match OpenStreetMap's hole tags (par 71). Its
tee table rates other lengths than the card's tees, except Players (6012 yards) = Silver 2 (6035), so only Silver
2 has a rating.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6455,33.0080,-96.6295,33.0205" -o map.json`
2. `python3 tools/pecanhollow/osm_to_geom.py map.json`; `pecanhollow.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py pecanhollow.osm.json pecanhollow.config.json ../data/pecanhollow.json`
   - `python3 fetch_tiles.py 19 33.0090 -96.6441 33.0195 -96.6307 pecanhollow/m19.png`
   - `python3 green_from_seed.py ../data/pecanhollow.json pecanhollow/m19.png ../data/pecanhollow.json 33.01435,-96.64065 --tol 7`
   - `python3 trim_far.py ../data/pecanhollow.json`
   - `python3 fill_from_imagery.py ../data/pecanhollow.json pecanhollow/m19.png ../data/pecanhollow.json --fairways missing --tees --paths pecanhollow.paths.osm.json`
   - `python3 add_ob.py pecanhollow.boundary.osm.json pecanhollow.roads_houses.osm.json pecanhollow.config.json ../data/pecanhollow.json`
   - `python3 trees_from_imagery.py ../data/pecanhollow.json pecanhollow/m19.png ../data/pecanhollow.json`
   - from the repo root: `python3 tools/soften_shapes.py data/pecanhollow.json` and `python3 tools/elevation.py pecanhollow`
