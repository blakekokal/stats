import { expose } from '../coaching/core.js';
import { _BAG_ORDER, getBagClubs, saveBagClubs, sortBagClubs } from './clubs.js';

// ─── FIND YARDAGES ─────────────────────────────────────────────────────────
var _fySelectedClub = null;
var _fyShotCount = 5;
var _fyPendingShots = null; // stored temporarily for conflict resolution

export function fyShowStep1() {
  document.getElementById('fyStep1').style.display = '';
  document.getElementById('fyStep2').style.display = 'none';
  document.getElementById('fyStep3').style.display = 'none';
  fyRenderClubGrid();
  fyPopulateNewClubDropdown();
}

function fyBackToStep1() {
  _fySelectedClub = null;
  fyShowStep1();
}

function fyBackToStep2() {
  document.getElementById('fyStep2').style.display = '';
  document.getElementById('fyStep3').style.display = 'none';
  fyRenderShotCountBtns();
}

function fyRenderClubGrid() {
  var clubs = getBagClubs();
  var grid = document.getElementById('fyClubGrid');
  if (!grid) return;
  if (clubs.length === 0) {
    grid.innerHTML = '<div style="color:#9a9a9a;font-size:13px;width:100%;text-align:center;padding:8px 0;">No clubs in bag yet. Add one below.</div>';
    return;
  }
  grid.innerHTML = clubs.map(function(c) {
    var safe = c.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<button onclick="fySelectClub(\'' + safe + '\')" style="padding:8px 14px;background:#282828;border:1px solid #3d3d3d;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:700;cursor:pointer;">' + c.name + '</button>';
  }).join('');
}

function fyPopulateNewClubDropdown() {
  var sel = document.getElementById('fyNewClubSelect');
  if (!sel) return;
  var clubs = getBagClubs();
  var inBag = {};
  clubs.forEach(function(c) { inBag[c.name.toLowerCase()] = true; });
  var opts = '<option value="" disabled selected>Select a club...</option>';
  _BAG_ORDER.forEach(function(name) {
    if (!inBag[name.toLowerCase()]) {
      opts += '<option value="' + name + '">' + name + '</option>';
    }
  });
  sel.innerHTML = opts;
}

function fyPickNewClub() {
  var sel = document.getElementById('fyNewClubSelect');
  var name = sel ? sel.value : '';
  if (!name) return;
  // Add to bag first
  var clubs = getBagClubs();
  if (!clubs.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
    clubs.push({ name: name, carry: null, total: null });
    saveBagClubs(sortBagClubs(clubs));
  }
  fySelectClub(name);
}

function fySelectClub(name) {
  _fySelectedClub = name;
  document.getElementById('fySelectedClubName').textContent = name;
  document.getElementById('fyStep1').style.display = 'none';
  document.getElementById('fyStep2').style.display = '';
  document.getElementById('fyStep3').style.display = 'none';
  fyRenderShotCountBtns();
}

function fyRenderShotCountBtns() {
  var container = document.getElementById('fyShotCountBtns');
  if (!container) return;
  var counts = [3, 5, 10, 15, 20];
  container.innerHTML = counts.map(function(n) {
    var active = n === _fyShotCount;
    return '<button onclick="fyPickShotCount(' + n + ')" style="width:52px;height:44px;font-size:16px;font-weight:800;border-radius:10px;border:2px solid ' +
      (active ? '#2d7abc' : '#3d3d3d') + ';background:' + (active ? '#2d7abc' : '#282828') + ';color:' +
      (active ? '#ffffff' : '#9a9a9a') + ';cursor:pointer;">' + n + '</button>';
  }).join('');
  container.innerHTML += '<button onclick="fyGoToStep3()" style="width:100%;height:42px;margin-top:8px;background:#007a52;border:none;border-radius:10px;color:#00b87a;font-size:14px;font-weight:700;cursor:pointer;">Enter Shots →</button>';
}

function fyPickShotCount(n) {
  _fyShotCount = n;
  fyRenderShotCountBtns();
}

function fyGoToStep3() {
  document.getElementById('fyStep2').style.display = 'none';
  document.getElementById('fyStep3').style.display = '';
  document.getElementById('fyStep3ClubName').textContent = _fySelectedClub;
  fyRenderShotInputs();
}

