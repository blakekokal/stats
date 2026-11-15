import { expose } from '../coaching/core.js';
import { bagDisplayName, bagWgGetLatestForClub, getBagClubs, sortBagClubs } from './clubs.js';
import { WG_SWINGS, WG_WEDGE_LIST, getWedgeClubColor } from './wedge-gapping.js';
import { show, loadScript } from '../coaching/core.js';

// ─── GAP VISUALIZER ────────────────────────────────────────────────────────
var _gapVizChart = null;
var _gapVizFilter = 'all';
var _gapVizCustomClubs = {};

var _GV_WOODS = ['Dr','Dr2','2W','3W','4W','5W','6W','7W','2HY','3HY','4HY','5HY','6HY','7HY'];
var _GV_IRONS = ['2I','3I','4I','5I','6I','7I','8I','9I'];
var _GV_WEDGES = ['48','PW','GW','AW','SW','50','52','54','56','58','60','62','LW'];

// Segment colors: bottom (smallest partial) → top (full-only extra)
// Purple gradient bottom-up, top segment is a muted slate to show "extra" distance
var _GV_SEG_COLORS = [
  '#2d7abc',  // deep violet — smallest partial
  '#3d96ee',  // purple
  '#3d96ee',  // medium purple
  '#44b8f0',  // soft purple
  '#2d7abc'   // slate — full-only extra on top
];

function gvClubCategory(name) {
  if (_GV_WOODS.indexOf(name) >= 0) return 'woods';
  if (_GV_IRONS.indexOf(name) >= 0) return 'irons';
  if (_GV_WEDGES.indexOf(name) >= 0) return 'wedges';
  return 'other';
}

function openGapVisualizer() {
  _gapVizFilter = 'all';
  _gapVizCustomClubs = {};
  show('gapVisualizerPage');
  gvBuildCustomPicker();
  setGapVizFilter('all');
}

function setGapVizFilter(filter) {
  _gapVizFilter = filter;
  var ids = ['All','Woods','Irons','Wedges','Custom'];
  ids.forEach(function(id) {
    var btn = document.getElementById('gvFilter' + id);
    if (!btn) return;
    var active = id.toLowerCase() === filter;
    btn.style.background = active ? '#3d96ee' : 'transparent';
    btn.style.color = active ? '#ffffff' : '#9a9a9a';
    btn.style.borderColor = active ? '#3d96ee' : '#3d3d3d';
  });
  document.getElementById('gvCustomPicker').style.display = filter === 'custom' ? '' : 'none';
  renderGapVisualizerChart();
}

function gvBuildCustomPicker() {
  var clubs = sortBagClubs(getBagClubs());
  var grid = document.getElementById('gvCustomClubGrid');
  if (!grid) return;
  _gapVizCustomClubs = {};
  clubs.forEach(function(c) { _gapVizCustomClubs[c.name] = false; });
  grid.innerHTML = clubs.map(function(c) {
    var dn = bagDisplayName(c.name);
    return '<button id="gvCust_' + c.name + '" onclick="gvToggleCustomClub(\'' + c.name + '\')" style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #3d3d3d;background:transparent;color:#9a9a9a;">' + dn + '</button>';
  }).join('');
}

function gvToggleCustomClub(name) {
  _gapVizCustomClubs[name] = !_gapVizCustomClubs[name];
  var btn = document.getElementById('gvCust_' + name);
  if (btn) {
    btn.style.background = _gapVizCustomClubs[name] ? '#3d96ee' : 'transparent';
    btn.style.color = _gapVizCustomClubs[name] ? '#ffffff' : '#9a9a9a';
  }
  renderGapVisualizerChart();
}

