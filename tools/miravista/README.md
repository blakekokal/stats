# Mira Vista Country Club (Fort Worth, TX; private)

OpenStreetMap (relation 4715528) has all 18 hole lines, greens, fairways, tee boxes, bunkers and ponds, but its
hole lines carry no par tags (pars from the card) and its bunkers predate a renovation: many sat on grass or under
greens. The greens, fairways, tee boxes and hole lines fit the Esri imagery as they are (no shift); every OSM bunker
is replaced by the 60 white-sand bunkers `fill_from_imagery.py --bunkers` finds near the hole lines, kept by eye
(roofs, cart paths and a sandy creek bank dropped), and `swap_bunkers.py` cuts the sand out of the 4 greens it overlapped.
`trim_far.py` drops the practice greens; the range is left out of the holes.

Scorecard from GolfPass (2918), par 71. Only I/II (Gold, 6556 yards) has a rating at its lengths; the other tees
have none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4455,32.6475,-97.4295,32.6685" -o map.json`
2. `python3 tools/miravista/osm_to_geom.py map.json`; `miravista.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py miravista.osm.json miravista.config.json ../data/miravista.json`
   - `python3 trim_far.py ../data/miravista.json`
   - `python3 add_ob.py miravista.boundary.osm.json miravista.roads_houses.osm.json miravista.config.json ../data/miravista.json`
   - `python3 fetch_tiles.py 19 32.6486 -97.4442 32.6675 -97.4309 miravista/m19.png`
   - bunkers: a copy of the course with no bunkers, then
     `python3 fill_from_imagery.py nob.json miravista/m19.png found.json --bunkers --paths miravista.paths.osm.json`,
     `python3 keep_found_bunkers.py nob.json found.json sel.json <the real ones' points>` and
     `python3 swap_bunkers.py ../data/miravista.json sel.json ../data/miravista.json`
   - `python3 trees_from_imagery.py ../data/miravista.json miravista/m19.png ../data/miravista.json`
   - from the repo root: `python3 tools/soften_shapes.py data/miravista.json` and `python3 tools/elevation.py miravista`
