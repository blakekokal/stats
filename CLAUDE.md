# Working on this repo

- When a change is done, always open a pull request into `main` and merge it
  straight away, so it goes live (GitHub Pages serves `main`). Don't ask first,
  unless the owner says otherwise for that change.
- Bump `js/version.js` with every release and add a line to What's New in `js/coach.js`.

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