function fyRenderShotInputs() {
  var container = document.getElementById('fyShotInputs');
  if (!container) return;
  var distStyle = 'height:36px;font-size:13px;font-weight:700;text-align:center;background:#282828;border:1px solid #333333;border-radius:8px;color:#ffffff;width:100%;box-sizing:border-box;';
  var offStyle = 'height:36px;font-size:12px;font-weight:700;text-align:center;background:#222222;border:1px solid #2a3a2a;border-radius:8px;color:#00b87a;width:100%;box-sizing:border-box;';
  var html = '';
  for (var i = 0; i < _fyShotCount; i++) {
    html += '<div style="display:grid;grid-template-columns:22px 1fr 1fr 70px;gap:4px;align-items:center;">' +
      '<div style="font-size:11px;color:#9a9a9a;font-weight:700;text-align:center;">' + (i + 1) + '</div>' +
      '<input type="number" id="fyCarry_' + i + '" placeholder="—" min="0" max="400" style="' + distStyle + '">' +
      '<input type="number" id="fyTotal_' + i + '" placeholder="—" min="0" max="450" style="' + distStyle + '">' +
      '<input type="number" id="fyTotalOff_' + i + '" placeholder="0" min="-99" max="99" style="' + offStyle + '">' +
      '</div>';
  }
  container.innerHTML = html;
  document.getElementById('fyMsg').textContent = '';
}

function fySaveShots() {
  var msg = document.getElementById('fyMsg');
  var newCarryShots = [];
  var newTotalShots = [];

  for (var i = 0; i < _fyShotCount; i++) {
    var carry = (function(el){ return el && el.value !== '' ? parseInt(el.value) : null; })(document.getElementById('fyCarry_' + i));
    var total = (function(el){ return el && el.value !== '' ? parseInt(el.value) : null; })(document.getElementById('fyTotal_' + i));
    var totalOff = (function(el){ return el && el.value !== '' ? parseFloat(el.value) : null; })(document.getElementById('fyTotalOff_' + i));

    // User enters total offline; interpolate carry offline from same angle
    var carryOff = null;
    if (totalOff !== null && total !== null && total > 0 && carry !== null) {
      carryOff = Math.round(totalOff * (carry / total) * 10) / 10;
    }

    if (carry !== null) {
      newCarryShots.push({ total: carry, side: carryOff !== null ? carryOff : 0, target: carry });
    }
    if (total !== null) {
      newTotalShots.push({ total: total, side: totalOff !== null ? totalOff : 0, target: total });
    }
  }

  if (newCarryShots.length === 0 && newTotalShots.length === 0) {
    msg.style.color = '#d4706e'; msg.textContent = 'Enter at least one shot.';
    return;
  }

  // Check if club already has shot data
  var clubs = getBagClubs();
  var club = clubs.find(function(c) { return c.name === _fySelectedClub; });
  if (club && club.shots && club.shots.length > 0) {
    // Store pending data and show conflict modal
    _fyPendingShots = { carry: newCarryShots, total: newTotalShots };
    var modal = document.getElementById('fyConflictModal');
    document.getElementById('fyConflictMsg').textContent =
      _fySelectedClub + ' already has ' + club.shots.length + ' shot(s). Do you want to add your ' +
      newCarryShots.length + ' new shot(s) to the existing data, or replace it entirely?';
    modal.style.display = 'flex';
    return;
  }

  // No existing data — just save
  fyApplyShots(newCarryShots, newTotalShots, 'replace');
}

function fyResolveConflict(action) {
  document.getElementById('fyConflictModal').style.display = 'none';
  if (action === 'cancel') { _fyPendingShots = null; return; }
  if (_fyPendingShots) {
    fyApplyShots(_fyPendingShots.carry, _fyPendingShots.total, action);
    _fyPendingShots = null;
  }
}

function fyApplyShots(newCarryShots, newTotalShots, mode) {
  var clubs = getBagClubs();
  var club = clubs.find(function(c) { return c.name === _fySelectedClub; });
  if (!club) {
    club = { name: _fySelectedClub, carry: null, total: null };
    clubs.push(club);
  }

  if (mode === 'add') {
    club.shots = (club.shots || []).concat(newCarryShots);
    if (newTotalShots.length > 0) {
      club.totalShots = (club.totalShots || []).concat(newTotalShots);
    }
  } else {
    club.shots = newCarryShots;
    club.totalShots = newTotalShots.length > 0 ? newTotalShots : null;
  }

  // Compute averages from all shots
  var allCarry = club.shots || [];
  var allTotal = club.totalShots || [];
  if (allCarry.length > 0) {
    club.carry = Math.round(allCarry.reduce(function(s, v) { return s + v.total; }, 0) / allCarry.length);
  }
  if (allTotal.length > 0) {
    club.total = Math.round(allTotal.reduce(function(s, v) { return s + v.total; }, 0) / allTotal.length);
  } else if (allCarry.length > 0) {
    club.total = club.carry;
  }

  saveBagClubs(sortBagClubs(clubs));

  var msg = document.getElementById('fyMsg');
  msg.style.color = '#00b87a';
  msg.textContent = 'Saved! ' + _fySelectedClub + ': ' + (club.carry || '—') + ' carry / ' + (club.total || '—') + ' total';

  // Go back to step 1 after a short delay
  setTimeout(function() {
    fyShowStep1();
  }, 1800);
}

// Functions called from inline HTML handlers
expose({ fyBackToStep1, fyBackToStep2, fyPickNewClub, fySelectClub, fyPickShotCount, fyGoToStep3, fySaveShots, fyResolveConflict });
