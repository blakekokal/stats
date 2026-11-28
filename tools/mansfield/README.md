# Mansfield National Golf Club (Mansfield, TX)

OpenStreetMap has only the 18 hole lines (no par tags), one pond and the course boundary (way 299872303);
everything else comes from the zoom-19 Esri imagery (winter, so greens and white sand stand out):
- Greens: `green_from_seed.py` from each hole line's end (all 18 trace cleanly).
- Fairways and tee boxes: `fill_from_imagery.py --fairways missing --tees` (fairways approximate; worth tidying).
- Bunkers: `fill_from_imagery.py --bunkers` (white sand inside the course boundary, after `add_ob.py`, so roofs are
  left out): 32, all checked by eye; a few small ones in clusters are missed.
No shift is applied (the hole lines end on the greens).

`build_course.py` now copes with a course file with no greens (pins at the line ends, until the greens are grown).

Scorecard from GolfPass (16373); the hole lines' lengths match its Black tees (par 72). The Silver/Red combination
is left out. Ratings by total yards: Black = its Blue (6850), Gold = its White (6232), men's; Red = Red (W) (5263,
the women's); Silver has none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0845,32.5495,-97.0680,32.5725" -o map.json`
2. `python3 tools/mansfield/osm_to_geom.py map.json`; `mansfield.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py mansfield.osm.json mansfield.config.json ../data/mansfield.json`
   - `python3 fetch_tiles.py 19 32.5506 -97.0832 32.5715 -97.0694 mansfield/m19.png`
   - `python3 green_from_seed.py ../data/mansfield.json mansfield/m19.png ../data/mansfield.json <each hole line's end> --tol 9`
   - `python3 fill_from_imagery.py ../data/mansfield.json mansfield/m19.png ../data/mansfield.json --fairways missing --tees --paths mansfield.paths.osm.json`
   - `python3 add_ob.py mansfield.boundary.osm.json mansfield.roads_houses.osm.json mansfield.config.json ../data/mansfield.json`
   - `python3 fill_from_imagery.py ../data/mansfield.json mansfield/m19.png ../data/mansfield.json --bunkers --paths mansfield.paths.osm.json`
   - `python3 trees_from_imagery.py ../data/mansfield.json mansfield/m19.png ../data/mansfield.json`
   - from the repo root: `python3 tools/soften_shapes.py data/mansfield.json` and `python3 tools/elevation.py mansfield`
