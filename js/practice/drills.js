import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { show } from '../coaching/core.js';
import { drillsData } from '../coaching/data-drills.js';

var _currentDrillCategory = 'putting';
var _currentSubcategoryFilter = null;

function getSubcategoriesForCategory(cat) {
  var drills = drillsData[cat] || [];
  var subs = {};
  drills.forEach(function(d) {
    (d.subcategories || []).forEach(function(s) {
      subs[s] = true;
    });
  });
  return Object.keys(subs).sort();
}

// Category colors for drill cards
var drillCatColors = {
  putting:   { bg: '#1a4a8a', border: '#2d7abc', tag: '#44b8f0' },
  shortgame: { bg: '#1a4a8a', border: '#2d7abc', tag: '#44b8f0' },
  fullswing: { bg: '#1a4a8a', border: '#2d7abc', tag: '#44b8f0' }
};

export function setDrillCategory(cat) {
  // Update tab button styles for both standalone and practice hub versions
  var prefix = S.drillsOnPracticeHub ? 'phDrillTab' : 'drillTab';
  var tabs = { putting: prefix+'Putting', shortgame: prefix+'Shortgame', fullswing: prefix+'Fullswing' };
  var activeColors = { putting: '#2d7abc', shortgame: '#2d7abc', fullswing: '#2d7abc' };
  Object.keys(tabs).forEach(function(k) {
    var btn = document.getElementById(tabs[k]);
    if (!btn) return;
    if (k === cat) {
      btn.style.background = activeColors[k];
      btn.style.color = '#ffffff';
    } else {
      btn.style.background = '#282828';
      btn.style.color = '#606060';
    }
  });
  showDrillCategory(cat);
}

function showDrillCategory(cat) {
  _currentDrillCategory = cat;
  _currentSubcategoryFilter = null;

  // Show subcategory dropdown
  var subs = getSubcategoriesForCategory(cat);
  var subId = S.drillsOnPracticeHub ? 'phDrillSubcategory' : 'drillSubcategory';
  var subSelect = document.getElementById(subId);

  var subHtml = '<option value="">All</option>';
  subs.filter(function(s){ return s !== 'All'; }).forEach(function(sub) {
    subHtml += '<option value="' + sub + '">' + sub + '</option>';
  });
  subSelect.innerHTML = subHtml;

  renderDrillsList(cat, null);
}

function filterDrillsBySubcategory(sub) {
  _currentSubcategoryFilter = sub || null;
  renderDrillsList(_currentDrillCategory, _currentSubcategoryFilter);
}

function renderDrillsList(cat, subFilter) {
  var drills = drillsData[cat] || [];
  var contentId = S.drillsOnPracticeHub ? 'phDrillContent' : 'drillContent';
  var content = document.getElementById(contentId);
  var colors = drillCatColors[cat] || { bg: '#282828', border: '#3d3d3d', tag: '#606060' };
  
  // Filter by subcategory if set
  if (subFilter) {
    drills = drills.filter(function(d) {
      return (d.subcategories || []).indexOf(subFilter) !== -1;
    });
  }
  
  if (drills.length === 0) {
    // span both columns for empty state
    content.innerHTML = '<div style="grid-column:1/-1;padding:20px;color:#606060;font-size:15px;background:#282828;border-radius:10px;text-align:center;">No drills found</div>';
    return;
  }
  
  var html = '';
  drills.forEach(function(drill) {
    var tags = (drill.subcategories || []).slice(0, 2).join(' · ');
    var typeBadge = drill.type === 'block'
      ? '<span style="font-size:9px;font-weight:700;color:#44b8f0;background:rgba(111,168,220,0.15);padding:1px 5px;border-radius:4px;">Block</span>'
      : '<span style="font-size:9px;font-weight:700;color:#e6a84d;background:rgba(230,168,77,0.15);padding:1px 5px;border-radius:4px;">Random</span>';
    html += '<div onclick="showDrillDetail(\'' + drill.id + '\', \'' + cat + '\')" style="background:' + colors.bg + ';border:1px solid ' + colors.border + ';border-radius:10px;padding:14px 10px;cursor:pointer;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;height:80px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.3;">' + drill.title + '</div>';
    html += '<div style="margin-top:auto;">' + typeBadge + '</div>';
    html += '</div>';
  });
  content.innerHTML = html;
}

function getYouTubeId(url) {
  if (!url) return '';
  var m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

export function showDrillDetail(drillId, cat) {
  var drills = drillsData[cat] || [];
  var drill = drills.find(function(d) { return d.id === drillId; });
  if (!drill) return;

  var tags = (drill.subcategories || []).join(' · ');
  var typeBadge = drill.type === 'block'
    ? '<span style="font-size:11px;font-weight:700;color:#44b8f0;background:rgba(111,168,220,0.15);padding:2px 8px;border-radius:6px;">Block</span>'
    : '<span style="font-size:11px;font-weight:700;color:#e6a84d;background:rgba(230,168,77,0.15);padding:2px 8px;border-radius:6px;">Random</span>';

  var html = '<div style="font-size:18px;font-weight:800;margin-bottom:4px;text-align:center;">' + drill.title + '</div>';
  html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">';
  html += typeBadge;
  if (drill.distance) html += '<span style="font-size:11px;color:#9a9a9a;">' + drill.distance + '</span>';
  html += '</div>';
  html += '<div style="font-size:11px;color:#606060;text-align:center;margin-bottom:12px;">' + tags + '</div>';
  if (drill.description) {
    html += '<div style="background:#282828;border-radius:10px;padding:14px;margin-bottom:10px;">';
    html += '<div style="font-size:12px;font-weight:700;color:#00b87a;margin-bottom:6px;">DESCRIPTION</div>';
    html += '<div style="font-size:13px;color:#9a9a9a;line-height:1.5;">' + drill.description + '</div>';
    html += '</div>';
  }
  if (drill.image) {
    html += '<img src="' + drill.image + '" alt="' + drill.title + '" style="width:100%;border-radius:12px;display:block;margin:0 0 10px;">';
  }
  if (drill.videoUrl) {
    var ytId = getYouTubeId(drill.videoUrl);
    if (ytId) {
      html += '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;margin-bottom:10px;background:#000;">';
      html += '<iframe src="https://www.youtube.com/embed/' + ytId + '" title="' + drill.title + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>';
      html += '</div>';
    } else {
      html += '<a href="' + drill.videoUrl + '" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#d4706e;border-radius:10px;padding:12px;margin-bottom:10px;text-decoration:none;cursor:pointer;">';
      html += '<svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#d4706e" d="M0 0h24v24H0z" fill-opacity="0"/><polygon fill="#ffffff" points="9.545,15.568 15.818,12 9.545,8.432"/></svg>';
      html += '<span style="font-size:14px;font-weight:700;color:#ffffff;">Watch Video</span>';
      html += '</a>';
    }
  }

  if (S.drillsOnPracticeHub) {
    S.drillDetailBackTarget = 'practiceHubPage';
  }
  S.drillDetailBackCategory = cat;
  document.getElementById('drillDetailContent').innerHTML = html;
  show('drillDetailPage');
}

// Functions called from inline HTML handlers
expose({ setDrillCategory, filterDrillsBySubcategory, showDrillDetail });
