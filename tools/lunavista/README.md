# Luna Vista Golf Course (Dallas, TX)

From OpenStreetMap: greens, tee boxes, bunkers, ponds and the 18 hole lines (with par and handicap). Only what
lies inside the course boundary (way 28383531) is kept; the practice greens are dropped with `trim_far.py`. The
outlines sit 0.5 m west and 1.0 m south of the Esri imagery (fitted to the greens; the sand is too dull for the
bunker fit) and are shifted onto it.

OSM has no fairways: `fill_from_imagery.py --fairways missing` traces them from the imagery (each hole's own
fairway vs rough colour, within 25 m of the line, cut at cart paths); approximate, worth tidying in the editor.
`--tees` adds a tee box where a hole line starts with none. OSM's bunkers are all on (dull) sand.

Scorecard from GolfPass (2867, formerly L. B. Houston); its pars match OpenStreetMap's hole tags (par 72); its
handicaps are used (OSM's have #2 and #11 both 4). Men's ratings, each for its own length.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9290,32.8800,-96.9170,32.8970" -o map.json`
2. `python3 tools/lunavista/osm_to_geom.py map.json`; `lunavista.paths.osm.json` is the export's cart paths and paths
3. From `tools/`:
   - `python3 build_course.py lunavista.osm.json lunavista.config.json ../data/lunavista.json`
   - `python3 fetch_tiles.py 19 32.8808 -96.9278 32.8960 -96.9182 lunavista/m19.png`
   - `python3 trim_far.py ../data/lunavista.json`
   - `python3 fill_from_imagery.py ../data/lunavista.json lunavista/m19.png ../data/lunavista.json --fairways missing --tees --paths lunavista.paths.osm.json`
   - `python3 add_ob.py lunavista.boundary.osm.json lunavista.roads_houses.osm.json lunavista.config.json ../data/lunavista.json`
   - `python3 trees_from_imagery.py ../data/lunavista.json lunavista/m19.png ../data/lunavista.json`
   - from the repo root: `python3 tools/soften_shapes.py data/lunavista.json` and `python3 tools/elevation.py lunavista`
