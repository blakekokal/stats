# Canyon Creek Country Club (Richardson, TX; private)

OpenStreetMap ("Canyon Creek Country Club", relation 14630515) has all 18 hole lines, greens, fairways, tee boxes,
bunkers and ponds, mapped in 2022, before the course's 2023 renovation (reopened Nov 2023 at par 72, 7,037 yards,
with new tees). The greens and fairways still fit the Esri imagery (no shift), but most bunkers moved: OSM's 28 on
grass are dropped and the imagery's 25 new ones added (`hazards_from_imagery.py` + `bunkers_from_imagery.py`, roofs
and yards removed by eye, then `swap_bunkers.py`, which also cut the sand out of 2 greens).

Scorecard from GolfPass (3257), the post-renovation card: OSM's hole tags have #8 and #18 as par 4s (the old par
70). The hole lines start at OSM's tees, so #5, #8, #10, #16 and #18 read 55-100 yards short of the card's I tees:
the new back tees can be set in the editor. The club lists I at 75.0/133; GolfPass's tee table is for the old
par-70 course, so the other tees have no rating.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7420,32.9815,-96.7270,32.9980" -o map.json`
2. `python3 tools/canyoncreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py canyoncreek.osm.json canyoncreek.config.json ../data/canyoncreek.json`
   - `python3 trim_far.py ../data/canyoncreek.json`
   - `python3 fetch_tiles.py 19 32.9820 -96.7415 32.9975 -96.7275 canyoncreek/m19.png`
   - `python3 hazards_from_imagery.py ../data/canyoncreek.json canyoncreek/m19.png haz.json` and
     `python3 bunkers_from_imagery.py ../data/canyoncreek.json haz.json canyoncreek/m19.png chk.json`; drop
     chk.json's added "bunkers" on roofs and yards, then `python3 swap_bunkers.py ../data/canyoncreek.json chk.json ../data/canyoncreek.json`
   - `python3 add_ob.py canyoncreek.boundary.osm.json canyoncreek.roads_houses.osm.json canyoncreek.config.json ../data/canyoncreek.json`
   - `python3 trees_from_imagery.py ../data/canyoncreek.json canyoncreek/m19.png ../data/canyoncreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/canyoncreek.json` and `python3 tools/elevation.py canyoncreek`
