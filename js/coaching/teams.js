import { S } from './core.js';
import { expose } from './core.js';
import { loadRosterHandicaps } from './student-goals.js';
import { _sb } from './core.js';
import { escapeHtml } from './core.js';

// ─── COACH TEAM MANAGEMENT ──────────────────────────────────────────────────
var _coachTeams = [];       // Array of { id, team_name }
var _coachTeamStudents = []; // All students with team_id included
var _currentTeamId = null;   // Currently viewing team (null = list view)

export async function loadCoachTeams() {
  // Fetch teams
  var { data: teams } = await _sb.from('coach_teams')
    .select('id, team_name')
    .eq('coach_id', S.currentUser.id)
    .order('team_name', { ascending: true });
  _coachTeams = teams || [];

  // Fetch all students with team_id
  var { data: students } = await _sb.from('coach_students')
    .select('student_id, student_name, student_email, team_id')
    .eq('coach_id', S.currentUser.id)
    .order('student_name', { ascending: true });
  _coachTeamStudents = students || [];

  renderCoachTeamCards();
}

function renderCoachTeamCards() {
  var el = document.getElementById('coachTeamCards');
  if (!el) return;

  var teams = _coachTeams || [];
  var students = _coachTeamStudents || [];

  // Count students per team
  var teamCounts = {};
  var noTeamCount = 0;
  teams.forEach(function(t) { teamCounts[t.id] = 0; });
  students.forEach(function(s) {
    if (s.team_id && teamCounts[s.team_id] !== undefined) {
      teamCounts[s.team_id]++;
    } else {
      noTeamCount++;
    }
  });

  var html = '';

  // Render each team card
  teams.forEach(function(t) {
    var count = teamCounts[t.id] || 0;
    html += '<div onclick="showTeamDetail(\'' + t.id + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#222222;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1px solid #333333;">'
      + '<div style="width:40px;height:40px;border-radius:10px;background:#1a4a8a;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#44b8f0;flex-shrink:0;">' + escapeHtml((t.team_name || 'T')[0].toUpperCase()) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.team_name) + '</div>'
      + '<div style="font-size:11px;color:#606060;">' + count + ' player' + (count !== 1 ? 's' : '') + '</div>'
      + '</div>'
      + '<div style="color:#444;font-size:16px;">›</div>'
      + '</div>';
  });

  // "No Team" card always at bottom
  html += '<div onclick="showTeamDetail(\'no-team\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#1e1e1e;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1px solid #282828;">'
    + '<div style="width:40px;height:40px;border-radius:10px;background:#333333;display:flex;align-items:center;justify-content:center;font-size:16px;color:#606060;flex-shrink:0;">—</div>'
    + '<div style="flex:1;min-width:0;">'
    + '<div style="font-weight:700;font-size:14px;color:#9a9a9a;">No Team</div>'
    + '<div style="font-size:11px;color:#606060;">' + noTeamCount + ' player' + (noTeamCount !== 1 ? 's' : '') + '</div>'
    + '</div>'
    + '<div style="color:#444;font-size:16px;">›</div>'
    + '</div>';

  if (teams.length === 0 && students.length === 0) {
    html = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No teams or students yet.</div>';
  }

  el.innerHTML = html;
}

async function createCoachTeam() {
  var input = document.getElementById('coachNewTeamName');
  var msg = document.getElementById('coachCreateTeamMsg');
  var name = (input.value || '').trim();

  if (!name) { msg.style.color = '#d4706e'; msg.textContent = 'Enter a team name'; return; }
  if (name.length > 50) { msg.style.color = '#d4706e'; msg.textContent = 'Name too long (50 chars max)'; return; }

  msg.style.color = '#606060'; msg.textContent = 'Creating...';

  var { error } = await _sb.from('coach_teams').insert({
    coach_id: S.currentUser.id,
    team_name: name
  });

  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }

  msg.style.color = '#00b87a'; msg.textContent = '✓ Created "' + name + '"';
  input.value = '';
  setTimeout(function() { msg.textContent = ''; }, 2000);
  loadCoachTeams();
}

function showTeamDetail(teamId) {
  _currentTeamId = teamId;
  document.getElementById('coachTeamListView').style.display = 'none';
  document.getElementById('coachTeamDetailView').style.display = 'block';

  var isNoTeam = (teamId === 'no-team');
  var teamName = 'No Team';

  if (!isNoTeam) {
    var team = _coachTeams.find(function(t) { return t.id === teamId; });
    teamName = team ? team.team_name : 'Team';
  }

  document.getElementById('coachTeamDetailName').textContent = teamName;

  // Hide rename/delete buttons for "No Team"
  document.getElementById('coachTeamRenameBtn').style.display = isNoTeam ? 'none' : '';
  document.getElementById('coachTeamDeleteBtn').style.display = isNoTeam ? 'none' : '';

  // Clear search
  var searchInput = document.getElementById('coachTeamPlayerSearch');
  if (searchInput) searchInput.value = '';

  renderTeamPlayers();
}

export function showCoachTeamList() {
  _currentTeamId = null;
  document.getElementById('coachTeamDetailView').style.display = 'none';
  document.getElementById('coachTeamListView').style.display = 'block';
  renderCoachTeamCards();
}

