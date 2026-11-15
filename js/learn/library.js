import { expose } from '../coaching/core.js';

var _learningLibraryVideos = [
  {
    title: 'Zero Torque Putting Explained by Phil Kenyon',
    url: 'https://www.youtube.com/watch?v=LHwChX2XpRs',
    tags: ['putting', 'technique', 'zero torque', 'phil kenyon'],
    description: 'Phil Kenyon explains the zero torque putting concept for more consistent stroke mechanics.'
  },
  {
    title: 'The 4 Factors of Clubhead Speed by Sasho Mackenzie',
    url: 'https://www.youtube.com/watch?v=NWiCxr6zasg',
    tags: ['full swing', 'speed', 'biomechanics', 'sasho mackenzie'],
    description: 'Sasho Mackenzie breaks down the four key factors that determine clubhead speed.'
  },
  {
    title: 'How to Chip by Phil Mickelson',
    url: 'https://www.youtube.com/watch?v=dpFd1xocxrE',
    tags: ['short game', 'chipping', 'phil mickelson'],
    description: 'Phil Mickelson shares his chipping technique and tips for better short game performance.'
  }
];

function openLearningLibrary() {
  document.getElementById('learningLibraryPage').style.display = 'block';
  document.getElementById('learningLibrarySearch').value = '';
  renderLearningLibrary(_learningLibraryVideos);
}
function closeLearningLibrary() {
  document.getElementById('learningLibraryPage').style.display = 'none';
}
function renderLearningLibrary(videos) {
  var content = document.getElementById('learningLibraryContent');
  if (!videos.length) {
    content.innerHTML = '<div style="text-align:center;color:#606060;font-size:15px;padding:30px 20px;">No results found</div>';
    return;
  }
  var html = '';
  videos.forEach(function(v) {
    var tagHtml = v.tags.map(function(t) {
      return '<span style="font-size:10px;font-weight:700;color:#44b8f0;background:rgba(68,184,240,0.12);padding:2px 7px;border-radius:5px;">' + t + '</span>';
    }).join(' ');
    html += '<a href="' + v.url + '" target="_blank" rel="noopener" style="display:block;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:14px 16px;margin-bottom:10px;text-decoration:none;text-align:left;">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">';
    html += '<span style="font-size:20px;flex-shrink:0;">&#9654;&#65039;</span>';
    html += '<div style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.3;">' + v.title + '</div>';
    html += '</div>';
    if (v.description) {
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;line-height:1.4;">' + v.description + '</div>';
    }
    html += '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + tagHtml + '</div>';
    html += '</a>';
  });
  content.innerHTML = html;
}
function filterLearningLibrary() {
  var q = document.getElementById('learningLibrarySearch').value.trim().toLowerCase();
  if (!q) { renderLearningLibrary(_learningLibraryVideos); return; }
  var filtered = _learningLibraryVideos.filter(function(v) {
    if (v.title.toLowerCase().indexOf(q) !== -1) return true;
    if (v.description && v.description.toLowerCase().indexOf(q) !== -1) return true;
    return v.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
  });
  renderLearningLibrary(filtered);
}

// Functions called from inline HTML handlers
expose({ openLearningLibrary, closeLearningLibrary, filterLearningLibrary });
