import { expose } from '../coaching/core.js';
import { BO_DATA, boGetInterpolatedData } from './optimizer.js';

// --- Distance Guide ("How Far Should I Hit It?") ---
var _dgCurrentTab = 'pga';

var DG_PGA_DATA = [
  {club:'Driver',carry:282,clubSpeed:115,ballSpeed:171,smash:1.49,attackAngle:'-0.9',launch:'10.4',spin:2545,maxHeight:35,landAngle:'39'},
  {club:'3 Wood',carry:249,clubSpeed:110,ballSpeed:162,smash:1.47,attackAngle:'-2.3',launch:'9.3',spin:3663,maxHeight:32,landAngle:'44'},
  {club:'5 Wood',carry:236,clubSpeed:106,ballSpeed:156,smash:1.47,attackAngle:'-2.5',launch:'9.7',spin:4322,maxHeight:33,landAngle:'48'},
  {club:'Hybrid',carry:231,clubSpeed:102,ballSpeed:149,smash:1.46,attackAngle:'-2.4',launch:'10.2',spin:4587,maxHeight:31,landAngle:'49'},
  {club:'3 Iron',carry:218,clubSpeed:100,ballSpeed:145,smash:1.45,attackAngle:'-2.5',launch:'10.3',spin:4404,maxHeight:30,landAngle:'48'},
  {club:'4 Iron',carry:209,clubSpeed:98,ballSpeed:140,smash:1.43,attackAngle:'-2.9',launch:'10.8',spin:4782,maxHeight:31,landAngle:'49'},
  {club:'5 Iron',carry:199,clubSpeed:96,ballSpeed:135,smash:1.41,attackAngle:'-3.4',launch:'11.9',spin:5280,maxHeight:33,landAngle:'50'},
  {club:'6 Iron',carry:188,clubSpeed:94,ballSpeed:130,smash:1.38,attackAngle:'-3.7',launch:'14.0',spin:6204,maxHeight:32,landAngle:'50'},
  {club:'7 Iron',carry:176,clubSpeed:92,ballSpeed:123,smash:1.34,attackAngle:'-3.9',launch:'16.1',spin:7124,maxHeight:34,landAngle:'52'},
  {club:'8 Iron',carry:164,clubSpeed:89,ballSpeed:118,smash:1.33,attackAngle:'-4.2',launch:'17.8',spin:8078,maxHeight:33,landAngle:'52'},
  {club:'9 Iron',carry:152,clubSpeed:87,ballSpeed:112,smash:1.29,attackAngle:'-4.3',launch:'20.0',spin:8793,maxHeight:32,landAngle:'53'},
  {club:'PW',carry:142,clubSpeed:84,ballSpeed:104,smash:1.24,attackAngle:'-4.7',launch:'23.7',spin:9316,maxHeight:32,landAngle:'52'}
];

var DG_LPGA_DATA = [
  {club:'Driver',carry:223,clubSpeed:96,ballSpeed:143,smash:1.49,attackAngle:'+2.8',launch:'12.6',spin:2506,maxHeight:26,landAngle:'36'},
  {club:'3 Wood',carry:200,clubSpeed:92,ballSpeed:135,smash:1.47,attackAngle:'-0.8',launch:'11.6',spin:2595,maxHeight:25,landAngle:'38'},
  {club:'5 Wood',carry:189,clubSpeed:90,ballSpeed:130,smash:1.44,attackAngle:'-1.6',launch:'12.3',spin:4320,maxHeight:25,landAngle:'43'},
  {club:'Hybrid',carry:178,clubSpeed:87,ballSpeed:125,smash:1.44,attackAngle:'-1.9',launch:'13.9',spin:4504,maxHeight:25,landAngle:'45'},
  {club:'4 Iron',carry:175,clubSpeed:82,ballSpeed:118,smash:1.44,attackAngle:'-1.7',launch:'13.9',spin:4608,maxHeight:25,landAngle:'43'},
  {club:'5 Iron',carry:166,clubSpeed:81,ballSpeed:114,smash:1.41,attackAngle:'-2.0',launch:'15.6',spin:4966,maxHeight:25,landAngle:'45'},
  {club:'6 Iron',carry:155,clubSpeed:80,ballSpeed:111,smash:1.39,attackAngle:'-2.3',launch:'16.7',spin:5904,maxHeight:25,landAngle:'46'},
  {club:'7 Iron',carry:143,clubSpeed:78,ballSpeed:106,smash:1.36,attackAngle:'-2.5',launch:'18.5',spin:6630,maxHeight:26,landAngle:'47'},
  {club:'8 Iron',carry:133,clubSpeed:76,ballSpeed:102,smash:1.34,attackAngle:'-2.8',launch:'20.8',spin:7413,maxHeight:27,landAngle:'47'},
  {club:'9 Iron',carry:123,clubSpeed:74,ballSpeed:95,smash:1.28,attackAngle:'-3.2',launch:'23.5',spin:7605,maxHeight:27,landAngle:'48'},
  {club:'PW',carry:111,clubSpeed:72,ballSpeed:88,smash:1.22,attackAngle:'-3.2',launch:'25.2',spin:8465,maxHeight:27,landAngle:'48'}
];

