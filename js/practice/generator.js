import { expose } from '../coaching/core.js';
import { getBagClubs } from '../bag/clubs.js';
import { ppFindClubsInRange, ppGetMaxApproachDist, ppHideAllViews, ppRound5 } from './plans.js';
import { hasLaunchMonitor } from '../coaching/core.js';

// ── Practice Generator ──
var _ppGenCats = { range: false, shortgame: false, putting: false };
var _ppGenType = 'split'; // 'split', 'block', 'random'

function ppShowGenerator() {
  ppHideAllViews();
  document.getElementById('ppGeneratorView').style.display = '';
  _ppGenCats = { range: false, shortgame: false, putting: false };
  _ppGenType = 'split';
  ppGenUpdateCatButtons();
  ppGenUpdateTypeButtons();
  document.getElementById('ppGenResults').innerHTML = '';
  document.getElementById('ppGenLogWrap').style.display = 'none';
  document.getElementById('ppGenMsg').textContent = '';
}

function ppGenToggleCat(cat) {
  _ppGenCats[cat] = !_ppGenCats[cat];
  ppGenUpdateCatButtons();
}

function ppGenUpdateCatButtons() {
  var map = { range: 'ppGenCatRange', shortgame: 'ppGenCatShortgame', putting: 'ppGenCatPutting' };
  for (var k in map) {
    var btn = document.getElementById(map[k]);
    if (_ppGenCats[k]) {
      btn.style.background = '#2d7abc'; btn.style.color = '#fff'; btn.style.borderColor = '#2d7abc';
    } else {
      btn.style.background = 'transparent'; btn.style.color = '#606060'; btn.style.borderColor = '#3d3d3d';
    }
  }
}

function ppGenSetType(t) {
  _ppGenType = t;
  ppGenUpdateTypeButtons();
}

function ppGenUpdateTypeButtons() {
  ['Split','Block','Random'].forEach(function(label) {
    var btn = document.getElementById('ppGenType' + label);
    var active = _ppGenType === label.toLowerCase();
    btn.style.background = active ? '#2d7abc' : '#282828';
    btn.style.color = active ? '#fff' : '#606060';
  });
}

