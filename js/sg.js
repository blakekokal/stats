// Expected strokes to hole out from a given lie and distance, by handicap level.
// Off-green distances are yards; putting distances are feet.

import { LEVELS, TABLES } from './expected-data.js';

export { LEVELS };

function interp(xs, rows, col, x) {
  const hi = xs.length - 1;
  if (x <= xs[0]) return rows[0][col];
  if (x >= xs[hi]) return rows[hi][col];
  let i = 0;
  while (xs[i + 1] < x) i++;
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return rows[i][col] + t * (rows[i + 1][col] - rows[i][col]);
}

// lie: tee | fairway | rough | bunker | recovery | green. dist: yards, or feet when lie is green.
// level: one of LEVELS ("Pro", "Scratch", "5" ... "30"). Distances outside a table use its nearest row.
export function expected(lie, dist, level = 'Pro') {
  const table = TABLES[lie] || TABLES.rough;
  const col = Math.max(0, LEVELS.indexOf(level));
  if (lie === 'green' && dist < 1) return 1;
  return interp(table.d, table.v, col, dist);
}