// Handicap data: swing speeds from deWiz Golf, distances from Arccos/Shot Scope aggregates
var DG_HANDICAP_DATA = {
  scratch:{driverDist:255,clubSpeed:108,clubs:[
    {section:'Woods'},{club:'Driver',carry:240,total:255},{club:'3 Wood',carry:218,total:232},{club:'5 Wood',carry:203,total:217},
    {section:'Irons'},{club:'4 Iron',carry:184,total:196},{club:'5 Iron',carry:174,total:186},{club:'6 Iron',carry:164,total:176},{club:'7 Iron',carry:154,total:165},{club:'8 Iron',carry:143,total:153},{club:'9 Iron',carry:132,total:141},
    {section:'Wedges'},{club:'PW',carry:121,total:129},{club:'GW',carry:109,total:116},{club:'SW',carry:94,total:100},{club:'LW',carry:79,total:84}
  ]},
  '5':{driverDist:242,clubSpeed:102,clubs:[
    {section:'Woods'},{club:'Driver',carry:227,total:242},{club:'3 Wood',carry:206,total:220},{club:'5 Wood',carry:192,total:205},
    {section:'Irons'},{club:'4 Iron',carry:174,total:185},{club:'5 Iron',carry:165,total:176},{club:'6 Iron',carry:155,total:166},{club:'7 Iron',carry:146,total:156},{club:'8 Iron',carry:135,total:144},{club:'9 Iron',carry:125,total:133},
    {section:'Wedges'},{club:'PW',carry:114,total:122},{club:'GW',carry:103,total:110},{club:'SW',carry:89,total:95},{club:'LW',carry:74,total:79}
  ]},
  '10':{driverDist:228,clubSpeed:96,clubs:[
    {section:'Woods'},{club:'Driver',carry:213,total:228},{club:'3 Wood',carry:194,total:207},{club:'5 Wood',carry:180,total:193},
    {section:'Irons'},{club:'5 Iron',carry:155,total:166},{club:'6 Iron',carry:146,total:156},{club:'7 Iron',carry:137,total:147},{club:'8 Iron',carry:127,total:136},{club:'9 Iron',carry:117,total:125},
    {section:'Wedges'},{club:'PW',carry:107,total:114},{club:'GW',carry:97,total:103},{club:'SW',carry:83,total:89},{club:'LW',carry:70,total:75}
  ]},
  '15':{driverDist:215,clubSpeed:93,clubs:[
    {section:'Woods'},{club:'Driver',carry:200,total:215},{club:'3 Wood',carry:182,total:196},{club:'5 Wood',carry:170,total:183},
    {section:'Irons'},{club:'5 Iron',carry:146,total:156},{club:'6 Iron',carry:138,total:148},{club:'7 Iron',carry:129,total:138},{club:'8 Iron',carry:120,total:128},{club:'9 Iron',carry:110,total:118},
    {section:'Wedges'},{club:'PW',carry:101,total:108},{club:'GW',carry:91,total:97},{club:'SW',carry:78,total:84},{club:'LW',carry:66,total:70}
  ]},
  '20':{driverDist:203,clubSpeed:92,clubs:[
    {section:'Woods'},{club:'Driver',carry:188,total:203},{club:'3 Wood',carry:171,total:185},{club:'5 Wood',carry:160,total:173},
    {section:'Irons'},{club:'5 Iron',carry:138,total:148},{club:'6 Iron',carry:130,total:139},{club:'7 Iron',carry:122,total:131},{club:'8 Iron',carry:113,total:121},{club:'9 Iron',carry:104,total:111},
    {section:'Wedges'},{club:'PW',carry:95,total:102},{club:'GW',carry:86,total:92},{club:'SW',carry:74,total:79},{club:'LW',carry:62,total:66}
  ]},
  '25':{driverDist:190,clubSpeed:88,clubs:[
    {section:'Woods'},{club:'Driver',carry:175,total:190},{club:'3 Wood',carry:159,total:173},{club:'5 Wood',carry:149,total:163},
    {section:'Irons'},{club:'6 Iron',carry:122,total:132},{club:'7 Iron',carry:114,total:123},{club:'8 Iron',carry:106,total:114},{club:'9 Iron',carry:97,total:105},
    {section:'Wedges'},{club:'PW',carry:89,total:96},{club:'GW',carry:80,total:86},{club:'SW',carry:69,total:74},{club:'LW',carry:58,total:62}
  ]},
  '30':{driverDist:177,clubSpeed:84,clubs:[
    {section:'Woods'},{club:'Driver',carry:162,total:177},{club:'3 Wood',carry:147,total:161},{club:'5 Wood',carry:138,total:151},
    {section:'Irons'},{club:'7 Iron',carry:106,total:115},{club:'8 Iron',carry:98,total:106},{club:'9 Iron',carry:90,total:97},
    {section:'Wedges'},{club:'PW',carry:83,total:89},{club:'GW',carry:75,total:80},{club:'SW',carry:64,total:69},{club:'LW',carry:54,total:58}
  ]}
};

