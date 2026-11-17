import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { renderSGExplainer } from './sg-explainer.js';
import { getExpectedPutts, getExpectedStrokes } from '../coaching/sg-calc.js';

// ── SG CALCULATOR ──
var _sgCalcPar = 4;
export var _sgCalcShots = []; // [{x, y, ydsFromTee, ydsRemaining, lie, sg, expBefore, expAfter}]
var _sgCalcHoleImages = {
  3: 'assets/sg-calculator/hole-par3.png',
  4: 'assets/sg-calculator/hole-par4.png',
  5: 'assets/sg-calculator/hole-par5.png'
};

var _sgCalcHoleYards = 400;
var _sgCalcDefaults = { 3: 180, 4: 400, 5: 540 };

function sgCalcSetHole(par) {
  _sgCalcPar = par;
  [3,4,5].forEach(function(p) {
    var btn = document.getElementById('sgCalcTab' + p);
    btn.style.background = p === par ? '#2d7abc' : '#222222';
    btn.style.color = p === par ? '#ffffff' : '#606060';
  });
  document.getElementById('sgCalcYardage').value = _sgCalcDefaults[par];
  sgCalcReset();
}

export function sgCalcReset() {
  _sgCalcShots = [];
  _sgCalcHoleYards = parseInt(document.getElementById('sgCalcYardage').value) || 400;
  var hcp = document.getElementById('sgCalcHcp').value;
  var expTee = getExpectedStrokes(_sgCalcHoleYards, 'TEE', hcp);

  document.getElementById('sgCalcResults').innerHTML = '';
  document.getElementById('sgCalcStatExp').textContent = expTee.toFixed(2);
  document.getElementById('sgCalcStatRemain').textContent = '–';
  document.getElementById('sgCalcStatRemain').style.color = '#44b8f0';
  document.getElementById('sgCalcStatSg').textContent = '–';
  document.getElementById('sgCalcStatSg').style.color = '#9a9a9a';
  sgCalcDrawHole();
  sgCalcLoadCanvas();
}

