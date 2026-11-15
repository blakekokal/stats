import { expose } from '../coaching/core.js';
import { escHtml } from '../coaching/core.js';
import { ppHideAllViews } from './plans.js';

// ── Custom Practice Plan ──
var _ppCustomCategories = []; // [{title:'', items:['','']}]
var _CUSTOM_PLANS_KEY = 'customPracticePlans_v1';

function ppGetSavedPlans() {
  try { return JSON.parse(localStorage.getItem(_CUSTOM_PLANS_KEY)) || []; }
  catch(e) { return []; }
}
function ppSavePlansToStorage(plans) {
  localStorage.setItem(_CUSTOM_PLANS_KEY, JSON.stringify(plans));
}

function ppShowCustom() {
  ppHideAllViews();
  document.getElementById('ppCustomView').style.display = '';
  _ppCustomCategories = [];
  ppCustomRenderCategories();
  ppCustomRenderSaved();
  document.getElementById('ppCustomMsg').textContent = '';
  var nameInput = document.getElementById('ppCustomName');
  if (nameInput) nameInput.value = '';
}

function ppCustomRenderSaved() {
  var container = document.getElementById('ppCustomSaved');
  var plans = ppGetSavedPlans();
  if (!plans.length) { container.innerHTML = ''; return; }
  var html = '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Saved Plans</div>';
  plans.forEach(function(p, i) {
    var totalItems = 0;
    p.categories.forEach(function(c) { totalItems += c.items.length; });
    html += '<div style="background:#222;border-radius:10px;padding:12px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">';
    html += '<div onclick="ppCustomUsePlan(' + i + ')" style="flex:1;cursor:pointer;">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;">' + escHtml(p.name) + '</div>';
    html += '<div style="font-size:11px;color:#606060;">' + p.categories.length + ' categories, ' + totalItems + ' drills</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:10px;align-items:center;">';
    html += '<button onclick="ppCustomEditPlan(' + i + ')" style="background:none;border:none;color:#44b8f0;font-size:11px;font-weight:700;cursor:pointer;padding:0;height:auto;max-width:none;width:auto;">Edit</button>';
    html += '<button onclick="ppCustomDeletePlan(' + i + ')" style="background:none;border:none;color:#555;font-size:11px;cursor:pointer;padding:0;height:auto;max-width:none;width:auto;">Delete</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function ppCustomAddCategory() {
  _ppCustomCategories.push({ title: '', items: [''] });
  ppCustomRenderCategories();
}

function ppCustomRenderCategories() {
  var container = document.getElementById('ppCustomCategories');
  var html = '';
  _ppCustomCategories.forEach(function(cat, ci) {
    var isPreset = (cat.title === 'Range' || cat.title === 'Short Game' || cat.title === 'Putting');
    var selVal = isPreset ? cat.title : (cat.title ? 'Custom' : '');
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:6px;">';
    html += '<select onchange="ppCustomCatSelect(' + ci + ',this.value)" style="flex:1;height:34px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:13px;font-weight:700;box-sizing:border-box;-webkit-appearance:none;appearance:none;">';
    html += '<option value=""' + (!selVal ? ' selected' : '') + ' disabled>Select category...</option>';
    html += '<option value="Range"' + (selVal === 'Range' ? ' selected' : '') + '>Range</option>';
    html += '<option value="Short Game"' + (selVal === 'Short Game' ? ' selected' : '') + '>Short Game</option>';
    html += '<option value="Putting"' + (selVal === 'Putting' ? ' selected' : '') + '>Putting</option>';
    html += '<option value="Custom"' + (selVal === 'Custom' ? ' selected' : '') + '>Custom</option>';
    html += '</select>';
    html += '<button onclick="ppCustomRemoveCat(' + ci + ')" style="background:none;border:none;color:#555;font-size:18px;cursor:pointer;padding:0 0 0 4px;height:auto;max-width:none;width:auto;">×</button>';
    html += '</div>';
    if (selVal === 'Custom') {
      html += '<input type="text" value="' + escHtml(cat.title) + '" placeholder="Enter custom category name" onchange="ppCustomUpdateCatTitle(' + ci + ',this.value)" style="width:100%;height:34px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box;margin-bottom:10px;">';
    }
    cat.items.forEach(function(item, ii) {
      html += '<div style="display:flex;gap:6px;margin-bottom:6px;">';
      html += '<input type="text" value="' + escHtml(item) + '" placeholder="Drill or activity" onchange="ppCustomUpdateItem(' + ci + ',' + ii + ',this.value)" style="flex:1;height:34px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:12px;box-sizing:border-box;">';
      html += '<button onclick="ppCustomRemoveItem(' + ci + ',' + ii + ')" style="width:34px;height:34px;background:#333;border:none;border-radius:8px;color:#666;font-size:16px;cursor:pointer;padding:0;">×</button>';
      html += '</div>';
    });
    html += '<button onclick="ppCustomAddItem(' + ci + ')" style="width:100%;height:32px;background:transparent;border:1px dashed #444;border-radius:8px;color:#666;font-size:12px;cursor:pointer;max-width:none;">+ Add drill</button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function ppCustomCatSelect(ci, val) {
  if (val === 'Custom') {
    _ppCustomCategories[ci].title = '';
  } else {
    _ppCustomCategories[ci].title = val;
  }
  ppCustomRenderCategories();
}

function ppCustomUpdateCatTitle(ci, val) { _ppCustomCategories[ci].title = val; }
function ppCustomUpdateItem(ci, ii, val) { _ppCustomCategories[ci].items[ii] = val; }
function ppCustomRemoveCat(ci) { _ppCustomCategories.splice(ci, 1); ppCustomRenderCategories(); }
function ppCustomRemoveItem(ci, ii) {
  _ppCustomCategories[ci].items.splice(ii, 1);
  if (_ppCustomCategories[ci].items.length === 0) _ppCustomCategories[ci].items.push('');
  ppCustomRenderCategories();
}
function ppCustomAddItem(ci) { _ppCustomCategories[ci].items.push(''); ppCustomRenderCategories(); }

var _ppCustomEditingIdx = -1;

function ppCustomSavePlan() {
  var msg = document.getElementById('ppCustomMsg');
  var name = (document.getElementById('ppCustomName').value || '').trim();
  if (!name) { msg.style.color = '#d4706e'; msg.textContent = 'Enter a plan name.'; return; }

  // Filter out empty categories/items
  var categories = [];
  _ppCustomCategories.forEach(function(c) {
    var title = (c.title || '').trim();
    var items = c.items.map(function(i) { return (i || '').trim(); }).filter(function(i) { return i; });
    if (title && items.length) categories.push({ title: title, items: items });
  });
  if (!categories.length) { msg.style.color = '#d4706e'; msg.textContent = 'Add at least one category with drills.'; return; }

  var plans = ppGetSavedPlans();
  var plan = { name: name, categories: categories, createdAt: new Date().toISOString() };

  if (_ppCustomEditingIdx >= 0 && _ppCustomEditingIdx < plans.length) {
    plans[_ppCustomEditingIdx] = plan;
    _ppCustomEditingIdx = -1;
    msg.style.color = '#00b87a'; msg.textContent = 'Plan updated!';
  } else {
    plans.push(plan);
    msg.style.color = '#00b87a'; msg.textContent = 'Plan saved!';
  }
  ppSavePlansToStorage(plans);
  _ppCustomCategories = [];
  ppCustomRenderCategories();
  ppCustomRenderSaved();
  document.getElementById('ppCustomName').value = '';
}

function ppCustomEditPlan(idx) {
  var plans = ppGetSavedPlans();
  var p = plans[idx];
  if (!p) return;
  _ppCustomEditingIdx = idx;
  document.getElementById('ppCustomName').value = p.name;
  _ppCustomCategories = p.categories.map(function(c) {
    return { title: c.title, items: c.items.slice() };
  });
  ppCustomRenderCategories();
  document.getElementById('ppCustomMsg').textContent = '';
  // Scroll to builder
  var scroll = document.getElementById('practiceHubScroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function ppCustomDeletePlan(idx) {
  if (!confirm('Delete this plan?')) return;
  var plans = ppGetSavedPlans();
  plans.splice(idx, 1);
  ppSavePlansToStorage(plans);
  ppCustomRenderSaved();
}

function ppCustomUsePlan(idx) {
  var plans = ppGetSavedPlans();
  var p = plans[idx];
  if (!p) return;
  ppHideAllViews();
  document.getElementById('ppCustomUseView').style.display = '';

  var html = '<div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:14px;">' + escHtml(p.name) + '</div>';
  var colors = ['#e06666','#6fa8dc','#93c47d','#f6b26b','#b4a7d6','#e6a84d'];
  p.categories.forEach(function(cat, ci) {
    var color = colors[ci % colors.length];
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:8px;border-left:4px solid ' + color + ';">';
    html += '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px;">' + escHtml(cat.title) + '</div>';
    cat.items.forEach(function(item, ii) {
      var uid = 'ppCustomDrill_' + ci + '_' + ii;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">';
      html += '<div id="' + uid + '" onclick="ppToggleDrill(this,event)" style="width:22px;height:22px;min-width:22px;border-radius:50%;border:2px solid #555;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>';
      html += '<div style="flex:1;font-size:13px;color:#ccc;">' + escHtml(item) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '<button onclick="ppLogFromPractice(\'custom\')" style="width:100%;height:46px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;max-width:none;margin-top:12px;">Log Session</button>';
  document.getElementById('ppCustomUseContent').innerHTML = html;
}

// Functions called from inline HTML handlers
expose({ ppShowCustom, ppCustomAddCategory, ppCustomCatSelect, ppCustomUpdateCatTitle, ppCustomUpdateItem, ppCustomRemoveCat, ppCustomRemoveItem, ppCustomAddItem, ppCustomSavePlan, ppCustomEditPlan, ppCustomDeletePlan, ppCustomUsePlan });
