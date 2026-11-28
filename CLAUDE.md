# Working on this repo

- **Hosting move (asked 2026-11-24; reminders paused 2026-11-25, owner will do it later):** don't
  remind the owner unless they bring it up. The move: make this repo private, serve the site from Cloudflare Pages (or Netlify/Vercel)
  linked to the private repo, point the web address there (add it to Supabase's allowed sign-in
  addresses if it changes), and turn off GitHub Pages. Once the owner says it's done,
  delete this bullet and update the release notes below for the new address.
- When a change is done, always open a pull request into `main` and merge it
  straight away, so it goes live (GitHub Pages serves `main`). Don't ask first,
  unless the owner says otherwise for that change.
- Bump `js/version.js` with every release and add a line to What's New in `js/coach.js`.
  Keep it short: a new course is just `New course: <name> (<city>)`, no build details.

## More than one session works on this repo at once

Other Claude sessions release to `main` while you work. Twice that has broken
the live app: a merge left `js/version.js` empty (the app opened to a blank
screen), and a version bump that replaced a hard-coded old number did nothing
because `main` had moved on. So, for every release:

1. Right before the pull request, `git fetch origin main` and merge it into
   your branch, so you build on what's live now, not what was live when you
   started.
2. Bump from main's number: read `VERSION` in `origin/main:js/version.js` and
   set yours one higher. Never `sed` an old version you remember; it may be gone.
3. In a merge conflict, keep both sides: `js/version.js` is one line,
   `export const VERSION = 'x.y.z';` with the new number (never empty); in
   What's New keep every entry, yours on top with that same number.
4. Run `tools/check_release.sh --page` and fix anything it reports. It checks
   the version line, that What's New starts with it, no duplicate versions,
   a version higher than main's, no conflict markers, that every JS file
   parses, and that the app actually opens.
5. Merge, then fetch `main` again. If someone else merged first and your PR
   is now behind, repeat from step 1 for the next release, not by editing
   their entry.

# Building a course

New courses are built from the owner's yardage books (vector PDFs: cover, plan,
notes, then a green page and a hole page per hole), not traced by eye. The
owner sends the book(s); align them to the imagery with the shared scripts
`tools/yardage_book.py` (reads a book) and `tools/build_from_book.py` (builds
the course file). A course needs only a `course.py` (scorecard and the middle
of each green in the imagery); see `tools/sherrillpark2` as the model.

- Each hole page: scale from the 50-yard rings (par 3: the tee's "N yd to
  green"), turn from the north arrow, the pin at the centre. Bunkers, water,
  fairways, green and the hole's own tee boxes come straight from the drawing;
  the 50-yard slope marks give the hole line's bends.
- Shapes drawn on two pages are identical, so all pages join into one plan;
  place that plan on the **zoom-19** Esri imagery (what the app shows) in one
  piece: shift, turn, scale from the greens, then fine-tuned to bunkers on sand
  and ponds/trees on dark ground. Don't fit hole by hole (a lone bunker can
  lock onto the wrong sand) and don't fit to trees alone (shadows fall north-west).
