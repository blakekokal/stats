# The Club at Frisco Farms (formerly Plantation Golf Club; Frisco, TX)

Built with no yardage book, from OpenStreetMap (which still calls it Plantation Golf Club): greens,
fairways (mostly multipolygon relations), tee boxes, bunkers, ponds and the 18 hole lines (with par and
handicap). Only what lies inside the course boundary (relation 6531467) is kept. The outlines sit 2.5 m
east and 4.0 m south of the Esri imagery, measured by fitting the greens (`fit_shift.py ... green`; the
sand is tan, so the bunker fit fails) and checked by eye: the greens and pot bunkers then sit on the
picture.

Scorecard from GolfPass (2934); its pars match OpenStreetMap's hole tags (par 72); its handicaps differ
from OSM's and are used. Ratings matched to tees by total yards (its tee table calls the 6375-yard tee
Blue and the 5876 White); Red's is the women's (for 4904 yards).

#2's back tee box lies just outside OSM's course boundary, so it is inside the OB area (add_ob.py leaves
shapes wholly outside the boundary out of bounds); the owner can redraw the boundary there in the editor.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7880,33.1145,-96.7685,33.1300" -o map.json`
2. `python3 tools/friscofarms/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py friscofarms.osm.json friscofarms.config.json ../data/friscofarms.json`
   - `python3 fetch_tiles.py 19 33.1157 -96.7865 33.1287 -96.7697 friscofarms/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the ones it would
     drop are tan or shaded sand, its finds are roofs, so OSM's are kept.
   - `python3 add_ob.py friscofarms.boundary.osm.json friscofarms.roads_houses.osm.json friscofarms.config.json ../data/friscofarms.json`
   - `python3 trees_from_imagery.py ../data/friscofarms.json friscofarms/m19.png ../data/friscofarms.json`
   - from the repo root: `python3 tools/soften_shapes.py data/friscofarms.json` and `python3 tools/elevation.py friscofarms`
