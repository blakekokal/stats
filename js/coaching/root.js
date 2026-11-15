// The coaching app's pages, built once and kept in the document (hidden while
// another part of this app is on screen). Its modules look their elements up
// by id, some as soon as they load, so this is imported before any of them.

import { COACHING_PAGE, STUDENT_VIEW_PAGE, MODALS } from './markup.js';
import { GUIDE_PAGE, PRACTICE_PAGES, PERFORMANCE_PAGE, DRILLS_PAGES, BAG_PAGES, COMBINES_PAGES, MORE_MODALS, SG_PARTS } from './markup-more.js';

export const root = document.createElement('div');
root.id = 'coachroot';
root.className = 'cx coachroot';
root.hidden = true;
root.innerHTML = COACHING_PAGE + STUDENT_VIEW_PAGE + MODALS + GUIDE_PAGE + PRACTICE_PAGES + PERFORMANCE_PAGE + DRILLS_PAGES + BAG_PAGES + COMBINES_PAGES + MORE_MODALS + SG_PARTS;
document.body.append(root);
