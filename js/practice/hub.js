import { onEnter } from '../coaching/core.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { boInit } from '../learn/optimizer.js';
import { returnSGCalcToHelp } from '../learn/sg-calculator.js';
import { setDrillCategory } from './drills.js';
import { loadPHCombineHistory } from './log.js';
import { ppBackToLanding } from './plans.js';

// =============================================
// PRACTICE HUB TABS
// =============================================


export function setPracticeHubTab(tab) {
  S.currentPHTab = tab;
  document.getElementById('phCombinesContent').style.display = tab === 'combines' ? '' : 'none';
  document.getElementById('phDrillsContent').style.display   = tab === 'drills'   ? '' : 'none';
  document.getElementById('phPlanContent').style.display     = tab === 'plan'     ? '' : 'none';
  document.getElementById('phLearnContent').style.display    = tab === 'learn'    ? '' : 'none';

  var tabs = { combines: 'phTabCombines', drills: 'phTabDrills', plan: 'phTabPlan', learn: 'phTabLearn' };
  Object.keys(tabs).forEach(function(k) {
    var btn = document.getElementById(tabs[k]);
    if (btn) {
      btn.style.background = k === tab ? '#2d7abc' : '#282828';
      btn.style.color      = k === tab ? '#ffffff' : '#606060';
    }
  });

  if (tab === 'combines') loadPHCombineHistory();
  if (tab === 'drills') { S.drillsOnPracticeHub = true; setDrillCategory('putting'); }
  if (tab === 'plan') {
    if (S.ppReturningFromDrill) {
      S.ppReturningFromDrill = false;
    } else {
      ppBackToLanding();
    }
  }
  // When leaving Learn tab, return SG calc to its original home
  if (tab !== 'learn') returnSGCalcToHelp();
}


// === DISTANCE OPTIMIZER ===
export function toggleLearnDistanceOptimizer() {
  var page = document.getElementById('learnDistanceOptimizerPage');
  if (!page) return;
  var isOpen = page.style.display === 'block';
  page.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && !S.boInited) { boInit(); S.boInited = true; }
}

export function toggleLearnProximityCalc() {
  var page = document.getElementById('learnProximityCalcPage');
  if (!page) return;
  var isOpen = page.style.display === 'block';
  page.style.display = isOpen ? 'none' : 'block';
}

onEnter('practiceHubPage', function() {
  setPracticeHubTab(S.currentPHTab || 'combines');
});

// Functions called from inline HTML handlers
expose({ setPracticeHubTab, toggleLearnDistanceOptimizer, toggleLearnProximityCalc });