function renderTeamPlayers() {
  var students = _coachTeamStudents || [];
  var teamId = _currentTeamId;
  var isNoTeam = (teamId === 'no-team');

  // Filter students for this team
  var teamPlayers;
  if (isNoTeam) {
    teamPlayers = students.filter(function(s) {
      return !s.team_id || !_coachTeams.find(function(t) { return t.id === s.team_id; });
    });
  } else {
    teamPlayers = students.filter(function(s) { return s.team_id === teamId; });
  }

  // Apply search filter
  var q = (document.getElementById('coachTeamPlayerSearch').value || '').toLowerCase().trim();
  if (q) {
    teamPlayers = teamPlayers.filter(function(s) {
      return ((s.student_name || '').toLowerCase().indexOf(q) !== -1 || (s.student_email || '').toLowerCase().indexOf(q) !== -1);
    });
  }

  document.getElementById('coachTeamDetailCount').textContent = teamPlayers.length + ' player' + (teamPlayers.length !== 1 ? 's' : '');

  var el = document.getElementById('coachTeamPlayerList');

  if (teamPlayers.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">' + (q ? 'No players match your search.' : 'No players in this team.') + '</div>';
    return;
  }

  // Build team move options for the dropdown
  var moveOptions = '';
  if (!isNoTeam) {
    moveOptions += '<option value="no-team">No Team</option>';
  }
  _coachTeams.forEach(function(t) {
    if (t.id !== teamId) {
      moveOptions += '<option value="' + t.id + '">' + escapeHtml(t.team_name) + '</option>';
    }
  });

  el.innerHTML = teamPlayers.map(function(s) {
    var initials = (s.student_name || 'S').split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
    var sid = s.student_id.replace(/'/g, '');
    var sname = (s.student_name || 'Student').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var semail = (s.student_email || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #282828;">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:#2d7abc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#44b8f0;flex-shrink:0;">' + escapeHtml(initials) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(s.student_name || 'Student') + '</span>'
      + '<span id="rosterHcp_' + sid + '" style="font-size:10px;font-weight:700;background:#1a4a8a;color:#44b8f0;padding:1px 6px;border-radius:10px;white-space:nowrap;"></span></div>'
      + '<div style="font-size:11px;color:#2e2e2e;">' + escapeHtml(s.student_email || '') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;flex-shrink:0;">'
      + (moveOptions ? '<select onchange="movePlayerToTeam(\'' + sid + '\', this.value)" style="height:28px;font-size:10px;background:#282828;border:1px solid #333;border-radius:6px;color:#9a9a9a;padding:0 4px;max-width:80px;"><option value="">Move...</option>' + moveOptions + '</select>' : '')
      + '<button onclick="viewStudent(\'' + sid + '\',\'' + sname + '\',\'' + semail + '\')" style="font-size:11px;font-weight:700;background:#2d7abc;border-radius:6px;padding:6px 10px;height:auto;max-width:none;width:auto;white-space:nowrap;">View</button>'
      + '</div>'
      + '</div>';
  }).join('');

  // Load handicap badges
  loadRosterHandicaps(teamPlayers);
}

function filterTeamPlayers() {
  renderTeamPlayers();
}

async function movePlayerToTeam(studentId, newTeamId) {
  if (!newTeamId) return;
  var teamIdValue = (newTeamId === 'no-team') ? null : newTeamId;

  await _sb.from('coach_students')
    .update({ team_id: teamIdValue })
    .eq('coach_id', S.currentUser.id)
    .eq('student_id', studentId);

  // Update local data
  _coachTeamStudents.forEach(function(s) {
    if (s.student_id === studentId) s.team_id = teamIdValue;
  });

  renderTeamPlayers();
}

async function renameCoachTeam() {
  if (!_currentTeamId || _currentTeamId === 'no-team') return;
  var team = _coachTeams.find(function(t) { return t.id === _currentTeamId; });
  if (!team) return;

  var newName = prompt('Rename team:', team.team_name);
  if (!newName || !newName.trim() || newName.trim() === team.team_name) return;
  newName = newName.trim();

  await _sb.from('coach_teams')
    .update({ team_name: newName })
    .eq('id', _currentTeamId)
    .eq('coach_id', S.currentUser.id);

  team.team_name = newName;
  document.getElementById('coachTeamDetailName').textContent = newName;
}

async function deleteCoachTeam() {
  if (!_currentTeamId || _currentTeamId === 'no-team') return;
  var team = _coachTeams.find(function(t) { return t.id === _currentTeamId; });
  if (!team) return;

  if (!confirm('Delete team "' + team.team_name + '"? Players will be moved to "No Team".')) return;

  // Move all players to no team first
  await _sb.from('coach_students')
    .update({ team_id: null })
    .eq('coach_id', S.currentUser.id)
    .eq('team_id', _currentTeamId);

  // Delete the team
  await _sb.from('coach_teams')
    .delete()
    .eq('id', _currentTeamId)
    .eq('coach_id', S.currentUser.id);

  showCoachTeamList();
  loadCoachTeams();
}

// Functions called from inline HTML handlers
expose({ createCoachTeam, showTeamDetail, showCoachTeamList, filterTeamPlayers, movePlayerToTeam, renameCoachTeam, deleteCoachTeam });
