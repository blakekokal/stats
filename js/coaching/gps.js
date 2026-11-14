// A student's rounds from this app, for their coach: fetched through
// coach_student_docs (store.js) and converted to the coaching app's round
// format, which the dashboard, rounds list and handicap all use.

import { fetchStudentRounds, fetchStudentsLive } from '../store.js';
import { toCoachRound } from '../dashboard.js';
import { courseById } from '../app.js';
import { summarize, startWatching } from '../rounds.js';

const cache = new Map(); // student id -> { at, rounds }
// The student's rounds, newest first: coaching-format rounds, each with `_gps`
// (the round as this app saved it). Kept for a minute so tabs don't refetch.
export async function studentRounds(studentId, fresh = false) {
  const hit = cache.get(studentId);
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.rounds;
  const raw = (await fetchStudentRounds(studentId)).filter(r => r && r.courseName);
  const rounds = raw.map(r => ({ ...toCoachRound(r), _gps: r })).filter(r => r.holes > 0)
    .sort((a, b) => (a.round_date < b.round_date ? 1 : a.round_date > b.round_date ? -1 : (b._gps.updated || 0) - (a._gps.updated || 0)));
  cache.set(studentId, { at: Date.now(), rounds });
  return rounds;
}

// Students playing right now: [{ id, student_id, name, course, hole, thru, toPar, updated }].
export async function liveStudents() {
  const rows = await fetchStudentsLive();
  return rows.filter(x => x.doc && x.doc.round).map(x => {
    const r = x.doc.round, c = courseById(r.course), s = summarize(r, c, r.level);
    return { id: x.id, student_id: x.student_id, roundId: r.id, name: x.doc.name || r.player || 'Student', course: r.courseName || c.name,
      hole: x.doc.at || s.firstOpen || null, thru: s.done, toPar: s.toPar, updated: x.updated };
  }).sort((a, b) => b.updated - a.updated);
}

// Where the hole screen's "Leave" goes after watching a student's round.
const backToCoaching = () => { try { sessionStorage.setItem('gs:watchBack', '#/coaching'); } catch { /* ignore */ } };
// Watch a round that is being played (it refreshes as they play).
export function watchLive(shareId) { backToCoaching(); location.hash = '#/live/' + shareId; }
// Open one of a student's rounds read-only on the hole screen.
export function viewRound(round, name) {
  backToCoaching();
  startWatching('sv-' + round.id, { round, live: false, name: name || round.player || '', at: null, sent: round.updated });
  location.hash = '#/hole/1';
}
