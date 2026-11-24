import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { bagWgGetLatestForClub, getBagClubs } from '../bag/clubs.js';
import { WG_WEDGE_LIST } from '../bag/wedge-gapping.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { getTodayCentral } from '../coaching/core.js';
import { drillsData } from '../coaching/data-drills.js';
import { ppDrawPie } from './generator.js';
import { initPracticeSessionForm, loadPracticeHistory, loadPracticePlanCombineOptions, renderPracticeNotes } from './log.js';
import { hasLaunchMonitor } from '../coaching/core.js';
import { getExpectedPutts, getExpectedStrokes } from '../coaching/sg-calc.js';

// ── Practice Plan: Tour / Recommended / Timed ──
var _ppTime = 90;
var _ppMode = 'recommended'; // 'recommended' or 'timed'
var _ppSGData = null;

export function ppHideAllViews() {
  ['ppLanding','ppTourView','ppRecommendedView','ppLogView','ppHistoryView','ppCustomView','ppCustomUseView','ppGeneratorView','ppWarmUpView','ppSwingJournalView'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

export function ppBackToLanding() {
  ppHideAllViews();
  document.getElementById('ppLanding').style.display = '';
}

var _ppTourSeason = 1; // 0=off season, 1=in season, 2=pre tournament

function ppShowTourPractice() {
  ppHideAllViews();
  document.getElementById('ppTourView').style.display = '';
  _ppTourSeason = 1;
  ppShowTourSeason(1);
}

function ppShowTourSeason(idx) {
  _ppTourSeason = idx;
  for (var i = 0; i < 3; i++) {
    var btn = document.getElementById('ppTourSeasonTab' + i);
    if (btn) {
      btn.style.background = i === idx ? '#2d7abc' : '#282828';
      btn.style.color = i === idx ? '#ffffff' : '#606060';
    }
  }
  ppRenderTourRoutine();
}

function ppShowRecommended() {
  _ppMode = 'recommended';
  ppHideAllViews();
  document.getElementById('ppRecommendedView').style.display = '';
  document.getElementById('ppRecTitle').textContent = 'Recommended Practice';
  document.getElementById('ppRecSubtitle').textContent = 'Based on your strokes gained data';
  document.getElementById('ppTimeInputWrap').style.display = 'none';
  _ppTime = 90;
  ppLoadAndRender();
}

function ppShowTimed() {
  _ppMode = 'timed';
  ppHideAllViews();
  document.getElementById('ppRecommendedView').style.display = '';
  document.getElementById('ppRecTitle').textContent = 'Timed Practice';
  document.getElementById('ppRecSubtitle').textContent = 'Focused plan for your available time';
  document.getElementById('ppTimeInputWrap').style.display = '';
  _ppTime = 90;
  ppLoadAndRender();
}

export function ppShowLogSession() {
  ppHideAllViews();
  document.getElementById('ppLogView').style.display = '';
  initPracticeSessionForm();
  loadPracticePlanCombineOptions();
}

export function ppShowHistory() {
  ppHideAllViews();
  document.getElementById('ppHistoryView').style.display = '';
  loadPracticeHistory();
}

function ppSetTime(mins) {
  if (!mins || mins < 10) mins = 10;
  if (mins > 300) mins = 300;
  _ppTime = mins;
  if (_ppSGData) ppRenderPlan(_ppSGData);
}

async function ppLoadAndRender() {
  var loading = document.getElementById('ppRecLoading');
  var noData = document.getElementById('ppRecNoData');
  var results = document.getElementById('ppRecResults');
  loading.style.display = 'block';
  noData.style.display = 'none';
  results.style.display = 'none';

  if (!S.currentUser) {
    loading.style.display = 'none';
    noData.style.display = 'block';
    noData.textContent = 'Log in to get personalized practice recommendations.';
    return;
  }

  var resp = await _sb.from('rounds').select('*').eq('user_id', activeUserId()).order('round_date', { ascending: false }).limit(5);
  var data = resp.data;

  // Also fetch recent combine scores
  var combResp = await _sb.from('combine_scores').select('combine_type, total_sg, filled_count, combine_date').eq('user_id', activeUserId()).order('combine_date', { ascending: false }).limit(20);
  var combines = combResp.data || [];

  loading.style.display = 'none';

  if ((!data || data.length === 0) && combines.length === 0) {
    noData.style.display = 'block';
    return;
  }

  // Aggregate SG across recent rounds
  var sg = { ott:0, app:0, arg:0, putt:0, holes:0 };
  var hcp = (document.getElementById('playerHandicap') || {}).value || '10';
  data.forEach(function(r) {
    var rd = r.round_data || {};
    var holes = rd.allHoles || [];
    if (rd.entryMode === 'simple' || holes.length === 0) return;
    holes.forEach(function(h) {
      var shots = h.shots || [];
      var hOTT=0, hAPP=0, hARG=0, hPutt=0;
      shots.forEach(function(s, idx) {
        if (!s.lie || s.lie === 'PENALTY') return;
        var db = s.distanceBefore||0, da = s.distanceAfter||0;
        var isTeePar45 = s.shotNum===1 && (h.par===4||h.par===5);
        var isTeePar3 = s.shotNum===1 && h.par===3;
        var expBefore, expAfter, sgVal;
        if (s.isPutt) {
          expBefore = getExpectedPutts(db, hcp);
          expAfter = da > 0 ? getExpectedPutts(da, hcp) : 0;
          sgVal = expBefore - expAfter - 1;
          hPutt += sgVal;
        } else if (isTeePar45) {
          expBefore = getExpectedStrokes(db, 'TEE', hcp);
          expAfter = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : getExpectedStrokes(da, s.lie, hcp);
          sgVal = expBefore - expAfter - 1;
          hOTT += sgVal;
        } else if (isTeePar3 || (!s.isPutt && !isTeePar45)) {
          var prevLie = idx > 0 ? shots[idx-1].lie : 'FAIRWAY';
          if (s.shotNum === 1) prevLie = 'TEE';
          expBefore = s.shotNum === 1 ? getExpectedStrokes(db, 'TEE', hcp) : getExpectedStrokes(db, prevLie, hcp);
          expAfter = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : (da > 0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
          sgVal = expBefore - expAfter - 1;
          // Classify: around the green if 30 yards or less and not a tee shot
          if (s.shotNum > 1 && db <= 30 && !s.isPutt) hARG += sgVal;
          else hAPP += sgVal;
        }
      });
      sg.ott += hOTT; sg.app += hAPP; sg.arg += hARG; sg.putt += hPutt;
      sg.holes++;
    });
  });

  // Aggregate combine SG by category — only use putting and wedge combines
  // Driver and chipping combines use different scoring, not comparable to round SG
  var combSG = { putt: [], app: [] };
  combines.forEach(function(c) {
    if (c.total_sg == null) return;
    var type = (c.combine_type || '').toLowerCase();
    if (type === 'putting') combSG.putt.push(c.total_sg);
    else if (type === 'wedge') combSG.app.push(c.total_sg);
  });

  // Average each combine category
  var combAvg = {};
  ['putt','app'].forEach(function(k) {
    if (combSG[k].length > 0) {
      combAvg[k] = combSG[k].reduce(function(s,v){return s+v;},0) / combSG[k].length;
    }
  });

  if (sg.holes === 0 && Object.keys(combAvg).length === 0) {
    noData.style.display = 'block';
    return;
  }

  // Normalize round SG to per-18 values
  var roundSG = { ott: 0, app: 0, arg: 0, putt: 0 };
  if (sg.holes > 0) {
    var scale = 18 / sg.holes;
    roundSG.ott = sg.ott * scale;
    roundSG.app = sg.app * scale;
    roundSG.arg = sg.arg * scale;
    roundSG.putt = sg.putt * scale;
  }

  // Blend: round data weighted 70%, combine data 30% (if both exist)
  // If only one source exists, use 100% of that source
  var blended = {};
  ['ott','app','arg','putt'].forEach(function(k) {
    var hasRound = sg.holes > 0;
    var hasComb = combAvg[k] != null;
    if (hasRound && hasComb) {
      blended[k] = roundSG[k] * 0.7 + combAvg[k] * 0.3;
    } else if (hasRound) {
      blended[k] = roundSG[k];
    } else if (hasComb) {
      blended[k] = combAvg[k];
    } else {
      blended[k] = 0;
    }
  });

  _ppSGData = {
    ott: blended.ott,
    app: blended.app,
    arg: blended.arg,
    putt: blended.putt,
    rounds: data ? data.length : 0,
    holes: sg.holes,
    combinesUsed: combines.length
  };

  results.style.display = '';
  ppRenderPlan(_ppSGData);
}

function ppRenderPlan(sg) {
  // Categories: more negative SG = more strokes lost = needs more practice time
  var cats = [
    { key:'ott', label:'OTT', fullLabel:'Off the Tee', sg:sg.ott, color:'#d4706e' },
    { key:'app', label:'APP', fullLabel:'Approach', sg:sg.app, color:'#44b8f0' },
    { key:'arg', label:'ARG', fullLabel:'Around the Green', sg:sg.arg, color:'#00b87a' },
    { key:'putt', label:'Putt', fullLabel:'Putting', sg:sg.putt, color:'#f6b26b' }
  ];

  // Convert SG to "need" weight: more negative = more weight
  var weights = cats.map(function(c) {
    return Math.max(0.05, -c.sg);
  });
  var totalNeed = weights.reduce(function(s, w) { return s + w; }, 0);

  // All time goes to categories - snap to nearest 5 for clean distribution
  var practiceMins = Math.round(_ppTime / 5) * 5;
  if (practiceMins < 20) practiceMins = 20;

  // Minimum per category: 10 mins normally, 5 mins if total time is 30 or less
  var minPerCat = _ppTime <= 30 ? 5 : 10;
  var minTotal = minPerCat * 4;

  // If not enough time for all minimums, distribute evenly
  if (practiceMins <= minTotal) {
    var each = Math.floor(practiceMins / 4);
    cats.forEach(function(c) { c.mins = each; });
    var remainder = practiceMins - each * 4;
    cats.sort(function(a, b) { return a.sg - b.sg; });
    if (remainder > 0) cats[0].mins += remainder;
  } else {
    var extraMins = practiceMins - minTotal;
    cats.forEach(function(c, i) {
      var pct = weights[i] / totalNeed;
      // Round to nearest 5
      c.mins = minPerCat + Math.round(pct * extraMins / 5) * 5;
      if (c.mins < minPerCat) c.mins = minPerCat;
    });
    // Fix rounding so sum === practiceMins, adjust weakest category
    var sumMins = cats.reduce(function(s, c) { return s + c.mins; }, 0);
    cats.sort(function(a, b) { return a.sg - b.sg; });
    cats[0].mins += (practiceMins - sumMins);
    if (cats[0].mins < minPerCat) cats[0].mins = minPerCat;
  }

  // Recalc pcts from final mins
  cats.forEach(function(c) { c.pct = Math.round(c.mins / practiceMins * 100); });
  cats.sort(function(a, b) { return a.sg - b.sg; }); // worst first

  // Build pie chart categories — group APP + OTT into "Range"
  var pieCats = [];
  var rangeMins = 0;
  var rangePct = 0;
  cats.forEach(function(c) {
    if (c.key === 'app' || c.key === 'ott') {
      rangeMins += c.mins;
      rangePct += c.pct;
    } else {
      pieCats.push(c);
    }
  });
  if (rangeMins > 0) {
    pieCats.unshift({ key: 'range', label: 'Range', fullLabel: 'Range', mins: rangeMins, pct: rangePct, color: '#d4706e' });
  }

  // Draw pie chart with grouped categories
  ppDrawPie(pieCats, practiceMins);

  // Build breakdown cards — order: APP, OTT, then rest (so range drills are together)
  var html = '';
  var appCat = null, ottCat = null, otherCats = [];
  cats.forEach(function(c) {
    if (c.key === 'app') appCat = c;
    else if (c.key === 'ott') ottCat = c;
    else otherCats.push(c);
  });

  // Show range header with combined time
  if (appCat || ottCat) {
    html += '<div style="font-size:12px;font-weight:700;color:#d4706e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Range — ' + rangeMins + ' min</div>';
  }

  var orderedCats = [];
  if (appCat) orderedCats.push(appCat);
  if (ottCat) orderedCats.push(ottCat);
  orderedCats = orderedCats.concat(otherCats);

  orderedCats.forEach(function(c, ci) {
    var drills = ppGetDrills(c.key, c.mins, c.sg);
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;border-left:4px solid ' + c.color + ';">';
    html += '<div onclick="this.parentElement.querySelector(\'.pp-drill-detail\').style.display=this.parentElement.querySelector(\'.pp-drill-detail\').style.display===\'none\'?\'\':\'none\'" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;">' + c.fullLabel + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span style="font-size:11px;font-weight:600;color:' + (c.sg < 0 ? '#d4706e' : '#00b87a') + ';">' + (c.sg >= 0 ? '+' : '') + c.sg.toFixed(1) + ' SG</span>';
    html += '<span style="font-size:13px;font-weight:700;color:' + c.color + ';">' + c.mins + ' min</span>';
    html += '</div></div>';
    html += '<div class="pp-drill-detail" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #333;">';
    drills.forEach(function(d, di) {
      var uid = 'ppDrill_' + ci + '_' + di;
      var tipsId = 'ppTips_' + ci + '_' + di;
      var wpId = 'wpTips_' + ci + '_' + di;
      var hasWpTips = d.tips && d.tips.length;
      var wpToggleHtml = '';
      var wpExpandHtml = '';
      if (hasWpTips) {
        // Pick 1 random Block tip and 1 random Random tip
        var blockTips = d.tips.filter(function(t) {
          return typeof t === 'object' ? t.type === 'block' : t.indexOf('Block:') === 0;
        });
        var randomTips = d.tips.filter(function(t) {
          return typeof t === 'object' ? t.type === 'random' : t.indexOf('Random:') === 0;
        });
        var pickedTips = [];
        if (blockTips.length) pickedTips.push(blockTips[Math.floor(Math.random() * blockTips.length)]);
        if (randomTips.length) pickedTips.push(randomTips[Math.floor(Math.random() * randomTips.length)]);
        wpToggleHtml = '<div onclick="var el=document.getElementById(\'' + wpId + '\');var arr=this.querySelector(\'span\');if(el.style.display===\'none\'){el.style.display=\'block\';arr.textContent=\'▾\';}else{el.style.display=\'none\';arr.textContent=\'▸\';};event.stopPropagation();" style="font-size:10px;color:#44b8f0;cursor:pointer;font-weight:600;text-decoration:underline;white-space:nowrap;margin-left:8px;">Drills <span style="text-decoration:none;display:inline-block;">▸</span></div>';
        wpExpandHtml = '<div id="' + wpId + '" style="display:none;margin-top:4px;margin-left:34px;text-align:left;">';
        pickedTips.forEach(function(tip) {
          var label = '';
          var drillName = '';
          var drillId = null;
          var drillCat = null;
          var combineFunc = null;
          if (typeof tip === 'object') {
            label = tip.type === 'block' ? 'Block' : tip.type === 'random' ? 'Random' : '';
            drillId = tip.drillId;
            drillCat = tip.drillCat;
            combineFunc = tip.combineFunc || null;
            if (drillId && drillCat && drillsData[drillCat]) {
              var drillObj = drillsData[drillCat].find(function(dd) { return dd.id === drillId; });
              drillName = drillObj ? drillObj.title : tip.text;
            } else {
              drillName = tip.text;
            }
          } else {
            if (tip.indexOf('Block:') === 0) { label = 'Block'; drillName = tip.substring(6).trim(); }
            else if (tip.indexOf('Random:') === 0) { label = 'Random'; drillName = tip.substring(7).trim(); }
            else { drillName = tip; }
          }
          var labelColor = label === 'Block' ? '#44b8f0' : '#e6a84d';
          var labelHtml = label ? '<span style="font-size:11px;font-weight:700;color:' + labelColor + ';margin-right:6px;">' + label + ' -</span>' : '';
          if (combineFunc) {
            wpExpandHtml += '<div style="font-size:12px;padding:4px 0;text-align:left;">' + labelHtml + '<a onclick="' + combineFunc + '();event.stopPropagation();" style="color:#44b8f0;font-weight:700;cursor:pointer;text-decoration:underline;">' + drillName + '</a></div>';
          } else if (drillId && drillCat) {
            wpExpandHtml += '<div style="font-size:12px;padding:4px 0;text-align:left;">' + labelHtml + '<a onclick="ppOpenDrillFromPractice(\'' + drillId + '\',\'' + drillCat + '\');event.stopPropagation();" style="color:#44b8f0;font-weight:700;cursor:pointer;text-decoration:underline;">' + drillName + '</a></div>';
          } else {
            wpExpandHtml += '<div style="font-size:12px;color:#9a9a9a;padding:4px 0;text-align:left;">' + labelHtml + drillName + '</div>';
          }
        });
        wpExpandHtml += '</div>';
      }
      html += '<div style="padding:6px 0;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<div id="' + uid + '" onclick="ppToggleDrill(this,event)" style="width:24px;height:24px;min-width:24px;border-radius:50%;border:2px solid #3d3d3d;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>';
      html += '<div style="flex:1;"><div style="font-size:13px;color:#9a9a9a;">' + d.name + '</div>';
      if (d.detail) html += '<div style="font-size:11px;color:#606060;margin-top:2px;">' + d.detail + '</div>';
      html += '</div>';
      if (hasWpTips) html += wpToggleHtml;
      html += '<div style="display:flex;align-items:center;gap:2px;white-space:nowrap;margin-left:8px;">';
      html += '<input type="number" value="' + d.mins + '" min="1" max="120" style="width:36px;height:24px;background:#1e1e1e;color:#9a9a9a;border:1px solid #3d3d3d;border-radius:6px;text-align:center;font-size:11px;font-weight:700;padding:0;font-family:inherit;" onclick="event.stopPropagation()">';
      html += '<span style="font-size:10px;color:#606060;">min</span></div>';
      html += '</div>';
      if (hasWpTips) html += wpExpandHtml;
      html += '</div>';
    });
    html += '</div></div>';
  });

  document.getElementById('ppBreakdownList').innerHTML = html;
}

function ppToggleDrill(el, e) {
  e.stopPropagation();
  var done = el.getAttribute('data-done') === '1';
  if (done) {
    el.setAttribute('data-done', '0');
    el.style.background = 'transparent';
    el.style.borderColor = '#606060';
    el.innerHTML = '';
    // Un-strike the text
    var textEl = el.nextElementSibling;
    if (textEl) { textEl.style.opacity = '1'; textEl.style.textDecoration = 'none'; }
  } else {
    el.setAttribute('data-done', '1');
    el.style.background = '#00b87a';
    el.style.borderColor = '#00b87a';
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    // Strike-through the text
    var textEl = el.nextElementSibling;
    if (textEl) { textEl.style.opacity = '0.5'; textEl.style.textDecoration = 'line-through'; }
  }
}

function ppLogFromPractice(source) {
  // Collect checked drills from the active practice view
  var container;
  if (source === 'tour') {
    container = document.getElementById('ppTourContent');
  } else if (source === 'custom') {
    container = document.getElementById('ppCustomUseContent');
  } else if (source === 'gen') {
    container = document.getElementById('ppGenResults');
  } else {
    container = document.getElementById('ppBreakdownList');
  }
  var notes = [];
  if (container) {
    var checkboxes = container.querySelectorAll('[data-done="1"]');
    checkboxes.forEach(function(cb) {
      var row = cb.parentElement;
      if (!row) return;
      var textEl = cb.nextElementSibling;
      if (!textEl) return;
      var name = textEl.textContent.trim();
      // Check for editable time input first
      var mins = 0;
      var timeInput = row.querySelector('input[type="number"]');
      if (timeInput) {
        mins = parseInt(timeInput.value) || 0;
      }
      if (!mins) {
        var minsEl = row.querySelector('div[style*="white-space:nowrap"]');
        if (minsEl) {
          var m = minsEl.textContent.match(/(\d+)/);
          if (m) mins = parseInt(m[1]);
        }
      }
      // For tour/custom items, parse mins from the text like "Dynamic stretching & mobility (5 min)"
      if (!mins && (source === 'tour' || source === 'custom')) {
        var pm = name.match(/\((\d+)\s*min\)/);
        if (pm) {
          mins = parseInt(pm[1]);
          name = name.replace(/\s*\(\d+\s*min\)/, '').trim();
        }
      }
      if (name) notes.push({ text: name, minutes: mins || 5, done: true });
    });
  }

  // If no drills checked, still go to log but empty
  S.practiceNotes = notes;
  S.editingPracticeSessionId = null;

  // Navigate to log view
  ppHideAllViews();
  document.getElementById('ppLogView').style.display = '';
  initPracticeSessionForm();
  S.practiceNotes = notes; // re-set after initPracticeSessionForm clears them
  renderPracticeNotes();

  var dateInput = document.getElementById('ppSessionDate');
  if (dateInput) dateInput.value = getTodayCentral();
}

export function ppFindClubsInRange(minYds, maxYds) {
  var clubs = getBagClubs();
  if (!clubs || !clubs.length) return '';
  var matched = [];
  clubs.forEach(function(c) {
    var dist = c.carry || c.total || 0;
    if (dist >= minYds && dist <= maxYds) {
      matched.push({ name: c.name, dist: dist });
      return;
    }
    // For wedges, also check gapping partial swing distances
    var isWedge = (typeof WG_WEDGE_LIST !== 'undefined') && WG_WEDGE_LIST.indexOf(c.name) >= 0;
    if (isWedge) {
      var wgSess = bagWgGetLatestForClub(c.name);
      if (wgSess && wgSess.results && wgSess.results[c.name]) {
        var clubData = wgSess.results[c.name];
        for (var key in clubData) {
          if (clubData.hasOwnProperty(key) && clubData[key] && clubData[key].avg != null) {
            var avg = clubData[key].avg;
            if (avg >= minYds && avg <= maxYds) {
              matched.push({ name: c.name, dist: avg });
              return;
            }
          }
        }
      }
    }
  });
  matched.sort(function(a, b) { return a.dist - b.dist; });
  // Deduplicate club names
  var seen = {};
  return matched.filter(function(m) {
    if (seen[m.name]) return false;
    seen[m.name] = true;
    return true;
  }).map(function(m) { return m.name; }).join(', ');
}

export function ppGetMaxApproachDist() {
  var clubs = getBagClubs();
  if (!clubs || !clubs.length) return 210; // default when no bag
  var woodHybridNames = ['2W','3W','4W','5W','6W','7W','2HY','3HY','4HY','5HY','6HY','7HY'];
  var maxDist = 0;
  clubs.forEach(function(c) {
    if (woodHybridNames.indexOf(c.name) >= 0) {
      var dist = c.carry || c.total || 0;
      if (dist > maxDist) maxDist = dist;
    }
  });
  return maxDist || 210;
}

export function ppRound5(n) { return Math.round(n / 5) * 5 || 5; }

function ppGetDrills(category, totalMins, sgVal) {
  var drills = [];
  var lm = hasLaunchMonitor();
  if (category === 'putt') {
    var shortTips = [
      {type:'block', text:'Gate Drill — two tees just wider than your putter, make 10 in a row', drillId:'gate', drillCat:'putting'},
      {type:'block', text:'Double Gate Drill — One gate for putter, one for ball, make 10 in a row', drillId:'double_gate', drillCat:'putting'},
      {type:'block', text:'Clock Drill/Around the World — 4-8 putts in a circle from 3-7 ft', drillId:'clock', drillCat:'putting'},
      {type:'random', text:'Spiral Pressure Drill — Series of 3, 5, 7 ft putts, must make them in a row', drillId:'spiral_pressure', drillCat:'putting'},
      {type:'random', text:'Run a Short Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Leapfrog Gates — 5-6 gates 3-7 ft 12 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ];
    var midTips = [
      {type:'block', text:'Gate Drill — two tees just wider than your putter, make 7 in a row', drillId:'gate', drillCat:'putting'},
      {type:'block', text:'3, 6, 9 Drill — make 9 in a row, 3 from each distance, restart on miss', drillId:'369_drill', drillCat:'putting'},
      {type:'random', text:'Clock Drill/Around the World — 4-8 putts in a circle from 7-15 ft', drillId:'clock', drillCat:'putting'},
      {type:'random', text:'Run a Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Double Gate Drill — One gate for putter, one for ball, make 10 in a row', drillId:'double_gate', drillCat:'putting'},
      {type:'block', text:'Leapfrog Gates — 5-8 gates 7-15 ft 18 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ];
    var midLagTips = [
      {type:'random', text:'Run a Putting Combine', combineFunc:'goToPuttingCombine'},
      {type:'block', text:'Leapfrog Drill — putt to 15 ft, next putt must go farther, max is 25 ft', drillId:'leapfrog_putting', drillCat:'putting'},
      {type:'block', text:'Leapfrog Gates — 5-8 gates 15-25 ft 24 inches apart, one ball through each gate in order', drillId:'leapfrog_gates', drillCat:'putting'}
    ];
    var lagTips = [
      {type:'block', text:'Anti 3-Putt Drill — two-putt from increasing distances, restart on 3-putt', drillId:'anti_3putt', drillCat:'putting'},
      {type:'block', text:'Leapfrog Drill — putt to 25 ft, next putt must go farther, max is 50 ft', drillId:'leapfrog_putting', drillCat:'putting'},
      {type:'random', text:'Run a Putting Combine for long putts', combineFunc:'goToPuttingCombine'},
      {type:'random', text:'Speed Calibration — 2 putts from 15-50 feet, focused on speed control', drillId:'speed_calibration', drillCat:'putting'}
    ];
    if (totalMins <= 15) {
      var t1 = ppRound5(totalMins * 0.6);
      var t2 = totalMins - t1;
      drills.push({ name: 'Putts 3-7 ft', mins: t1, detail: '', tips: shortTips });
      drills.push({ name: 'Lag putts 25-50 ft', mins: t2, detail: '', tips: lagTips });
    } else if (totalMins <= 30) {
      var t1 = ppRound5(totalMins * 0.35);
      var t2 = ppRound5(totalMins * 0.35);
      var t3 = totalMins - t1 - t2;
      drills.push({ name: 'Putts 3-7 ft', mins: t1, detail: '', tips: shortTips });
      drills.push({ name: 'Putts 7-15 ft', mins: t2, detail: '', tips: midTips });
      drills.push({ name: 'Lag putts 25-50 ft', mins: t3, detail: '', tips: lagTips });
    } else {
      var t1 = ppRound5(totalMins * 0.25);
      var t2 = ppRound5(totalMins * 0.25);
      var t3 = ppRound5(totalMins * 0.25);
      var t4 = totalMins - t1 - t2 - t3;
      drills.push({ name: 'Putts 3-7 ft', mins: t1, detail: '', tips: shortTips });
      drills.push({ name: 'Putts 7-15 ft', mins: t2, detail: '', tips: midTips });
      drills.push({ name: 'Putts 15-25 ft', mins: t3, detail: '', tips: midLagTips });
      drills.push({ name: 'Lag putts 25-50 ft', mins: t4, detail: '', tips: lagTips });
    }
  } else if (category === 'arg') {
    var argClubs10_30 = ppFindClubsInRange(10, 30);
    var chipTips = [
      {type:'block', text:'5-10 shots from 10, 20, 30 yards, focus on consistent landing spot and trajectory'},
      {type:'block', text:'Flamingo Drill — 99% of weight on lead foot, focus on controlling low point in front of ball', drillId:'flamingo', drillCat:'shortgame'},
      {type:'block', text:'Chipping Leapfrog — each chip lands past the previous one, focus on distance control', drillId:'chipping_leapfrog', drillCat:'shortgame'},
      {type:'random', text:'Low/mid/high — alternate all 3 trajectories to the same hole'},
      {type:'random', text:'Up & Down Combine — Play holes from 10-30 yards and hole out'},
      {type:'random', text:'Run a Shortgame Combine', combineFunc:'goToCombines'}
    ];
    var bunkerTips = [
      {type:'block', text:'5-10 shots from same lie — focus on hitting 1/2 inch to 1 inch behind the ball'},
      {type:'block', text:'5-10 shots to same pin — Alternate between high and low shots'},
      {type:'random', text:'Different lies — flat, clean, uphill/downhill, plugged etc'}
    ];
    if (totalMins <= 15) {
      var t1 = ppRound5(totalMins * 0.6);
      var t2 = totalMins - t1;
      drills.push({ name: 'Chipping 10-30 yds', mins: t1, detail: argClubs10_30, tips: chipTips });
      drills.push({ name: 'Bunker play', mins: t2, detail: '', tips: bunkerTips });
    } else {
      var t1 = ppRound5(totalMins * 0.6);
      var t2 = totalMins - t1;
      drills.push({ name: 'Chipping 10-30 yds', mins: t1, detail: argClubs10_30, tips: chipTips });
      drills.push({ name: 'Bunker play', mins: t2, detail: '', tips: bunkerTips });
    }
  } else if (category === 'app') {
    // Determine max approach distance from player's bag (highest non-driver wood/hybrid carry)
    var maxAppDist = ppGetMaxApproachDist();

    var appClubs30_70 = ppFindClubsInRange(30, 70);
    var appClubs80_120 = ppFindClubsInRange(80, 120);

    var shortWedgeTips = [
      {type:'random', text:'Leapfrog — carry first ball 30, then 35, etc until 70 yards. Increments of 5 or 10 yards', drillId:'leapfrog_wedges', drillCat:'fullswing'},
      {type:'block', text:'5-10 shots at each yardage — 30, 40, 50, 60, 70'}
    ];
    if (lm) {
      shortWedgeTips.push({type:'random', text:'Run a Wedge Combine', combineFunc:'goToWedgeCombine'});
    }

    var wedgeTips = [
      {type:'block', text:'3-7 shots with same wedge to 80, 90, 100, 110, and 120'},
      {type:'random', text:'Leapfrog — 80, 90, 100, 110, 120 yd targets, different club each shot', drillId:'leapfrog_wedges', drillCat:'fullswing'},
      {type:'random', text:'3 clubs one carry — hit 3 wedges the same carry, SW, GW, PW all 100 carry for example'}
    ];
    if (lm) {
      wedgeTips.push({type:'random', text:'Run a Wedge Combine', combineFunc:'goToWedgeCombine'});
    }

    var ironTips = [
      {type:'block', text:'10 shots to same target — focus on center contact and hitting ball first'},
      {type:'block', text:'10 shots to same target — focus on consistent shot shape'},
      {type:'random', text:'Alternate clubs to different targets, pre shot routine on every shot'},
      {type:'random', text:'9 Shot Challenge — 9 different shot shapes to same target with same club', drillId:'9shot_challenge', drillCat:'fullswing'}
    ];

    // Build all possible approach bands based on max approach distance
    var allBands = [
      { name: '30-70 yds', detail: appClubs30_70, tips: shortWedgeTips },
      { name: '80-120 yds', detail: appClubs80_120, tips: wedgeTips }
    ];
    if (maxAppDist > 120) {
      var upper1 = Math.min(150, maxAppDist);
      allBands.push({ name: '120-' + upper1 + ' yds', detail: ppFindClubsInRange(120, upper1), tips: ironTips });
    }
    if (maxAppDist > 150) {
      var upper2 = Math.min(180, maxAppDist);
      allBands.push({ name: '150-' + upper2 + ' yds', detail: ppFindClubsInRange(150, upper2), tips: ironTips });
    }
    if (maxAppDist > 180) {
      var upper3 = Math.min(210, maxAppDist);
      allBands.push({ name: '180-' + upper3 + ' yds', detail: ppFindClubsInRange(180, upper3), tips: ironTips });
    }
    if (maxAppDist > 210) {
      allBands.push({ name: '210-' + maxAppDist + ' yds', detail: ppFindClubsInRange(210, maxAppDist), tips: ironTips });
    }

    // 3-min warmup: leapfrog wedges 30-70 yds (does not count toward practice time)
    drills.push({ name: 'Warmup — Leapfrog wedges 30-70 yds', mins: 3, detail: appClubs30_70, tips: [
      {type:'block', text:'Leapfrog — carry first ball 30, then 35, etc until 70 yards. Increments of 5 or 10 yards', drillId:'leapfrog_wedges', drillCat:'fullswing'}
    ]});

    // Pick how many bands: 10 min minimum per band, max 4
    var numBands = Math.min(4, Math.max(1, Math.floor(totalMins / 10)));
    if (numBands > allBands.length) numBands = allBands.length;

    // Randomly select which bands to focus on this session
    var shuffled = allBands.slice();
    for (var si = shuffled.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
    }
    var picked = shuffled.slice(0, numBands);
    // Sort picked bands by distance order (match original allBands order)
    picked.sort(function(a, b) { return allBands.indexOf(a) - allBands.indexOf(b); });

    // Distribute time evenly across picked bands, rounded to nearest 5
    var perBand = ppRound5(totalMins / picked.length);
    var remaining = totalMins;
    picked.forEach(function(b, i) {
      var m = (i === picked.length - 1) ? remaining : perBand;
      remaining -= m;
      drills.push({ name: b.name, mins: m, detail: b.detail, tips: b.tips });
    });
  } else if (category === 'ott') {
    var clubs = getBagClubs();
    var driverName = '', woodName = '';
    if (clubs && clubs.length) {
      clubs.forEach(function(c) {
        if (c.name === 'Dr' && !driverName) driverName = c.name;
        if ((c.name === '3W' || c.name === '2W' || c.name === '4W' || c.name === '5W') && !woodName) woodName = c.name;
      });
    }
    var driverTips = [
      {type:'block', text:'10 drivers to same fairway target — aim for 7/10 hit rate'},
      {type:'block', text:'Swing at 80% — 10 shots focusing on center strike not distance'},
      {type:'random', text:'Tee shot simulation — pick a hole, pick a target, commit, then switch holes'},
      {type:'random', text:'Play 9 imaginary holes — change target shape each time'}
    ];
    var driverShapeTips = [
      {type:'block', text:'10 draws in a row to same target'},
      {type:'block', text:'10 fades in a row to same target'},
      {type:'random', text:'Alternate draw/fade — switch shape every shot'},
      {type:'random', text:'Tee shot simulation — play imaginary holes, pick the right shape each time'}
    ];
    var driverTempoTips = [
      {type:'block', text:'10 swings at 70% — same target, focus on center contact'},
      {type:'block', text:'Slow motion swing then real swing — alternate, 10 reps'},
      {type:'random', text:'3 balls same target — watch the dispersion, adjust tempo'},
      {type:'random', text:'Hit driver, then 3W, then driver — change clubs to reset tempo'}
    ];
    var woodTips = [
      {type:'block', text:'10 shots with 3W to same target — focus on solid contact'},
      {type:'block', text:'Punch shots — 10 low trajectory shots in a row'},
      {type:'random', text:'Tight fairway sim — narrow your target, change target each shot'},
      {type:'random', text:'Alternate draw and fade off the tee — different shape each shot'}
    ];
    if (totalMins <= 15) {
      var t1 = ppRound5(totalMins * 0.6);
      var t2 = totalMins - t1;
      drills.push({ name: 'Driver — fairway focus', mins: t1, detail: driverName, tips: driverTips });
      drills.push({ name: '3 Wood / hybrid off tee', mins: t2, detail: woodName, tips: woodTips });
    } else {
      var t1 = ppRound5(totalMins * 0.45);
      var t2 = ppRound5(totalMins * 0.3);
      var t3 = totalMins - t1 - t2;
      drills.push({ name: 'Driver — shape control', mins: t1, detail: driverName, tips: driverShapeTips });
      drills.push({ name: 'Driver — tempo & contact', mins: t2, detail: driverName, tips: driverTempoTips });
      drills.push({ name: '3 Wood / hybrid off tee', mins: t3, detail: woodName, tips: woodTips });
    }
  }
  return drills;
}

function ppRenderTourRoutine() {
  var html = '';

  var inSeasonSections = [
    { title: 'Warm Up & Exercises', color: '#9a9a9a', items: [] },
    { title: 'Putting', color: '#f6b26b', items: [
      { text: 'Make 15 Gate drill in a row from 3 ft' },
      { text: 'Make 15 Double gate drill from 7 ft' },
      { text: 'break' },
      { text: 'Hit 3x5 Around the world from 5 ft', tour: '11/15' },
      { text: 'Hit 3x5 Around the world from 10 ft', tour: '6/15' },
      { text: 'Hit 3x5 Around the world from 15 ft', tour: '3/15' },
      { text: 'break' },
      { text: 'Leapfrog drill — fit 8 balls into 10 ft space from 3 ft' },
      { text: 'Hit 3x3 Around the world from 30 ft', tour: '1.98 putts' },
      { text: 'Play 6 holes with 1 ball: 4ft, 30ft, 9ft, 12ft, 25ft, 6ft', tour: '9.7 putts' }
    ]},
    { title: 'Short Game', color: '#00b87a', items: [
      { text: '5-10 from 5 yds', tour: '<3 ft' },
      { text: '5-10 from 10 yds', tour: '4 ft' },
      { text: '5-10 from 15 yds', tour: '5 ft' },
      { text: '5-10 from 20 yds', tour: '6 ft' },
      { text: '5-10 from 25 yds', tour: '7 ft' },
      { text: 'break' },
      { text: '5-10 short bunker shots (5-10 yds)', tour: '9 ft' },
      { text: '5-10 medium bunker shots (10-15 yds)', tour: '10 ft' },
      { text: '5-10 long bunker shots (15+ yds)', tour: '11 ft' }
    ]},
    { title: 'Range', color: '#d4706e', items: [
      { text: '5-10 balls leapfrogging 30-60 yards' },
      { text: '5-10 short irons (PW-8i) at single target' },
      { text: '5-10 mid irons (7i-6i) at single target' },
      { text: '5-10 long irons/hybrids (5i-4i) at single target' },
      { text: 'break' },
      { text: '5-10 woods (5W-3W) at single target' },
      { text: '5-10 drivers at single target' },
      { text: 'break' },
      { text: '5-10 drivers in 5 different "fairways"' },
      { text: '5-10 mid irons at 5 different "greens"' },
      { text: '5-10 drivers focusing solely on speed/distance' }
    ]},
    { title: 'On Course', color: '#b4a7d6', items: [] }
  ];

  var offSeasonSections = [
    { title: 'Off Season', color: '#9a9a9a', items: [
      { text: 'Coming soon — send txt file to populate' }
    ]}
  ];

  var preTournamentSections = [
    { title: 'Pre Tournament', color: '#9a9a9a', items: [
      { text: 'Coming soon — send txt file to populate' }
    ]}
  ];

  var sections;
  if (_ppTourSeason === 0) sections = offSeasonSections;
  else if (_ppTourSeason === 2) sections = preTournamentSections;
  else sections = inSeasonSections;

  sections.forEach(function(s, si) {
    var detailId = 'ppTourDetail_' + si;
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:8px;border-left:4px solid ' + s.color + ';">';
    html += '<div onclick="var d=document.getElementById(\'' + detailId + '\');d.style.display=d.style.display===\'none\'?\'\':\'none\'" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;">' + s.title + '</div>';
    html += '</div>';
    html += '<div id="' + detailId + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #333;">';
    if (s.items.length === 0) {
      html += '<div style="font-size:12px;color:#606060;font-style:italic;">Coming soon</div>';
    }
    s.items.forEach(function(item, ii) {
      if (item.text === 'break') {
        html += '<div style="border-top:1px solid #333;margin:6px 0;"></div>';
        return;
      }
      var uid = 'ppTourDrill_' + s.title.replace(/[^a-zA-Z]/g,'') + '_' + ii;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;">';
      html += '<div id="' + uid + '" onclick="ppToggleDrill(this,event)" style="width:22px;height:22px;min-width:22px;border-radius:50%;border:2px solid #3d3d3d;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:12px;color:#9a9a9a;">' + item.text + '</div>';
      if (item.goal || item.tour) {
        html += '<div style="font-size:10px;color:#606060;margin-top:1px;">';
        if (item.goal) html += '<span style="color:#44b8f0;">Goal: ' + item.goal + '</span>';
        if (item.goal && item.tour) html += '<span style="margin:0 6px;">|</span>';
        if (item.tour) html += '<span style="color:#00b87a;">Tour: ' + item.tour + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    });
    html += '</div></div>';
  });
  document.getElementById('ppTourContent').innerHTML = html;
}

function ppShowWarmUp() {
  ppHideAllViews();
  document.getElementById('ppWarmUpView').style.display = '';
  ppRenderWarmUp();
}

function ppRenderWarmUp() {
  var sections = [
    { title: 'Stretching', color: '#9a9a9a', items: [
      { text: 'Toe touch — hold 15-20 sec' },
      { text: 'Quad stretch — hold 15-20 sec each leg' },
      { text: 'Shoulder stretch — hold 15-20 sec each arm' },
      { text: 'Leg swings — front to back, side to side' },
      { text: 'Arm circles — small to large, both directions' },
      { text: 'Torso rotations — feet planted, rotate through core' }
    ]},
    { title: 'Range', color: '#d4706e', items: [
      { text: 'Leapfrog wedges — 20, 30, 40, 50, 60 yds', note: '5-10 balls' },
      { text: 'Short irons — 9I, PW', note: '3-5 balls' },
      { text: 'Mid irons — 7I, 8I', note: '3-5 balls' },
      { text: 'Long irons — 5I, 6I', note: '3-5 balls' },
      { text: 'Woods / hybrids', note: '3-5 balls' },
      { text: 'Driver', note: '5-8 balls' },
      { text: 'Random shots through the bag' },
      { text: 'Finish with the club you hit off the first tee' }
    ]},
    { title: 'Chipping', color: '#00b87a', items: [
      { text: 'Low chips from 10-30 yds', note: '3-5 balls' },
      { text: 'Mid-trajectory chips from 10-30 yds', note: '3-5 balls' },
      { text: 'High chips / flops from 10-30 yds', note: '3-5 balls' },
      { text: 'Bunker shots', note: '3-5 balls' }
    ]},
    { title: 'Putting', color: '#f6b26b', items: [
      { text: 'Make 5 three-footers in a row' },
      { text: 'Circle drill — 5-10 putts around the hole from 3-7 ft' },
      { text: 'Lag putts from 20-30 ft', note: '5 putts' },
      { text: 'Miscellaneous putts from all distances — dial in green speed' }
    ]}
  ];

  var html = '';
  sections.forEach(function(s) {
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:8px;border-left:4px solid ' + s.color + ';">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px;">' + s.title + '</div>';
    s.items.forEach(function(item, ii) {
      var uid = 'ppWarmDrill_' + s.title.replace(/[^a-zA-Z]/g,'') + '_' + ii;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;">';
      html += '<div id="' + uid + '" onclick="ppToggleDrill(this,event)" style="width:22px;height:22px;min-width:22px;border-radius:50%;border:2px solid #3d3d3d;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>';
      html += '<div style="flex:1;font-size:12px;color:#9a9a9a;">' + item.text + '</div>';
      if (item.mins) {
        html += '<div style="display:flex;align-items:center;gap:2px;white-space:nowrap;">';
        html += '<input type="number" value="' + item.mins + '" min="1" max="120" style="width:36px;height:24px;background:#1e1e1e;color:#9a9a9a;border:1px solid #3d3d3d;border-radius:6px;text-align:center;font-size:11px;font-weight:700;padding:0;font-family:inherit;" onclick="event.stopPropagation()">';
        html += '<span style="font-size:10px;color:#606060;">min</span></div>';
      } else if (item.note) {
        html += '<div style="font-size:10px;color:#606060;white-space:nowrap;">' + item.note + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  document.getElementById('ppWarmUpContent').innerHTML = html;
}

// Functions called from inline HTML handlers
expose({ ppBackToLanding, ppShowTourPractice, ppShowTourSeason, ppShowRecommended, ppShowTimed, ppShowLogSession, ppShowHistory, ppSetTime, ppToggleDrill, ppLogFromPractice, ppShowWarmUp });
