# Mesquite Golf Club (Mesquite Municipal; Mesquite, TX)

From OpenStreetMap: greens, a few fairways, ponds and the 18 hole lines (with par and handicap). Only what lies
inside the course boundary (way 30742252) is kept; the practice greens are dropped with `trim_far.py`. OSM has no
bunkers, so the outlines are fitted to the greens: 1.0 m east and 2.8 m south of the Esri imagery, shifted onto it.

Filled in from the imagery:
- Fairways for the nine holes OSM lacks them on, and a tee box where a hole line starts with none
  (`fill_from_imagery.py --fairways missing --tees`); approximate, worth tidying in the editor.
- Bunkers: the three greenside bunkers the sand check finds (`keep_found_bunkers.py`); its other finds are bare
  ground and roofs. The course may have a few more that the picture doesn't show clearly.

Scorecard from GolfPass (3162); its pars and handicaps match OpenStreetMap's hole tags (par 71). Men's ratings,
each for its own length.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6230,32.8335,-96.6025,32.8455" -o map.json`
2. `python3 tools/mesquite/osm_to_geom.py map.json`; `mesquite.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py mesquite.osm.json mesquite.config.json ../data/mesquite.json`
   - `python3 fetch_tiles.py 19 32.8342 -96.6219 32.8445 -96.6035 mesquite/m19.png`
   - `python3 trim_far.py ../data/mesquite.json`
   - `python3 fill_from_imagery.py ../data/mesquite.json mesquite/m19.png ../data/mesquite.json --fairways missing --tees --paths mesquite.paths.osm.json`
   - `hazards_from_imagery.py` + `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/mesquite.json checked.json ../data/mesquite.json 32.835665,-96.609651 32.837781,-96.61204 32.839905,-96.611782`
   - `python3 add_ob.py mesquite.boundary.osm.json mesquite.roads_houses.osm.json mesquite.config.json ../data/mesquite.json`
   - `python3 trees_from_imagery.py ../data/mesquite.json mesquite/m19.png ../data/mesquite.json`
   - from the repo root: `python3 tools/soften_shapes.py data/mesquite.json` and `python3 tools/elevation.py mesquite`