function gvGetAllItems() {
  var clubs = sortBagClubs(getBagClubs());
  var items = [];
  clubs.forEach(function(club) {
    var isWedge = (typeof WG_WEDGE_LIST !== 'undefined') && WG_WEDGE_LIST.indexOf(club.name) >= 0;
    var wgSess = isWedge ? bagWgGetLatestForClub(club.name) : null;
    var swings = [];

    if (wgSess) {
      var swingLabels = WG_SWINGS[wgSess.swingType] || [];
      var wgClubData = wgSess.results[club.name] || {};
      swingLabels.forEach(function(label, si) {
        var entry = wgClubData['sw' + si];
        var avg = entry && entry.avg != null ? entry.avg : null;
        swings.push({ label: label, carry: avg });
      });
      if (swings.length > 0 && swings[0].carry === null && club.carry != null) {
        swings[0].carry = club.carry;
      }
    } else {
      var fullCarry = club.carry != null ? club.carry : null;
      var threeQCarry = club.carry34 != null ? club.carry34 : null;
      if (fullCarry !== null) swings.push({ label: 'Full', carry: fullCarry });
      if (threeQCarry !== null) swings.push({ label: '¾', carry: threeQCarry });
    }

    var hasAny = swings.some(function(s) { return s.carry !== null; });
    if (hasAny) {
      items.push({ raw: club.name, name: bagDisplayName(club.name), swings: swings });
    }
  });
  return items;
}

// Build stacked segments from swings.
// Swings come in order: Full (biggest), then partials (3/4, 1/2, etc. — decreasing).
// We sort by carry ascending, then compute segment heights between each level.
// Bottom segment = smallest partial distance. Each segment above = gap to next level.
// Top segment (full-only extra) gets the red/accent color.
function gvBuildSegments(items) {
  // Find the max number of swing levels with data across all items
  var maxSegs = 0;
  items.forEach(function(item) {
    var valid = item.swings.filter(function(s) { return s.carry !== null; });
    if (valid.length > maxSegs) maxSegs = valid.length;
  });
  if (maxSegs === 0) return { datasets: [], segLabels: [] };

  // For each item, sort swings by carry ascending and compute segment diffs
  var segData = []; // segData[segIndex][itemIndex] = height of that segment
  var segLabels = []; // label for each segment
  for (var s = 0; s < maxSegs; s++) { segData.push([]); }

  items.forEach(function(item) {
    // Get valid swings sorted by carry ascending (smallest first)
    var valid = item.swings.filter(function(sw) { return sw.carry !== null; });
    valid.sort(function(a, b) { return a.carry - b.carry; });

    // Pad to maxSegs: if this club has fewer levels, missing segments = 0
    // Bottom segment = smallest carry value
    // Each subsequent segment = difference between consecutive carries
    for (var s = 0; s < maxSegs; s++) {
      if (s === 0) {
        segData[s].push(valid.length > 0 ? valid[0].carry : null);
      } else if (s < valid.length) {
        segData[s].push(valid[s].carry - valid[s - 1].carry);
      } else {
        segData[s].push(0);
      }
    }
  });

  // Build segment labels from the first item that has the most swings
  var refItem = items.reduce(function(best, item) {
    var vc = item.swings.filter(function(s) { return s.carry !== null; }).length;
    return vc > best.count ? { count: vc, item: item } : best;
  }, { count: 0, item: null });
  if (refItem.item) {
    var refValid = refItem.item.swings.filter(function(s) { return s.carry !== null; });
    refValid.sort(function(a, b) { return a.carry - b.carry; });
    refValid.forEach(function(s) { segLabels.push(s.label); });
  }

  return { segData: segData, segLabels: segLabels, maxSegs: maxSegs };
}