// Speed ratios relative to driver speed (based on BO_META defaults)
var DG_SPEED_RATIOS = {
  driver:{key:'driver',label:'Driver',ratio:1.0,aa:0},
  '3w':{key:'3w',label:'3 Wood',ratio:0.95,aa:-1},
  '5w':{key:'5w',label:'5 Wood',ratio:0.90,aa:-2},
  '4i':{key:'4i',label:'4 Iron',ratio:0.86,aa:-3},
  '5i':{key:'5i',label:'5 Iron',ratio:0.85,aa:-3},
  '6i':{key:'6i',label:'6 Iron',ratio:0.83,aa:-3},
  '7i':{key:'7i',label:'7 Iron',ratio:0.82,aa:-3.5},
  '8i':{key:'8i',label:'8 Iron',ratio:0.80,aa:-4},
  '9i':{key:'9i',label:'9 Iron',ratio:0.78,aa:-4},
  pw:{key:'pw',label:'PW',ratio:0.75,aa:-4.5},
  '50':{key:'50',label:'50\u00B0',ratio:0.72,aa:-5},
  '52':{key:'52',label:'52\u00B0',ratio:0.70,aa:-5},
  '54':{key:'54',label:'54\u00B0',ratio:0.68,aa:-5},
  '56':{key:'56',label:'56\u00B0',ratio:0.66,aa:-5},
  '58':{key:'58',label:'58\u00B0',ratio:0.64,aa:-5},
  '60':{key:'60',label:'60\u00B0',ratio:0.62,aa:-5}
};

function toggleDistanceGuide() {
  var page = document.getElementById('distanceGuidePage');
  if (!page) return;
  var isOpen = page.style.display === 'block';
  page.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) dgRenderCurrentTab();
}

function dgSetTab(tab) {
  _dgCurrentTab = tab;
  ['pga','lpga','handicap','speed','profile'].forEach(function(t) {
    document.getElementById('dgTab_' + t).classList.toggle('dg-tab-active', t === tab);
    document.getElementById('dgContent_' + t).style.display = t === tab ? 'block' : 'none';
  });
  dgRenderCurrentTab();
}

function dgRenderCurrentTab() {
  if (_dgCurrentTab === 'pga') dgRenderTourTable('dgPgaTable', DG_PGA_DATA, 'PGA Tour Averages');
  else if (_dgCurrentTab === 'lpga') dgRenderTourTable('dgLpgaTable', DG_LPGA_DATA, 'LPGA Tour Averages');
  else if (_dgCurrentTab === 'handicap') dgRenderHandicap();
  else if (_dgCurrentTab === 'speed') dgRenderSpeed();
  else if (_dgCurrentTab === 'profile') dgRenderProfile();
}

function dgBuildSimpleTable(data) {
  var html = '<div class="dg-table-wrap"><table class="dg-table dg-table-simple"><thead><tr><th>Club</th><th>Carry</th><th>Total</th></tr></thead><tbody>';
  data.forEach(function(row) {
    if (row.section) {
      html += '<tr class="dg-section-header"><td colspan="3">' + row.section + '</td></tr>';
    } else {
      html += '<tr><td class="dg-club-name">' + row.club + '</td><td>' + row.carry + '</td><td>' + row.total + '</td></tr>';
    }
  });
  html += '</tbody></table></div>';
  return html;
}

