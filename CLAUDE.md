# Working on this repo

- When a change is done, always open a pull request into `main` and merge it
  straight away, so it goes live (GitHub Pages serves `main`). Don't ask first,
  unless the owner says otherwise for that change.
- Bump `js/version.js` with every release and add a line to What's New in `js/coach.js`.

# Building a course

New courses are built from the owner's yardage books (vector PDFs: cover, plan,
notes, then a green page and a hole page per hole), not traced by eye. The
owner sends the book(s); align them to the imagery. `tools/sherrillpark1` is
the model to copy (see its README):

- `book.py` reads each hole page: scale from the 50-yard rings (par 3: the
  tee's "N yd to green"), turn from the north arrow, the pin at the centre.
  Bunkers, water, fairways, green and the hole's own tee boxes (those with a
  yardage label) come straight from the drawing; the 50-yard slope marks give
  the hole line's bends.
- `build_book.py` aligns on the **zoom-19** Esri imagery the app shows (not
  zoom 18): pin on the green seen in the imagery, coarse fit of trees/ponds to
  dark ground, then a fine fit of bunkers to sand and the green to green turf
  (tree shadows fall north-west and pull a trees-only fit a few metres north),
  then each bunker and green snapped on its own by up to 3 m.
- Trees are the leafy canopy in the imagery inside the book's tree circles,
  never the circles themselves (they are far too big).
- Scorecard (tees, ratings, pars, handicaps) still comes from the club.
- Check by eye on an overlay and in the app (GPS Overview), and commit the
  book PDF next to the scripts so the course can be rebuilt.
