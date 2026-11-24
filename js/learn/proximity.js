import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { getExpectedPutts, getExpectedStrokes } from '../coaching/sg-calc.js';
import { sgPuttingData } from '../coaching/sg-tables.js';

var _proxHcp = '10';
var _proxLie = 'FAIRWAY';

function proxSetHcp(hcp) {
  _proxHcp = hcp;
  var btns = document.querySelectorAll('.prox-hcp-btn');
  btns.forEach(function(b) {
    if (b.getAttribute('data-hcp') === hcp) {
      b.style.background = '#2d7abc'; b.style.color = '#fff';
    } else {
      b.style.background = '#333'; b.style.color = 'rgba(255,255,255,0.5)';
    }
  });
  proxCalc();
}

function proxSetLie(lie) {
  _proxLie = lie;
  var btns = document.querySelectorAll('.prox-lie-btn');
  btns.forEach(function(b) {
    if (b.getAttribute('data-lie') === lie) {
      b.style.background = '#2d7abc'; b.style.color = '#fff';
    } else {
      b.style.background = '#333'; b.style.color = 'rgba(255,255,255,0.5)';
    }
  });
  proxCalc();
}

// Binary search: find feet where SG = sgTarget for given expBefore/hcp
function proxFindFtForSG(expBefore, sgTarget, hcp) {
  // SG = expBefore - getExpectedPutts(ft) - 1
  // We want: expBefore - getExpectedPutts(ft) - 1 = sgTarget
  // So: getExpectedPutts(ft) = expBefore - 1 - sgTarget
  var puttTarget = expBefore - 1 - sgTarget;
  if (puttTarget <= 1) return 1; // basically holed it
  var lo = 0, hi = 300, mid;
  var table = sgPuttingData[hcp] || sgPuttingData['pro'];
  var base110 = table[110] || 2.48;
  if (puttTarget >= base110 + (300 - 110) * 0.004) {
    return Math.round((110 + (puttTarget - base110) / 0.004) * 2) / 2;
  }
  for (var i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    if (getExpectedPutts(mid, hcp) < puttTarget) lo = mid;
    else hi = mid;
  }
  var ft = Math.round((lo + hi) / 2 * 2) / 2;
  return ft < 1 ? 1 : ft;
}

function proxFmtFt(ft) {
  return (ft % 1 === 0 ? ft : ft.toFixed(1)) + ' ft';
}

function proxCalc() {
  var yardEl = document.getElementById('proxYardage');
  var displayEl = document.getElementById('proxFtDisplay');
  var hintEl = document.getElementById('proxFtHint');
  var loseEl = document.getElementById('proxLoseHalfFt');
  var gainEl = document.getElementById('proxGainHalfFt');
  var yards = parseInt(yardEl.value);
  if (!yards || yards < 10 || yards > 600) {
    displayEl.textContent = '—';
    loseEl.textContent = '—';
    gainEl.textContent = '—';
    hintEl.textContent = 'Enter yardage above';
    S.proxExpBefore = null;
    S.proxBreakFt = null;
    document.getElementById('proxSGResultWrap').style.display = 'none';
    return;
  }

  var expBefore = getExpectedStrokes(yards, _proxLie, _proxHcp);

  // Breakeven (SG = 0)
  var breakFt = proxFindFtForSG(expBefore, 0, _proxHcp);
  // Lose 0.25 (SG = -0.25) — farther from pin
  var loseFt = proxFindFtForSG(expBefore, -0.25, _proxHcp);
  // Gain 0.25 (SG = +0.25) — closer to pin
  var gainFt = proxFindFtForSG(expBefore, 0.25, _proxHcp);

  if (breakFt <= 0) breakFt = 1;
  S.proxExpBefore = expBefore;
  S.proxBreakFt = breakFt;
  S.proxCurrentFt = breakFt;

  displayEl.textContent = proxFmtFt(breakFt);
  loseEl.textContent = proxFmtFt(loseFt);
  gainEl.textContent = proxFmtFt(gainFt);
  hintEl.textContent = 'Tap to change';

  // Show SG = 0 at breakeven
  proxShowSG(breakFt);
}

function proxEditFt() {
  if (!S.proxExpBefore) return;
  var displayEl = document.getElementById('proxFtDisplay');
  var wrapEl = document.getElementById('proxFtInputWrap');
  var inputEl = document.getElementById('proxFtInput');
  displayEl.style.display = 'none';
  wrapEl.style.display = 'flex';
  inputEl.value = S.proxCurrentFt || '';
  inputEl.focus();
  inputEl.select();
}

function proxConfirmFt() {
  var displayEl = document.getElementById('proxFtDisplay');
  var wrapEl = document.getElementById('proxFtInputWrap');
  var inputEl = document.getElementById('proxFtInput');
  wrapEl.style.display = 'none';
  displayEl.style.display = 'block';

  var ft = parseFloat(inputEl.value);
  if (isNaN(ft) || ft < 0 || !S.proxExpBefore) {
    // Revert to breakeven
    ft = S.proxBreakFt || 0;
  }
  ft = Math.round(ft * 2) / 2;
  S.proxCurrentFt = ft;
  displayEl.textContent = proxFmtFt(ft);
  proxShowSG(ft);
}

function proxShowSG(ft) {
  var sgWrap = document.getElementById('proxSGResultWrap');
  if (!S.proxExpBefore) { sgWrap.style.display = 'none'; return; }

  var expBefore = S.proxExpBefore;
  var expAfter = ft <= 0 ? 0 : getExpectedPutts(ft, _proxHcp);
  var sg = expBefore - expAfter - 1;

  sgWrap.style.display = 'block';
  var valEl = document.getElementById('proxSGValue');

  if (Math.abs(sg) < 0.015) sg = 0;
  var sgStr = (sg >= 0 ? '+' : '') + sg.toFixed(2);
  valEl.textContent = sgStr;

  if (sg > 0.05) {
    valEl.style.color = '#00b87a';
  } else if (sg < -0.05) {
    valEl.style.color = '#d4706e';
  } else {
    valEl.style.color = '#ffffff';
  }
}

export function init() {

// Init proximity with default yardage
proxCalc();
}

// Functions called from inline HTML handlers
expose({ proxSetHcp, proxSetLie, proxCalc, proxEditFt, proxConfirmFt });
