# Duck Creek Golf Club (Garland, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, some tee boxes (22; the other
holes start at the hole line's tee end), bunkers, ponds and the 18 hole lines (with par and
handicap). Only what lies inside the course boundary (way 495932707) is kept. The outlines sit on
the Esri imagery as they are (no shift: greens and bunkers sit on the picture).

Scorecard from GolfPass (2945, 2800 Diamond Oaks Dr, formerly Oakridge Country Club); its pars and
handicaps match OpenStreetMap's hole tags (par 71). Ratings matched by total yards (Back = Black,
Middle = White); Gold has none, and the Forward rating is for 5103 yards, not Red's 5019, so Red has none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6845,32.9310,-96.6645,32.9465" -o map.json`
2. `python3 tools/duckcreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py duckcreek.osm.json duckcreek.config.json ../data/duckcreek.json`
   - `python3 fetch_tiles.py 19 32.9320 -96.6832 32.9456 -96.6658 duckcreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the three it
     would drop are darker or shaded sand, its finds are roofs and pools, so OSM's seven are kept.
   - `python3 add_ob.py duckcreek.boundary.osm.json duckcreek.roads_houses.osm.json duckcreek.config.json ../data/duckcreek.json`
   - `python3 trees_from_imagery.py ../data/duckcreek.json duckcreek/m19.png ../data/duckcreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/duckcreek.json` and `python3 tools/elevation.py duckcreek`

Dropped: nothing.
