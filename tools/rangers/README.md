# Texas Rangers Golf Club (Arlington, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 25930393) is kept.
The outlines sit 0.3 m east and 1.3 m south of the Esri imagery (measured by fitting the bunkers to the sand)
and are shifted onto it.

Scorecard from GolfPass (2737). Its grid has the nines the other way round (the Korn Ferry Tour's
order, whose #1 is the club's #10): the club's #1 is the 589-yard par 5 (18Birdies, GolfPass's own
photo caption), as OpenStreetMap numbers the holes, so the card's nines are swapped (handicaps with
them). Tees matched by total yards (Home Plate = Black, Third Base = Gold, Second Base = Silver,
First Base = Bronze); men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.1085,32.7740,-97.0940,32.7860" -o map.json`
2. `python3 tools/rangers/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py rangers.osm.json rangers.config.json ../data/rangers.json`
   - `python3 fetch_tiles.py 19 32.7749 -97.1069 32.7852 -97.0955 rangers/m19.png`
   - `python3 hazards_from_imagery.py ../data/rangers.json rangers/m19.png imagery.json`,
     `python3 bunkers_from_imagery.py ../data/rangers.json imagery.json rangers/m19.png checked.json`
     (drops five OSM bunkers on grass, checked by eye), then
     `python3 rangers/keep_bunkers.py ../data/rangers.json checked.json ../data/rangers.json`
     (of its finds only the round fairway bunker between #12 and #17 is a bunker; the rest are paths and roofs)
   - `python3 add_ob.py rangers.boundary.osm.json rangers.roads_houses.osm.json rangers.config.json ../data/rangers.json`
   - `python3 trees_from_imagery.py ../data/rangers.json rangers/m19.png ../data/rangers.json`
   - from the repo root: `python3 tools/soften_shapes.py data/rangers.json` and `python3 tools/elevation.py rangers`

Dropped (`drop` in the config): the practice green by the clubhouse, and the practice range west of
#1 and #2 with the short-game area south of it (five greens and eleven bunkers).