- Trees are the leafy canopy in the imagery inside the book's tree circles,
  never the book's circles themselves (they are far too big), and are saved as
  circles (`tools/tree_circles.py`): a wood becomes a cluster of round trees,
  not one blob, so the owner can edit trees one at a time.
  2-5 small trees close together become one bigger tree (`merge_small`;
  `tools/merge_trees.py` does it to a course file's existing trees).
- Check the book's bunkers and ponds against the imagery. If they're wrong
  (Sherrill Park #2's were), take bunkers, ponds and trees from the imagery with
  `tools/hazards_from_imagery.py` and keep only greens, fairways, tee boxes and
  hole lines from the book. Where the book is only partly wrong but the imagery
  misses bunkers the book has right (Tour 18 Dallas), `tools/bunkers_from_imagery.py`
  keeps the book's bunkers on sand, drops those on grass and adds the imagery's
  missing ones. Send the owner a picture of one hole, then the whole
  course, before putting it live.
- Before rebuilding a course that's live, read its published edits
  (`course_edits` in Supabase, readable with the anon key) and start from them,
  so the owner's edits aren't lost; a new `builtAt` then sets the old ones aside.
- Every course gets its OB boundary (the course-wide OB: a big area with the
  course cut out). `tools/add_ob.py` makes it from the OpenStreetMap course
  boundary; the owner can also trace it in the hole editor (Draw new boundary
  → Course boundary). Sherrill Park #1, #2 and Cross Timbers have none yet:
  the owner is drawing those.
- No trees in OB: don't draw trees outside the course boundary.
- To redo only a course's trees (from the imagery, as circles, nothing else
  changed): `tools/trees_from_imagery.py`.
- Elevation (View box: contours in yards with downhill arrows on the lines, and plays-like yardages) comes from USGS 3DEP lidar:
  `tools/elevation.py <course>` writes `data/elev/` (no book needed, the course
  file isn't touched). Every course has it; run it for each new course. The
  USGS server throws the odd 502: just run it again.
- Outlines are soft, rounded shapes: run `tools/soften_shapes.py data/<course>.json`
  as the last step of a build (pass the published `doc` too if the course has
  live edits; it starts from them and sets `builtAt`).
- Scorecard (tees, ratings, pars, handicaps) still comes from the club.
- Check by eye on an overlay and in the app (GPS Overview), and commit the
  book PDF next to the scripts so the course can be rebuilt. The build takes
  several minutes: run it in the background.

# Courses OpenStreetMap already has (no yardage book needed)

A survey of OpenStreetMap (Nov 2026) found these DFW courses mapped with all 18
hole lines plus greens, tee boxes, bunkers and fairways, so they can be built
without a book, the way Lake Park, Texas Star, Iron Horse and Fields Ranch were.
The recipe: download the course with the plain OSM API (`api/0.6/map.json?bbox=...`;
Overpass is often down), convert it with a small `tools/<id>/osm_to_geom.py` (copy
`tools/texasstar/`), then `build_course.py`, measure the shift by fitting the
bunkers to the sand in the zoom-19 imagery, drop practice greens (`drop`), check the
bunkers (`hazards_from_imagery.py` + `bunkers_from_imagery.py`, then look: shade and
dormant grass fool it), `add_ob.py`, `trees_from_imagery.py`, `soften_shapes.py`,
`elevation.py`. Scorecard from the club or GolfPass; check its pars against OSM's
hole tags and match ratings to tees by total yards. Send the owner pictures first.

Keep this list current: when you start one, mark it `(building, <date>)` so no
other session starts it too; when it's live, move it to Done.

Done: Lantana (OSM had no hole lines; routed from the scorecard), Lake Park
Championship and Executive, Texas Star, Iron Horse, Indian Creek Creek and Lakes,
Fields Ranch East and West (two courses: holes told apart by OSM course boundary),
Cedar Crest, Stevens Park, Tierra Verde, Riverside (#13 and #18 share a double
green: `pinAtLineEnd` in the config), Cottonwood Valley (TPC Four Seasons is
next door: kept to its own boundary), Trails of Frisco (winter imagery: shift fitted
to the greens, as dormant fairways fool the bunker fit). Twin Creeks (GolfPass has its nines swapped:
the club's current card, as Greenskeeper has it, matches OSM), Woodbridge, Buffalo Creek
(OSM draws its driving range as a fairway: dropped), The Tribute (OSM tags hole 5's green as a tee),
Old American (GolfPass's card is one hole off: its #1 is #2; its tan waste bunkers fool the sand
check, so they were judged by eye; a `drop` point can name its type, `[lat, lng, "bunker"]`, so a
bunker inside a fairway goes without the fairway), Sky Creek Ranch, Rockwall,
Fossil Creek, Whitestone (winter imagery and brown sand: shift fitted to the greens, its bunkers judged
by eye), Hawks Creek (Shady Oaks is next door: kept to its own boundary), Oak Hollow, Tenison Park Highlands and Glen
(one OSM boundary for both: holes told apart by way id; winter imagery with snow in the shade, so
OSM's bunkers kept as they are). The Resort (Fort Worth; winter imagery and tan sand: shift
fitted to the greens; OSM's 19th hole dropped). Pecan Valley Hills and River (River's two missing greens and eight fairways from the
imagery). Texas Rangers
(GolfPass's card has the nines swapped: the club's #1 is the 589-yard par 5, as in OSM). Grover C. Keaton
(GolfPass lists it as Keeton Park; its ratings are for old lengths, so none are given). Duck Creek (Garland). Watters Creek Traditions (Plano; the short
course, practice holes and range in the same boundary trimmed out). Rusted Rail (Crandall; OSM's fairways are drawn wide,
fairway and rough together: worth redoing from summer imagery). `tools/keep_found_bunkers.py` adds only the
bunkers you name from `bunkers_from_imagery.py`'s finds. Champions Circle (Fort Worth; OSM's boundary has no
name; GolfPass's ratings are for a longer layout, so none are given). Waterchase (Fort Worth; unnamed in OSM;
its short course trimmed with `tools/trim_far.py`, which drops shapes far from every hole, optionally in a box). The Club at
Frisco Farms (OSM: Plantation Golf Club; shift 4 m, fitted to the greens). TPC Craig Ranch (private;
OSM predates its 2020-21 renovation: bunkers from the imagery with `tools/swap_bunkers.py`, which cuts the
sand out of greens it overlaps). TPC Four Seasons Las Colinas (OSM's holes have no par tags:
pars from the card). Stonebriar Fazio and Country Club (two courses in one boundary: holes
told apart by way id; Fazio #7's missing green grown from the imagery with `tools/green_from_seed.py`). Dallas Athletic Club
Blue (Gold not yet: see below). Dallas National (its big short-game area trimmed). Colonial (GolfPass 15181; its 21496 is
in Florida). Northwood (GolfPass 12693). Prestonwood Creek (OSM's greens drawn ~3 m off its
bunkers: `greenShift` in the config moves only the greens). Hackberry Creek (#5's missing green grown from the imagery). Eldorado (McKinney; boundary is two ways; #9's green
tagged as a bunker: `retype` in the config, a `build_course.py` option). Oakmont (Corinth;
`greenShift` as at Prestonwood). Shady Oaks (holes named "SOCC n"; its par-3 course trimmed; OSM
predates the 2020 renovation: 58 bunkers on grass dropped, 14 added from the imagery). Lake Arlington (its
"gap" was bunkers, but it has none: no sand in the imagery). Pecan Hollow (no fairways or tee boxes in OSM:
`tools/fill_from_imagery.py` traces fairways from the imagery, each hole's own fairway vs rough colour, and adds
tee boxes; approximate, worth tidying in the editor). Luna Vista (fairways the same way). Mesquite Municipal (fairways, tee boxes and
three bunkers from the imagery). Timarron (not missing a hole: OSM tags #10 ref=4, name=10;
the card's par 5 #1 used). Ridgeview Ranch (#18's hole line added in `osm_to_geom.py` from its mapped
tee boxes, fairway and green; 22 old bunkers on grass dropped). Stonebridge Ranch Dye (not missing a hole: #3 and #4
are in a second boundary way). Heritage Ranch (Fairview; all 18 holes, in three boundary ways). Mansfield National (OSM had only hole lines: greens, fairways,
tee boxes and bunkers from the imagery; `fill_from_imagery.py --bunkers` finds white sand inside the course). Thorntree (the same, from
dormant winter imagery: greens good, fairways approximate, many beige bunkers missing; a yardage book would help;
`green_from_seed.py --auto/--hull/--open` for dull greens).

Skipped for now: Meadowbrook (Fort Worth; GolfPass's card is a different layout from OSM's holes),
Lost Creek (Aledo; GolfPass says it closed). `tools/fit_shift.py` measures the shift (bunkers on sand, or greens).

Also live, though OpenStreetMap had almost nothing: Prairie Lakes (three nines, every shape
traced from the imagery, routed from the club's course map; see `tools/prairielakes/`).
Outside DFW: Isabella (Hot Springs Village, AR; three nines, Nina, Pinta and Santa Maria, all
from OSM; OSM numbers Pinta 10-18, so `tools/isabella/course.py` names each nine's holes by way id).

Public, complete:
- Maridoe (Carrollton): GolfPass has the pre-renovation card (pars and yards fit
  no OSM hole); needs the current card from the club

Mapped with gaps (better from a book, or fill the gaps from the imagery):
- Mira Vista (Fort Worth): OSM's greens and bunkers don't fit the imagery (greens over bunkers;
  renovated since?): greens and bunkers need redrawing; GolfPass 2918 has the card (par 71)
- Dallas Athletic Club Gold: OSM's #16-#18 don't match GolfPass's card (see `tools/dac/README.md`);
  needs the club's current card (Blue is live)
- shapes but no hole lines: Waterview, Timberlinks