export function renderGapVisualizerChart() {
  // Chart.js is only fetched when the chart is first drawn.
  if (!window.Chart) { loadScript('vendor/chart/chart.umd.js').then(renderGapVisualizerChart, function() {}); return; }
  var allItems = gvGetAllItems();
  var emptyMsg = document.getElementById('gapVizEmpty');
  var canvas = document.getElementById('gapVizChart');
  var wrap = document.getElementById('gapVizChartWrap');
  var legendEl = document.getElementById('gapVizLegend');
  if (!canvas) return;

  var items = allItems.filter(function(item) {
    if (_gapVizFilter === 'all') return true;
    if (_gapVizFilter === 'woods') return gvClubCategory(item.raw) === 'woods';
    if (_gapVizFilter === 'irons') return gvClubCategory(item.raw) === 'irons';
    if (_gapVizFilter === 'wedges') return gvClubCategory(item.raw) === 'wedges';
    if (_gapVizFilter === 'custom') return !!_gapVizCustomClubs[item.raw];
    return true;
  });

  // Sort by full swing carry ascending (lowest club on left)
  items.sort(function(a, b) {
    var aFull = (a.swings[0] && a.swings[0].carry) || 0;
    var bFull = (b.swings[0] && b.swings[0].carry) || 0;
    return aFull - bFull;
  });

  if (items.length === 0) {
    emptyMsg.style.display = 'block';
    wrap.style.display = 'none';
    legendEl.style.display = 'none';
    if (_gapVizChart) { _gapVizChart.destroy(); _gapVizChart = null; }
    return;
  }
  emptyMsg.style.display = 'none';
  wrap.style.display = '';
  legendEl.style.display = 'flex';

  // Swing type color map
  var _GV_SWING_COLORS = {
    '½': '#007a52',      // teal
    '1/2': '#007a52',
    '50%': '#007a52',
    'Hips': '#007a52',
    '¾': '#3d96ee',      // blue
    '3/4': '#3d96ee',
    '75%': '#3d96ee',
    'Ribs': '#3d96ee',
    'Shldr': '#3d96ee',
    'Ears': '#3d96ee',
    'Full': '#ffffff'    // white
  };
  var _GV_SEG_COLOR_DEFAULT = ['#007a52', '#3d96ee', '#ffffff'];

  function _gvSwingColor(label) {
    return _GV_SWING_COLORS[label] || _GV_SEG_COLOR_DEFAULT[0];
  }

  if (_gapVizChart) { _gapVizChart.destroy(); _gapVizChart = null; }

  // ── WEDGE MODE: grouped bars colored by club, grouped by swing ──
  if (_gapVizFilter === 'wedges') {
    // Detect swing type from WG sessions to normalize labels
    var _wgSwingType = null;
    var _wgClubs = sortBagClubs(getBagClubs());
    _wgClubs.forEach(function(club) {
      if (_wgSwingType) return;
      var isWedge = (typeof WG_WEDGE_LIST !== 'undefined') && WG_WEDGE_LIST.indexOf(club.name) >= 0;
      var wgSess = isWedge ? bagWgGetLatestForClub(club.name) : null;
      if (wgSess && wgSess.swingType) _wgSwingType = wgSess.swingType;
    });
    var _labelMap = { 'Full': 'FULL', '¾': '¾' };
    if (_wgSwingType === 'percent') {
      _labelMap['¾'] = '75%';
    } else if (_wgSwingType === 'fraction') {
      _labelMap['¾'] = '3/4';
    } else if (_wgSwingType === 'body') {
      _labelMap['¾'] = 'Ears';
    }

    // Build flat bar list with normalized labels
    var flatBars = [];
    items.forEach(function(item) {
      item.swings.forEach(function(sw) {
        if (sw.carry !== null) {
          var lbl = _labelMap[sw.label] || sw.label;
          flatBars.push({ name: item.name, raw: item.raw, label: lbl, carry: sw.carry });
        }
      });
    });

    // Get unique clubs (sorted by full swing carry ascending = lowest distance first)
    var uniqueClubs = [];
    items.forEach(function(item) {
      if (uniqueClubs.indexOf(item.name) === -1) uniqueClubs.push(item.name);
    });
    var clubColorMap = {};
    uniqueClubs.forEach(function(name) {
      clubColorMap[name] = getWedgeClubColor(name);
    });

    // Sort all bars by carry distance ascending (left to right)
    var groupedBars = flatBars.slice().sort(function(a, b) { return a.carry - b.carry; });

    var wgLabels = groupedBars.map(function(b) { return [b.name, b.label]; }); // two-line labels
    var wgData = groupedBars.map(function(b) { return b.carry; });
    var wgColors = groupedBars.map(function(b) { return clubColorMap[b.name]; });

    // Build lookup: for each bar, find same club's next higher carry (for ghost outlines)
    // Ghost outline always reaches the Full swing carry for that club
    var _fullCarryByClub = {};
    groupedBars.forEach(function(b) {
      var lbl = b.label.toUpperCase();
      if (lbl === 'FULL') _fullCarryByClub[b.name] = b.carry;
    });
    var ghostHeights = groupedBars.map(function(b) {
      var lbl = b.label.toUpperCase();
      if (lbl === 'FULL') return null; // Full swing doesn't need a ghost
      var fullCarry = _fullCarryByClub[b.name];
      return (fullCarry != null && fullCarry > b.carry) ? fullCarry : null;
    });

    // Plugin: ghost outlines + value labels on bars
    var wedgePlugin = {
      id: 'wedgeGhost',
      afterDraw: function(chart) {
        var ctx2 = chart.ctx;
        var xScale = chart.scales.x;
        var yScale = chart.scales.y;
        var meta = chart.getDatasetMeta(0);
        ctx2.save();

        for (var i = 0; i < groupedBars.length; i++) {
          var bar = meta.data[i];
          if (!bar) continue;
          var barX = bar.x;
          var barWidth = bar.width;

          // Draw ghost outline for next swing level
          if (ghostHeights[i] !== null) {
            var ghostTopY = yScale.getPixelForValue(ghostHeights[i]);
            var bottomY = yScale.getPixelForValue(0);
            var color = wgColors[i];
            ctx2.beginPath();
            ctx2.setLineDash([5, 4]);
            ctx2.strokeStyle = color;
            ctx2.globalAlpha = 0.35;
            ctx2.lineWidth = 1.5;
            var gx = barX - barWidth / 2;
            var gw = barWidth;
            var gr = 4;
            // Rounded rect top
            ctx2.moveTo(gx + gr, ghostTopY);
            ctx2.lineTo(gx + gw - gr, ghostTopY);
            ctx2.quadraticCurveTo(gx + gw, ghostTopY, gx + gw, ghostTopY + gr);
            ctx2.lineTo(gx + gw, bottomY);
            ctx2.moveTo(gx, bottomY);
            ctx2.lineTo(gx, ghostTopY + gr);
            ctx2.quadraticCurveTo(gx, ghostTopY, gx + gr, ghostTopY);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.globalAlpha = 1;
          }

          // Value label on top of bar
          var val = wgData[i];
          if (val != null) {
            var topY = yScale.getPixelForValue(val);
            ctx2.font = 'bold 12px sans-serif';
            ctx2.textAlign = 'center';
            ctx2.textBaseline = 'bottom';
            ctx2.fillStyle = '#ffffff';
            ctx2.fillText(Math.round(val), barX, topY - 4);
          }
        }
        ctx2.restore();
      }
    };

    var ctx = canvas.getContext('2d');
    _gapVizChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: wgLabels,
        datasets: [{
          data: wgData,
          backgroundColor: wgColors,
          borderColor: wgColors,
          borderWidth: 0,
          borderRadius: 6,
          barPercentage: 0.82,
          categoryPercentage: 0.88
        }]
      },
      plugins: [wedgePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 32, bottom: 4, left: 8, right: 8 } },
        scales: {
          y: {
            display: false,
            beginAtZero: true
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#9a9a9a',
              font: { size: 11, weight: '700' },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#222222',
            titleColor: '#ffffff',
            bodyColor: '#9a9a9a',
            borderColor: '#3d3d3d',
            borderWidth: 1,
            callbacks: {
              title: function(items) {
                var b = groupedBars[items[0].dataIndex];
                return b.name + ' — ' + b.label;
              },
              label: function(c) {
                return groupedBars[c.dataIndex].carry + ' yds';
              }
            }
          }
        }
      }
    });

    // Build legend showing club colors
    legendEl.innerHTML = '';
    uniqueClubs.forEach(function(name) {
      legendEl.innerHTML += '<div style="display:flex;align-items:center;gap:5px;">' +
        '<div style="width:14px;height:14px;border-radius:3px;background:' + clubColorMap[name] + ';"></div>' +
        '<span style="font-size:12px;color:#9a9a9a;font-weight:600;">' + name + '</span></div>';
    });
    legendEl.style.display = 'flex';

    // Resize canvas
    var barCount = groupedBars.length;
    var minW = Math.max(barCount * 52, 320);
    canvas.parentElement.style.overflowX = barCount > 10 ? 'auto' : 'visible';
    canvas.style.width = minW + 'px';
    canvas.style.minHeight = '280px';
    canvas.style.height = '320px';
    return;
  }

  // ── STANDARD STACKED MODE (all/woods/irons/custom) ──
  var labels = items.map(function(i) { return i.name; });
  var seg = gvBuildSegments(items);

  // Compute gaps between adjacent clubs (full swing carry difference)
  var gapLabels = [];
  for (var gi = 0; gi < items.length - 1; gi++) {
    var leftFull = (items[gi].swings[0] && items[gi].swings[0].carry) || 0;
    var rightFull = (items[gi + 1].swings[0] && items[gi + 1].swings[0].carry) || 0;
    gapLabels.push(rightFull - leftFull);
  }

  // Count valid swings per item for per-bar coloring
  var itemSwingCounts = items.map(function(item) {
    return item.swings.filter(function(s) { return s.carry !== null; }).length;
  });

  var datasets = [];
  for (var si = 0; si < seg.maxSegs; si++) {
    var segLabel = seg.segLabels[si] || '';
    // Per-bar colors based on each item's own swing label at this segment index
    var bgColors = items.map(function(item, idx) {
      var valid = item.swings.filter(function(s) { return s.carry !== null; });
      valid.sort(function(a, b) { return a.carry - b.carry; });
      if (si < valid.length) {
        var lbl = valid[si].label;
        return _GV_SWING_COLORS[lbl] || _GV_SEG_COLOR_DEFAULT[Math.min(si, _GV_SEG_COLOR_DEFAULT.length - 1)];
      }
      // No data at this segment for this club
      return _GV_SWING_COLORS['Full'];
    });

    datasets.push({
      label: segLabel || ('Segment ' + si),
      data: seg.segData[si],
      backgroundColor: bgColors,
      borderColor: bgColors,
      borderWidth: 0,
      borderRadius: 4,
      barPercentage: 0.75,
      categoryPercentage: 0.8
    });
  }

  // Plugin to draw gap numbers + dotted connector lines between bars
  var gapLabelPlugin = {
    id: 'gapLabels',
    afterDraw: function(chart) {
      if (!gapLabels || gapLabels.length === 0) return;
      var ctx2 = chart.ctx;
      var xScale = chart.scales.x;
      var yScale = chart.scales.y;
      ctx2.save();

      for (var g = 0; g < gapLabels.length; g++) {
        var x1 = xScale.getPixelForValue(g);
        var x2 = xScale.getPixelForValue(g + 1);
        var midX = (x1 + x2) / 2;

        // Get top of each bar (total stacked value)
        var leftTotal = 0, rightTotal = 0;
        for (var ds = 0; ds < chart.data.datasets.length; ds++) {
          leftTotal += (chart.data.datasets[ds].data[g] || 0);
          rightTotal += (chart.data.datasets[ds].data[g + 1] || 0);
        }
        var leftTopY = yScale.getPixelForValue(leftTotal);
        var rightTopY = yScale.getPixelForValue(rightTotal);
        var higherY = Math.min(leftTopY, rightTopY); // smaller px = higher on screen
        var lowerY = Math.max(leftTopY, rightTopY);

        // Draw dotted line from top of left bar to top of right bar
        ctx2.beginPath();
        ctx2.setLineDash([3, 3]);
        ctx2.strokeStyle = '#606060';
        ctx2.lineWidth = 1;
        ctx2.moveTo(x1, leftTopY);
        ctx2.lineTo(x2, rightTopY);
        ctx2.stroke();
        ctx2.setLineDash([]);

        // Draw vertical bracket lines at midpoint showing the gap
        var bracketTop = higherY;
        var bracketBot = lowerY;
        ctx2.beginPath();
        ctx2.setLineDash([2, 2]);
        ctx2.strokeStyle = '#606060';
        ctx2.lineWidth = 1;
        ctx2.moveTo(midX, bracketTop);
        ctx2.lineTo(midX, bracketBot);
        ctx2.stroke();
        ctx2.setLineDash([]);

        // Gap label above the bars
        var gap = gapLabels[g];
        var labelY = higherY - 12;
        ctx2.font = 'bold 11px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'bottom';
        ctx2.fillStyle = gap <= 5 ? '#d4706e' : gap >= 20 ? '#f0c830' : '#ffffff';
        ctx2.fillText(gap + 'y', midX, labelY);
      }
      ctx2.restore();
    }
  };

  var ctx = canvas.getContext('2d');
  _gapVizChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    plugins: [gapLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, bottom: 4 } },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: 'Yards', color: '#606060', font: { size: 12, weight: '600' } },
          grid: { color: '#282828' },
          ticks: { color: '#9a9a9a', font: { size: 11 } }
        },
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#ffffff', font: { size: 11, weight: '700' }, maxRotation: 45, minRotation: 0, autoSkip: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#222222',
          titleColor: '#ffffff',
          bodyColor: '#9a9a9a',
          borderColor: '#3d3d3d',
          borderWidth: 1,
          callbacks: {
            label: function(c) {
              // Show the actual carry for this swing level, not the segment height
              var item = items[c.dataIndex];
              if (!item) return null;
              var valid = item.swings.filter(function(s) { return s.carry !== null; });
              valid.sort(function(a, b) { return a.carry - b.carry; });
              var sw = valid[c.datasetIndex];
              if (!sw) return null;
              return sw.label + ': ' + sw.carry + ' yds';
            }
          }
        }
      }
    }
  });

  // Build legend with swing-type colors
  legendEl.innerHTML = '';
  for (var li = 0; li < seg.maxSegs; li++) {
    var isTopL = (li === seg.maxSegs - 1 && seg.maxSegs > 1);
    var segLbl = seg.segLabels[li] || ('Segment ' + li);
    var col;
    if (isTopL) {
      col = _GV_SWING_COLORS['Full'] || _GV_SEG_COLOR_DEFAULT[2];
    } else if (_GV_SWING_COLORS[segLbl]) {
      col = _GV_SWING_COLORS[segLbl];
    } else {
      col = _GV_SEG_COLOR_DEFAULT[Math.min(li, _GV_SEG_COLOR_DEFAULT.length - 1)];
    }
    legendEl.innerHTML += '<div style="display:flex;align-items:center;gap:5px;">' +
      '<div style="width:14px;height:14px;background:' + col + ';border-radius:3px;"></div>' +
      '<span style="font-size:11px;color:#9a9a9a;font-weight:600;">' + segLbl + '</span></div>';
  }

  wrap.style.height = '320px';
}

// Functions called from inline HTML handlers
expose({ openGapVisualizer, setGapVizFilter, gvToggleCustomClub });
