# Tenison Park Golf Course – Highlands and Glen (Dallas, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and both courses' 36 hole lines (with par and handicap). One boundary (way 465004152)
holds both courses; the hole lines carry no course name, so the Highlands' 18 (the west half,
ways 7210…–7212…, mapped 2019) and the Glen's (the east half plus #1 and #18 by the clubhouse,
ways 1449…, mapped 2025) are told apart by way id. Their handicap tags match each club card.
Like Fields Ranch, each course file has both courses' shapes and its own 18 holes.

The outlines sit on the Esri imagery as they are (no shift): `fit_shift.py` gives under 0.5 m
from both the bunkers and the greens. The imagery is winter (dormant grass, snow lying in the
tree shade), which fools the sand check both ways (the bunkers it would drop are in shade or
under snow, most of its finds are snow patches and a roof), so OSM's bunkers are kept as they
are, judged by eye.

Scorecards from GolfPass: Highlands (2856), par 72, pars and handicaps match OSM; men's ratings.
Glen (2871): handicaps match OSM, pars too except #13 (OSM: par 5; card: par 4, 410 yards), so the
card's are used (par 72); ratings matched to tees by total yards, men's, Red has only the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7440,32.7900,-96.7170,32.8080" -o map.json`
2. `python3 tools/tenison/osm_to_geom.py map.json`
3. From `tools/`, for c in highlands, glen:
   - `python3 build_course.py tenison-$c.osm.json tenison-$c.config.json ../data/tenison-$c.json`
   - `python3 add_ob.py tenison.boundary.osm.json tenison.roads_houses.osm.json tenison-$c.config.json ../data/tenison-$c.json`
   - `python3 trees_from_imagery.py ../data/tenison-$c.json tenison/m19.png ../data/tenison-$c.json`
   (imagery: `python3 fetch_tiles.py 19 32.7925 -96.7415 32.8055 -96.7191 tenison/m19.png`)
4. From the repo root: `python3 tools/soften_shapes.py data/tenison-$c.json` and `python3 tools/elevation.py tenison-$c`

Dropped (`drop` in the configs): the two practice greens by the clubhouse (and the fairway round
one) and a chipping green west of the Highlands' #1.
