# Tierra Verde Golf Club (Arlington, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (no par tags; every hole's length matches the card). The
outlines sit 0.5 m east and 1.3 m south of the Esri imagery (measured by fitting all
bunkers to the sand; 78% then on sand) and are shifted onto it.

Scorecard from GolfPass (22620). Men's ratings for all five tees.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.1925,32.6175,-97.1725,32.6295" -o map.json`
2. From `tools/tierraverde/`: `python3 osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py tierraverde.osm.json tierraverde.config.json ../data/tierraverde.json`
   - `python3 fetch_tiles.py 19 32.6186 -97.1902 32.6286 -97.1744 tierraverde/m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: kept as OSM has them (the two it calls grass
     are in tree shade, grey sand); nothing to add.
   - `python3 add_ob.py tierraverde.boundary.osm.json tierraverde.roads_houses.osm.json tierraverde.config.json ../data/tierraverde.json`
   - `python3 trees_from_imagery.py ../data/tierraverde.json tierraverde/m19.png ../data/tierraverde.json`
   - from the repo root: `python3 tools/soften_shapes.py data/tierraverde.json` and `python3 tools/elevation.py tierraverde`

OpenStreetMap also maps three short practice holes (no number) west of the range, and the
practice greens: their greens, tee boxes, fairways and bunkers are dropped (`drop` in the config).