function dgBuildTourTable(data) {
  var html = '<div class="dg-table-wrap"><table class="dg-table"><thead><tr>';
  html += '<th>Club</th><th>Carry</th><th>Club Spd</th><th>Ball Spd</th><th>Smash</th><th>Attack</th><th>Launch</th><th>Spin</th><th>Height</th><th>Land</th>';
  html += '</tr></thead><tbody>';
  data.forEach(function(row) {
    html += '<tr>';
    html += '<td class="dg-club-name">' + row.club + '</td>';
    html += '<td style="font-weight:700;color:#4fc3f7;">' + row.carry + '</td>';
    html += '<td>' + row.clubSpeed + '</td>';
    html += '<td>' + row.ballSpeed + '</td>';
    html += '<td>' + row.smash + '</td>';
    html += '<td>' + row.attackAngle + '\u00B0</td>';
    html += '<td>' + row.launch + '\u00B0</td>';
    html += '<td>' + row.spin.toLocaleString() + '</td>';
    html += '<td>' + row.maxHeight + ' yd</td>';
    html += '<td>' + row.landAngle + '\u00B0</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function dgRenderTourTable(containerId, data, title) {
  var html = '<p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.35);margin:0 0 8px;">Swipe to see all stats \u2192</p>';
  html += dgBuildTourTable(data);
  document.getElementById(containerId).innerHTML = html;
}

function dgRenderHandicap() {
  var hcp = document.getElementById('dgHandicapSelect').value;
  var d = DG_HANDICAP_DATA[hcp];
  if (!d) return;
  var html = '<div class="dg-stat-box">';
  html += '<div><div class="dg-stat-label">Avg Driver Distance</div><div class="dg-stat-value">' + d.driverDist + ' <span style="font-size:0.6em;color:#999;">yds</span></div></div>';
  html += '<div><div class="dg-stat-label">Driver Club Speed</div><div class="dg-stat-value">' + d.clubSpeed + ' <span style="font-size:0.6em;color:#999;">mph</span></div></div>';
  html += '</div>';
  html += dgBuildSimpleTable(d.clubs);
  document.getElementById('dgHandicapTable').innerHTML = html;
}

function dgRenderSpeed() {
  var driverSpeed = parseFloat(document.getElementById('dgDriverSpeed').value);
  if (isNaN(driverSpeed) || driverSpeed < 60 || driverSpeed > 140) {
    document.getElementById('dgSpeedTable').innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Enter a driver club speed between 60-140 mph</div>';
    return;
  }
  var clubs = [
    {key:'driver',section:'Woods'},
    {key:'driver'},{key:'3w'},{key:'5w'},
    {key:'4i',section:'Irons'},
    {key:'4i'},{key:'5i'},{key:'6i'},{key:'7i'},{key:'8i'},{key:'9i'},
    {key:'pw',section:'Wedges'},
    {key:'pw'},{key:'50'},{key:'52'},{key:'54'},{key:'56'},{key:'58'},{key:'60'}
  ];
  var rows = [];
  clubs.forEach(function(c) {
    if (c.section) { rows.push({section:c.section}); return; }
    var info = DG_SPEED_RATIOS[c.key];
    if (!info) return;
    var clubSpeed = Math.round(driverSpeed * info.ratio);
    var cdata = BO_DATA[info.key];
    if (!cdata) return;
    var carryResult = boGetInterpolatedData(clubSpeed, info.aa, cdata.carry);
    var totalResult;
    if (cdata.total) {
      totalResult = boGetInterpolatedData(clubSpeed, info.aa, cdata.total);
    } else {
      totalResult = carryResult;
    }
    rows.push({club:info.label,carry:Math.round(carryResult.carry),total:Math.round(totalResult.total)});
  });
  var html = '<div class="dg-stat-box">';
  html += '<div><div class="dg-stat-label">Driver Club Speed</div><div class="dg-stat-value">' + driverSpeed + ' <span style="font-size:0.6em;color:#999;">mph</span></div></div>';
  var driverRow = rows.find(function(r){ return r.club === 'Driver'; });
  if (driverRow) {
    html += '<div><div class="dg-stat-label">Est. Driver Carry</div><div class="dg-stat-value">' + driverRow.carry + ' <span style="font-size:0.6em;color:#999;">yds</span></div></div>';
    html += '<div><div class="dg-stat-label">Est. Driver Total</div><div class="dg-stat-value">' + driverRow.total + ' <span style="font-size:0.6em;color:#999;">yds</span></div></div>';
  }
  html += '</div>';
  html += dgBuildSimpleTable(rows);
  document.getElementById('dgSpeedTable').innerHTML = html;
}

// Age/Gender profile data
// Male: Arccos (20M+ drives) for total distance, deWiz Golf for swing speeds, club ratios derived from Trackman
// Female: Trackman LPGA scaled by age, deWiz Golf female swing speeds
var DG_PROFILE_DATA = {
  male: {
    '20': {driverSpeed:104,driverTotal:240,driverCarry:225},
    '30': {driverSpeed:101,driverTotal:234,driverCarry:219},
    '40': {driverSpeed:97,driverTotal:226,driverCarry:211},
    '50': {driverSpeed:93,driverTotal:215,driverCarry:201},
    '60': {driverSpeed:88,driverTotal:205,driverCarry:191},
    '70': {driverSpeed:82,driverTotal:190,driverCarry:177}
  },
  female: {
    '20': {driverSpeed:83,driverTotal:186,driverCarry:172},
    '30': {driverSpeed:81,driverTotal:181,driverCarry:167},
    '40': {driverSpeed:78,driverTotal:174,driverCarry:161},
    '50': {driverSpeed:74,driverTotal:163,driverCarry:150},
    '60': {driverSpeed:69,driverTotal:149,driverCarry:137},
    '70': {driverSpeed:64,driverTotal:135,driverCarry:124}
  }
};

function dgRenderProfile() {
  var age = document.getElementById('dgProfileAge').value;
  var gender = document.getElementById('dgProfileGender').value;
  var p = DG_PROFILE_DATA[gender] && DG_PROFILE_DATA[gender][age];
  if (!p) return;
  var driverSpeed = p.driverSpeed;

  // Build club table using speed ratios (same as Driver Speed tab)
  var clubList = [
    {key:'driver',section:'Woods'},
    {key:'driver'},{key:'3w'},{key:'5w'},
    {key:'4i',section:'Irons'},
    {key:'4i'},{key:'5i'},{key:'6i'},{key:'7i'},{key:'8i'},{key:'9i'},
    {key:'pw',section:'Wedges'},
    {key:'pw'},{key:'50'},{key:'52'},{key:'54'},{key:'56'},{key:'58'},{key:'60'}
  ];
  var rows = [];
  clubList.forEach(function(c) {
    if (c.section) { rows.push({section:c.section}); return; }
    var info = DG_SPEED_RATIOS[c.key];
    if (!info) return;
    var clubSpeed = Math.round(driverSpeed * info.ratio);
    var cdata = BO_DATA[info.key];
    if (!cdata) return;
    var carryResult = boGetInterpolatedData(clubSpeed, info.aa, cdata.carry);
    var totalResult = cdata.total ? boGetInterpolatedData(clubSpeed, info.aa, cdata.total) : carryResult;
    rows.push({club:info.label,carry:Math.round(carryResult.carry),total:Math.round(totalResult.total)});
  });

  var ageLabel = age === '70' ? '70+' : age + '-' + (parseInt(age)+9);
  var genderLabel = gender === 'male' ? 'Male' : 'Female';
  var html = '<div style="text-align:center;font-size:13px;font-weight:700;color:#e0e0e0;margin-bottom:10px;">' + genderLabel + ', Age ' + ageLabel + '</div>';
  html += '<div class="dg-stat-box">';
  html += '<div><div class="dg-stat-label">Avg Driver Speed</div><div class="dg-stat-value">' + driverSpeed + ' <span style="font-size:0.6em;color:#999;">mph</span></div></div>';
  html += '<div><div class="dg-stat-label">Avg Driver Carry</div><div class="dg-stat-value">' + p.driverCarry + ' <span style="font-size:0.6em;color:#999;">yds</span></div></div>';
  html += '<div><div class="dg-stat-label">Avg Driver Total</div><div class="dg-stat-value">' + p.driverTotal + ' <span style="font-size:0.6em;color:#999;">yds</span></div></div>';
  html += '</div>';
  html += dgBuildSimpleTable(rows);
  document.getElementById('dgProfileTable').innerHTML = html;
}

// Functions called from inline HTML handlers
expose({ toggleDistanceGuide, dgSetTab, dgRenderHandicap, dgRenderSpeed, dgRenderProfile });