function sgCalcDrawHole() {
  var svg = document.getElementById('sgCalcSvg');
  var yds = _sgCalcHoleYards;
  var par = _sgCalcPar;
  
  // Hole layout constants
  var teeY = 370, greenY = 50, greenCY = 55;
  var holeLen = teeY - greenY; // pixels for full hole
  var cx = 170; // center x
  
  // Fairway width varies by par
  var fwWidth = par === 3 ? 30 : par === 5 ? 44 : 38;
  var greenRx = par === 3 ? 22 : par === 5 ? 28 : 25;
  var greenRy = par === 3 ? 18 : par === 5 ? 22 : 20;
  
  // Hole position — exact pixel location of the black cup in each image (SVG 340x400 space)
  var holeX = par === 3 ? 162.1 : par === 4 ? 151.1 : 177.9;
  var holeY = par === 3 ? 87.1  : par === 4 ? 51.6  : 36.7;

  var html = '';
  // Embed the actual hole image for this par
  var imgSrc = _sgCalcHoleImages[par];
  html += '<image href="' + imgSrc + '" x="0" y="0" width="340" height="400" preserveAspectRatio="none"/>';

  // Tee ball — centred on the tee box rounded rectangle
  var teeBallY = 368;
  html += '<circle cx="' + cx + '" cy="' + teeBallY + '" r="5" fill="#ffffff" stroke="#000" stroke-width="1.5"/>';
  
  // Yardage markers — bigger, white, with dark shadow for readability
  var markers = [];
  if (yds >= 400) markers = [100, 150, 200, 250];
  else if (yds >= 300) markers = [100, 150, 200];
  else if (yds >= 200) markers = [50, 100, 150];
  else markers = [50, 100];
  
  markers.forEach(function(m) {
    if (m >= yds) return;
    var pct = m / yds;
    var my = teeY - pct * holeLen;
    var label = (yds - m) + '';
    html += '<text x="' + (cx - fwWidth/2 - 16) + '" y="' + (my + 5) + '" fill="#000" font-size="14" text-anchor="end" font-weight="800" stroke="#000" stroke-width="3" paint-order="stroke">' + label + '</text>';
    html += '<text x="' + (cx - fwWidth/2 - 16) + '" y="' + (my + 5) + '" fill="#ffffff" font-size="14" text-anchor="end" font-weight="800">' + label + '</text>';
  });
  
  // Hole yardage — bottom right corner
  html += '<text x="330" y="395" fill="#000" font-size="16" text-anchor="end" font-weight="800" stroke="#000" stroke-width="3" paint-order="stroke">' + yds + ' yds</text>';
  html += '<text x="330" y="395" fill="#ffffff" font-size="16" text-anchor="end" font-weight="800">' + yds + ' yds</text>';

  // Draw placed shots
  var lastX = cx, lastY = teeBallY;
  var lastYdsRemaining = yds;
  _sgCalcShots.forEach(function(s, i) {
    // Solid white arc — shot tracer (tee → ball)
    var midY = (lastY + s.y) / 2 - 20;
    html += '<path d="M' + lastX + ',' + lastY + ' Q' + ((lastX + s.x)/2) + ',' + midY + ' ' + s.x + ',' + s.y + '" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,3"/>';

    // Dashed remaining-distance line from ball → hole (blue)
    if (!s.holed) {
      var rmidX = (s.x + holeX) / 2;
      var rmidY = (s.y + holeY) / 2;
      html += '<path d="M' + s.x + ',' + s.y + ' Q' + rmidX + ',' + rmidY + ' ' + holeX + ',' + holeY + '" fill="none" stroke="#44b8f0" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.9"/>';

      // Remaining distance label — blue
      var remainDist = s.lie === 'GREEN' ? s.ydsRemaining + ' ft' : s.ydsRemaining + ' yds';
      var rlabelX = rmidX + 18;
      var rlabelY = rmidY;
      if (rlabelX > 300) rlabelX = rmidX - 18;
      var ranchor = rlabelX > holeX ? 'start' : 'end';
      html += '<text x="' + rlabelX + '" y="' + (rlabelY + 4) + '" fill="#000" font-size="14" text-anchor="' + ranchor + '" font-weight="800" stroke="#000" stroke-width="3" paint-order="stroke">' + remainDist + '</text>';
      html += '<text x="' + rlabelX + '" y="' + (rlabelY + 4) + '" fill="#44b8f0" font-size="14" text-anchor="' + ranchor + '" font-weight="800">' + remainDist + '</text>';
    }

    // Ball
    html += '<circle cx="' + s.x + '" cy="' + s.y + '" r="5" fill="#ffffff" stroke="#000" stroke-width="2"/>';
    
    // Shot distance — use the stored projection value, not a subtraction
    var shotDist;
    if (s.holed) {
      shotDist = s.ydsFromTee + ' yds';
    } else if (s.lie === 'GREEN') {
      shotDist = s.ydsFromTee + ' yds';
    } else {
      shotDist = s.ydsFromTee + ' yds';
    }
    
    var labelX = Math.max(s.x, lastX) + 20;
    var labelY = (lastY + s.y) / 2;
    if (labelX > 300) { labelX = Math.min(s.x, lastX) - 20; }
    var anchor = labelX > cx ? 'start' : 'end';
    html += '<text x="' + labelX + '" y="' + (labelY - 2) + '" fill="#000" font-size="16" text-anchor="' + anchor + '" font-weight="900" stroke="#000" stroke-width="3" paint-order="stroke">' + shotDist + '</text>';
    html += '<text x="' + labelX + '" y="' + (labelY - 2) + '" fill="#ffffff" font-size="16" text-anchor="' + anchor + '" font-weight="900">' + shotDist + '</text>';
    
    // Shot number label near the ball
    html += '<text x="' + s.x + '" y="' + (s.y - 11) + '" fill="#000" font-size="11" text-anchor="middle" font-weight="800" stroke="#000" stroke-width="2" paint-order="stroke">' + s.label + '</text>';
    html += '<text x="' + s.x + '" y="' + (s.y - 11) + '" fill="#ffffff" font-size="11" text-anchor="middle" font-weight="800">' + s.label + '</text>';
    
    lastX = s.x;
    lastY = s.y;
    lastYdsRemaining = s.lie === 'GREEN' ? Math.round(s.ydsRemaining / 3) : s.ydsRemaining;
  });
  
  // Tap hint
  if (_sgCalcShots.length === 0) {
    html += '<text x="' + cx + '" y="' + (teeY - holeLen * 0.5) + '" fill="#000" font-size="13" text-anchor="middle" font-weight="700" stroke="#000" stroke-width="3" paint-order="stroke">Tap to place your tee shot</text>';
    html += '<text x="' + cx + '" y="' + (teeY - holeLen * 0.5) + '" fill="#ffffff" font-size="13" text-anchor="middle" font-weight="700" opacity="0.7">Tap to place your tee shot</text>';
  }
  
  svg.innerHTML = html;
  
  // Add click handler
  svg.onclick = null;
  svg.onclick = function(e) { sgCalcTap(e); };
}