function ppGenGenerate() {
  var msg = document.getElementById('ppGenMsg');
  var activeCats = [];
  if (_ppGenCats.range) activeCats.push('range');
  if (_ppGenCats.shortgame) activeCats.push('shortgame');
  if (_ppGenCats.putting) activeCats.push('putting');
  if (!activeCats.length) { msg.style.color = '#d4706e'; msg.textContent = 'Select at least one category.'; return; }
  msg.textContent = '';

  var totalMins = parseInt(document.getElementById('ppGenTime').value) || 60;
  var drillCountPref = parseInt(document.getElementById('ppGenDrillCount').value) || 0;
  var minsPerCat = Math.floor(totalMins / activeCats.length);

  var lm = hasLaunchMonitor();
  var allDrills = [];

  activeCats.forEach(function(cat) {
    var catDrills = ppGenGetCatDrills(cat, minsPerCat, drillCountPref, lm);
    allDrills = allDrills.concat(catDrills);
  });

  // Render results using same format as recommended practice
  var colors = { range: '#d4706e', shortgame: '#00b87a', putting: '#f6b26b' };
  var labels = { range: 'Range', shortgame: 'Short Game', putting: 'Putting' };
  var html = '';
  var ci = 0;
  activeCats.forEach(function(cat) {
    var catItems = allDrills.filter(function(d) { return d.cat === cat; });
    var color = colors[cat];
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;border-left:4px solid ' + color + ';">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px;">' + labels[cat] + '</div>';
    catItems.forEach(function(d, di) {
      var uid = 'ppGenDrill_' + ci + '_' + di;
      var wpId = 'wpGenTips_' + ci + '_' + di;
      var hasTip = !!d.tip;
      var wpToggleHtml = '';
      var wpExpandHtml = '';
      if (hasTip) {
        var tipLabel = d.tip.type === 'block' ? 'Block' : 'Random';
        var tipColor = d.tip.type === 'block' ? '#44b8f0' : '#e6a84d';
        var tipText = d.tip.text || '';
        var drillId = d.tip.drillId || null;
        var drillCat = d.tip.drillCat || null;
        var combineFunc = d.tip.combineFunc || null;
        wpToggleHtml = '<div onclick="var el=document.getElementById(\'' + wpId + '\');var arr=this.querySelector(\'span\');if(el.style.display===\'none\'){el.style.display=\'block\';arr.textContent=\'▾\';}else{el.style.display=\'none\';arr.textContent=\'▸\';};event.stopPropagation();" style="font-size:10px;color:#44b8f0;cursor:pointer;font-weight:600;text-decoration:underline;white-space:nowrap;margin-left:8px;">Drills <span style="text-decoration:none;display:inline-block;">▸</span></div>';
        wpExpandHtml = '<div id="' + wpId + '" style="display:none;margin-top:4px;margin-left:34px;text-align:left;">';
        wpExpandHtml += '<div style="font-size:12px;padding:4px 0;text-align:left;">';
        wpExpandHtml += '<span style="font-size:11px;font-weight:700;color:' + tipColor + ';margin-right:6px;">' + tipLabel + ' -</span>';
        if (combineFunc) {
          wpExpandHtml += '<a onclick="' + combineFunc + '();event.stopPropagation();" style="color:#44b8f0;font-weight:700;cursor:pointer;text-decoration:underline;">' + tipText + '</a>';
        } else if (drillId && drillCat) {
          wpExpandHtml += '<a onclick="ppOpenDrillFromPractice(\'' + drillId + '\',\'' + drillCat + '\');event.stopPropagation();" style="color:#44b8f0;font-weight:700;cursor:pointer;text-decoration:underline;">' + tipText + '</a>';
        } else {
          wpExpandHtml += '<span style="color:#9a9a9a;">' + tipText + '</span>';
        }
        wpExpandHtml += '</div></div>';
      }
      html += '<div style="padding:6px 0;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<div id="' + uid + '" onclick="ppToggleDrill(this,event)" style="width:24px;height:24px;min-width:24px;border-radius:50%;border:2px solid #3d3d3d;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>';
      html += '<div style="flex:1;"><div style="font-size:13px;color:#9a9a9a;">' + d.name + '</div>';
      if (d.detail) html += '<div style="font-size:11px;color:#606060;margin-top:2px;">' + d.detail + '</div>';
      html += '</div>';
      if (hasTip) html += wpToggleHtml;
      html += '<div style="display:flex;align-items:center;gap:2px;white-space:nowrap;margin-left:8px;">';
      html += '<input type="number" value="' + d.mins + '" min="1" max="120" style="width:36px;height:24px;background:#1e1e1e;color:#9a9a9a;border:1px solid #3d3d3d;border-radius:6px;text-align:center;font-size:11px;font-weight:700;padding:0;font-family:inherit;" onclick="event.stopPropagation()">';
      html += '<span style="font-size:10px;color:#606060;">min</span></div>';
      html += '</div>';
      if (hasTip) html += wpExpandHtml;
      html += '</div>';
    });
    html += '</div>';
    ci++;
  });

  document.getElementById('ppGenResults').innerHTML = html;
  document.getElementById('ppGenLogWrap').style.display = '';
}

function ppGenGetCatDrills(cat, totalMins, drillCountPref, lm) {
  var results = [];

  if (cat === 'putting') {
    var allTipGroups = ppGenPuttingGroups();
    results = ppGenPickFromGroups(allTipGroups, totalMins, drillCountPref, cat);
  } else if (cat === 'shortgame') {
    var allTipGroups = ppGenShortGameGroups();
    results = ppGenPickFromGroups(allTipGroups, totalMins, drillCountPref, cat);
  } else if (cat === 'range') {
    var allTipGroups = ppGenRangeGroups(lm);
    results = ppGenPickFromGroups(allTipGroups, totalMins, drillCountPref, cat);
  }
  return results;
}

