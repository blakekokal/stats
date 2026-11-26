# Adding courses to Shot Tracker — handoff guide

For a Claude session picking up course building on `blakekokal/stats`. Read the repo's
`CLAUDE.md` first: it is the source of truth and may be newer than this file.

## The app in one paragraph

Shot Tracker is a static golf stat tracker (no build step; GitHub Pages serves `main`).
Each course is one JSON file in `data/<id>.json` (outlines: greens, fairways, tee boxes,
bunkers, water, trees, OB, hole lines, plus the scorecard) and one line in the course list
in `js/app.js`, e.g.
`{ id: 'oakhollow', name: 'Oak Hollow Golf Course', file: 'data/oakhollow.json' },`.
Courses sharing ground use `shares: '<other id>'` (Bear Creek, Indian Creek, Fields Ranch);
nines played in pairs use `nines: '<group>'` (Grapevine, Prairie Lakes, Isabella).
Elevation lives in `data/elev/`. The owner can edit outlines in the app; those edits are
published to the Supabase table `course_edits`.

## Working rules (from CLAUDE.md)

- Keep replies to the owner short: what changed and the version, no long explanations.
- When a change is done, open a PR into `main` and merge it straight away (don't ask),
  unless the owner says otherwise for that change.
- **But for a new course: send the owner a picture of one hole, then the whole course,
  before putting it live.** Settings or designs sent for a look are preview only; ask
  before releasing them.
- Every release: bump `js/version.js` and add a line on top of What's New in `js/coach.js`.
- Other sessions release to `main` at the same time. For every release:
  1. Right before the PR, `git fetch origin main` and merge it into your branch.
  2. Bump from main's number: read `VERSION` in `origin/main:js/version.js`, set yours one
     higher. Never `sed` an old version you remember.
  3. In a conflict keep both sides: `js/version.js` is one line,
     `export const VERSION = 'x.y.z';` (never empty); in What's New keep every entry, yours
     on top with that same number.
  4. Run `tools/check_release.sh --page` and fix anything it reports.
  5. Merge, then fetch `main` again. If someone merged first, repeat from step 1.
- Also update `README.md` (the course list at the top) and the CLAUDE.md OSM list (below).
- Before starting a course, mark it `(building, <date>)` in CLAUDE.md's list so no other
  session starts it too; when it's live, move it to Done.
- Network: Overpass is often down or blocked. Use the plain OSM API,
  `https://api.openstreetmap.org/api/0.6/map.json?bbox=W,S,E,N` (max 0.25 deg² and 50,000
  nodes; split big courses into parts and merge, as Indian Creek and Fields Ranch did).

## Recipe A: course from OpenStreetMap (no yardage book)

Use when OSM has all hole lines plus greens, tees, bunkers and fairways. Model:
`tools/texasstar/` (README + `osm_to_geom.py`); neighbours to copy for a course that shares
a fence line: `tools/cottonwood/`, `tools/hawkscreek/` (keep only what lies inside the
course's own boundary relation).

1. Download: `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=..." -o map.json`
2. Copy `tools/texasstar/osm_to_geom.py` to `tools/<id>/`, change the file names; run it.
   It writes `tools/<id>.osm.json`, `<id>.boundary.osm.json`, `<id>.roads_houses.osm.json`.
3. Write `tools/<id>.config.json` (copy `tools/oakhollow.config.json`): id, name, location,
   par, hcp, tees (name, rating, slope, 18 yards), `drop` (points inside polygons to leave
   out: practice greens, driving range; `[lat, lng, "bunker"]` drops only that type), `shift`
   (metres east/north to move OSM onto the imagery).
4. From `tools/`: `python3 build_course.py <id>.osm.json <id>.config.json ../data/<id>.json`
5. Imagery: `python3 fetch_tiles.py 19 <S> <W> <N> <E> <id>/m19.png` (zoom 19 Esri = what the app shows).
6. Measure the shift by fitting the bunkers to the sand in the imagery; set `shift`, rebuild.
   Winter imagery / dormant fairways / brown sand (Trails of Frisco, Whitestone): fit the
   greens instead.
7. Drop practice greens and the range (`drop`).
8. Bunkers: `hazards_from_imagery.py` + `bunkers_from_imagery.py`, then look by eye: shade,
   dormant grass, roofs, patios and paths fool it. Usually only a few OSM bunkers on grass
   get dropped and nothing is added.
9. OB: `python3 add_ob.py <id>.boundary.osm.json <id>.roads_houses.osm.json <id>.config.json ../data/<id>.json`
10. Trees: `python3 trees_from_imagery.py ../data/<id>.json <id>/m19.png ../data/<id>.json`
    (round trees from the canopy; never trees outside the course boundary).
11. From the repo root: `python3 tools/soften_shapes.py data/<id>.json` (last build step) and
    `python3 tools/elevation.py <id>` (USGS 3DEP lidar; a 502 means run it again).
12. Write `tools/<id>/README.md` like the others (bbox, shift, what was dropped and why,
    scorecard source).
13. Check by eye on an overlay and in the app (GPS Overview). Send the owner pictures.

Scorecard (tees, ratings, slopes, pars, handicaps) comes from the club or GolfPass. Check its
pars against OSM's hole tags; match ratings to tees by total yards. Known traps: GolfPass
cards can be old (Maridoe), one hole off (Old American) or have nines swapped (Twin Creeks,
Texas Rangers); OSM sometimes numbers a nine 10-18 (Isabella) or mis-tags a green as a tee
(The Tribute); some OSM hole lines start at a middle tee.

If OSM is only partly mapped, fill gaps from the imagery (`greens_from_imagery.py`,
`hazards_from_imagery.py`, `trace_turf.py`), or route holes from the scorecard (Lantana) or
the club's course map (Prairie Lakes), or ask the owner for the yardage book.

## Recipe B: course from the owner's yardage book

Books are vector PDFs (cover, plan, notes, then a green page and a hole page per hole).
Model: `tools/sherrillpark2/` (only a `course.py`: scorecard and the middle of each green
in the imagery).

- `tools/yardage_book.py` reads a book; `tools/build_from_book.py <id> <book.pdf> <m19.png> <out.json>`
  builds the course (needs `pymupdf`, `opencv-python`; several minutes: run it in the background).
- Each hole page: scale from the 50-yard rings (par 3: the tee's "N yd to green"), turn
  from the north arrow, pin at the centre. Bunkers, water, fairways, green and tee boxes come
  from the drawing; the 50-yard slope marks give the hole line's bends.
- Shapes drawn on two pages are identical, so all pages join into one plan. Place that plan
  on the zoom-19 imagery in one piece (shift, turn, scale from the greens, then fine-tune to
  bunkers on sand and ponds/trees on dark ground). Don't fit hole by hole; don't fit to
  trees alone (shadows fall north-west).
- Trees are the canopy inside the book's tree circles, never the circles themselves; saved as
  round trees (`tree_circles.py`); 2-5 small trees close together merge into one
  (`merge_small`, `merge_trees.py`).
- Check the book's bunkers and ponds against the imagery. If wrong, take bunkers, ponds and
  trees from the imagery (`hazards_from_imagery.py`); if partly wrong,
  `bunkers_from_imagery.py` keeps those on sand, drops those on grass, adds missing ones.
- OB from OSM's course boundary (`add_ob.py`), or the owner traces it in the hole editor.
- Commit the book PDF next to the scripts so the course can be rebuilt.

## Rebuilding a course that's live

Read its published edits first (`course_edits` in Supabase, readable with the anon key) and
start from them so the owner's edits aren't lost; pass the published `doc` to
`soften_shapes.py` (it starts from it and sets `builtAt`). A new `builtAt` sets old edits aside.
Redo trees only: `tools/trees_from_imagery.py`. Merge trees: `tools/merge_trees.py`.

## Status (as of 2026-11-26)

Live: Bridlewood, Bear Creek East/West, Cowboys, Tangle Ridge, Squaw Creek, Cross Timbers,
Sherrill Park #1/#2, Tour 18 Dallas, Grapevine (3 nines), Coyote Ridge, Firewheel Lakes,
Lantana, Lake Park Championship/Executive, Texas Star, Iron Horse, Indian Creek Creek/Lakes,
Fields Ranch East/West, Cedar Crest, Stevens Park, Tierra Verde, Riverside, Prairie Lakes
(3 nines), Cottonwood Valley, Trails of Frisco, Twin Creeks, Woodbridge, Buffalo Creek,
The Tribute, Old American, Sky Creek Ranch, Rockwall, Fossil Creek, Whitestone, Hawks Creek,
Oak Hollow, Isabella (AR, 3 nines).

No OB boundary yet (owner drawing): Sherrill Park #1, #2, Cross Timbers.

Next up from CLAUDE.md (OSM complete, public): Tenison Park (East and Glen), Maridoe (needs
current card), Texas Rangers Golf Club (nines swapped vs GolfPass), Pecan Valley (two
courses), The Resort (Fort Worth).

## Every Texas course with OpenStreetMap data (survey 2026-11-26)

How it was made: Nominatim found 807 `leisure=golf_course` areas in Texas; for each, the OSM
API (`map.json` on the course's bbox) was read and the ways inside its bbox counted. Counts are
approximate: a bbox can take in a neighbour's features (two courses on one site show double greens),
**Holes** counts distinct `golf=hole` refs, and fairways mapped as multipolygon relations aren't
counted, so a low fairway count doesn't always mean fairways are missing. Re-check a course with
its own download before building. About 300 more Texas courses have only a boundary and are not listed.
**(live)** = already in the app.

### 1. Ready to build: all hole lines plus greens, tees and bunkers (309)

Sorted by place. Fairways column: if it's well under the hole count, check whether fairways are
missing (then trace them from the imagery) or are relations.

| Course | Place | Holes | Greens | Tees | Bunkers | Fairways | OSM | bbox (W,S,E,N) |
|---|---|--:|--:|--:|--:|--:|---|---|
| Tierra Verde Golf Club **(live)** | Arlington | 19 | 29 | 96 | 49 | 15 | way/1037827161 | -97.1900,32.6192,-97.1752,32.6277 |
| Flintrock Falls Country Club | Austin | 18 | 19 | 74 | 87 | 16 | relation/17646117 | -97.9986,30.3304,-97.9720,30.3401 |
| Hancock Golf Course | Austin | 9 | 10 | 17 | 4 | 9 | way/30764860 | -97.7285,30.2962,-97.7227,30.3016 |
| Lions Municipal Golf Course | Austin | 18 | 19 | 38 | 14 | 20 | way/30764972 | -97.7835,30.2834,-97.7735,30.2938 |
| Onion Creek Club | Austin | 18 | 30 | 56 | 63 | 17 | relation/12256109 | -97.7944,30.1293,-97.7757,30.1438 |
| River Place Country Club | Austin | 18 | 19 | 54 | 34 | 18 | way/31113781 | -97.8662,30.3639,-97.8491,30.3761 |
| Spanish Oaks Golf Club | Austin | 18 | 31 | 43 | 124 | 10 | way/206847834 | -97.9514,30.2886,-97.9364,30.3026 |
| The Hills Country Club | Austin | 18 | 26 | 87 | 58 | 18 | relation/17642867 | -97.9941,30.3392,-97.9795,30.3562 |
| (unnamed) | Bastrop County | 18 | 17 | 75 | 77 | 12 | relation/17001905 | -97.4628,30.1586,-97.4487,30.1678 |
| Lost Pines Golf Club | Bastrop County | 18 | 21 | 93 | 105 | 13 | relation/11175258 | -97.4628,30.1564,-97.4447,30.1678 |
| Pine Forest Golf Club | Bastrop County | 18 | 19 | 30 | 18 | 14 | relation/12322609 | -97.3085,30.0645,-97.2820,30.0796 |
| Falconhead Golf Course | Bee Cave | 18 | 26 | 84 | 32 | 16 | relation/20258868 | -97.9766,30.3118,-97.9616,30.3250 |
| Cedar Creek Golf Course | Bexar County | 18 | 20 | 76 | 37 | 21 | relation/1190170 | -98.6607,29.5991,-98.6428,29.6176 |
| TPC San Antonio Oaks Course | Bexar County | 18 | 20 | 70 | 56 | 12 | way/79659611 | -98.4010,29.6480,-98.3922,29.6664 |
| Vaaler Creek Golf Club | Blanco County | 18 | 19 | 67 | 16 | 23 | way/1019652249 | -98.3910,30.0286,-98.3699,30.0533 |
| Eagles Bluff Country Club | Bullard | 18 | 21 | 66 | 47 | 22 | way/1531755256 | -95.4483,32.1119,-95.4281,32.1297 |
| Delaware Springs Golf Course | Burnet | 18 | 19 | 64 | 30 | 12 | relation/13466990 | -98.2584,30.7154,-98.2402,30.7351 |
| Indian Creek Golf Club **(live)** | Carrollton | 18 | 37 | 129 | 82 | 9 | way/475716356 | -96.9433,32.9954,-96.9280,33.0117 |
| Twin Creeks Country Club | Cedar Park | 18 | 20 | 87 | 53 | 10 | relation/3203627 | -97.8636,30.4470,-97.8495,30.4744 |
| The Challenge at the Woods | Cherokee County | 18 | 20 | 41 | 24 | 18 | way/130429644 | -95.2155,31.9641,-95.2012,31.9791 |
| The Golf Club at Texas A&M | College Station | 18 | 18 | 93 | 158 | 11 | way/381345053 | -96.3350,30.6124,-96.3241,30.6225 |
| Lakeview Course | Conroe | 18 | 18 | 44 | 72 | 18 | relation/7065965 | -95.6245,30.3611,-95.6008,30.3738 |
| Rusted Rail Golf Club | Crandall | 18 | 18 | 54 | 32 | 10 | way/550943599 | -96.4511,32.6107,-96.4389,32.6268 |
| Bear Creek Golf Course **(live)** | Dallas | 18 | 37 | 103 | 108 | 18 | way/25552525 | -97.0636,32.8529,-97.0523,32.8673 |
| Dallas Athletic Club | Dallas | 18 | 52 | 161 | 162 | 21 | way/28469868 | -96.6536,32.8376,-96.6360,32.8510 |
| Grover C. Keaton Golf Course | Dallas | 18 | 22 | 57 | 5 | 16 | way/27130579 | -96.7122,32.7494,-96.7038,32.7601 |
| Prestonwood Country Club - Creeks Course | Dallas | 18 | 25 | 51 | 65 | 17 | way/300531170 | -96.8136,32.9541,-96.8071,32.9684 |
| Tenison Park Golf Course | Dallas | 18 | 39 | 111 | 33 | 10 | way/465004152 | -96.7410,32.7930,-96.7196,32.8050 |
| Yoakum County Golf Club | Denver City | 18 | 20 | 51 | 13 | 20 | way/1153502208 | -102.8187,33.0456,-102.8051,33.0514 |
| Coronado Country Golf Course | El Paso | 18 | 24 | 51 | 42 | 15 | way/676288348 | -106.5251,31.8440,-106.5101,31.8526 |
| Painted Dunes Golf Course | El Paso | 18 | 18 | 58 | 52 | 20 | way/102722703 | -106.4077,31.9474,-106.3942,31.9663 |
| Golf Club of Houston | Fall Creek | 18 | 44 | 201 | 116 | 23 | way/193396475 | -95.2727,29.9063,-95.2535,29.9310 |
| Tournament Course | Fall Creek | 18 | 35 | 169 | 95 | 21 | way/193396474 | -95.2706,29.9063,-95.2535,29.9246 |
| (unnamed) | Fort Worth | 18 | 20 | 41 | 25 | 12 | way/28618973 | -97.2433,32.7460,-97.2341,32.7594 |
| (unnamed) | Fort Worth | 18 | 29 | 106 | 54 | 15 | way/28382130 | -97.1629,32.7607,-97.1490,32.7780 |
| (unnamed) | Fort Worth | 18 | 18 | 59 | 25 | 14 | way/778710383 | -97.3062,33.0149,-97.2823,33.0265 |
| Colonial Country Club | Fort Worth | 18 | 31 | 48 | 82 | 15 | way/27865544 | -97.3776,32.7150,-97.3637,32.7233 |
| Lost Creek Golf Club | Fort Worth | 18 | 20 | 40 | 19 | 19 | way/685755822 | -97.5297,32.7052,-97.5159,32.7194 |
| Mira Vista Country Club | Fort Worth | 18 | 19 | 70 | 66 | 10 | relation/4715528 | -97.4436,32.6491,-97.4315,32.6670 |
| Shady Oaks Country Club | Fort Worth | 19 | 33 | 53 | 110 | 19 | way/28320368 | -97.4277,32.7479,-97.4127,32.7574 |
| The Golf Club at Fossil Creek **(live)** | Fort Worth | 18 | 19 | 75 | 54 | 13 | relation/15710500 | -97.3108,32.8487,-97.2902,32.8610 |
| White Stone Golf Course **(live)** | Fort Worth | 18 | 21 | 65 | 50 | 10 | way/448822379 | -97.5038,32.6531,-97.4874,32.6669 |
| Woodhaven Country Club | Fort Worth | 18 | 19 | 30 | 37 | 10 | relation/9295216 | -97.2429,32.7651,-97.2234,32.7763 |
| Timber Creek Golf Club | Friendswood | 9 | 28 | 108 | 93 | 11 | relation/13009107 | -95.2012,29.5493,-95.1860,29.5668 |
| Fields Ranch - West Course **(live)** | Frisco | 18 | 50 | 19 | 149 | 16 | way/1175982342 | -96.8685,33.1990,-96.8527,33.2150 |
| Trails of Frisco Golf Course **(live)** | Frisco | 18 | 22 | 76 | 49 | 10 | way/274445699 | -96.8821,33.1636,-96.8641,33.1781 |
| Duck Creek Golf Club | Garland | 18 | 18 | 22 | 7 | 12 | way/495932707 | -96.6826,32.9325,-96.6664,32.9451 |
| Tempest Golf Club | Gladewater | 18 | 20 | 83 | 52 | 23 | way/440697855 | -94.9359,32.4471,-94.9223,32.4592 |
| Riverside Golf Club **(live)** | Grand Prairie | 18 | 19 | 35 | 34 | 23 | way/28541360 | -97.0667,32.7934,-97.0547,32.8148 |
| Hearthstone Country Club | Harris County | 9 | 27 | 84 | 54 | 24 | relation/2728576 | -95.6381,29.8795,-95.6224,29.8946 |
| Northgate Country Club | Harris County | 18 | 18 | 64 | 64 | 18 | relation/6154850 | -95.4909,30.0023,-95.4709,30.0244 |
| (unnamed) | Heath | 18 | 24 | 71 | 56 | 20 | relation/18027980 | -96.4855,32.8121,-96.4696,32.8309 |
| Buffalo Creek Golf Club **(live)** | Heath | 18 | 28 | 50 | 45 | 14 | relation/9921546 | -96.4715,32.8594,-96.4481,32.8765 |
| Hideaway West | Hideaway | 9 | 10 | 30 | 23 | 8 | way/402948286 | -95.4660,32.4711,-95.4551,32.4780 |
| White Bluff New Course | Hill County | 18 | 19 | 49 | 38 | 9 | relation/18925493 | -97.4056,32.0280,-97.3762,32.0406 |
| Apple Rock | Horseshoe Bay | 18 | 22 | 75 | 53 | 19 | relation/8064375 | -98.4129,30.5385,-98.3904,30.5538 |
| Slick Rock | Horseshoe Bay | 18 | 19 | 21 | 68 | 17 | relation/8064379 | -98.3782,30.5336,-98.3600,30.5465 |
| Slick Rock Golf Course | Horseshoe Bay | 18 | 19 | 21 | 68 | 17 | way/563513967 | -98.3782,30.5336,-98.3600,30.5465 |
| Clear Creek Golf Club | Houston | 18 | 19 | 47 | 40 | 15 | way/191520362 | -95.3708,29.5850,-95.3576,29.5941 |
| Gus Wortham Golf Course | Houston | 18 | 20 | 62 | 56 | 24 | relation/15627050 | -95.3110,29.7229,-95.2999,29.7345 |
| Hermann Park Golf Course | Houston | 18 | 19 | 35 | 24 | 18 | way/43035413 | -95.3910,29.7090,-95.3819,29.7199 |
| Houston Country Club | Houston | 18 | 27 | 64 | 86 | 19 | way/123670178 | -95.4962,29.7596,-95.4816,29.7712 |
| Marsh Golf Course | Houston | 18 | 32 | 81 | 79 | 11 | way/219055063 | -95.1948,30.0253,-95.1853,30.0408 |
| Pine Forest Country Club | Houston | 9 | 22 | 59 | 85 | 27 | way/691543588 | -95.6853,29.8232,-95.6696,29.8311 |
| Wildcat Golf Club - The Lakes Course | Houston | 18 | 17 | 58 | 37 | 14 | way/1119606658 | -95.4235,29.6397,-95.4108,29.6493 |
| Cottonwood Valley Golf Course **(live)** | Irving | 18 | 20 | 76 | 64 | 19 | relation/5351639 | -96.9755,32.8587,-96.9602,32.8697 |
| Hackberry Creek Country Club | Irving | 18 | 21 | 81 | 57 | 15 | relation/8111659 | -96.9829,32.9011,-96.9655,32.9142 |
| TPC Four Seasons Las Colinas | Irving | 18 | 25 | 84 | 76 | 21 | relation/5281830 | -96.9617,32.8598,-96.9468,32.8792 |
| Jersey Meadow Golf Course | Jersey Village | 18 | 20 | 28 | 31 | 17 | way/126449831 | -95.5843,29.8886,-95.5721,29.8955 |
| The Club at Falcon Point | Katy | 18 | 17 | 38 | 49 | 18 | relation/1528626 | -95.8019,29.7604,-95.7890,29.7722 |
| The Golf Club at Cinco Ranch | Katy | 18 | 21 | 67 | 75 | 15 | relation/1527947 | -95.7684,29.7416,-95.7548,29.7540 |
| Riverhill Country Club | Kerrville | 18 | 18 | 49 | 44 | 16 | way/1412310353 | -99.1416,30.0131,-99.1273,30.0244 |
| Meadowbrook Golf & Event Center | Kilgore | 9 | 10 | 17 | 9 | 11 | way/457635516 | -94.8656,32.3752,-94.8560,32.3797 |
| Stonetree Golf Club | Killeen | 18 | 22 | 57 | 21 | 20 | relation/21570028 | -97.6873,31.0771,-97.6739,31.0903 |
| Plum Creek Golf Course | Kyle | 18 | 21 | 78 | 24 | 19 | way/650962096 | -97.8880,30.0097,-97.8704,30.0272 |
| Lago Vista Golf Course | Lago Vista | 18 | 18 | 43 | 23 | 15 | relation/17639856 | -98.0125,30.4353,-97.9940,30.4534 |
| Live Oak Golf Course | Lakeway | 18 | 18 | 44 | 3 | 17 | relation/17639954 | -97.9950,30.3563,-97.9813,30.3702 |
| Casa Balnca Golf Course | Laredo | 18 | 20 | 55 | 16 | 19 | way/930353810 | -99.4576,27.5323,-99.4469,27.5415 |
| Laredo Country Club | Laredo | 18 | 19 | 54 | 44 | 23 | relation/6333077 | -99.4716,27.5786,-99.4561,27.5899 |
| Max A. Mandel Municipal Golf Course | Laredo | 18 | 19 | 87 | 40 | 17 | way/1072605790 | -99.6852,27.6569,-99.6569,27.6665 |
| Magnolia Creek Golf Club | League City | 18 | 33 | 83 | 99 | 12 | way/357581616 | -95.1542,29.4686,-95.1312,29.4790 |
| South Shore Harbour | League City | 9 | 30 | 93 | 82 | 9 | relation/5677911 | -95.0681,29.5266,-95.0488,29.5420 |
| Garden Valley Golf Club | Lindale | 18 | 18 | 51 | 30 | 16 | way/926954797 | -95.5563,32.4742,-95.5427,32.4881 |
| Crossing Creeks Country Club | Longview | 18 | 20 | 56 | 26 | 22 | way/385356094 | -94.7778,32.5392,-94.7545,32.5498 |
| Wood Hollow Golf Course | Longview | 18 | 18 | 41 | 1 | 20 | way/386102155 | -94.7759,32.5584,-94.7671,32.5687 |
| Longwood Golf Club | Longwood Village | 9 | 29 | 104 | 62 | 23 | relation/6941062 | -95.6514,29.9772,-95.6342,29.9934 |
| Meadowbrook Golf Course | Lubbock | 18 | 37 | 52 | 9 | 9 | way/178103599 | -101.8374,33.5914,-101.8240,33.6078 |
| Shadow Glen Golf Club | Manor | 18 | 19 | 81 | 47 | 14 | relation/12842447 | -97.5624,30.3493,-97.5437,30.3649 |
| Shary Municipal Golf Course | Mission | 9 | 10 | 14 | 1 | 9 | relation/3990098 | -98.3228,26.2185,-98.3088,26.2289 |
| Quail Valley El Dorado Course | Missouri City | 18 | 26 | 104 | 79 | 11 | way/216999898 | -95.5639,29.5635,-95.5408,29.5825 |
| Quail Valley La Quinta Course | Missouri City | 18 | 27 | 90 | 69 | 9 | relation/5141753 | -95.5525,29.5621,-95.5313,29.5816 |
| Grand Pines Golf Club | Montgomery County | 18 | 18 | 76 | 69 | 21 | way/629918707 | -95.6308,30.4373,-95.6160,30.4488 |
| Miller Course | Montgomery County | 18 | 19 | 70 | 28 | 18 | relation/8766680 | -95.6528,30.4179,-95.6287,30.4287 |
| Weiskopf Course | Montgomery County | 18 | 19 | 69 | 81 | 23 | relation/8766800 | -95.6296,30.4169,-95.6113,30.4326 |
| Pecan Lakes Golf Course | Navasota | 18 | 21 | 65 | 38 | 17 | way/50075704 | -96.1216,30.3596,-96.1135,30.3692 |
| The Bandit Golf Club | New Braunfels | 18 | 18 | 78 | 67 | 23 | relation/2587667 | -98.0653,29.6248,-98.0464,29.6398 |
| Oak Hurst Golf Course | New Hope | 18 | 20 | 37 | 17 | 15 | way/454056122 | -95.3295,32.1685,-95.3173,32.1786 |
| Sunset Grove Country Club | Orange | 18 | 20 | 32 | 33 | 20 | way/473919372 | -93.7642,30.1112,-93.7567,30.1193 |
| (unnamed) | Paris | 18 | 18 | 33 | 18 | 15 | way/1362031154 | -95.4880,33.7058,-95.4778,33.7138 |
| Golfcrest Country Club | Pearland | 18 | 18 | 51 | 57 | 13 | way/105241412 | -95.2513,29.5564,-95.2324,29.5711 |
| Southwyck Golf Club | Pearland | 18 | 18 | 73 | 50 | 9 | relation/8558130 | -95.3820,29.5350,-95.3603,29.5501 |
| Princedale Country Club | Pittsburg | 9 | 9 | 13 | 4 | 8 | way/468890985 | -94.9503,32.9998,-94.9439,33.0063 |
| The Courses at Watters Creek | Plano | 18 | 36 | 93 | 66 | 9 | way/372377445 | -96.7077,33.0687,-96.6866,33.0837 |
| Canyon Creek Country Club | Richardson | 18 | 20 | 37 | 51 | 9 | relation/14630515 | -96.7404,32.9828,-96.7284,32.9969 |
| Rockport Country Club | Rockport | 18 | 18 | 20 | 43 | 14 | relation/20730272 | -97.0617,28.0451,-97.0444,28.0606 |
| (unnamed) | San Antonio | 9 | 22 | 65 | 42 | 16 | way/1525365893 | -98.6872,29.4545,-98.6737,29.4667 |
| Canyon Springs Golf Club | San Antonio | 18 | 18 | 105 | 47 | 15 | relation/1199950 | -98.4880,29.6660,-98.4680,29.6796 |
| Fort Sam Houston Golf Course | San Antonio | 18 | 37 | 110 | 48 | 12 | way/79453711 | -98.4406,29.4607,-98.4238,29.4751 |
| Hyatt Hill Country Golf Club | San Antonio | 9 | 29 | 93 | 57 | 22 | relation/20802735 | -98.6872,29.4483,-98.6687,29.4667 |
| Oak Hills Country Club | San Antonio | 18 | 23 | 72 | 73 | 18 | relation/21357500 | -98.5761,29.4962,-98.5630,29.5084 |
| Olmos Basin Golf Course | San Antonio | 18 | 19 | 29 | 32 | 10 | way/79107442 | -98.4916,29.4881,-98.4822,29.5027 |
| Palmer Course at La Cantera | San Antonio | 18 | 20 | 88 | 59 | 21 | way/79665188 | -98.6416,29.6003,-98.6278,29.6126 |
| Resort Course at La Cantera | San Antonio | 18 | 26 | 92 | 66 | 14 | relation/19603207 | -98.6292,29.5974,-98.6118,29.6143 |
| The Club at Sonterra | San Antonio | 18 | 39 | 115 | 105 | 17 | relation/1198348 | -98.5117,29.5968,-98.4946,29.6229 |
| Willow Springs Golf Course | San Antonio | 18 | 20 | 42 | 36 | 18 | way/78568344 | -98.4347,29.4243,-98.4228,29.4329 |
| Preston Club Golf Course | Sherman | 18 | 19 | 47 | 51 | 11 | way/1085500145 | -96.7157,33.6534,-96.7030,33.6707 |
| Barton Creek Lakeside Country Club | Spicewood | 18 | 20 | 74 | 65 | 11 | relation/18286836 | -98.1046,30.4565,-98.0846,30.4678 |
| Augusta Pines Golf Course | Spring | 18 | 20 | 78 | 49 | 15 | way/1033966141 | -95.5418,30.1180,-95.5283,30.1313 |
| Gleannloch Golf Club | Spring | 18 | 31 | 113 | 97 | 26 | way/912430461 | -95.5813,30.0282,-95.5513,30.0497 |
| Willow Creek Golf Club | Spring | 18 | 20 | 64 | 61 | 17 | way/181669805 | -95.5268,30.1152,-95.5126,30.1259 |
| River Crossing Club | Spring Branch | 18 | 19 | 104 | 51 | 19 | relation/18160470 | -98.4089,29.8325,-98.3965,29.8498 |
| Riverbend Country Club | Sugar Land | 18 | 20 | 36 | 73 | 43 | way/216961891 | -95.5959,29.6066,-95.5826,29.6160 |
| Sammons Golf Course | Temple | 18 | 20 | 72 | 14 | 14 | way/68829670 | -97.3818,31.0951,-97.3653,31.1057 |
| Wild Flower Country Club | Temple | 18 | 19 | 69 | 20 | 19 | way/68835418 | -97.4060,31.0965,-97.3925,31.1117 |
| Old American Golf Club **(live)** | The Colony | 18 | 41 | 137 | 200 | 9 | way/297401053 | -96.9358,33.0847,-96.9133,33.1074 |
| Stewart Peninsula Golf Course | The Colony | 9 | 12 | 36 | 22 | 7 | way/297553370 | -96.9245,33.0833,-96.9131,33.0932 |
| Palmer Course - General nine | The Woodlands | 9 | 13 | 44 | 41 | 11 | way/219583737 | -95.5332,30.1848,-95.5199,30.1939 |
| The Tournament Course | The Woodlands | 18 | 31 | 62 | 61 | 11 | relation/6154993 | -95.4712,30.1433,-95.4525,30.1554 |
| (unnamed) | Thompsons | 18 | 19 | 45 | 26 | 13 | way/1121066818 | -95.6337,29.5192,-95.6248,29.5390 |
| Tomball Country Club | Tomball | 18 | 18 | 18 | 18 | 10 | way/195023891 | -95.5895,30.0788,-95.5777,30.0872 |
| Hollytree Country Club | Tyler | 18 | 24 | 51 | 45 | 14 | relation/16640160 | -95.3287,32.2686,-95.3130,32.2798 |
| Willow Brook Country Club | Tyler | 18 | 26 | 52 | 63 | 12 | way/546721062 | -95.3405,32.3509,-95.3311,32.3593 |
| Olympia Hills Golf & Event Center | Universal City | 18 | 21 | 71 | 54 | 13 | relation/20509373 | -98.3140,29.5634,-98.3014,29.5801 |
| Cottonwood Creek Golf Course | Waco | 18 | 19 | 75 | 34 | 17 | way/259248246 | -97.1747,31.5009,-97.1590,31.5097 |
| Houston Oaks Country Club - Family Nine | Waller County | 9 | 11 | 11 | 13 | 5 | way/205086047 | -95.8425,30.0987,-95.8380,30.1075 |
| (unnamed) | Waterwood | 18 | 22 | 26 | 85 | 12 | relation/21203729 | -95.2394,30.8174,-95.2226,30.8329 |
| Cape Royal Golf Club | Wolf Creek | 18 | 18 | 18 | 7 | 16 | way/1472061569 | -95.1489,30.6480,-95.1387,30.6598 |
| Bear Ridge Golf Course | Woodway | 18 | 22 | 100 | 45 | 14 | relation/17880292 | -97.2875,31.4832,-97.2717,31.4976 |
| Woodbridge Golf Club **(live)** | Wylie | 18 | 20 | 73 | 66 | 13 | way/499185290 | -96.5649,32.9769,-96.5524,32.9940 |
| Abilene Country Club North Course | Abilene | 18 | 22 | 61 | 67 | 5 | way/299872249 | -99.7423,32.4015,-99.7338,32.4119 |
| Abilene Country Club South Course (Fairway) | Abilene | 18 | 18 | 58 | 24 | 3 | relation/3987829 | -99.7707,32.3735,-99.7516,32.3834 |
| Maxwell Golf Course | Abilene | 18 | 21 | 39 | 9 | 6 | way/299872310 | -99.7358,32.4015,-99.7290,32.4136 |
| Split Rail Links & Golf Club | Aledo | 18 | 17 | 76 | 51 | 2 | relation/3987831 | -97.6527,32.6923,-97.6330,32.7045 |
| The Golf Club at Twin Creeks **(live)** | Allen | 18 | 20 | 83 | 49 | 0 | way/374107296 | -96.7268,33.1010,-96.7093,33.1157 |
| Shady Valley Country Club | Arlington | 18 | 19 | 30 | 35 | 4 | way/624141555 | -97.1767,32.7176,-97.1674,32.7286 |
| Texas Rangers Golf Club | Arlington | 18 | 24 | 71 | 69 | 3 | way/25930393 | -97.1063,32.7755,-97.0961,32.7847 |
| Athens Country Club | Athens | 18 | 18 | 19 | 9 | 8 | way/551731918 | -95.8695,32.1889,-95.8619,32.1971 |
| (unnamed) | Austin | 18 | 27 | 93 | 120 | 6 | way/1265806389 | -97.8032,30.3328,-97.7910,30.3484 |
| Butler Pitch & Putt | Austin | 9 | 10 | 9 | 1 | 4 | way/255962136 | -97.7576,30.2612,-97.7554,30.2641 |
| Jimmy Clay Golf Course | Austin | 18 | 20 | 52 | 30 | 1 | relation/19150951 | -97.7332,30.1845,-97.7217,30.1949 |
| Lost Creek Country Club | Austin | 27 | 28 | 73 | 51 | 7 | way/709072895 | -97.8563,30.2716,-97.8447,30.2869 |
| Morris Williams Golf Course | Austin | 18 | 20 | 63 | 13 | 4 | way/30764681 | -97.6974,30.2841,-97.6813,30.2915 |
| Riverside Golf Course | Austin | 18 | 18 | 47 | 47 | 2 | way/30769048 | -97.7104,30.2291,-97.7026,30.2443 |
| Roy Kizer Golf Course | Austin | 18 | 22 | 75 | 50 | 2 | relation/73352 | -97.7422,30.1720,-97.7285,30.1876 |
| University of Texas Golf Club | Austin | 18 | 20 | 94 | 53 | 5 | relation/17973325 | -97.8981,30.3469,-97.8842,30.3679 |
| Cross Timbers Golf Course **(live)** | Azle | 18 | 18 | 37 | 18 | 7 | way/299872279 | -97.5719,32.8736,-97.5592,32.8863 |
| Barton Creek Fazio Foothills | Barton Creek | 29 | 29 | 120 | 57 | 6 | way/31820623 | -97.8681,30.2821,-97.8519,30.3040 |
| Pecan Valley Golf Course | Benbrook | 18 | 36 | 75 | 56 | 5 | relation/8908077 | -97.4622,32.6521,-97.4430,32.6642 |
| Ridglea Country Club - Championship Golf Course | Benbrook | 18 | 19 | 26 | 59 | 2 | relation/9348785 | -97.4396,32.6845,-97.4266,32.6946 |
| Briggs Ranch | Bexar County | 18 | 21 | 76 | 88 | 1 | way/302534356 | -98.7690,29.3949,-98.7524,29.4093 |
| Randolph Oaks | Bexar County | 18 | 18 | 18 | 30 | 0 | relation/18799540 | -98.2795,29.5155,-98.2655,29.5253 |
| TPC San Antonio AT&T Canyons Course | Bexar County | 18 | 19 | 18 | 47 | 1 | way/79659612 | -98.4120,29.6663,-98.3921,29.6811 |
| Legacy Ridge Golf Club | Bonham | 18 | 20 | 64 | 18 | 4 | way/343001254 | -96.1661,33.5947,-96.1402,33.6032 |
| Valley International Country Club | Brownsville | 18 | 18 | 37 | 54 | 4 | relation/13588868 | -97.5206,25.9400,-97.5093,25.9508 |
| Van Zandt Country Club | Canton | 18 | 20 | 17 | 11 | 13 | way/758461612 | -95.8715,32.5828,-95.8623,32.5952 |
| Maridoe Golf Club | Carrollton | 18 | 22 | 89 | 74 | 7 | way/321513687 | -96.8779,32.9597,-96.8640,32.9686 |
| Avery Ranch Golf Club | Cedar Park | 18 | 21 | 75 | 60 | 4 | way/1482734144 | -97.7870,30.4965,-97.7535,30.5106 |
| Cleburne Golf Links | Cleburne | 18 | 18 | 68 | 15 | 2 | way/198245532 | -97.4351,32.3014,-97.4176,32.3226 |
| Pebble Creek Golf Course | College Station | 18 | 22 | 75 | 17 | 7 | way/485951553 | -96.2438,30.5616,-96.2252,30.5737 |
| Courses of Clear Creek | Comanche Village I | 18 | 18 | 50 | 4 | 4 | way/1010789871 | -97.8260,31.1407,-97.8081,31.1550 |
| The Buckhorn Golf Course | Comfort | 18 | 19 | 64 | 26 | 4 | way/339670041 | -98.8949,29.9714,-98.8886,29.9843 |
| River Plantation Country Club | Conroe | 18 | 28 | 46 | 50 | 4 | relation/5160644 | -95.4559,30.2428,-95.4314,30.2577 |
| Oakmont Country Club | Corinth | 18 | 20 | 64 | 32 | 5 | way/319591744 | -97.0952,33.1435,-97.0810,33.1633 |
| Oso Beach Municipal Golf Course | Corpus Christi | 18 | 20 | 52 | 30 | 0 | way/193429098 | -97.3554,27.7100,-97.3388,27.7176 |
| River Hills Country Club | Corpus Christi | 9 | 9 | 21 | 7 | 0 | way/294836731 | -97.6519,27.8617,-97.6426,27.8684 |
| BlackHorse Golf Club | Cypress | 18 | 36 | 166 | 117 | 5 | relation/6531137 | -95.7178,29.9497,-95.6983,29.9626 |
| Cypress Lakes Golf Club | Cypress | 18 | 18 | 69 | 53 | 0 | way/200512869 | -95.7157,29.9836,-95.7063,29.9958 |
| Bent Tree Country Club | Dallas | 18 | 30 | 81 | 85 | 2 | relation/5500548 | -96.8272,32.9703,-96.8129,32.9878 |
| Cedar Crest Golf Course **(live)** | Dallas | 18 | 22 | 68 | 34 | 3 | way/39218951 | -96.8005,32.7197,-96.7872,32.7270 |
| Dallas National Golf Club | Dallas | 18 | 40 | 87 | 105 | 6 | way/28379443 | -96.9142,32.7295,-96.9005,32.7409 |
| Luna Vista Golf Course | Dallas | 18 | 20 | 46 | 19 | 0 | way/28383531 | -96.9272,32.8813,-96.9188,32.8955 |
| Stevens Golf Course **(live)** | Dallas | 18 | 23 | 72 | 38 | 2 | way/32490345 | -96.8585,32.7539,-96.8429,32.7631 |
| The Northwood Club | Dallas | 18 | 27 | 56 | 79 | 2 | way/27811262 | -96.7969,32.9288,-96.7884,32.9376 |
| Battleground Golf Course at Deer Park | Deer Park | 18 | 17 | 75 | 38 | 5 | way/51383790 | -95.1447,29.6949,-95.1294,29.7007 |
| Frisco Lakes Golf Course | Denton County | 18 | 21 | 91 | 34 | 0 | relation/8837816 | -96.9189,33.1308,-96.8909,33.1447 |
| Beacon Lakes Golf Club | Dickinson | 18 | 17 | 39 | 36 | 4 | way/1111823962 | -95.0840,29.4730,-95.0740,29.4836 |
| Butterfield Trail Golf Club | El Paso | 18 | 20 | 72 | 80 | 1 | way/1104786217 | -106.3408,31.8196,-106.3311,31.8321 |
| Texas Star Golf Course **(live)** | Euless | 18 | 20 | 70 | 48 | 7 | way/28584648 | -97.1173,32.8078,-97.1050,32.8222 |
| Old Brickyard Golf Course | Ferris | 18 | 18 | 55 | 6 | 2 | way/1176385017 | -96.6656,32.5385,-96.6594,32.5502 |
| Shadow Hawk Golf Club and Black Hawk Country Club | Fort Bend County | 18 | 19 | 70 | 82 | 0 | way/49631870 | -95.6977,29.6283,-95.6813,29.6457 |
| (unnamed) | Fort Worth | 18 | 19 | 73 | 52 | 8 | way/28740221 | -97.3762,32.7652,-97.3626,32.7812 |
| The Resort Golf Club | Fort Worth | 19 | 23 | 67 | 39 | 6 | way/1272769256 | -97.4949,32.9436,-97.4833,32.9575 |
| Lady Bird Johnson Municipal Golf Course | Fredericksburg | 18 | 28 | 81 | 47 | 3 | way/355487076 | -98.9205,30.2352,-98.9134,30.2512 |
| Freeport Municipal Golf Course | Freeport | 18 | 18 | 33 | 11 | 6 | way/1315588384 | -95.3983,28.9664,-95.3923,28.9808 |
| Fields Ranch - East Course **(live)** | Frisco | 18 | 47 | 29 | 138 | 7 | way/910555574 | -96.8617,33.1990,-96.8381,33.2146 |
| Plantation Golf Club | Frisco | 18 | 19 | 36 | 20 | 3 | relation/6531467 | -96.7860,33.1162,-96.7703,33.1281 |
| Stonebriar Country Club | Frisco | 18 | 46 | 126 | 142 | 6 | relation/3652901 | -96.8567,33.0871,-96.8404,33.1062 |
| Gaines County Golf Course | Gaines County | 19 | 19 | 50 | 19 | 5 | way/405548653 | -102.6574,32.8278,-102.6406,32.8422 |
| Moody Gardens Golf Course | Galveston | 18 | 20 | 60 | 64 | 1 | way/927815900 | -94.8747,29.2552,-94.8604,29.2702 |
| Cowan Creek Golf Club | Georgetown | 18 | 22 | 103 | 37 | 2 | relation/17650606 | -97.7507,30.7130,-97.7328,30.7390 |
| Legacy Hills Golf Club | Georgetown | 18 | 19 | 88 | 46 | 2 | relation/17654902 | -97.7326,30.7023,-97.7029,30.7166 |
| White Wing Golf Club | Georgetown | 18 | 19 | 104 | 31 | 3 | relation/17649933 | -97.7392,30.7176,-97.7172,30.7326 |
| Squaw Valley Golf Course - Apache Links | Glen Rose | 18 | 24 | 74 | 45 | 8 | way/1580734383 | -97.7287,32.2526,-97.7141,32.2617 |
| Squaw Valley Golf Course - Comanche Lakes | Glen Rose | 18 | 24 | 92 | 69 | 7 | way/1580736663 | -97.7331,32.2592,-97.7155,32.2691 |
| (unnamed) | Granbury | 18 | 19 | 74 | 65 | 1 | relation/9435723 | -97.7713,32.4184,-97.7582,32.4383 |
| Halbert National Golf Club | Granbury | 18 | 24 | 85 | 91 | 3 | way/1568621988 | -97.7763,32.4733,-97.7666,32.4825 |
| Tangle Ridge Golf Club **(live)** | Grand Prairie | 18 | 19 | 59 | 49 | 7 | way/480089940 | -97.0252,32.5608,-97.0106,32.5694 |
| Cowboys Golf Club and Grapevine Golf Course **(live)** | Grapevine | 18 | 50 | 160 | 100 | 7 | relation/17453587 | -97.0567,32.9513,-97.0405,32.9847 |
| The Oaks Country Club | Greenville | 9 | 11 | 30 | 6 | 4 | way/983799925 | -96.0824,33.0641,-96.0772,33.0713 |
| Tony Butler Golf Course | Harlingen | 18 | 19 | 39 | 24 | 5 | way/473696345 | -97.7141,26.1636,-97.7013,26.1770 |
| White Bluff Old Course | Hill County | 18 | 20 | 73 | 50 | 5 | way/1374207418 | -97.4158,32.0109,-97.3981,32.0284 |
| (unnamed) | Houston | 18 | 21 | 54 | 39 | 6 | relation/2981305 | -95.1357,29.5857,-95.1222,29.6018 |
| BraeBurn Country Club | Houston | 18 | 20 | 20 | 61 | 8 | way/125353645 | -95.5280,29.6723,-95.5154,29.6817 |
| Champions Golf Club | Houston | 18 | 41 | 155 | 82 | 1 | relation/6545606 | -95.5381,29.9733,-95.5183,29.9954 |
| Houston National Golf Club | Houston | 18 | 18 | 76 | 61 | 5 | relation/4445263 | -95.6730,29.9190,-95.6595,29.9474 |
| Island Golf Course | Houston | 18 | 34 | 77 | 90 | 6 | way/219054001 | -95.1998,30.0252,-95.1889,30.0391 |
| Memorial Park Golf Course | Houston | 18 | 23 | 51 | 21 | 1 | relation/13729803 | -95.4424,29.7655,-95.4319,29.7772 |
| Pasadena Municipal Golf Course | Houston | 18 | 18 | 40 | 33 | 5 | way/42409070 | -95.1791,29.6103,-95.1742,29.6230 |
| River Oaks Country Club | Houston | 18 | 34 | 79 | 69 | 2 | way/123419610 | -95.4340,29.7520,-95.4223,29.7604 |
| River Terrace Golf Course | Houston | 18 | 17 | 19 | 30 | 7 | way/144169335 | -95.1429,29.8193,-95.1306,29.8269 |
| Sharpstown Country Club | Houston | 18 | 18 | 51 | 20 | 3 | relation/1705949 | -95.5344,29.7062,-95.5248,29.7141 |
| The Clubs of Kingwood - Deerwood | Houston | 18 | 20 | 80 | 51 | 0 | relation/5976409 | -95.1761,30.0374,-95.1554,30.0509 |
| The Clubs of Kingwood - Forest Course | Houston | 18 | 33 | 105 | 83 | 7 | relation/5976406 | -95.1912,30.0285,-95.1749,30.0469 |
| The Clubs of Kingwood - Lake Course | Houston | 18 | 21 | 59 | 52 | 3 | relation/5976407 | -95.2144,30.0313,-95.1977,30.0430 |
| Westwood Country Club | Houston | 18 | 18 | 56 | 62 | 4 | way/125353929 | -95.5491,29.6806,-95.5368,29.6880 |
| Wildcat Golf Club - Highlands Course | Houston | 18 | 19 | 22 | 42 | 5 | way/913325504 | -95.4238,29.6493,-95.4140,29.6637 |
| Member Course | Humble | 18 | 25 | 90 | 59 | 4 | way/193396473 | -95.2722,29.9157,-95.2582,29.9310 |
| Tour 18 | Humble | 18 | 23 | 47 | 73 | 3 | relation/11814661 | -95.2313,29.9803,-95.2193,29.9991 |
| Walden on Lake Houston Golf & Country Club | Humble | 18 | 18 | 67 | 41 | 7 | relation/17014156 | -95.1605,29.9806,-95.1449,29.9971 |
| Golf Club at Star Ranch | Hutto | 18 | 28 | 71 | 72 | 1 | way/30828196 | -97.5888,30.4996,-97.5779,30.5190 |
| Las Colinas Country Club | Irving | 18 | 21 | 18 | 59 | 0 | way/25921985 | -96.9502,32.8518,-96.9304,32.8643 |
| (unnamed) | Jasper County | 18 | 20 | 55 | 61 | 6 | relation/20984088 | -94.0309,31.0620,-94.0090,31.0741 |
| Meadowbrook Farms Golf Club | Katy | 18 | 18 | 70 | 38 | 2 | way/107268266 | -95.8042,29.7042,-95.7781,29.7178 |
| Willow Fork Country Club | Katy | 18 | 18 | 48 | 64 | 4 | relation/1528669 | -95.7531,29.7256,-95.7373,29.7418 |
| Sky Creek Ranch **(live)** | Keller | 18 | 20 | 66 | 24 | 6 | way/356055952 | -97.2187,32.9193,-97.1901,32.9274 |
| King's Creek Country Club | Kemp | 18 | 19 | 27 | 8 | 7 | way/386836594 | -96.2503,32.3991,-96.2419,32.4086 |
| The Clubs of Cordillera Ranch | Kendall County | 18 | 19 | 60 | 81 | 3 | way/1326372740 | -98.6122,29.8323,-98.5997,29.8535 |
| Legends Golf Course | Kingsland | 18 | 19 | 1 | 1 | 0 | way/995995188 | -98.4387,30.6606,-98.4161,30.6721 |
| Bay Forest Golf Club | La Porte | 18 | 20 | 74 | 20 | 5 | way/51557948 | -95.0281,29.6314,-95.0195,29.6458 |
| South Padre Island Golf Club | Laguna Vista | 18 | 18 | 49 | 42 | 1 | relation/19071561 | -97.3112,26.1008,-97.2958,26.1185 |
| Lajitas Golf and Resort | Lajitas | 18 | 19 | 69 | 47 | 2 | relation/20391599 | -103.7779,29.2427,-103.7503,29.2606 |
| The Wilderness Golf Course | Lake Jackson Farms | 18 | 20 | 63 | 47 | 1 | way/215254770 | -95.4911,29.0399,-95.4767,29.0474 |
| Lake Kiowa Golf Course | Lake Kiowa | 18 | 20 | 29 | 21 | 8 | relation/21019694 | -97.0224,33.5574,-97.0126,33.5898 |
| Yaupon Golf Course | Lakeway | 18 | 18 | 48 | 53 | 2 | relation/17646835 | -97.9777,30.3514,-97.9584,30.3678 |
| Lake Park Golf Club Championship Course **(live)** | Lewisville | 18 | 21 | 40 | 5 | 0 | way/336438232 | -97.0089,33.0658,-96.9955,33.0743 |
| Lake Park Golf Club Executive Course **(live)** | Lewisville | 9 | 13 | 19 | 2 | 0 | way/336437861 | -97.0124,33.0663,-97.0064,33.0717 |
| Pinecrest Country Club | Longview | 18 | 23 | 44 | 27 | 7 | way/439220012 | -94.7047,32.4810,-94.6992,32.4983 |
| Lubbock Country Club | Lubbock | 18 | 22 | 69 | 44 | 7 | way/220972529 | -101.8426,33.6282,-101.8362,33.6381 |
| Rawls Golf Course | Lubbock | 18 | 24 | 66 | 91 | 5 | way/177621745 | -101.8988,33.5944,-101.8880,33.6067 |
| High Meadow Ranch Golf Club | Magnolia | 18 | 21 | 86 | 68 | 7 | relation/6545607 | -95.7465,30.1515,-95.7239,30.1714 |
| Lake Windcrest Golf Club | Magnolia | 18 | 18 | 94 | 63 | 8 | relation/7065970 | -95.6225,30.2098,-95.5973,30.2218 |
| Eldorado Country Club | McKinney | 18 | 24 | 60 | 30 | 5 | way/548019653 | -96.6596,33.1736,-96.6416,33.1851 |
| Oak Hollow Golf Course **(live)** | McKinney | 18 | 18 | 57 | 5 | 2 | way/595547029 | -96.6247,33.2235,-96.6127,33.2294 |
| TPC Craig Ranch | McKinney | 18 | 21 | 77 | 83 | 7 | way/448674021 | -96.7277,33.1301,-96.7182,33.1520 |
| Westridge Golf Course | McKinney | 9 | 12 | 34 | 18 | 3 | way/595547873 | -96.7437,33.1891,-96.7331,33.2033 |
| Battle Lake Golf Club | McLennan County | 18 | 20 | 35 | 1 | 6 | way/798177674 | -96.9031,31.5311,-96.8933,31.5493 |
| Holiday Hills Country Club | Mineral Wells | 18 | 20 | 38 | 14 | 1 | way/31769274 | -98.0674,32.8108,-98.0571,32.8172 |
| Sienna Golf Club | Missouri City | 18 | 19 | 61 | 23 | 7 | relation/5451829 | -95.5405,29.4881,-95.5127,29.4995 |
| Eagle Pointe Golf Club | Mont Belvieu | 18 | 18 | 19 | 29 | 5 | way/681156783 | -94.8679,29.8718,-94.8513,29.8804 |
| Bluejack National Golf Club | Montgomery County | 18 | 20 | 64 | 43 | 3 | way/1481663183 | -95.7968,30.3085,-95.7838,30.3190 |
| Grand Lake Estates | Montgomery County | 18 | 18 | 22 | 47 | 4 | way/1184326104 | -95.6495,30.2677,-95.6324,30.2845 |
| Turtle Hill Golf Course | Muenster | 18 | 20 | 55 | 12 | 3 | way/986787668 | -97.3823,33.7531,-97.3730,33.7642 |
| Landa Park Golf Course | New Braunfels | 18 | 19 | 68 | 35 | 3 | relation/2705270 | -98.1349,29.7082,-98.1222,29.7159 |
| Iron Horse Golf Course **(live)** | North Richland Hills | 18 | 20 | 76 | 17 | 5 | relation/5146870 | -97.2601,32.8316,-97.2490,32.8487 |
| Pearland Golf Club | Pearland | 18 | 25 | 93 | 100 | 8 | relation/17047914 | -95.3823,29.5763,-95.3640,29.5882 |
| Pecan Plantation Country Club | Pecan Plantation | 18 | 20 | 50 | 24 | 4 | way/1568768688 | -97.6915,32.3473,-97.6765,32.3674 |
| Idylwild Golf Club | Pinewood Estates | 18 | 18 | 31 | 20 | 7 | way/1458652887 | -94.3347,30.1546,-94.3167,30.1681 |
| Pecan Hollow Golf Course | Plano | 18 | 24 | 1 | 40 | 0 | way/280162269 | -96.6436,33.0095,-96.6312,33.0190 |
| Highland Pines Golf Club | Porter | 18 | 18 | 71 | 31 | 3 | way/1234945362 | -95.3342,30.1247,-95.3137,30.1417 |
| Oakhurst Golf Club | Porter | 18 | 18 | 54 | 56 | 5 | relation/6124798 | -95.2641,30.0730,-95.2515,30.0929 |
| Gentle Creek Country Club | Prosper | 18 | 20 | 74 | 64 | 1 | relation/17951191 | -96.7656,33.2479,-96.7462,33.2590 |
| Rockwall Golf and Athletic Club **(live)** | Rockwall | 18 | 20 | 68 | 61 | 7 | way/675683662 | -96.4964,32.9442,-96.4736,32.9584 |
| Forest Creek Golf Club | Round Rock | 18 | 19 | 66 | 40 | 8 | relation/16666504 | -97.6133,30.5064,-97.5913,30.5182 |
| Teravista Golf Club | Round Rock | 18 | 18 | 97 | 73 | 4 | relation/8082143 | -97.6821,30.5619,-97.6531,30.5812 |
| Brackenridge Golf Course | San Antonio | 18 | 20 | 56 | 62 | 7 | way/131693205 | -98.4835,29.4459,-98.4728,29.4560 |
| Dominion Country Club | San Antonio | 18 | 19 | 52 | 64 | 4 | relation/1199854 | -98.6251,29.6373,-98.6095,29.6636 |
| Golf Club of Texas | San Antonio | 18 | 18 | 70 | 40 | 6 | way/302534362 | -98.7668,29.3777,-98.7498,29.3927 |
| Quarry Golf Club | San Antonio | 18 | 20 | 60 | 39 | 6 | way/79107604 | -98.4812,29.4918,-98.4708,29.5055 |
| San Antonio Country Club | San Antonio | 18 | 22 | 65 | 32 | 1 | way/30448008 | -98.4608,29.4612,-98.4532,29.4682 |
| Silverhorn Golf Club | San Antonio | 18 | 19 | 55 | 30 | 0 | relation/21038991 | -98.5090,29.5621,-98.5011,29.5773 |
| Kissing Tree Golf Club | San Marcos | 18 | 18 | 71 | 25 | 5 | relation/19131633 | -98.0108,29.8338,-97.9897,29.8564 |
| Max Starcke Park Golf Course | Seguin | 18 | 19 | 28 | 25 | 2 | way/182836178 | -97.9802,29.5509,-97.9695,29.5585 |
| Stone Creek Golf Club | Sherman | 18 | 18 | 73 | 63 | 8 | way/1085233072 | -96.6280,33.6041,-96.6095,33.6223 |
| Cypresswood Golf Club | Spring | 18 | 35 | 103 | 119 | 8 | way/192975264 | -95.3517,30.0277,-95.3098,30.0482 |
| Windrose Golf Club | Spring | 18 | 18 | 75 | 31 | 0 | relation/6154881 | -95.5214,30.0539,-95.5028,30.0672 |
| University of Texas Golf Club | Steiner Ranch | 18 | 20 | 94 | 53 | 5 | relation/3475699 | -97.8981,30.3469,-97.8848,30.3679 |
| Greatwood Golf Club | Sugar Land | 18 | 18 | 49 | 78 | 2 | relation/6004130 | -95.6866,29.5455,-95.6685,29.5630 |
| Sweetwater Country Club | Sugar Land | 18 | 36 | 134 | 102 | 8 | relation/4491651 | -95.6331,29.5637,-95.5932,29.5781 |
| Texarkana Golf Ranch | Texarkana | 18 | 20 | 72 | 41 | 4 | way/296932154 | -94.1154,33.4904,-94.1022,33.5051 |
| The Tribute at The Colony Golf Club **(live)** | The Colony | 18 | 23 | 90 | 130 | 1 | way/297400644 | -96.9431,33.0939,-96.9271,33.1061 |
| Jack Nicklaus Signature Golf Course at Carlton Woods | The Woodlands | 18 | 18 | 83 | 61 | 1 | relation/5500982 | -95.5580,30.1881,-95.5374,30.2022 |
| Palmer Course - Deacon nine | The Woodlands | 9 | 9 | 42 | 29 | 1 | relation/1703127 | -95.5282,30.1928,-95.5178,30.2037 |
| Palmer Course - King nine | The Woodlands | 9 | 11 | 40 | 34 | 4 | relation/1703101 | -95.5234,30.1805,-95.5118,30.1899 |
| Panther Trail | The Woodlands | 18 | 18 | 100 | 45 | 5 | relation/6531145 | -95.4931,30.1435,-95.4712,30.1564 |
| Tom Fazio Championship Course at Carlton Woods | The Woodlands | 18 | 21 | 89 | 67 | 2 | way/1211840154 | -95.5454,30.1528,-95.5275,30.1670 |
| Austin Golf Course | Travis County | 18 | 21 | 53 | 66 | 3 | way/253740948 | -98.1061,30.4036,-98.0892,30.4156 |
| Barton Creek Crenshaw Cliffside | Travis County | 26 | 27 | 86 | 55 | 4 | way/709072894 | -97.8606,30.2774,-97.8488,30.2898 |
| Barton Creek Fazio Canyons | Travis County | 18 | 24 | 81 | 52 | 4 | relation/3778021 | -97.8870,30.2633,-97.8686,30.2776 |
| (unnamed) | Trinity County | 18 | 26 | 16 | 81 | 82 | way/1472122122 | -95.2584,30.9404,-95.2326,30.9570 |
| (unnamed) | Trophy Club | 9 | 9 | 18 | 36 | 0 | relation/9601799 | -97.1862,32.9920,-97.1712,33.0002 |
| Hilltop Country Club | Troup | 9 | 9 | 13 | 5 | 2 | way/550970901 | -95.1163,32.1526,-95.1068,32.1598 |
| The Club at Colony Creek | Victoria | 18 | 18 | 44 | 38 | 1 | relation/4541324 | -96.9588,28.8259,-96.9440,28.8390 |
| Victoria Country Club | Victoria | 18 | 18 | 63 | 33 | 2 | way/325339133 | -97.0106,28.8457,-96.9982,28.8596 |
| Lake Waco Golf Club | Waco | 18 | 37 | 45 | 18 | 4 | way/480915043 | -97.2573,31.6025,-97.2439,31.6151 |
| Ridgewood Country Club | Waco | 18 | 21 | 46 | 56 | 4 | relation/16099134 | -97.2260,31.5270,-97.2146,31.5409 |
| Canyon West Golf Course | Weatherford | 18 | 18 | 65 | 20 | 4 | way/299872263 | -97.9125,32.6962,-97.9013,32.7108 |
| Hawks Creek Golf Club **(live)** | Westworth Village | 18 | 18 | 55 | 35 | 8 | relation/7463411 | -97.4352,32.7559,-97.4214,32.7656 |
| River Creek Park Golf Course | Wichita Falls | 18 | 19 | 36 | 3 | 2 | way/820360062 | -98.4895,34.0499,-98.4839,34.0613 |
| Webb Hill Country Club | Wolfe City | 18 | 18 | 19 | 22 | 5 | way/1270681861 | -96.1151,33.3115,-96.1010,33.3176 |

### 2. Hole lines but gaps: greens, tees or bunkers missing, or a hole count that isn't 9 or 18 (62)

| Course | Place | Holes | Greens | Tees | Bunkers | Fairways | OSM | bbox (W,S,E,N) |
|---|---|--:|--:|--:|--:|--:|---|---|
| Albany Golf Club | Albany | 9 | 9 | 11 | 0 | 0 | way/763503560 | -99.3034,32.7312,-99.2988,32.7377 |
| Tascosa Golf Club - La Paloma | Amarillo | 9 | 9 | 8 | 0 | 7 | way/722668266 | -101.9065,35.2356,-101.8947,35.2425 |
| Tascosa Golf Club - La Paloma Course | Amarillo | 9 | 9 | 9 | 0 | 10 | way/722668267 | -101.8950,35.2357,-101.8843,35.2409 |
| Archer City Country Club | Archer City | 9 | 10 | 13 | 0 | 2 | way/1156225128 | -98.6359,33.5808,-98.6310,33.5866 |
| Lake Arlington Golf Course | Arlington | 18 | 21 | 47 | 0 | 1 | way/412547642 | -97.1981,32.7131,-97.1824,32.7243 |
| Shady Oaks Golf Course | Baird | 18 | 0 | 0 | 0 | 0 | way/39679858 | -99.4546,32.4004,-99.4462,32.4070 |
| (unnamed) | Beaumont | 18 | 21 | 0 | 60 | 62 | way/779741615 | -94.1112,30.1290,-94.0963,30.1359 |
| Benbrook Lighted Par 3 and Range | Benbrook | 9 | 9 | 9 | 0 | 0 | way/1577606528 | -97.4760,32.6609,-97.4716,32.6650 |
| The Hideout | Brownwood | 18 | 0 | 0 | 0 | 0 | relation/18318500 | -99.0518,31.7958,-99.0383,31.8187 |
| Hidden Creek Golf Course | Burleson | 18 | 6 | 22 | 10 | 3 | way/667757954 | -97.3180,32.5256,-97.3096,32.5397 |
| (unnamed) | Carrollton | 9 | 11 | 23 | 0 | 10 | way/645686052 | -96.8641,32.9599,-96.8538,32.9651 |
| Walden on Lake Conroe | Conroe | 17 | 18 | 49 | 91 | 15 | relation/8763534 | -95.6356,30.3855,-95.6169,30.4037 |
| Corpus Christi Country Club Golf Course | Corpus Christi | 9 | 0 | 0 | 0 | 0 | relation/2605220 | -97.3963,27.6879,-97.3828,27.6994 |
| Corsicana Country Club | Corsicana | 18 | 19 | 0 | 39 | 0 | way/321352658 | -96.5152,32.1216,-96.5031,32.1317 |
| Brook Hollow Golf Club | Dallas | 18 | 19 | 0 | 0 | 15 | way/27111495 | -96.8718,32.8266,-96.8616,32.8364 |
| Trinity Forest Golf Club | Dallas | 18 | 18 | 0 | 117 | 2 | relation/13643297 | -96.7248,32.7044,-96.7089,32.7122 |
| Austin Bayou Golf Course | Danbury | 9 | 9 | 9 | 0 | 3 | way/1017745078 | -95.3660,29.2886,-95.3548,29.2967 |
| Thorntree Golf Club | DeSoto | 18 | 1 | 0 | 0 | 0 | relation/9347183 | -96.8890,32.6188,-96.8744,32.6255 |
| Heritage Ranch Golf & Country Club | Fairview | 10 | 17 | 41 | 29 | 1 | way/570328263 | -96.5970,33.1306,-96.5872,33.1421 |
| Brookhaven Country Club | Farmers Branch | 18 | 2 | 0 | 112 | 0 | relation/4242546 | -96.8730,32.9267,-96.8569,32.9487 |
| Bridlewood Golf Course **(live)** | Flower Mound | 17 | 21 | 77 | 53 | 3 | relation/9297809 | -97.1095,33.0418,-97.0875,33.0590 |
| (unnamed) | Fort Worth | 15 | 17 | 44 | 47 | 8 | way/1215810307 | -97.3040,32.5514,-97.2846,32.5607 |
| Gilmer Country Club | Gilmer | 9 | 10 | 15 | 0 | 4 | way/708370253 | -94.9612,32.6932,-94.9525,32.6985 |
| Cottonwood Creek Country Club | Harlingen | 9 | 0 | 0 | 0 | 0 | way/1337838568 | -97.6911,26.1449,-97.6857,26.1517 |
| Treasure Hills Golf Club | Harlingen | 16 | 18 | 45 | 31 | 4 | relation/17347561 | -97.6568,26.1743,-97.6370,26.1857 |
| Driftwood Golf Course | Hays County | 18 | 18 | 18 | 0 | 1 | way/1385835998 | -98.0044,30.1228,-97.9873,30.1321 |
| Holly Lake Ranch Golf Club | Holly Lake Ranch | 18 | 19 | 0 | 11 | 2 | relation/11372870 | -95.1998,32.7107,-95.1853,32.7269 |
| Lakeside Country Club | Houston | 17 | 23 | 38 | 66 | 13 | way/123746318 | -95.5884,29.7570,-95.5758,29.7666 |
| Raven Nest Golf Club | Huntsville | 12 | 15 | 60 | 30 | 3 | way/480142792 | -95.5705,30.6954,-95.5591,30.7039 |
| Irving Golf Club | Irving | 18 | 2 | 0 | 1 | 0 | way/318383971 | -96.9206,32.7843,-96.9081,32.8012 |
| Comanche Trace | Kerr County | 16 | 26 | 99 | 76 | 6 | relation/19347199 | -99.1341,29.9637,-99.1169,29.9915 |
| (unnamed) | La Ward | 18 | 17 | 0 | 68 | 1 | relation/12799925 | -96.4842,28.7428,-96.4717,28.7512 |
| Country View Golf Club | Lancaster | 18 | 19 | 0 | 0 | 0 | way/671879541 | -96.7718,32.5728,-96.7580,32.5849 |
| Crystal Falls Golf Course | Leander | 18 | 19 | 52 | 0 | 7 | relation/7363676 | -97.8943,30.5254,-97.8745,30.5465 |
| Point Venture Golf Club | Leander | 9 | 9 | 10 | 0 | 9 | relation/17639979 | -98.0034,30.3813,-97.9911,30.3871 |
| (unnamed) | Livingston | 18 | 19 | 0 | 12 | 3 | relation/18379214 | -94.9530,30.6949,-94.9400,30.7072 |
| (unnamed) | Lockhart | 9 | 9 | 0 | 0 | 0 | way/1272924400 | -97.7023,29.8477,-97.6943,29.8554 |
| Alpine Golf Course | Longview | 18 | 20 | 18 | 0 | 18 | way/264964469 | -94.7026,32.5321,-94.6939,32.5384 |
| Mansfield National Golf Club | Mansfield | 18 | 0 | 0 | 0 | 0 | way/299872303 | -97.0827,32.5511,-97.0699,32.5710 |
| Oak Course | Mansfield | 18 | 0 | 0 | 0 | 0 | way/664506572 | -97.1196,32.5753,-97.1020,32.5893 |
| Pecan Course | Mansfield | 18 | 0 | 0 | 0 | 0 | relation/9232829 | -97.1278,32.5764,-97.1182,32.5966 |
| (unnamed) | McKinney | 12 | 15 | 60 | 42 | 7 | way/518438378 | -96.6936,33.1758,-96.6816,33.1875 |
| Stonebridge Ranch | McKinney | 17 | 26 | 76 | 74 | 13 | way/518448847 | -96.7234,33.1880,-96.7086,33.2023 |
| Mesquite Municipal Golf Course | Mesquite | 18 | 21 | 1 | 0 | 4 | way/30742252 | -96.6214,32.8347,-96.6040,32.8440 |
| Nueva Vista Golf Club | Midland | 18 | 21 | 0 | 0 | 16 | way/180295808 | -102.1765,31.9984,-102.1644,32.0104 |
| Ranchland Hills Country Club | Midland | 17 | 19 | 56 | 40 | 3 | way/403305557 | -102.0670,32.0285,-102.0570,32.0349 |
| Mineola Country Club | Mineola | 10 | 11 | 14 | 0 | 0 | way/515444377 | -95.5086,32.6659,-95.5028,32.6721 |
| (unnamed) | Nocona | 18 | 18 | 32 | 0 | 3 | way/161233270 | -97.7415,33.7709,-97.7305,33.7834 |
| Olton Country Club | Olton | 9 | 9 | 10 | 0 | 7 | way/1177259290 | -102.1454,34.1337,-102.1403,34.1424 |
| Ridgeview Ranch Golf Course | Plano | 17 | 19 | 69 | 77 | 10 | relation/9848761 | -96.7496,33.1040,-96.7336,33.1214 |
| (unnamed) | Port Aransas | 9 | 7 | 20 | 15 | 3 | way/348101778 | -97.0900,27.7966,-97.0804,27.8040 |
| (unnamed) | Rancho Viejo | 9 | 8 | 27 | 30 | 1 | way/155816744 | -97.5655,26.0321,-97.5529,26.0487 |
| Lakeside Village Golf Course | Rockwall | 10 | 11 | 21 | 5 | 0 | way/1505434706 | -96.4791,32.8970,-96.4716,32.9021 |
| Stone River Golf Club | Royse City | 18 | 17 | 18 | 0 | 0 | way/1097057989 | -96.3178,32.9522,-96.3064,32.9616 |
| Quicksand Golf Course | San Angelo | 18 | 22 | 0 | 86 | 98 | way/148396150 | -100.4047,31.4568,-100.3841,31.4722 |
| San Pedro Driving Range & Par 3 Course | San Antonio | 9 | 9 | 27 | 0 | 0 | way/1279097198 | -98.4991,29.4893,-98.4935,29.4939 |
| Sinton Municipal Golf Course | Sinton | 17 | 17 | 0 | 0 | 0 | way/1539751203 | -97.5349,28.0609,-97.5214,28.0768 |
| Timarron Golf Course | Southlake | 17 | 19 | 73 | 45 | 21 | relation/9794821 | -97.1519,32.9130,-97.1293,32.9262 |
| Sugar Creek Country Club | Sugar Land | 17 | 43 | 138 | 203 | 44 | way/216961892 | -95.6108,29.6057,-95.5861,29.6247 |
| Houston Oaks Country Club - Oaks Course | Waller County | 18 | 18 | 0 | 0 | 8 | way/205086046 | -95.8396,30.0951,-95.8314,30.1066 |
| Windcrest Golf Club | Windcrest | 18 | 10 | 14 | 8 | 9 | way/79661221 | -98.3816,29.5166,-98.3742,29.5188 |
| Los Ebanos Golf Course | Zapata | 9 | 11 | 0 | 0 | 0 | way/1164327098 | -99.2760,26.8942,-99.2692,26.9007 |

### 3. Shapes but no (or few) hole lines (140)

Greens, tees, bunkers or fairways mapped, but under 9 hole lines: holes would have to be routed
from the scorecard or course map (as Lantana and Prairie Lakes were), or built from a yardage book.

| Course | Place | Holes | Greens | Tees | Bunkers | Fairways | OSM | bbox (W,S,E,N) |
|---|---|--:|--:|--:|--:|--:|---|---|
| Diamondback Golf Club | Abilene | 0 | 19 | 0 | 17 | 0 | way/299872284 | -99.7002,32.4015,-99.6879,32.4088 |
| Mesquite Grove Golf Course | Abilene | 0 | 1 | 0 | 10 | 0 | way/299872316 | -99.8253,32.4221,-99.8094,32.4327 |
| Tommy Hale Short Game Center | Abilene | 0 | 2 | 0 | 2 | 0 | way/1327284074 | -99.7387,32.4797,-99.7372,32.4806 |
| Alpine Country Club | Alpine | 0 | 9 | 0 | 0 | 0 | way/142506515 | -103.6633,30.3651,-103.6575,30.3715 |
| Amarillo Country Club | Amarillo | 0 | 19 | 0 | 54 | 2 | way/428057395 | -101.8933,35.2060,-101.8842,35.2132 |
| Comanche Trail Golf Course | Amarillo | 0 | 113 | 5 | 59 | 11 | way/552434102 | -101.8115,35.1531,-101.7955,35.1771 |
| Ross Rogers Public Golf Course | Amarillo | 0 | 2 | 0 | 3 | 0 | way/687917077 | -101.8487,35.2365,-101.8369,35.2508 |
| Balcones Country Club | Austin | 0 | 7 | 0 | 15 | 0 | way/30903717 | -97.7968,30.4357,-97.7808,30.4448 |
| Great Hills Golf Club | Austin | 0 | 0 | 0 | 4 | 0 | way/31099449 | -97.7711,30.3964,-97.7680,30.4016 |
| Grey Rock Golf Course | Austin | 0 | 10 | 19 | 33 | 11 | way/188600547 | -97.9226,30.1764,-97.9040,30.1963 |
| Flying L Golf Course and Guest Ranch | Bandera County | 0 | 20 | 0 | 25 | 0 | way/796565671 | -99.0583,29.7003,-99.0339,29.7183 |
| (unnamed) | Bastrop County | 0 | 1 | 7 | 7 | 0 | way/297050569 | -97.4500,30.1659,-97.4463,30.1685 |
| (unnamed) | Bastrop County | 1 | 18 | 37 | 12 | 0 | relation/17699559 | -97.2704,30.0473,-97.2614,30.0637 |
| ColoVista Golf Club | Bastrop County | 1 | 20 | 41 | 12 | 0 | relation/17699558 | -97.2701,30.0477,-97.2587,30.0637 |
| Bay City Country Club | Bay City | 0 | 12 | 19 | 17 | 1 | way/547762058 | -96.0198,28.9741,-96.0120,28.9805 |
| (unnamed) | Beaumont | 0 | 18 | 19 | 0 | 2 | way/1125678350 | -94.2060,30.0239,-94.1895,30.0382 |
| (unnamed) | Beaumont | 0 | 1 | 0 | 0 | 0 | way/259830643 | -94.0773,30.0430,-94.0771,30.0433 |
| Lackland Golf Course | Bexar County | 0 | 18 | 6 | 30 | 0 | way/79581118 | -98.6139,29.3890,-98.6028,29.4012 |
| Comanche Trail Municipal Golf Course | Big Spring | 1 | 1 | 0 | 0 | 2 | way/415387547 | -101.4857,32.2050,-101.4676,32.2226 |
| (unnamed) | Briarcliff | 0 | 7 | 0 | 0 | 0 | relation/17650833 | -98.0548,30.3943,-98.0485,30.4037 |
| Brownsville Memorial Golf Course | Brownsville | 0 | 17 | 0 | 11 | 0 | way/27444854 | -97.4967,25.8808,-97.4903,25.8914 |
| Goodman Aggie Golf Complex | Bryan | 0 | 7 | 1 | 7 | 3 | way/405352190 | -96.3871,30.5992,-96.3835,30.6023 |
| Miramont Country Club | Bryan | 0 | 1 | 0 | 34 | 0 | way/676771771 | -96.3155,30.6646,-96.2966,30.6818 |
| Traditions Club | Bryan | 1 | 18 | 13 | 11 | 20 | way/485951552 | -96.4000,30.6019,-96.3816,30.6202 |
| Mountain Valley Country Club (Disused) | Burleson | 0 | 18 | 10 | 0 | 0 | way/1409246661 | -97.3762,32.4791,-97.3594,32.4966 |
| (unnamed) | Cameron County | 0 | 17 | 18 | 6 | 0 | way/666154429 | -97.2049,26.0627,-97.2008,26.0678 |
| Chambers County Golf Course | Chambers County | 0 | 19 | 0 | 0 | 0 | way/1117304136 | -94.6391,29.8309,-94.6280,29.8362 |
| (unnamed) | Comanche County | 0 | 3 | 3 | 0 | 1 | relation/19609368 | -98.5182,31.9620,-98.5086,31.9734 |
| Conroe Country Club | Conroe | 1 | 10 | 10 | 15 | 1 | way/346308142 | -95.5029,30.3146,-95.4933,30.3234 |
| Links at West Fork Golf Course | Conroe | 0 | 19 | 18 | 0 | 0 | relation/7065794 | -95.5302,30.3221,-95.5079,30.3315 |
| Riverchase Golf Course | Coppell | 8 | 7 | 11 | 6 | 0 | way/28780020 | -96.9571,32.9525,-96.9421,32.9637 |
| (unnamed) | Crandall | 2 | 0 | 1 | 1 | 0 | way/668282182 | -96.4464,32.6233,-96.4432,32.6258 |
| Crane County Golf Course | Crane County | 0 | 0 | 0 | 0 | 10 | way/413740607 | -102.3595,31.4254,-102.3532,31.4317 |
| (unnamed) | Dallas | 0 | 1 | 0 | 0 | 0 | way/746178710 | -96.9854,32.6937,-96.9760,32.7057 |
| Lakewood Country Club golf course | Dallas | 0 | 6 | 0 | 0 | 0 | way/28545583 | -96.7519,32.8083,-96.7395,32.8165 |
| Oak Cliff Country Club | Dallas | 0 | 4 | 0 | 0 | 0 | way/27915004 | -96.8549,32.6636,-96.8434,32.6716 |
| Preston Trail Golf Club | Dallas | 6 | 36 | 97 | 112 | 6 | way/288965669 | -96.8212,32.9770,-96.8070,32.9911 |
| Royal Oaks Country Club | Dallas | 0 | 2 | 3 | 4 | 20 | way/144950216 | -96.7660,32.8865,-96.7540,32.8985 |
| Decatur Golf Club | Decatur | 0 | 10 | 17 | 0 | 5 | way/473933702 | -97.5820,33.2586,-97.5761,33.2652 |
| Timberlinks Golf Course | Denton | 0 | 8 | 36 | 11 | 4 | way/130805180 | -97.0809,33.1783,-97.0743,33.1835 |
| Pheasant Trails Golf Course | Dumas | 0 | 13 | 0 | 9 | 2 | way/461060639 | -101.9629,35.9246,-101.9502,35.9362 |
| Brenham Country Club | Earlywine | 0 | 19 | 58 | 11 | 18 | way/1006500644 | -96.3609,30.2011,-96.3523,30.2126 |
| The Old Course at Odessa Country Club | Ector County | 0 | 0 | 0 | 0 | 18 | way/172842561 | -102.2897,31.8853,-102.2769,31.8980 |
| (unnamed) | El Paso | 1 | 1 | 3 | 0 | 0 | relation/6454797 | -106.3292,31.7548,-106.3090,31.7651 |
| Fair Oaks Country Club | Fair Oaks Ranch | 0 | 6 | 23 | 17 | 2 | relation/3233617 | -98.6594,29.7311,-98.6258,29.7543 |
| Heritage Ranch Golf & Country Club | Fairview | 7 | 8 | 26 | 16 | 1 | way/570328257 | -96.5984,33.1418,-96.5831,33.1500 |
| Heritage Ranch Golf & Country Club | Fairview | 5 | 12 | 18 | 18 | 0 | way/570328258 | -96.5985,33.1333,-96.5922,33.1424 |
| River Bend Golf Club | Floresville | 0 | 13 | 10 | 24 | 0 | relation/8065254 | -98.1948,29.1435,-98.1797,29.1594 |
| (unnamed) | Fort Worth | 0 | 10 | 33 | 12 | 4 | way/178757547 | -97.3008,32.7361,-97.2934,32.7440 |
| (unnamed) | Fort Worth | 1 | 1 | 2 | 1 | 0 | way/1216594149 | -97.2919,32.5499,-97.2902,32.5517 |
| (unnamed) | Fort Worth | 3 | 3 | 6 | 3 | 2 | way/1216594148 | -97.2934,32.5467,-97.2889,32.5511 |
| Ridgelea Country Club North Golf Course | Fort Worth | 0 | 28 | 35 | 46 | 5 | way/141986180 | -97.4232,32.7107,-97.4149,32.7226 |
| Willow Pond Golf Course | Frisco | 0 | 0 | 0 | 2 | 0 | way/468508376 | -96.8149,33.1169,-96.8145,33.1178 |
| Firewheel Golf Park **(live)** | Garland | 0 | 23 | 72 | 39 | 23 | relation/17812863 | -96.6409,32.9540,-96.6158,32.9842 |
| (unnamed) | Georgetown | 1 | 1 | 0 | 0 | 0 | way/662922637 | -97.7354,30.7153,-97.7337,30.7178 |
| Berry Creek Country Club | Georgetown | 0 | 18 | 0 | 35 | 0 | relation/17228760 | -97.6830,30.7012,-97.6624,30.7135 |
| Grand Oaks Golf Course | Grand Prairie | 0 | 5 | 0 | 0 | 0 | way/358615601 | -96.9982,32.6771,-96.9879,32.6912 |
| Prairie Lakes Golf Course **(live)** | Grand Prairie | 0 | 1 | 0 | 0 | 0 | way/29189913 | -96.9855,32.6939,-96.9749,32.7056 |
| Wright Park Golf Course | Greenville | 0 | 3 | 11 | 2 | 3 | way/550711827 | -96.0912,33.1148,-96.0836,33.1183 |
| (unnamed) | Harlingen | 0 | 4 | 0 | 3 | 0 | relation/18312671 | -97.7173,26.2343,-97.7148,26.2379 |
| Lochinvar Golf Club | Harris County | 0 | 19 | 18 | 0 | 0 | way/223723229 | -95.3853,29.9720,-95.3758,29.9837 |
| Hideaway Central | Hideaway | 3 | 11 | 32 | 27 | 9 | way/395699944 | -95.4585,32.4720,-95.4524,32.4847 |
| Hideaway East | Hideaway | 0 | 9 | 26 | 6 | 9 | way/403365007 | -95.4524,32.4726,-95.4463,32.4847 |
| Escondido Golf & Lake Club | Horseshoe Bay | 5 | 28 | 69 | 60 | 9 | relation/8064378 | -98.3922,30.5347,-98.3819,30.5501 |
| Ram Rock | Horseshoe Bay | 4 | 14 | 50 | 34 | 12 | relation/8064376 | -98.4121,30.5304,-98.3941,30.5473 |
| (unnamed) | Houston | 0 | 3 | 0 | 0 | 0 | way/211167277 | -95.5579,29.8274,-95.5558,29.8296 |
| Melrose Golf Course | Houston | 0 | 18 | 17 | 0 | 1 | way/319372646 | -95.3823,29.8758,-95.3738,29.8780 |
| Royal Oaks Country Club | Houston | 0 | 0 | 0 | 0 | 1 | relation/6003959 | -95.5890,29.7165,-95.5733,29.7308 |
| (unnamed) | Irving | 3 | 5 | 11 | 9 | 2 | way/359593921 | -96.9715,32.8597,-96.9649,32.8649 |
| (unnamed) | Jefferson County | 0 | 18 | 18 | 0 | 19 | way/1126242239 | -94.1649,29.9604,-94.1529,29.9772 |
| Gator National Golf Club | Kendall County | 4 | 4 | 0 | 2 | 4 | way/1530723226 | -98.6060,29.8562,-98.6050,29.8575 |
| Winkler County Golf Course | Kermit | 0 | 0 | 0 | 9 | 0 | way/1284671020 | -103.2153,31.8281,-103.2043,31.8372 |
| (unnamed) | Kerrville | 2 | 3 | 9 | 3 | 0 | way/1414286836 | -99.1179,29.9872,-99.1141,29.9916 |
| Scott Schreiner Golf Course | Kerrville | 0 | 19 | 57 | 23 | 16 | way/353723510 | -99.1303,30.0515,-99.1170,30.0616 |
| Plum Creek Golf Course | Kyle | 1 | 1 | 4 | 2 | 1 | way/650962093 | -97.8884,30.0203,-97.8859,30.0236 |
| Lantana Golf Club **(live)** | Lantana | 0 | 19 | 83 | 82 | 2 | relation/8107119 | -97.1299,33.0747,-97.1170,33.1046 |
| Levelland Country Club | Levelland | 0 | 0 | 0 | 3 | 0 | way/258955131 | -102.3774,33.5693,-102.3678,33.5724 |
| (unnamed) | Lewisville | 0 | 22 | 71 | 62 | 20 | way/335667016 | -96.9109,33.0275,-96.8890,33.0460 |
| (unnamed) | Lindale | 0 | 2 | 1 | 2 | 0 | way/395699565 | -95.4548,32.4707,-95.4524,32.4723 |
| (unnamed) | Longview | 0 | 0 | 2 | 0 | 1 | way/1252647694 | -94.7710,32.5658,-94.7671,32.5679 |
| Longview Country Club | Longview | 1 | 1 | 1 | 0 | 0 | way/423039752 | -94.8510,32.4851,-94.8447,32.4959 |
| Chaparral Ridge Golf Course | Lubbock | 0 | 11 | 0 | 1 | 0 | way/460874875 | -101.9406,33.5634,-101.9331,33.5706 |
| Hillcrest Golf & Country Club | Lubbock | 0 | 1 | 0 | 0 | 0 | way/472439137 | -101.8883,33.6358,-101.8772,33.6429 |
| Lakeridge Country Club | Lubbock | 0 | 19 | 49 | 21 | 22 | relation/4541370 | -101.9222,33.5053,-101.9050,33.5183 |
| Rio Colorado | Matagorda County | 0 | 14 | 31 | 32 | 1 | way/549843173 | -96.0137,28.9198,-95.9810,28.9260 |
| McAllen Country Club | McAllen | 2 | 2 | 0 | 5 | 1 | relation/9081806 | -98.2342,26.1710,-98.2211,26.1819 |
| (unnamed) | McKinney | 0 | 5 | 19 | 21 | 0 | way/518448852 | -96.7328,33.1847,-96.7253,33.1953 |
| (unnamed) | McKinney | 0 | 4 | 13 | 6 | 0 | way/518448854 | -96.7313,33.1824,-96.7227,33.1865 |
| (unnamed) | McKinney | 6 | 5 | 31 | 14 | 3 | way/518438372 | -96.6857,33.1794,-96.6769,33.1908 |
| Eldorado Country Club | McKinney | 1 | 1 | 7 | 3 | 1 | way/603232845 | -96.6565,33.1750,-96.6542,33.1800 |
| Stonebridge Ranch | McKinney | 2 | 2 | 9 | 10 | 1 | way/595547874 | -96.7143,33.2012,-96.7086,33.2035 |
| Hidden Falls Golf Course | Meadowlakes | 0 | 16 | 0 | 0 | 0 | relation/18288319 | -98.3017,30.5599,-98.2876,30.5759 |
| Green Tree Country Club | Midland | 0 | 0 | 0 | 80 | 0 | relation/20317581 | -102.1708,32.0484,-102.1546,32.0636 |
| Quail Valley Golf Course | Missouri City | 0 | 0 | 2 | 0 | 0 | way/216999896 | -95.5509,29.5765,-95.5444,29.5784 |
| (unnamed) | Mitchell County | 3 | 4 | 6 | 0 | 1 | way/661327746 | -100.8321,32.4095,-100.8260,32.4155 |
| Bentwater | Montgomery County | 0 | 1 | 6 | 2 | 0 | way/629642112 | -95.6298,30.4188,-95.6263,30.4240 |
| The Golf Club at La Torretta | Montgomery County | 5 | 5 | 11 | 22 | 4 | relation/8763533 | -95.6448,30.3949,-95.6294,30.4042 |
| Woodforest Golf Club | Montgomery County | 1 | 39 | 30 | 68 | 0 | relation/5714645 | -95.5770,30.2646,-95.5491,30.2808 |
| (unnamed) | Nacogdoches County | 0 | 19 | 46 | 20 | 8 | way/1362044362 | -94.6902,31.5357,-94.6801,31.5438 |
| Ratliff Ranch Golf Links | Odessa | 0 | 6 | 12 | 5 | 16 | way/412265310 | -102.3639,31.9198,-102.3514,31.9329 |
| Sunset Country Club Golf Course | Odessa | 0 | 0 | 0 | 0 | 18 | way/177696033 | -102.4137,31.9391,-102.4047,31.9520 |
| The Links Course at The Odessa Country Club | Odessa | 0 | 0 | 0 | 0 | 4 | way/402377924 | -102.2769,31.9060,-102.2723,31.9142 |
| Palacios Golf Course | Palacios | 0 | 0 | 0 | 1 | 0 | way/562094050 | -96.2624,28.7215,-96.2551,28.7285 |
| Panorama Golf Club | Panorama Village | 0 | 3 | 16 | 6 | 0 | relation/7065748 | -95.5015,30.3706,-95.4959,30.3801 |
| (unnamed) | Pecan Plantation | 1 | 2 | 4 | 0 | 0 | way/1298886604 | -97.6738,32.3583,-97.6691,32.3614 |
| (unnamed) | Pecan Plantation | 1 | 1 | 3 | 1 | 0 | way/1298886609 | -97.6682,32.3635,-97.6633,32.3646 |
| (unnamed) | Pecan Plantation | 3 | 3 | 11 | 6 | 1 | way/1298886608 | -97.6715,32.3660,-97.6690,32.3708 |
| (unnamed) | Pecan Plantation | 6 | 7 | 21 | 2 | 1 | way/1298886606 | -97.6753,32.3599,-97.6630,32.3644 |
| Blackhawk Golf Club | Pflugerville | 1 | 3 | 6 | 0 | 2 | way/30799831 | -97.5844,30.4630,-97.5713,30.4755 |
| (unnamed) | Plano | 1 | 2 | 3 | 7 | 1 | way/529269879 | -96.8521,33.0382,-96.8416,33.0449 |
| Gleneagles Country Club | Plano | 0 | 5 | 5 | 10 | 1 | relation/6395350 | -96.8199,33.0139,-96.8005,33.0434 |
| (unnamed) | Port Aransas | 3 | 3 | 12 | 6 | 1 | way/340558350 | -97.0959,27.7955,-97.0909,27.7997 |
| (unnamed) | Rancho Viejo | 3 | 2 | 9 | 9 | 1 | way/155816757 | -97.5568,26.0404,-97.5541,26.0460 |
| (unnamed) | Rancho Viejo | 3 | 3 | 10 | 9 | 0 | way/931601362 | -97.5532,26.0311,-97.5458,26.0353 |
| (unnamed) | Rancho Viejo | 4 | 3 | 6 | 14 | 0 | way/856443991 | -97.5563,26.0397,-97.5481,26.0448 |
| (unnamed) | Rancho Viejo | 6 | 6 | 24 | 26 | 1 | way/155816758 | -97.5571,26.0340,-97.5490,26.0399 |
| (unnamed) | Rancho Viejo | 3 | 4 | 14 | 12 | 0 | way/155816754 | -97.5590,26.0386,-97.5551,26.0462 |
| Sherrill Park Golf Course **(live)** | Richardson | 0 | 1 | 0 | 1 | 0 | way/97535016 | -96.6951,32.9784,-96.6841,32.9959 |
| (unnamed) | Richmond | 0 | 1 | 0 | 6 | 0 | relation/7158854 | -95.7436,29.6194,-95.7264,29.6365 |
| Mountain Creek Golf Club | Robert Lee | 1 | 8 | 1 | 0 | 0 | way/541980187 | -100.4818,31.8930,-100.4764,31.8980 |
| Waterview Golf Club | Rowlett | 0 | 17 | 89 | 55 | 0 | way/523314770 | -96.5444,32.9421,-96.5236,32.9601 |
| (unnamed) | San Antonio | 7 | 10 | 34 | 23 | 10 | way/1525365892 | -98.6794,29.4483,-98.6687,29.4565 |
| Mission Del Lago Golf Course | San Antonio | 0 | 19 | 60 | 50 | 19 | way/79437456 | -98.4860,29.2839,-98.4765,29.3053 |
| Riverside Golf Course | San Antonio | 0 | 28 | 48 | 41 | 0 | relation/4037636 | -98.4898,29.3706,-98.4827,29.3865 |
| The Dominion Golf Course Dry Creek | San Antonio | 0 | 1 | 0 | 1 | 0 | way/1550286338 | -98.6222,29.6589,-98.6206,29.6600 |
| (unnamed) | San Felipe | 3 | 17 | 17 | 11 | 14 | way/1356289092 | -96.1089,29.8099,-96.1020,29.8209 |
| Pedernales Golf Club | Spicewood | 0 | 10 | 0 | 0 | 0 | relation/17650834 | -98.0581,30.3943,-98.0485,30.4060 |
| Mustang Creek Golf Course | Taylor | 0 | 8 | 0 | 0 | 3 | way/660808741 | -97.4187,30.5525,-97.4121,30.5584 |
| Northridge Country Club | Texarkana | 1 | 1 | 3 | 4 | 1 | way/296932144 | -94.0683,33.4788,-94.0556,33.4858 |
| (unnamed) | Texas City | 3 | 3 | 10 | 2 | 1 | way/1339358730 | -94.9812,29.4100,-94.9610,29.4200 |
| The Oaks | The Woodlands | 3 | 5 | 10 | 13 | 0 | relation/6124799 | -95.4857,30.1165,-95.4730,30.1445 |
| Woodlands Country Club - Palmer Course | The Woodlands | 0 | 10 | 10 | 11 | 0 | way/125104007 | -95.5218,30.1873,-95.5177,30.1933 |
| (unnamed) | Travis County | 0 | 1 | 0 | 1 | 0 | way/1310584177 | -97.9324,30.3407,-97.9322,30.3409 |
| Lakecliff On Lake Travis Golf | Travis County | 3 | 2 | 3 | 11 | 0 | relation/18286837 | -98.0819,30.4504,-98.0645,30.4600 |
| Trophy Club Country Club Golf Course | Trophy Club | 8 | 31 | 23 | 74 | 2 | relation/12045880 | -97.2035,32.9985,-97.1700,33.0116 |
| The Cascades Golf Club | Tyler | 0 | 1 | 0 | 0 | 0 | relation/3987833 | -95.3635,32.3163,-95.3472,32.3235 |
| Dallas Country Club | University Park | 0 | 16 | 0 | 45 | 2 | way/27454080 | -96.8043,32.8324,-96.7956,32.8439 |
| (unnamed) | Uvalde County | 0 | 0 | 0 | 2 | 0 | relation/19527290 | -99.6929,29.5268,-99.6759,29.5351 |
| River Ridge Golf Club | Waller County | 2 | 26 | 99 | 97 | 27 | way/96110232 | -96.0427,29.7446,-96.0296,29.7666 |
| Vaquero Golf Course | Westlake | 7 | 8 | 36 | 22 | 4 | way/232901631 | -97.1978,32.9604,-97.1866,32.9780 |