function sgCalcLoadCanvas() {
  var canvas = document.getElementById('sgCalcHoleCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var img = new Image();
  img.onload = function() {
    ctx.drawImage(img, 0, 0, 340, 400);
  };
  img.src = _sgCalcHoleImages[_sgCalcPar];
}

function sgCalcTap(e) {
  var svg = document.getElementById('sgCalcSvg');
  var rect = svg.getBoundingClientRect();
  var scaleX = 340 / rect.width;
  var scaleY = 400 / rect.height;
  var tapX = (e.clientX - rect.left) * scaleX;
  var tapY = (e.clientY - rect.top) * scaleY;
  
  var yds = _sgCalcHoleYards;
  var hcp = document.getElementById('sgCalcHcp').value;
  var teeY = 370, greenY = 50, greenCY = 55;
  var holeLen = teeY - greenY;
  var cx = 170;
  
  // Clamp tap within reasonable bounds
  tapY = Math.max(30, Math.min(375, tapY));
  tapX = Math.max(30, Math.min(310, tapX));

  // ── Distance math ──
  // One scale: tee→hole pixel span = total yardage
  var teeX = cx, teeBallY = 368;
  var holeX = _sgCalcPar === 3 ? 162.1 : _sgCalcPar === 4 ? 151.1 : 177.9;
  var holeY = _sgCalcPar === 3 ? 87.1  : _sgCalcPar === 4 ? 51.6  : 36.7;

  var axDx = holeX - teeX, axDy = holeY - teeBallY;
  var totalPx = Math.sqrt(axDx*axDx + axDy*axDy);
  var ydsPerPx = yds / totalPx;

  // ydsFromTee: project tee→tap vector onto the tee→hole axis
  // (goes sideways = doesn't reduce distance hit, just like real golf)
  var ux = axDx / totalPx, uy = axDy / totalPx;
  var tapDx = tapX - teeX, tapDy = tapY - teeBallY;
  var projection = tapDx * ux + tapDy * uy;
  var ydsFromTee = Math.max(0, Math.min(Math.round(projection * ydsPerPx), yds));

  // ydsRemaining: true Euclidean pixel distance from tap to hole cup
  var pxToHole = Math.sqrt(Math.pow(tapX - holeX, 2) + Math.pow(tapY - holeY, 2));
  var ydsRemaining = Math.round(pxToHole * ydsPerPx);
  
  // Determine lie by sampling actual pixel colour from the hole image canvas
  var lie;
  (function() {
    var canvas = document.getElementById('sgCalcHoleCanvas');
    var ctx = canvas ? canvas.getContext('2d') : null;
    var r = 46, g = 100, b = 23; // default rough green
    if (ctx) {
      // canvas is 340x400, same coordinate space as SVG
      var px = Math.round(Math.min(Math.max(tapX, 0), 339));
      var py = Math.round(Math.min(Math.max(tapY, 0), 399));
      var d = ctx.getImageData(px, py, 1, 1).data;
      r = d[0]; g = d[1]; b = d[2];
    }

    // ── Colour classifiers (matched to actual image palette) ──
    // Water / hazard: blue-purple  RGB ~ (94, 23, 235)
    var isWater = (b > 150 && r < 150 && g < 100);
    // Bunker / sand: yellow-orange  RGB ~ (212, 168, 67)
    var isBunker = (r > 170 && g > 120 && b < 100 && r > g);
    // Putting green: very light lime  RGB ~ (193, 255, 114)
    var isGreen  = (g > 210 && r > 140 && b < 160 && g > r);
    // Fairway: medium green  RGB ~ (126, 217, 87)
    var isFairway = (!isGreen && g > 160 && b < 130 && g > r * 1.3);

    // OB: positional (same dark-green colour as rough, but past the dashed line)
    // Par 3 → OB is LEFT of the dashed white line at SVG x ≈ 66
    // Par 4/5 → OB is RIGHT of the dashed white line at SVG x ≈ 253
    var isOB = (_sgCalcPar === 3 && tapX < 66) ||
               ((_sgCalcPar === 4 || _sgCalcPar === 5) && tapX > 253);

    if (isWater) {
      lie = 'WATER';
    } else if (isOB) {
      lie = 'OB';
    } else if (isBunker) {
      // Distinguish greenside vs fairway bunker by proximity to top of image (green end)
      lie = tapY < 160 ? 'GS BUNKER' : 'FW BUNKER';
    } else if (isGreen && ydsRemaining < 50) {
      lie = 'GREEN';
      ydsRemaining = Math.max(1, Math.round(ydsRemaining * 3)); // convert yds → feet
    } else if (isFairway) {
      lie = 'FAIRWAY';
    } else {
      lie = 'ROUGH';
    }
  })();
  
  // Calculate SG for tee shot
  var expBefore = getExpectedStrokes(yds, 'TEE', hcp);
  var expAfter;
  var lieForSG = lie;
  if (lie === 'OB' || lie === 'WATER') {
    // Penalty stroke + re-tee/drop: effectively adds 1 stroke, ball back near tee / drop zone
    ydsRemaining = yds; // treat as back to full distance
    lieForSG = 'PENALTY';
  }
  if (lie === 'GREEN') {
    expAfter = getExpectedPutts(ydsRemaining, hcp);
  } else {
    expAfter = getExpectedStrokes(ydsRemaining, lieForSG, hcp);
  }
  var sg = expBefore - 1 - expAfter;
  
  var color = '#44b8f0';
  var distLabel = lie === 'GREEN' ? ydsRemaining + ' ft' : ydsFromTee + ' yds';

  // Always replace — single tee shot only
  _sgCalcShots = [{
    x: tapX, y: tapY,
    ydsFromTee: ydsFromTee,
    ydsRemaining: ydsRemaining,
    lie: lie,
    sg: sg,
    expBefore: expBefore,
    expAfter: expAfter,
    color: color,
    label: '①',
    holed: false,
    distLabel: distLabel
  }];
  
  // Update stats bar
  var sgCol = sg >= 0 ? '#00b87a' : '#d4706e';
  document.getElementById('sgCalcStatExp').textContent = expBefore.toFixed(2);
  document.getElementById('sgCalcStatRemain').textContent = expAfter.toFixed(2);
  document.getElementById('sgCalcStatRemain').style.color = '#44b8f0';
  document.getElementById('sgCalcStatSg').textContent = (sg >= 0 ? '+' : '') + sg.toFixed(2);
  document.getElementById('sgCalcStatSg').style.color = sgCol;
  
  sgCalcDrawHole();
  sgCalcRenderResults();
}

function sgCalcRenderResults() {
  var el = document.getElementById('sgCalcResults');
  if (_sgCalcShots.length === 0) { el.innerHTML = ''; return; }
  
  var s = _sgCalcShots[0];
  var sgCol = s.sg >= 0 ? '#00b87a' : '#d4706e';
  var sgStr = (s.sg >= 0 ? '+' : '') + s.sg.toFixed(2);
  var lieStr = s.lie === 'GREEN' ? 'Green (' + s.ydsRemaining + ' ft)' : s.lie + ' (' + s.ydsRemaining + ' yds out)';
  
  el.innerHTML = '<div style="background:#1e1e1e;border-left:3px solid ' + s.color + ';border-radius:8px;padding:10px 12px;margin-bottom:4px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<div style="font-size:13px;font-weight:700;color:#ffffff;">Tee Shot → ' + lieStr + '</div>'
    + '<div style="font-size:18px;font-weight:900;color:' + sgCol + ';">' + sgStr + '</div></div>'
    + '<div style="font-family:monospace;font-size:11px;color:#606060;line-height:1.8;">'
    + 'Expected from tee: <span style="color:#00b87a;">' + s.expBefore.toFixed(2) + '</span><br>'
    + 'Shot taken: <span style="color:#ffffff;">1</span><br>'
    + 'Expected remaining: <span style="color:#44b8f0;">' + s.expAfter.toFixed(2) + '</span><br>'
    + 'SG = ' + s.expBefore.toFixed(2) + ' − 1 − ' + s.expAfter.toFixed(2) + ' = <span style="color:' + sgCol + ';font-weight:700;">' + sgStr + '</span>'
    + '</div></div>';
}
export function toggleLearnSGCalc() {
  var page = document.getElementById('learnSGCalcPage');
  if (!page) return;
  var isOpen = page.style.display === 'flex';
  if (isOpen) {
    page.style.display = 'none';
    returnSGCalcToHelp();
    return;
  }
  // Move the existing SG calc into the full-screen container
  var container = document.getElementById('learnSGCalcContainer');
  var calc = document.getElementById('sgSubContent_calc');
  if (calc && container) {
    container.appendChild(calc);
    calc.style.display = 'block';
    page.style.display = 'flex';
    // Initialize the calculator
    var userHcp = (S.currentUser && S.currentUser.user_metadata && S.currentUser.user_metadata.hcp_preference) || '10';
    var hcpMap = { 'pro': 'Tour Pro', '0': 'Scratch', '5': '5', '10': '10', '15': '15', '20': '20', '25': '25', '30': '30' };
    var hcpVal = hcpMap[userHcp] || '10';
    var sel = document.getElementById('sgCalcHcp');
    if (sel) sel.value = hcpVal;
    sgCalcReset();
  }
}

function toggleLearnSGExplainer() {
  var wrap = document.getElementById('learnSGExplainerWrap');
  var openBtn = document.getElementById('learnSGExplainerOpenBtn');
  var closeBtn = document.getElementById('learnSGExplainerCloseBtn');
  if (!wrap) return;
  var isVisible = wrap.style.display !== 'none';
  wrap.style.display = isVisible ? 'none' : 'block';
  if (openBtn) openBtn.style.display = isVisible ? 'flex' : 'none';
  if (closeBtn) closeBtn.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) {
    var el = document.getElementById('learnSGExplainerGraphic');
    if (el && !el.getAttribute('data-rendered')) {
      el.setAttribute('data-rendered', '1');
      var src = document.getElementById('sgExplainerGraphic');
      if (src) {
        renderSGExplainer();
        el.innerHTML = src.innerHTML;
      }
    }
  }
}

export function returnSGCalcToHelp() {
  var calc = document.getElementById('sgSubContent_calc');
  var helpParent = document.getElementById('helpContent_sg');
  if (calc && helpParent && calc.parentNode !== helpParent) {
    calc.style.display = 'none';
    helpParent.appendChild(calc);
  }
  var page = document.getElementById('learnSGCalcPage');
  if (page) page.style.display = 'none';
}

// Functions called from inline HTML handlers
expose({ sgCalcSetHole, sgCalcReset, toggleLearnSGCalc, toggleLearnSGExplainer });