function ppGenPuttingGroups() {
  return [
    { name: 'Putts 3-7 ft', detail: '', tips: [
      {type:'block', text:'Gate Drill — two tees just wider than your putter, make 10 in a row', drillId:'gate', drillCat:'putting'},
      {type:'block', text:'Double Gate Drill — One gate for putter, one for ball, make 10 in a row', drillId:'double_gate', drillCat:'putting'},
      {type:'block', text:'Clock Drill/Around the World — 4-8 putts in a circle from 3-7 ft', drillId:'clock', drillCat:'putting'},
      {type:'random', text:'Spiral Pressure Drill — Series of 3, 5, 7 ft putts, must make them in a row', drillId:'spiral_pressure', drillCat:'putting'},
      {type:'random', text:'Run a Short Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Leapfrog Gates — 5-6 gates 3-7 ft 12 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ]},
    { name: 'Putts 7-15 ft', detail: '', tips: [
      {type:'block', text:'Gate Drill — two tees just wider than your putter, make 7 in a row', drillId:'gate', drillCat:'putting'},
      {type:'block', text:'3, 6, 9 Drill — make 9 in a row, 3 from each distance, restart on miss', drillId:'369_drill', drillCat:'putting'},
      {type:'random', text:'Clock Drill/Around the World — 4-8 putts in a circle from 7-15 ft', drillId:'clock', drillCat:'putting'},
      {type:'random', text:'3 balls to 5 different holes — read commit roll'},
      {type:'random', text:'Run a Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Leapfrog Gates — 5-8 gates 7-15 ft 18 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ]},
    { name: 'Putts 15-25 ft', detail: '', tips: [
      {type:'random', text:'Run a Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Leapfrog Drill — putt to 15 ft, next putt must go farther, max is 25 ft', drillId:'leapfrog_putting', drillCat:'putting'},
      {type:'block', text:'Leapfrog Gates — 5-8 gates 15-25 ft 24 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ]},
    { name: 'Lag putts 25-50 ft', detail: '', tips: [
      {type:'block', text:'Anti 3-Putt Drill — two-putt from increasing distances, restart on 3-putt', drillId:'anti_3putt', drillCat:'putting'},
      {type:'block', text:'Leapfrog Drill — putt to 25 ft, next putt must go farther, max is 50 ft', drillId:'leapfrog_putting', drillCat:'putting'},
      {type:'random', text:'Run a Putting Combine for long putts', combineFunc:'goToPuttingCombine'},
      {type:'random', text:'Speed Calibration — 2 putts from 15-50 feet, focused on speed control', drillId:'speed_calibration', drillCat:'putting'}
    ]}
  ];
}

function ppGenShortGameGroups() {
  return [
    { name: 'Chipping 10-30 yds', detail: ppFindClubsInRange(10, 30), tips: [
      {type:'block', text:'5-10 shots from 10, 20, 30 yards, focus on consistent landing spot and trajectory'},
      {type:'block', text:'Flamingo Drill — 99% of weight on lead foot, focus on controlling low point in front of ball', drillId:'flamingo', drillCat:'shortgame'},
      {type:'block', text:'Chipping Leapfrog — each chip lands past the previous one, focus on distance control', drillId:'chipping_leapfrog', drillCat:'shortgame'},
      {type:'random', text:'Low/mid/high — alternate all 3 trajectories to the same hole'},
      {type:'random', text:'Up & Down Combine — Play holes from 10-30 yards and hole out'},
      {type:'random', text:'Run a Shortgame Combine', combineFunc:'goToCombines'}
    ]},
    { name: 'Bunker play', detail: '', tips: [
      {type:'block', text:'5-10 shots from same lie — focus on hitting 1/2 inch to 1 inch behind the ball'},
      {type:'block', text:'5-10 shots to same pin — Alternate between high and low shots'},
      {type:'random', text:'Different lies — flat, clean, uphill/downhill, plugged etc'}
    ]}
  ];
}

function ppGenRangeGroups(lm) {
  var maxAppDist = ppGetMaxApproachDist();
  var groups = [
    { name: '30-70 yds', detail: ppFindClubsInRange(30, 70), tips: [
      {type:'random', text:'Leapfrog — carry first ball 30, then 35, etc until 70 yards', drillId:'leapfrog_wedges', drillCat:'fullswing'},
      {type:'block', text:'5-10 shots at each yardage — 30, 40, 50, 60, 70'}
    ]},
    { name: '80-120 yds', detail: ppFindClubsInRange(80, 120), tips: [
      {type:'block', text:'3-7 shots with same wedge to 80, 90, 100, 110, and 120'},
      {type:'random', text:'Leapfrog — 80, 90, 100, 110, 120 yd targets, different club each shot', drillId:'leapfrog_wedges', drillCat:'fullswing'},
      {type:'random', text:'3 clubs one carry — hit 3 wedges the same carry, SW, GW, PW all 100 carry for example'}
    ]}
  ];
  if (lm) {
    groups[0].tips.push({type:'random', text:'Run a Wedge Combine', combineFunc:'goToWedgeCombine'});
    groups[1].tips.push({type:'random', text:'Run a Wedge Combine', combineFunc:'goToWedgeCombine'});
  }

  var ironTips = [
    {type:'block', text:'10 shots to same target — focus on center contact and hitting ball first'},
    {type:'block', text:'10 shots to same target — focus on consistent shot shape'},
    {type:'random', text:'Alternate clubs to different targets, pre shot routine on every shot'},
    {type:'random', text:'9 Shot Challenge — 9 different shot shapes to same target with same club', drillId:'9shot_challenge', drillCat:'fullswing'}
  ];
  if (maxAppDist > 120) { var u1 = Math.min(150, maxAppDist); groups.push({ name: '120-' + u1 + ' yds', detail: ppFindClubsInRange(120, u1), tips: ironTips }); }
  if (maxAppDist > 150) { var u2 = Math.min(180, maxAppDist); groups.push({ name: '150-' + u2 + ' yds', detail: ppFindClubsInRange(150, u2), tips: ironTips }); }
  if (maxAppDist > 180) { var u3 = Math.min(210, maxAppDist); groups.push({ name: '180-' + u3 + ' yds', detail: ppFindClubsInRange(180, u3), tips: ironTips }); }
  if (maxAppDist > 210) { groups.push({ name: '210-' + maxAppDist + ' yds', detail: ppFindClubsInRange(210, maxAppDist), tips: ironTips }); }

  // Driver & wood groups
  var clubs = getBagClubs();
  var driverName = '', woodName = '';
  if (clubs && clubs.length) {
    clubs.forEach(function(c) {
      if (c.name === 'Dr' && !driverName) driverName = c.name;
      if ((c.name === '3W' || c.name === '2W' || c.name === '4W' || c.name === '5W') && !woodName) woodName = c.name;
    });
  }
  groups.push({ name: 'Driver', detail: driverName, tips: [
    {type:'block', text:'10 drivers to same fairway target — aim for 7/10 hit rate'},
    {type:'block', text:'Swing at 80% — 10 shots focusing on center strike not distance'},
    {type:'block', text:'10 draws in a row to same target'},
    {type:'block', text:'10 fades in a row to same target'},
    {type:'random', text:'Tee shot simulation — pick a hole, pick a target, commit, then switch holes'},
    {type:'random', text:'Alternate draw/fade — switch shape every shot'},
    {type:'random', text:'3 balls same target — watch the dispersion, adjust tempo'}
  ]});
  groups.push({ name: '3 Wood / hybrid off tee', detail: woodName, tips: [
    {type:'block', text:'10 shots with 3W to same target — focus on solid contact'},
    {type:'block', text:'Punch shots — 10 low trajectory shots in a row'},
    {type:'random', text:'Tight fairway sim — narrow your target, change target each shot'},
    {type:'random', text:'Alternate draw and fade off the tee — different shape each shot'}
  ]});

  return groups;
}

function ppGenPickFromGroups(allGroups, totalMins, drillCountPref, cat) {
  // Determine how many drills to pick
  var numDrills = drillCountPref || Math.min(4, Math.max(1, Math.floor(totalMins / 10)));
  if (numDrills > allGroups.length) numDrills = allGroups.length;

  // Shuffle and pick groups
  var shuffled = allGroups.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  var picked = shuffled.slice(0, numDrills);
  // Sort back to original order
  picked.sort(function(a, b) { return allGroups.indexOf(a) - allGroups.indexOf(b); });

  // Distribute time
  var perDrill = ppRound5(totalMins / picked.length);
  var remaining = totalMins;

  var results = [];
  picked.forEach(function(g, idx) {
    var mins = (idx === picked.length - 1) ? remaining : perDrill;
    remaining -= mins;

    // Pick a tip based on type preference
    var blockTips = g.tips.filter(function(t) { return t.type === 'block'; });
    var randomTips = g.tips.filter(function(t) { return t.type === 'random'; });
    var tip = null;
    if (_ppGenType === 'block' && blockTips.length) {
      tip = blockTips[Math.floor(Math.random() * blockTips.length)];
    } else if (_ppGenType === 'random' && randomTips.length) {
      tip = randomTips[Math.floor(Math.random() * randomTips.length)];
    } else {
      // Split: pick one block or one random at random
      var pool = g.tips.slice();
      tip = pool[Math.floor(Math.random() * pool.length)];
    }

    results.push({ name: g.name, detail: g.detail, mins: mins, tip: tip, cat: cat });
  });
  return results;
}

export function ppDrawPie(cats, total) {
  var canvas = document.getElementById('ppPieChart');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  canvas.width = 280 * dpr;
  canvas.height = 280 * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, 280, 280);

  var cx = 140, cy = 140, r = 110, ir = 60;
  var startAngle = -Math.PI / 2;
  var endAngle = startAngle + Math.PI * 2;
  var angle = startAngle;

  cats.forEach(function(c, idx) {
    var isLast = idx === cats.length - 1;
    var sliceEnd = isLast ? endAngle : angle + (c.mins / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + ir * Math.cos(angle), cy + ir * Math.sin(angle));
    ctx.arc(cx, cy, r, angle, sliceEnd);
    ctx.arc(cx, cy, ir, sliceEnd, angle, true);
    ctx.closePath();
    ctx.fillStyle = c.color;
    ctx.fill();
    // Label: category name + time on the slice
    var mid = (angle + sliceEnd) / 2;
    var lr = (r + ir) / 2;
    var lx = cx + lr * Math.cos(mid);
    var ly = cy + lr * Math.sin(mid);
    // Clamp labels so they don't hang off the canvas edge
    var pad = 24;
    if (lx < pad) lx = pad;
    if (lx > 280 - pad) lx = 280 - pad;
    if (ly < pad) ly = pad;
    if (ly > 280 - pad) ly = 280 - pad;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Only show labels if slice is big enough
    var sliceAngle = sliceEnd - angle;
    if (sliceAngle > 0.6) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(c.label, lx, ly - 7);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(c.mins + ' min', lx, ly + 8);
    } else if (sliceAngle > 0.3) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(c.mins + 'm', lx, ly);
    }
    angle = sliceEnd;
  });

  // Center text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total + ' min', cx, cy - 6);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#9a9a9a';
  ctx.fillText('total practice', cx, cy + 14);
}

// Functions called from inline HTML handlers
expose({ ppShowGenerator, ppGenToggleCat, ppGenSetType, ppGenGenerate });
