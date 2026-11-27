// Page markup for My Bag, Performance Analysis, Practice and Learning, drills
// and combines, taken from the coaching app (v6/index.html).

import { ic } from '../icons.js';

export const GUIDE_PAGE = `<!-- GUIDE TO GOLF PAGE -->
<div id="guideToGolfPage" class="page" style="justify-content:flex-start;padding-top:20px;overflow-y:auto;padding-bottom:80px;align-items:center;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="font-size:22px;font-weight:800;margin-bottom:4px;">Guide to Golf</div>
  <div style="font-size:13px;color:#9a9a9a;margin-bottom:16px;">How to hit every shot</div>

  <div style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;">

    <!-- Driver -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SRIQYISbFAIcbNaYD9H3Lyhy8N96NP5RRX2q1tV79XzJ-UsSxpxXkWx8KPcXa1bPC1p675MtCz6tisJQx7heESOxUTVHGrU7tn2UaJlcy55msyaHXsCgcpIXsoaieWPXMnxU7FV5SMPdhtIjX61O92OjbugQQ7DOvCy2K-idN_0KicmYifCOtkwOQmtS5d3Nkqkxlfx5hApWuqwcdWBKE0oc2Z8GbT3UzbuFjo=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Driver</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Feet wide</li>
          <li>Ball by front foot</li>
          <li>Tall tee</li>
          <li>Shoulders up</li>
        </ul>
      </div>
    </div>

    <!-- Hybrid / 3 Wood -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SSlzxe1ZkAQFMoPwx7a2hsJ14qmu95s6ouidrhGGPeFk3lakIWozxBBnngq0sN6O58bz8PJsNz68h4ouDCjBWtxXOz8pKditU_Ewbwg2x7FgD3BAxv2S4HhjgiEDntGacgfCxAtOpE7dUk3fM5P1nspByJPlG1e-AS7UOjjCCi3F9olICzO9bA_hZkl6fr_UzinsL2NLifuv_G8xZmQr-7uVMFyN-IJji2E=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Hybrid / 3 Wood</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Feet slightly wider than shoulder width</li>
          <li>Ball slightly forward in stance</li>
          <li>Shoulders level</li>
          <li>55-65% of weight on back foot</li>
        </ul>
      </div>
    </div>

    <!-- Irons -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SSSafVu6pyn9CtjE6MCwlqPIoUlbor4rsToLB8w_qPy40arVW_DzAOFUO4WmMmwzpnLgvG7eJUNSKWGlbsrX3myrbTV0oGOufhGungQJikKiFO_dTRcQnIbhLxflEAIn2mqepcA8DMfzcPNTajR0IrRR0mXw58avsULIYvS-uRWFEkHdb3-dun82JAAf9WGadxmZU8g9SIg7gDw1YfwRuqDnmQlwFn_QeupMqg=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Irons</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Feet shoulder width</li>
          <li>Ball in middle of stance</li>
          <li>Shoulders level</li>
          <li>50/50 weight on each foot</li>
        </ul>
      </div>
    </div>

    <!-- Chipping (Low) -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0STiquwMUrI8swVnJjsZAyR3CNWXbbTFGaloKaBtGrMbDayuXszg5bXFF6GUjDi3Kh5iQE2FbrYkffIuPVvXtlht46QXHefD4ur3dg5c2LkB3tIKuRZNaa9ap9oRTUwhyYZa-Trp5q2kVltJ431dO0_Ffkx9NIfIAFHy7OdYgEyNSmjzK4RijsdFndo9X67CsiV8k9BQAGUJ1SXy692rZ7JAbDgRjlHfYQtZ=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Chipping (Low)</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Use PW or SW</li>
          <li>70-80% of weight on front foot</li>
          <li>Feet closer together</li>
          <li>Ball in back of stance</li>
          <li>Putting motion, no wrists</li>
        </ul>
      </div>
    </div>

    <!-- Chipping (High) -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SS8CLkEWl7AKcDzVO_5yFgF_rAKOF0PSfuLe-yEvDZJk6DUoLZm7y7vnBc6k4QVSPomKBVtW8VU0S_zwF1-L22TrnB04frfTTfIgglnjVYqBLGNQfZ9LfNbmzA6RnJZ2MJKcQN2gVfHLIxK1PedKbKmHGFofUTOzjp2HB_KGfrW1QGNcV_0R_Z7_Ca0XRD0NFt-7XgqLTZnLvBseBU2-RWzlchEk-RPzbpIgpU=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Chipping (High)</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Use SW</li>
          <li>70-80% of weight on front foot</li>
          <li>Feet closer together</li>
          <li>Ball in front of stance</li>
          <li>Putting motion, no wrists</li>
        </ul>
      </div>
    </div>

    <!-- Bunker / Sand -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SQrqmzOjd-3aSmwHpP9uFiRovqAxRbe_GyURl2VqM5RINn_oFS-95mSwHrBq_8M-9O8fCpY60AFND55zzOm2Bs9byZArW7xLj36xLcXXe-pfIeRl9Aws7-FZxTQsrwYayCEWFyJ2UBQwIWSSm7w-NwnRnMedR9NpkiuF7DlL1fWRzVWJblQ79gm3UNKcby3OYuLpCxjRHxQgHjSVjLIIuin6w14Xkemsw=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Bunker / Sand</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Use SW</li>
          <li>Feet shoulder width</li>
          <li>Ball in front of stance</li>
          <li>70-80% weight on front foot</li>
          <li>Big swing, hitting sand 1 inch behind ball</li>
        </ul>
      </div>
    </div>

    <!-- Putting -->
    <div style="background:#222;border-radius:14px;overflow:hidden;">
      <img src="https://lh3.googleusercontent.com/sitesv/APaQ0SRlfRyfWIZrDSnLIuxViVrMdPARpebxXiCvAMvDQn6BasIERfCXMGoiZdielgP_UhyNUHHooSIYo3uDKmg-afYdgCW5x7U7yRlNPDHxGq7qqxYGT3vjvfhKunecI5Ftm5FG3gmWFZ7GbLuynIbpSmToZcridjh3TB5GKiRDUtSa1NST7ThbR-OG9NLdxnT9TGPYgmU9p_uKzZuhGmjSSkpkBkI0815qChg1hFI=w1280" alt="" onerror="this.style.display='none'" style="width:100%;display:block;border-radius:14px 14px 0 0;">
      <div style="padding:14px 16px;">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Putting</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:2;text-align:left;">
          <li>Feet around shoulder width</li>
          <li>Ball in middle/front of stance</li>
          <li>No wrists, rock back and shoulders back and forth</li>
        </ul>
      </div>
    </div>

  </div>
</div>`;

export const PRACTICE_PAGES = `<div id="practiceHubPage" class="page" style="justify-content:flex-start;padding:0;overflow:hidden;">

  <!-- Fixed header -->
  <div class="fixedhead" style="flex-shrink:0;width:100%;padding:30px 16px 0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;position:relative;">
    <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div style="font-size:22px;font-weight:800;margin-bottom:6px;">${ic('club', 'tint-yellow')} Practice and Learning</div>
    <div style="font-size:13px;color:#9a9a9a;margin-bottom:14px;">Combines, Drills, Practice &amp; Learn</div>

    <!-- 4-tab bar -->
    <div class="tabs" style="display:flex;width:100%;max-width:360px;margin-bottom:0;">
      <button onclick="setPracticeHubTab('combines')" id="phTabCombines" style="flex:1;height:40px;font-size:13px;font-weight:700;background:#2d7abc;border:none;color:#ffffff;cursor:pointer;max-width:none;width:auto;padding:0;margin:0;">Combines</button>
      <button onclick="setPracticeHubTab('plan')" id="phTabPlan" style="flex:1;height:40px;font-size:13px;font-weight:700;background:#282828;border:none;color:#606060;cursor:pointer;max-width:none;width:auto;padding:0;margin:0;">Practice</button>
      <button onclick="setPracticeHubTab('drills')" id="phTabDrills" style="flex:1;height:40px;font-size:13px;font-weight:700;background:#282828;border:none;color:#606060;cursor:pointer;max-width:none;width:auto;padding:0;margin:0;">Drills</button>
      <button onclick="setPracticeHubTab('learn')" id="phTabLearn" style="flex:1;height:40px;font-size:13px;font-weight:700;background:#282828;border:none;color:#606060;cursor:pointer;max-width:none;width:auto;padding:0;margin:0;">Learn</button>
    </div>
  </div>

  <!-- Scrollable body -->
  <div id="practiceHubScroll" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;width:100%;display:flex;flex-direction:column;align-items:center;padding:14px 16px 80px;">
  <div style="width:100%;max-width:360px;">

    <!-- COMBINES TAB -->
    <div id="phCombinesContent">
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
        <button onclick="goToEvalCombine()" id="phEvalCombineBtn" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('target', 'tint-blue')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Evaluation Test</div></div>
        </button>
        <button onclick="goToPuttingCombine()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('putt', 'tint-green')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Putting</div></div>
        </button>
        <button onclick="goToCombines()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('chip', 'tint-yellow')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Short Game</div></div>
        </button>
        <button onclick="goToWedgeCombine()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('carry', 'tint-red')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Wedge Distances</div></div>
        </button>
        <button onclick="goToLineDrill()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('line', 'tint-purple')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Line Drill</div></div>
        </button>
        <button onclick="goToDriverCombinePicker()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('driver', 'tint-blue')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Driver</div></div>
        </button>
      </div>
      <!-- Combine History -->
      <div style="margin-top:16px;">
        <div class="fhead" style="margin-bottom:10px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;">Combine History</div><div class="fmenu"><button type="button" class="fbtn">&#9776; <span>Filter</span></button><div class="fpanel" hidden><label class="frow"><span>Type</span><select id="phCombFilterType" onchange="loadPHCombineHistory()" class="glassselect">
            <option value="all">All Types</option>
            <option value="Putting">Putting</option>
            <option value="Chipping (Prox)">Chipping Prox</option>
            <option value="Chip Hole Out">Chip Hole Out</option>
            <option value="Wedge">Wedge</option>
            <option value="Driver">Driver</option>
            <option value="Line Drill">Line Drill</option>
          </select></label><label class="frow"><span>Show</span><select id="phCombFilterMode" onchange="loadPHCombineHistory()" class="glassselect">
            <option value="all">Custom &amp; Combine</option>
            <option value="combine">Combine Only</option>
            <option value="custom">Custom Only</option>
          </select></label><div class="factions"><button type="button" class="fclear">Clear</button><button type="button" class="fdone">Done</button></div></div></div></div>
        <div id="phCombineHistoryMsg" style="font-size:13px;color:#606060;min-height:20px;text-align:center;margin-bottom:4px;"></div>
        <div id="phCombineHistory" style="width:100%;"></div>
      </div>
    </div>

    <!-- DRILLS TAB -->
    <div id="phDrillsContent" style="display:none;">
      <div style="font-size:22px;font-weight:800;margin-bottom:12px;text-align:center;">Drills Library</div>
      <div class="tabs" style="display:flex;margin-bottom:10px;">
        <button id="phDrillTabPutting"   onclick="setDrillCategory('putting')"   style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#2d7abc;color:#ffffff;min-width:0;max-width:none;width:auto;">Putting</button>
        <button id="phDrillTabShortgame" onclick="setDrillCategory('shortgame')" style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#282828;color:#606060;min-width:0;max-width:none;width:auto;">Short Game</button>
        <button id="phDrillTabFullswing" onclick="setDrillCategory('fullswing')" style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#282828;color:#606060;min-width:0;max-width:none;width:auto;">Full Swing</button>
      </div>
      <div class="fhead end" style="margin-bottom:10px;"><div class="fmenu"><button type="button" class="fbtn">&#9776; <span>Filter</span></button><div class="fpanel" hidden><label class="frow"><span>Type</span><select id="phDrillSubcategory" onchange="filterDrillsBySubcategory(this.value)"></select></label><div class="factions"><button type="button" class="fclear">Clear</button><button type="button" class="fdone">Done</button></div></div></div></div>
      <div id="phDrillContent" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
    </div>

    <!-- MY PRACTICE PLAN TAB -->
    <div id="phPlanContent" style="display:none;">

      <!-- Landing: choose practice mode -->
      <div id="ppLanding">
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
          <button onclick="ppShowSwingJournal()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('journal', 'tint-blue')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Swing Journal</div></div>
          </button>
          <button onclick="ppShowWarmUp()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('dumbbell', 'tint-red')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pre-Round Warm Up</div></div>
          </button>
          <button onclick="ppShowRecommended()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('checklist', 'tint-green')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Recommended Practice</div></div>
          </button>
          <button onclick="ppShowTimed()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('watch', 'tint-yellow')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Timed Practice</div></div>
          </button>
          <button onclick="ppShowTourPractice()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('trophy', 'tint-purple')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Tour Practice</div></div>
          </button>
          <button onclick="ppShowCustom()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('pencil', 'tint-blue')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Custom Practice</div></div>
          </button>
          <button onclick="ppShowGenerator()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
            <span class="tileic">${ic('shuffle', 'tint-green')}</span>
            <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Practice Generator</div></div>
          </button>
        </div>
        <!-- Log / History link -->
        <div style="margin-top:16px;display:flex;gap:0;border-radius:10px;overflow:hidden;">
          <button onclick="ppShowLogSession()" id="ppSubNew" style="flex:1;height:36px;font-size:13px;font-weight:700;background:#282828;border:none;color:#606060;cursor:pointer;max-width:none;">Log Session</button>
          <button onclick="ppShowHistory()" id="ppSubHistory" style="flex:1;height:36px;font-size:13px;font-weight:700;background:#282828;border:none;color:#606060;cursor:pointer;max-width:none;">History</button>
        </div>
      </div>

      <!-- TOUR PRACTICE VIEW -->
      <div id="ppTourView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Tour Practice Routine</div>
        <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 10px;">Typical PGA Tour practice structure</p>
        <!-- Season tabs -->
        <div class="tabs" style="display:flex;width:100%;margin-bottom:14px;">
          <button id="ppTourSeasonTab0" onclick="ppShowTourSeason(0)" style="flex:1;height:36px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Off Season</button>
          <button id="ppTourSeasonTab1" onclick="ppShowTourSeason(1)" style="flex:1;height:36px;font-size:11px;font-weight:700;background:#2d7abc;border-radius:0;border:none;color:#ffffff;max-width:none;width:auto;padding:0;margin:0;">In Season</button>
          <button id="ppTourSeasonTab2" onclick="ppShowTourSeason(2)" style="flex:1;height:36px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Pre Tournament</button>
        </div>
        <div id="ppTourContent"></div>
      </div>

      <!-- RECOMMENDED / TIMED PRACTICE VIEW -->
      <div id="ppRecommendedView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div id="ppRecTitle" style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Recommended Practice</div>
        <p id="ppRecSubtitle" style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Based on your last 5 rounds</p>
        <!-- Time input -->
        <div id="ppTimeInputWrap" style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:14px;text-align:center;">
          <div style="font-size:12px;color:#9a9a9a;margin-bottom:8px;font-weight:600;">How much time do you have?</div>
          <select id="ppTimeSelect" onchange="ppSetTime(parseInt(this.value))" style="width:100%;height:42px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;text-align:center;font-size:15px;font-weight:700;font-family:inherit;appearance:none;-webkit-appearance:none;padding:0 10px;">
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90" selected>90 min</option>
            <option value="120">2 hrs</option>
          </select>
        </div>
        <!-- Pie chart + breakdown -->
        <div id="ppRecLoading" style="display:none;text-align:center;color:#606060;padding:20px;">Loading your round data...</div>
        <div id="ppRecNoData" style="display:none;text-align:center;color:#606060;padding:20px;">Play a few rounds first so we can analyze your game and build a plan.</div>
        <div id="ppRecResults" style="display:none;touch-action:pan-y;">
          <canvas id="ppPieChart" width="240" height="240" style="display:block;margin:6px auto 20px;width:240px;height:240px;touch-action:pan-y;"></canvas>
          <div id="ppBreakdownList" style="display:flex;flex-direction:column;gap:8px;"></div>
          <button onclick="ppLogFromPractice('rec')" style="width:100%;margin-top:16px;padding:14px;font-size:15px;font-weight:700;color:#ffffff;background:#007a52;border:none;border-radius:12px;cursor:pointer;">Log Session</button>
        </div>
      </div>

      <!-- LOG SESSION VIEW (moved from old New Session) -->
      <div id="ppLogView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div id="ppNewSession">
        <div style="background:#222222;border-radius:12px;padding:16px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Session Details</div>
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:#9a9a9a;display:block;margin-bottom:4px;">Date</label>
            <input type="date" id="ppSessionDate" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:#9a9a9a;display:block;margin-bottom:4px;">Combine Completed (optional)</label>
            <select id="ppSessionCombine" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box;">
              <option value="">None</option>
            </select>
            <div style="font-size:10px;color:#9a9a9a;margin-top:3px;">Select if you completed a combine during this session</div>
          </div>
        </div>
        <div style="background:#222222;border-radius:12px;padding:16px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Practice Notes</div>
          <div style="font-size:11px;color:#9a9a9a;margin-bottom:10px;">Add what you practiced and how long (in minutes)</div>
          <div id="ppNotesList"></div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <input type="text" id="ppNoteInput" placeholder="e.g. Short putting 5-25ft" style="flex:1;height:38px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box;">
            <input type="number" id="ppNoteMinutes" placeholder="mins" min="1" style="width:60px;height:38px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 8px;font-size:13px;box-sizing:border-box;text-align:center;">
            <button onclick="addPracticeNote()" style="width:38px;height:38px;background:#007a52;border:none;border-radius:8px;color:#ffffff;font-size:18px;font-weight:700;cursor:pointer;padding:0;">+</button>
          </div>
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid #333333;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:700;color:#9a9a9a;">Total Session Time</span>
            <span id="ppTotalTime" style="font-size:16px;font-weight:800;color:#00b87a;">0 min</span>
          </div>
        </div>
        <button id="ppSaveBtn" onclick="savePracticeSession()" style="width:100%;height:46px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">Save Practice Session</button>
        <div id="ppSaveMsg" style="font-size:12px;text-align:center;min-height:18px;margin-top:6px;"></div>
        </div>
      </div>

      <!-- HISTORY VIEW -->
      <div id="ppHistoryView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div id="ppHistory">
          <div id="ppHistoryList" style="font-size:13px;color:#9a9a9a;text-align:center;padding:12px 0;">Loading...</div>
        </div>
      </div>

      <!-- CUSTOM PRACTICE VIEW -->
      <div id="ppCustomView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Custom Practice</div>
        <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Build your own plan</p>
        <!-- Saved plans list -->
        <div id="ppCustomSaved" style="margin-bottom:14px;"></div>
        <!-- Build new plan -->
        <div id="ppCustomBuilder">
          <div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
            <label style="font-size:12px;color:#9a9a9a;display:block;margin-bottom:4px;">Plan Name</label>
            <input type="text" id="ppCustomName" placeholder="e.g. Pre-round warm-up" style="width:100%;height:38px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:14px;box-sizing:border-box;">
          </div>
          <div id="ppCustomCategories"></div>
          <button onclick="ppCustomAddCategory()" style="width:100%;height:40px;background:#333;border:1px dashed #3d3d3d;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:700;cursor:pointer;max-width:none;margin-bottom:10px;">+ Add Category</button>
          <button onclick="ppCustomSavePlan()" style="width:100%;height:46px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">Save Plan</button>
          <div id="ppCustomMsg" style="font-size:12px;text-align:center;min-height:18px;margin-top:6px;"></div>
        </div>
      </div>

      <!-- CUSTOM PRACTICE USE VIEW (running a saved plan) -->
      <div id="ppCustomUseView" style="display:none;">
        <button class="stepback" onclick="ppShowCustom()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div id="ppCustomUseContent"></div>
      </div>

      <!-- PRACTICE GENERATOR VIEW -->
      <div id="ppGeneratorView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Practice Generator</div>
        <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Pick what you want to work on</p>

        <!-- Category toggles -->
        <div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Categories</div>
          <div style="display:flex;gap:8px;">
            <button id="ppGenCatRange" onclick="ppGenToggleCat('range')" style="flex:1;height:38px;font-size:13px;font-weight:700;border-radius:8px;border:2px solid #3d3d3d;background:transparent;color:#606060;cursor:pointer;">Range</button>
            <button id="ppGenCatShortgame" onclick="ppGenToggleCat('shortgame')" style="flex:1;height:38px;font-size:13px;font-weight:700;border-radius:8px;border:2px solid #3d3d3d;background:transparent;color:#606060;cursor:pointer;">Short Game</button>
            <button id="ppGenCatPutting" onclick="ppGenToggleCat('putting')" style="flex:1;height:38px;font-size:13px;font-weight:700;border-radius:8px;border:2px solid #3d3d3d;background:transparent;color:#606060;cursor:pointer;">Putting</button>
          </div>
        </div>

        <!-- Time -->
        <div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Total Time</div>
          <select id="ppGenTime" style="width:100%;height:42px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;text-align:center;font-size:15px;font-weight:700;font-family:inherit;appearance:none;-webkit-appearance:none;padding:0 10px;">
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60" selected>60 min</option>
            <option value="90">90 min</option>
            <option value="120">2 hrs</option>
          </select>
        </div>

        <!-- Optional: drills per category -->
        <div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Drills per category <span style="font-weight:400;color:#606060;">(optional)</span></div>
          <select id="ppGenDrillCount" style="width:100%;height:42px;background:#1e1e1e;color:#fff;border:1px solid #3d3d3d;border-radius:8px;text-align:center;font-size:15px;font-weight:700;font-family:inherit;appearance:none;-webkit-appearance:none;padding:0 10px;">
            <option value="0" selected>Auto</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>

        <!-- Optional: block/random preference -->
        <div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Drill type <span style="font-weight:400;color:#606060;">(optional)</span></div>
          <div style="display:flex;gap:0;border-radius:8px;overflow:hidden;">
            <button id="ppGenTypeSplit" onclick="ppGenSetType('split')" style="flex:1;height:38px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#2d7abc;color:#fff;">Split</button>
            <button id="ppGenTypeBlock" onclick="ppGenSetType('block')" style="flex:1;height:38px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#282828;color:#606060;">Block</button>
            <button id="ppGenTypeRandom" onclick="ppGenSetType('random')" style="flex:1;height:38px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#282828;color:#606060;">Random</button>
          </div>
        </div>

        <button onclick="ppGenGenerate()" style="width:100%;padding:14px;font-size:15px;font-weight:700;color:#ffffff;background:#007a52;border:none;border-radius:12px;cursor:pointer;margin-bottom:14px;">Generate Practice</button>
        <div id="ppGenMsg" style="text-align:center;font-size:12px;margin-bottom:8px;"></div>

        <!-- Generated results -->
        <div id="ppGenResults" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div id="ppGenLogWrap" style="display:none;">
          <button onclick="ppLogFromPractice('gen')" style="width:100%;margin-top:16px;padding:14px;font-size:15px;font-weight:700;color:#ffffff;background:#007a52;border:none;border-radius:12px;cursor:pointer;">Log Session</button>
        </div>
      </div>

      <!-- PRE-ROUND WARM UP VIEW -->
      <div id="ppWarmUpView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Pre-Round Warm Up</div>
        <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Get loose and dial in before your round</p>
        <div id="ppWarmUpContent"></div>
      </div>

      <!-- SWING JOURNAL VIEW -->
      <div id="ppSwingJournalView" style="display:none;">
        <button class="stepback" onclick="ppBackToLanding()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#2d7abc;font-size:13px;font-weight:700;cursor:pointer;padding:0;margin-bottom:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg> Back</button>
        <div style="font-size:18px;font-weight:800;text-align:center;margin-bottom:4px;">Swing Journal</div>
        <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Track your current swing thoughts</p>
        <div id="sjAddForm" style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:12px;">
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:#9a9a9a;display:block;margin-bottom:4px;">Date</label>
            <input type="date" id="sjEntryDate" style="width:100%;height:40px;background:#1e1e1e;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:#9a9a9a;display:block;margin-bottom:4px;">Swing Thought</label>
            <input type="text" id="sjEntryText" placeholder="e.g. Feel left shoulder turn down" style="width:100%;height:40px;background:#1e1e1e;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;font-size:14px;box-sizing:border-box;">
          </div>
          <button onclick="addSwingJournalEntry()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">+ Add Thought</button>
        </div>
        <div id="sjEntries"></div>
      </div>

    </div>

    <!-- LEARN TAB -->
    <div id="phLearnContent" style="display:none;">
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
        <button onclick="openLearningLibrary()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('books', 'tint-blue')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Learning Library</div></div>
        </button>
        <button onclick="toggleLearnPBV()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('breakGreen', 'tint-purple')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Putting Break Calculator</div></div>
        </button>
        <button onclick="toggleLearnDistanceOptimizer()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('ruler', 'tint-yellow')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Distance Optimizer</div></div>
        </button>
        <button onclick="toggleLearnProximityCalc()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('prox', 'tint-red')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Proximity Calculator</div></div>
        </button>
        <button onclick="toggleDistanceGuide()" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('flight', 'tint-purple')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">How Far Should I Hit It?</div></div>
        </button>
        <button onclick="show('guideToGolfPage')" style="width:100%;display:flex;align-items:center;gap:13px;height:60px;padding:0 15px;font-size:15px;font-weight:700;background:#1a4a8a;border-radius:12px;text-align:left;">
          <span class="tileic">${ic('book', 'tint-blue')}</span>
          <div><div style="font-size:1.1rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Guide to Golf</div></div>
        </button>
      </div>
    </div>

  </div>
  </div><!-- /practiceHubScroll -->
</div>

<!-- DISTANCE OPTIMIZER FULL SCREEN -->
<div id="learnDistanceOptimizerPage" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#1e1e1e;overflow-y:auto;padding:50px 16px 30px;box-sizing:border-box;">
  <button class="back-btn-top" onclick="toggleLearnDistanceOptimizer()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="width:100%;max-width:420px;margin:0 auto;">
    <div style="font-size:20px;font-weight:800;margin-bottom:12px;text-align:center;">Distance Optimizer</div>
    <div id="learnDistanceOptimizerContainer" style="width:100%;">
<div id="bagOptApp">
  <div class="bo-content">
    <div class="bo-results" id="bo_results">
      <h3>Optimal Results</h3>
      <div style="color:#9a9a9a;text-align:center;font-size:0.85em;">Adjust settings to see results</div>
    </div>
    <div class="bo-control-group">
      <label class="bo-label" for="bo_clubSelect">Club Selection</label>
      <select id="bo_clubSelect" onchange="boOnClubChange()">
        <optgroup label="Woods">
          <option value="driver" selected>Driver</option>
          <option value="3w">3 Wood</option>
          <option value="4w">4 Wood</option>
          <option value="5w">5 Wood</option>
        </optgroup>
        <optgroup label="Irons">
          <option value="2i">2 Iron</option>
          <option value="3i">3 Iron</option>
          <option value="4i">4 Iron</option>
          <option value="5i">5 Iron</option>
          <option value="6i">6 Iron</option>
          <option value="7i">7 Iron</option>
          <option value="8i">8 Iron</option>
          <option value="9i">9 Iron</option>
        </optgroup>
        <optgroup label="Wedges">
          <option value="pw">PW (46°)</option>
          <option value="48">48°</option>
          <option value="50">50°</option>
          <option value="52">52°</option>
          <option value="54">54°</option>
          <option value="56">56°</option>
          <option value="58">58°</option>
          <option value="60">60°</option>
        </optgroup>
      </select>
    </div>
    <div class="bo-control-group">
      <label class="bo-label">Optimization Mode</label>
      <div class="bo-btn-group bo-mode-buttons">
        <button id="bo_modeBtn1" class="bo-toggle-btn bo-mode-btn bo-active" data-mode="carry" onclick="boSetOptimizeMode(this.getAttribute('data-mode'))">Carry</button>
        <button id="bo_modeBtn2" class="bo-toggle-btn bo-mode-btn" data-mode="total" onclick="boSetOptimizeMode(this.getAttribute('data-mode'))">Total</button>
        <button id="bo_modeBtn3" class="bo-toggle-btn bo-mode-btn" data-mode="both" onclick="boSetOptimizeMode(this.getAttribute('data-mode'))">Carry+Total</button>
      </div>
    </div>
    <div class="bo-control-group">
      <div class="bo-input-row">
        <div class="bo-input-column">
          <label class="bo-label" for="bo_ballSpeed">Ball Speed (mph)</label>
          <input type="number" id="bo_ballSpeed" min="40" max="220" step="1" oninput="boOnBallSpeedManualInput()">
          <div class="bo-input-hint">Auto-calculated</div>
        </div>
        <div class="bo-input-column">
          <label class="bo-label" for="bo_smashFactor">Smash Factor</label>
          <input type="number" id="bo_smashFactor" min="1.0" max="1.53" step="0.01" oninput="boOnSmashFactorManualInput()">
          <div class="bo-input-hint">Auto-calculated</div>
        </div>
      </div>
    </div>
    <div class="bo-control-group">
      <div class="bo-slider-container">
        <div class="bo-slider-header">
          <div class="bo-slider-label">Club Speed</div>
          <div class="bo-current-value-display" id="bo_clubSpeedValue">100 mph</div>
        </div>
        <input type="range" id="bo_clubSpeed" min="60" max="140" step="1" value="100" oninput="boOnClubSpeedOrAttackAngleChange()">
        <div class="bo-value-display">
          <span id="bo_speedMinDisplay">60 mph</span>
          <span id="bo_speedMaxDisplay">140 mph</span>
        </div>
      </div>
    </div>
    <div class="bo-control-group">
      <div class="bo-slider-container">
        <div class="bo-slider-header">
          <div class="bo-slider-label">Attack Angle</div>
          <div class="bo-current-value-display" id="bo_attackAngleValue">0°</div>
        </div>
        <input type="range" id="bo_attackAngle" min="-10" max="10" step="0.5" value="0" oninput="boOnClubSpeedOrAttackAngleChange()">
        <div class="bo-value-display">
          <span>-10°</span>
          <span>+10°</span>
        </div>
      </div>
    </div>
  </div>
</div>
    </div>
  </div>
</div>

<!-- PROXIMITY CALCULATOR FULL SCREEN -->
<div id="learnProximityCalcPage" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#1e1e1e;overflow-y:auto;padding:50px 16px 30px;box-sizing:border-box;">
  <button class="back-btn-top" onclick="toggleLearnProximityCalc()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="width:100%;max-width:420px;margin:0 auto;">
    <div style="font-size:20px;font-weight:800;text-align:center;margin-bottom:4px;">Proximity Calculator</div>
    <p style="text-align:center;font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 18px;">How close do you need to hit it to gain strokes?</p>

    <!-- Inputs -->
    <div style="display:flex;flex-direction:column;gap:12px;">

      <!-- Handicap -->
      <div style="background:#282828;border-radius:12px;padding:14px 16px;text-align:center;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;font-weight:600;">HANDICAP</div>
        <div id="proxHcpBtns" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
          <button onclick="proxSetHcp('0')" class="prox-hcp-btn" data-hcp="0" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">0</button>
          <button onclick="proxSetHcp('5')" class="prox-hcp-btn" data-hcp="5" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">5</button>
          <button onclick="proxSetHcp('10')" class="prox-hcp-btn" data-hcp="10" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#2d7abc;color:#fff;">10</button>
          <button onclick="proxSetHcp('15')" class="prox-hcp-btn" data-hcp="15" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">15</button>
          <button onclick="proxSetHcp('20')" class="prox-hcp-btn" data-hcp="20" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">20</button>
          <button onclick="proxSetHcp('25')" class="prox-hcp-btn" data-hcp="25" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">25</button>
          <button onclick="proxSetHcp('30')" class="prox-hcp-btn" data-hcp="30" style="flex:1;min-width:40px;padding:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">30</button>
        </div>
      </div>

      <!-- Lie -->
      <div style="background:#282828;border-radius:12px;padding:14px 16px;text-align:center;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;font-weight:600;">LIE</div>
        <div id="proxLieBtns" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
          <button onclick="proxSetLie('TEE')" class="prox-lie-btn" data-lie="TEE" style="flex:1;min-width:65px;padding:8px 0;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">Tee</button>
          <button onclick="proxSetLie('FAIRWAY')" class="prox-lie-btn" data-lie="FAIRWAY" style="flex:1;min-width:65px;padding:8px 0;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#2d7abc;color:#fff;">Fairway</button>
          <button onclick="proxSetLie('ROUGH')" class="prox-lie-btn" data-lie="ROUGH" style="flex:1;min-width:65px;padding:8px 0;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">Rough</button>
          <button onclick="proxSetLie('SAND')" class="prox-lie-btn" data-lie="SAND" style="flex:1;min-width:65px;padding:8px 0;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">Sand</button>
          <button onclick="proxSetLie('RECOVERY')" class="prox-lie-btn" data-lie="RECOVERY" style="flex:1;min-width:65px;padding:8px 0;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#333;color:rgba(255,255,255,0.5);">Recovery</button>
        </div>
      </div>

      <!-- Yardage -->
      <div style="background:#282828;border-radius:12px;padding:14px 16px;text-align:center;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;font-weight:600;">YARDAGE TO PIN</div>
        <input type="number" id="proxYardage" placeholder="150" min="10" max="600" value="50" inputmode="numeric" pattern="[0-9]*" oninput="proxCalc()" style="width:100%;padding:10px 14px;border:2px solid #3d3d3d;border-radius:10px;background:#1e1e1e;color:#fff;font-size:18px;font-weight:700;text-align:center;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.select();this.style.borderColor='#2d7abc'" onblur="this.style.borderColor='#606060'">
      </div>
    </div>

    <!-- Results - always visible, 3 in a row -->
    <div style="margin-top:16px;display:flex;gap:8px;">
      <!-- Lose 0.25 -->
      <div style="flex:1 1 0;min-width:0;background:#282828;border-radius:12px;padding:18px 6px;text-align:center;overflow:hidden;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:8px;">LOSE 0.25</div>
        <div id="proxLoseHalfFt" style="font-size:32px;font-weight:800;color:#ffffff;line-height:1.1;white-space:nowrap;">—</div>
        <div style="font-size:11px;margin-top:6px;">&nbsp;</div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:4px;">STROKES GAINED</div>
          <div style="font-size:28px;font-weight:800;color:#d4706e;line-height:1.1;white-space:nowrap;">-0.25</div>
        </div>
      </div>

      <!-- Avg Proximity (center, tappable) -->
      <div style="flex:1 1 0;min-width:0;background:#282828;border-radius:12px;padding:18px 6px;text-align:center;overflow:hidden;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:8px;">AVG PROXIMITY</div>
        <div id="proxFtDisplay" onclick="proxEditFt()" style="font-size:32px;font-weight:800;color:#ffffff;line-height:1.1;cursor:pointer;white-space:nowrap;">—</div>
        <div id="proxFtInputWrap" style="display:none;justify-content:center;">
          <input type="number" id="proxFtInput" min="0" max="500" step="0.5" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" style="width:100%;padding:8px;border:2px solid #2d7abc;border-radius:10px;background:#1e1e1e;color:#fff;font-size:28px;font-weight:800;text-align:center;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.select()" onblur="proxConfirmFt()" onkeydown="if(event.key==='Enter'){this.blur();}">
        </div>
        <div id="proxFtHint" style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px;">Enter yardage above</div>
        <div id="proxSGResultWrap" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:4px;">STROKES GAINED</div>
          <div id="proxSGValue" style="font-size:28px;font-weight:800;line-height:1.1;white-space:nowrap;"></div>
        </div>
      </div>

      <!-- Gain 0.25 -->
      <div style="flex:1 1 0;min-width:0;background:#282828;border-radius:12px;padding:18px 6px;text-align:center;overflow:hidden;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:8px;">GAIN 0.25</div>
        <div id="proxGainHalfFt" style="font-size:32px;font-weight:800;color:#ffffff;line-height:1.1;white-space:nowrap;">—</div>
        <div style="font-size:11px;margin-top:6px;">&nbsp;</div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:4px;">STROKES GAINED</div>
          <div style="font-size:28px;font-weight:800;color:#00b87a;line-height:1.1;white-space:nowrap;">+0.25</div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- DISTANCE GUIDE STYLES -->

<!-- DISTANCE GUIDE FULL SCREEN -->
<div id="distanceGuidePage" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#1e1e1e;overflow-y:auto;padding:50px 16px 30px;box-sizing:border-box;">
  <button class="back-btn-top" onclick="toggleDistanceGuide()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="width:100%;max-width:420px;margin:0 auto;">
    <div style="font-size:20px;font-weight:800;text-align:center;margin-bottom:4px;">How Far Should I Hit It?</div>
    <p style="text-align:center;font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 14px;">Average distances by tour, handicap, or club speed</p>

    <!-- Mode Tabs -->
    <div class="tabs many" style="display:flex;margin-bottom:16px;">
      <button id="dgTab_pga" class="dg-tab dg-tab-active" onclick="dgSetTab('pga')">PGA Tour</button>
      <button id="dgTab_lpga" class="dg-tab" onclick="dgSetTab('lpga')">LPGA</button>
      <button id="dgTab_handicap" class="dg-tab" onclick="dgSetTab('handicap')">Handicap</button>
      <button id="dgTab_speed" class="dg-tab" onclick="dgSetTab('speed')">Speed</button>
      <button id="dgTab_profile" class="dg-tab" onclick="dgSetTab('profile')">Age</button>
    </div>

    <!-- PGA Tour Content -->
    <div id="dgContent_pga">
      <div id="dgPgaTable"></div>
    </div>

    <!-- LPGA Content -->
    <div id="dgContent_lpga" style="display:none;">
      <div id="dgLpgaTable"></div>
    </div>

    <!-- Handicap Content -->
    <div id="dgContent_handicap" style="display:none;">
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;color:#ffffff;display:block;margin-bottom:6px;">Select Handicap</label>
        <select id="dgHandicapSelect" onchange="dgRenderHandicap()" style="width:100%;padding:10px;border:2px solid #333;border-radius:10px;font-size:16px;background:#282828;color:#fff;font-family:inherit;">
          <option value="scratch">Scratch (0)</option>
          <option value="5">5 Handicap</option>
          <option value="10" selected>10 Handicap</option>
          <option value="15">15 Handicap</option>
          <option value="20">20 Handicap</option>
          <option value="25">25 Handicap</option>
          <option value="30">30 Handicap</option>
        </select>
      </div>
      <div id="dgHandicapTable"></div>
    </div>

    <!-- Driver Speed Content -->
    <div id="dgContent_speed" style="display:none;">
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;color:#ffffff;display:block;margin-bottom:6px;">Your Driver Club Speed (mph)</label>
        <input type="number" id="dgDriverSpeed" min="60" max="140" step="1" value="100" oninput="dgRenderSpeed()" style="width:100%;padding:10px;border:2px solid #333;border-radius:10px;font-size:16px;background:#282828;color:#fff;font-weight:600;font-family:inherit;box-sizing:border-box;">
      </div>
      <div id="dgSpeedTable"></div>
    </div>

    <!-- Age / Gender Content -->
    <div id="dgContent_profile" style="display:none;">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div style="flex:1;">
          <label style="font-size:13px;font-weight:600;color:#ffffff;display:block;margin-bottom:6px;">Age</label>
          <select id="dgProfileAge" onchange="dgRenderProfile()" style="width:100%;padding:10px;border:2px solid #333;border-radius:10px;font-size:16px;background:#282828;color:#fff;font-family:inherit;">
            <option value="20">20 - 29</option>
            <option value="30" selected>30 - 39</option>
            <option value="40">40 - 49</option>
            <option value="50">50 - 59</option>
            <option value="60">60 - 69</option>
            <option value="70">70+</option>
          </select>
        </div>
        <div style="flex:1;">
          <label style="font-size:13px;font-weight:600;color:#ffffff;display:block;margin-bottom:6px;">Gender</label>
          <select id="dgProfileGender" onchange="dgRenderProfile()" style="width:100%;padding:10px;border:2px solid #333;border-radius:10px;font-size:16px;background:#282828;color:#fff;font-family:inherit;">
            <option value="male" selected>Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>
      <div id="dgProfileTable"></div>
      <p style="text-align:center;font-size:10px;color:rgba(255,255,255,0.3);margin:12px 0 0;">Sources: Arccos (20M+ drives), deWiz Golf, Trackman</p>
    </div>

  </div>
</div>

<!-- PBV FULL SCREEN -->
<div id="learnPBVPage" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#1e1e1e;overflow:hidden;flex-direction:column;align-items:center;justify-content:center;">
  <button class="back-btn-top" onclick="toggleLearnPBV()" style="z-index:10001;"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div id="learnPBVContainer" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
    <div id="pbvWrap" style="position:relative;display:inline-block;line-height:0;overflow:hidden;border-radius:0;width:100%;">
      <div id="pbvOverlay" style="position:absolute;top:0;left:0;right:0;z-index:10;background:linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0) 100%);padding:50px 16px 20px;display:flex;flex-direction:column;gap:16px;pointer-events:none;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="color:#ffffff;font-size:1.15rem;font-weight:bold;letter-spacing:0.04em;text-shadow:0 1px 4px rgba(0,0,0,0.9);">Inches past hole:</span>
            <span id="pbvOvershootVal" style="color:#44b8f0;font-size:1.25rem;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);min-width:48px;text-align:left;">12"</span>
          </div>
          <input type="range" id="pbvOvershootIn" value="12" min="0" max="24" step="1" style="-webkit-appearance:none;appearance:none;width:85%;height:6px;background:rgba(255,255,255,0.3);border-radius:3px;outline:none;cursor:pointer;margin-top:12px;pointer-events:auto;">
        </div>
        <div style="display:flex;flex-direction:row;justify-content:space-around;width:90%;margin:0 auto;align-items:center;gap:6px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:45%;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="color:#ffffff;font-size:1.0rem;font-weight:bold;letter-spacing:0.04em;text-shadow:0 1px 4px rgba(0,0,0,0.9);">Stimp:</span>
              <span id="pbvStimpVal" style="color:#44b8f0;font-size:1.1rem;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);min-width:20px;text-align:left;">10</span>
            </div>
            <input type="range" id="pbvStimpIn" value="10" min="8" max="13" step="1" style="-webkit-appearance:none;appearance:none;width:100%;height:6px;background:rgba(255,255,255,0.3);border-radius:3px;outline:none;cursor:pointer;margin-top:12px;pointer-events:auto;">
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:45%;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="color:#ffffff;font-size:1.0rem;font-weight:bold;letter-spacing:0.04em;text-shadow:0 1px 4px rgba(0,0,0,0.9);">Slope:</span>
              <span id="pbvSlopeVal" style="color:#44b8f0;font-size:1.1rem;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);min-width:35px;text-align:left;">2.0%</span>
            </div>
            <input type="range" id="pbvSlopeIn" value="2.0" min="0.5" max="5.0" step="0.5" style="-webkit-appearance:none;appearance:none;width:100%;height:6px;background:rgba(255,255,255,0.3);border-radius:3px;outline:none;cursor:pointer;margin-top:12px;pointer-events:auto;">
          </div>
        </div>
        <div id="pbvRangeToggle" style="display:flex;gap:0;justify-content:center;width:90%;margin:0 auto;border-radius:8px;overflow:hidden;">
          <button class="pbv-range-btn pbv-range-active" data-range="short" style="flex:1;padding:12px 0;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:bold;background:rgba(68,136,255,0.5);color:#ffffff;letter-spacing:0.03em;pointer-events:auto;border-radius:8px 0 0 8px;">3' – 7'</button>
          <button class="pbv-range-btn" data-range="mid" style="flex:1;padding:12px 0;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:bold;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);letter-spacing:0.03em;pointer-events:auto;">7' – 11'</button>
          <button class="pbv-range-btn" data-range="long" style="flex:1;padding:12px 0;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:bold;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);letter-spacing:0.03em;pointer-events:auto;border-radius:0 8px 8px 0;">11' – 15'</button>
        </div>
        <div id="pbvAimReadout" style="text-align:center;color:#ffffff;font-size:1.5rem;font-weight:bold;margin-top:8px;text-shadow:0 1px 4px rgba(0,0,0,0.9);border-top:1px solid rgba(255,255,255,0.2);padding-top:16px;letter-spacing:0.02em;">Aim: Center</div>
      </div>
      <canvas id="pbvCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;touch-action:none;"></canvas>
      <div style="position:absolute;bottom:0;left:0;right:0;z-index:10;display:flex;gap:10px;color:rgba(255,255,255,0.75);font-size:0.65rem;letter-spacing:0.06em;flex-wrap:wrap;justify-content:center;padding:20px 8px 8px;background:linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%);">
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:22px;border-top:2px dashed white"></div><span>Aim Line</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:22px;height:2px;background:#f0c830"></div><span>Path</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:#000;border:1px solid #ffffff;"></div><span>Aim Point</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:22px;border-top:2px dashed rgba(255,255,255,0.45)"></div><span>Slope</span></div>
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:22px;border-top:2px dotted rgba(0,0,0,0.4)"></div><span>Grid</span></div>
      </div>
      <div id="pbvHint" style="position:absolute;bottom:26px;left:0;right:0;z-index:10;color:rgba(255,255,255,0.3);font-size:0.6rem;letter-spacing:0.08em;text-align:center;pointer-events:none;">Drag the white ball to set distance (3' to 7') and angle</div>
    </div>
  </div>
</div>

<!-- LEARNING LIBRARY PAGE -->
<div id="learningLibraryPage" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#1e1e1e;overflow-y:auto;padding:50px 16px 30px;box-sizing:border-box;">
  <button class="back-btn-top" onclick="closeLearningLibrary()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="width:100%;max-width:420px;margin:0 auto;">
    <div style="font-size:20px;font-weight:800;text-align:center;margin-bottom:4px;">Learning Library</div>
    <p style="text-align:center;font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 16px;">Articles, tips &amp; guides to improve your game</p>
    <input type="text" id="learningLibrarySearch" placeholder="Search by tag (e.g. putting, mental game, wedges...)" oninput="filterLearningLibrary()" style="width:100%;max-width:100%;height:44px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:10px;padding:0 14px;font-size:14px;box-sizing:border-box;margin-bottom:16px;text-align:center;display:block;">
    <div id="learningLibraryContent" style="text-align:center;color:#606060;font-size:15px;background:#222222;border-radius:12px;padding:30px 20px;">
      Coming soon
    </div>
  </div>
</div>`;

export const PERFORMANCE_PAGE = `<div id="performanceAnalysisPage" class="page" style="justify-content:flex-start;padding-top:30px;overflow-y:auto;scrollbar-gutter:stable;padding-bottom:80px;align-items:center;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>

  <div style="width:100%;max-width:420px;padding:0 14px;box-sizing:border-box;">
    <div style="font-size:22px;font-weight:800;margin-bottom:2px;text-align:center;">${ic('perf', 'tint-blue')} Performance Analysis</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <div id="perfAnalysisSubtitle" style="font-size:12px;color:#9a9a9a;">Loading...</div>
      <div id="perfHcpBadge" style="display:none;background:#1a2533;border:1px solid #2d7abc;border-radius:20px;padding:4px 10px;align-items:center;gap:5px;">
        <span style="font-size:10px;color:#606060;">vs</span>
        <span id="perfHcpLabel" style="font-size:11px;font-weight:700;color:#7a9ab5;">—</span>
      </div>
    </div>

    <!-- Page toggle tabs -->
    <div class="tabs" style="display:flex;margin-bottom:16px;">
      <button id="perfTabBtnRounds"   onclick="setPerfPage('rounds')"   style="flex:1;height:38px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:#2d7abc;color:#ffffff;">Past Rounds</button>
      <button id="perfTabBtnCombines" onclick="setPerfPage('combines')" style="flex:1;height:38px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:#9a9a9a;">Combines</button>
    </div>

    <!-- ── PAST ROUNDS PAGE ── -->
    <div id="perfPageRounds">
      <!-- No rounds state -->
      <div id="perfNoRounds" style="display:none;background:#1e1e1e;border-radius:12px;padding:24px;text-align:center;color:#9a9a9a;font-size:14px;line-height:1.6;margin-bottom:16px;">
        Play and save at least 1 round to see your performance analysis.
      </div>

      <!-- Main content (hidden until loaded) -->
      <div id="perfContent" style="display:none;">

        <!-- PRIORITY CARD -->
        <div id="perfPriorityCard" style="border-radius:14px;padding:16px;margin-bottom:14px;"></div>

        <!-- SG OVERVIEW -->
        <div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#606060;margin-bottom:8px;">Strokes Gained Overview</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div id="perfCardOtt"  onclick="togglePerfTab('ott', this)"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
          <div id="perfCardApp"  onclick="togglePerfTab('app', this)"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
          <div id="perfCardArg"  onclick="togglePerfTab('arg', this)"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
          <div id="perfCardPutt" onclick="togglePerfTab('putt', this)" style="border-radius:11px;padding:12px;cursor:pointer;"></div>
        </div>

        <!-- DETAIL PANELS -->
        <div id="perfTab-ott"  style="display:none;"></div>
        <div id="perfTab-app"  style="display:none;"></div>
        <div id="perfTab-arg"  style="display:none;"></div>
        <div id="perfTab-putt" style="display:none;"></div>

      </div>
    </div>

    <!-- ── COMBINES PAGE ── -->
    <div id="perfPageCombines" style="display:none;">
      <div id="perfCombineLoading" style="background:#1e1e1e;border-radius:12px;padding:18px;text-align:center;color:#9a9a9a;font-size:13px;margin-bottom:10px;">Loading combine data…</div>
      <div id="perfCombineGrid" style="display:none;grid-template-columns:1fr 1fr;gap:8px;align-items:start;width:100%;">
        <div>
          <div style="font-size:15px;font-weight:800;color:#ffffff;margin-bottom:8px;text-align:center;">Putting</div>
          <div id="perfCombinePuttFocus"></div>
          <div id="perfCombinePuttOverview"></div>
        </div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#ffffff;margin-bottom:8px;text-align:center;">Wedge</div>
          <div id="perfCombineWedgeFocus"></div>
          <div id="perfCombineWedgeOverview"></div>
        </div>
      </div>
      <!-- A tile's detail opens here, below the tiles (as Past Rounds' does) -->
      <div id="perfCombinePuttDetail" style="display:none;margin-top:14px;"></div>
      <div id="perfCombineWedgeDetail" style="display:none;margin-top:14px;"></div>
      <div id="perfCombineFooter" style="display:none;text-align:center;font-size:10px;color:#9a9a9a;margin-top:14px;">All stats vs scratch · combines only</div>
    </div>

  </div>
</div>`;

export const DRILLS_PAGES = `<div id="drillsPage" class="page" style="justify-content:flex-start;padding-top:30px;overflow-y:auto;padding-bottom:80px;align-items:center;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>

  <!-- Single stable-width container so toggling tabs never shifts layout -->
  <div style="width:320px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;align-items:stretch;gap:0;">

    <div style="font-size:22px;font-weight:800;margin-bottom:12px;text-align:center;">Drills Library</div>

    <!-- Category button tabs -->
    <div class="tabs" style="display:flex;margin-bottom:10px;">
      <button id="drillTabPutting"   onclick="setDrillCategory('putting')"   style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#2d7abc;color:#ffffff;min-width:0;max-width:none;width:auto;">Putting</button>
      <button id="drillTabShortgame" onclick="setDrillCategory('shortgame')" style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#282828;color:#606060;min-width:0;max-width:none;width:auto;">Short Game</button>
      <button id="drillTabFullswing" onclick="setDrillCategory('fullswing')" style="flex:1;height:44px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#282828;color:#606060;min-width:0;max-width:none;width:auto;">Full Swing</button>
    </div>

    <!-- Subcategory filter -->
    <div class="fhead end" style="margin-bottom:10px;"><div class="fmenu"><button type="button" class="fbtn">&#9776; <span>Filter</span></button><div class="fpanel" hidden><label class="frow"><span>Type</span><select id="drillSubcategory" onchange="filterDrillsBySubcategory(this.value)"></select></label><div class="factions"><button type="button" class="fclear">Clear</button><button type="button" class="fdone">Done</button></div></div></div></div>

    <!-- Drill cards: 2-column grid -->
    <div id="drillContent" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>

  </div>
</div>

<!-- DRILL DETAIL PAGE -->
<div id="drillDetailPage" class="page" style="justify-content:flex-start;padding-top:20px;overflow-y:auto;padding-bottom:80px;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div id="drillDetailContent" style="width:320px;max-width:100%;"></div>
</div>`;

export const BAG_PAGES = `<div id="myBagPage" class="page" style="justify-content:flex-start;padding-top:15px;overflow-y:auto;padding-bottom:80px;align-items:center;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:800;">${ic('bag', 'tint-blue')} My Bag</div>
  </div>

  <!-- Coach Student Selector -->
  <div id="bagCoachStudentBar" style="display:none;width:100%;max-width:360px;margin:0 auto 10px;">
    <select id="bagStudentSelect" onchange="onBagStudentChange(this.value)" style="width:100%;height:38px;font-size:13px;font-weight:600;text-align:center;background:#222222;color:#ffffff;border:1px solid #007a52;border-radius:10px;-webkit-appearance:none;appearance:none;padding:0 10px;box-sizing:border-box;">
      <option value="">My Bag</option>
    </select>
  </div>

  <!-- Tabs -->
  <div style="position:sticky;top:0;z-index:10;width:100%;display:flex;justify-content:center;background:#1e1e1e;padding:0 0 16px;">
    <div class="tabs" style="display:flex;width:100%;max-width:360px;">
      <button id="bagTabMyBag" onclick="setBagTab('myBag')" style="height:40px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#2d7abc;color:#ffffff;padding:0 2px;">Bag</button>
      <button id="bagTabFindYardages" onclick="setBagTab('findYardages')" style="height:40px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:transparent;color:#606060;padding:0 2px;">Yardages</button>
      <button id="bagTabWedgeGap" onclick="setBagTab('wedgeGap')" style="height:40px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:transparent;color:#606060;padding:0 2px;">Wedges</button>
      <button id="bagTabSpeed" onclick="setBagTab('speed')" style="height:40px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:transparent;color:#606060;padding:0 2px;">Speed</button>
    </div>
  </div>

  <!-- TAB 1: MY BAG -->
  <div id="bagTabContentMyBag" style="width:100%;display:flex;flex-direction:column;align-items:center;">
    <!-- Add Club Toggle -->
    <div style="width:100%;max-width:360px;margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="toggleBagAddClub()" style="flex:1;height:40px;background:#222222;border:1px solid #333333;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:600;cursor:pointer;">+ Add a Club</button>
      <button onclick="openGapVisualizer()" style="flex:1;height:40px;background:#222222;border:1px solid #2d7abc;border-radius:10px;color:#44b8f0;font-size:13px;font-weight:700;cursor:pointer;">${ic('bars')} Gap Visualizer</button>
    </div>
    <!-- Add Club Expandable Section -->
    <div id="bagAddClubSection" style="display:none;width:100%;max-width:360px;background:#222222;border-radius:14px;padding:16px;margin-bottom:16px;">
      <select id="bagClubName" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:10px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;-webkit-appearance:none;appearance:none;">
        <option value="" disabled selected>Select a club...</option>
      </select>
      <input id="bagClubLabel" type="text" placeholder="Custom label (e.g. 48°, Titleist)" maxlength="20" style="width:100%;height:36px;font-size:13px;text-align:center;box-sizing:border-box;margin-bottom:10px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;">
      <button onclick="addBagClub()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">+ Add to Bag</button>
      <div id="bagAddMsg" style="font-size:12px;min-height:16px;text-align:center;margin-top:6px;color:#00b87a;"></div>
      <div style="text-align:center;margin-top:8px;">
        <button onclick="document.getElementById('bagImportCSV').click()" style="background:none;border:none;color:#9a9a9a;font-size:11px;font-weight:600;cursor:pointer;text-decoration:underline;">Import from .csv / .xlsx</button>
        <input type="file" id="bagImportCSV" accept=".csv,.xlsx,.xls" style="display:none;" onchange="importBagFile(this)">
      </div>
    </div>

    <!-- Club Tile Grid -->
    <div style="width:100%;max-width:360px;">
      <div id="bagEmptyMsg" style="background:#222222;border-radius:12px;padding:24px;text-align:center;color:#9a9a9a;font-size:13px;line-height:1.7;">
        No clubs in your bag yet.<br>Add clubs above to track your distances.
      </div>
      <div id="bagClubHeaders" style="display:none;"></div>
      <div id="bagClubList" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>
    </div>
  </div>

  <!-- Club Detail Modal -->
  <div id="clubDetailModal" onclick="if(event.target===this)closeClubDetail()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;justify-content:center;align-items:center;">
    <div id="clubDetailContent" style="background:#222222;border-radius:16px;padding:20px;width:90%;max-width:340px;max-height:80vh;overflow-y:auto;position:relative;border:1px solid #333333;"></div>
  </div>

  <!-- TAB 2: FIND YARDAGES -->
  <div id="bagTabContentFindYardages" style="width:100%;display:none;flex-direction:column;align-items:center;">
    <!-- Step 1: Select Club -->
    <div id="fyStep1" style="width:100%;max-width:360px;">
      <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Select a Club</div>
        <div id="fyClubGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;"></div>
        <div style="font-size:11px;color:#9a9a9a;margin-bottom:8px;text-align:center;">— or add a new club —</div>
        <select id="fyNewClubSelect" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;-webkit-appearance:none;appearance:none;">
          <option value="" disabled selected>Select a club...</option>
        </select>
        <button onclick="fyPickNewClub()" style="width:100%;height:38px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;">+ Add & Select</button>
      </div>
    </div>

    <!-- Step 2: Choose # of shots -->
    <div id="fyStep2" style="width:100%;max-width:360px;display:none;">
      <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <button class="stepback" onclick="fyBackToStep1()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
          <div style="font-size:16px;font-weight:800;color:#9a9a9a;" id="fySelectedClubName"></div>
          <div style="width:32px;"></div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">How many shots?</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;" id="fyShotCountBtns"></div>
      </div>
    </div>

    <!-- Step 3: Enter shots -->
    <div id="fyStep3" style="width:100%;max-width:360px;display:none;">
      <div style="background:#222222;border-radius:14px;padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <button class="stepback" onclick="fyBackToStep2()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
          <div style="font-size:16px;font-weight:800;color:#9a9a9a;" id="fyStep3ClubName"></div>
          <div style="width:32px;"></div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Enter Carry & Total for each shot</div>
        <div style="display:grid;grid-template-columns:22px 1fr 1fr 70px;gap:4px;align-items:center;margin-bottom:4px;">
          <div></div>
          <div style="font-size:10px;color:#9a9a9a;font-weight:600;text-align:center;">CARRY</div>
          <div style="font-size:10px;color:#9a9a9a;font-weight:600;text-align:center;">TOTAL</div>
          <div style="font-size:10px;color:#00b87a;font-weight:600;text-align:center;">OFFLINE</div>
        </div>
        <div id="fyShotInputs" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;margin-bottom:12px;"></div>
        <button onclick="fySaveShots()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#00b87a;font-size:14px;font-weight:700;cursor:pointer;">Save Yardages</button>
        <div id="fyMsg" style="font-size:12px;min-height:16px;text-align:center;margin-top:6px;color:#00b87a;"></div>
      </div>
    </div>
  </div>

  <!-- TAB 3: WEDGE GAPPING -->
  <div id="bagTabContentWedgeGap" style="width:100%;display:none;flex-direction:column;align-items:center;">

    <!-- History View -->
    <div id="wgHistoryView" style="width:100%;max-width:400px;padding:0 10px 80px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 10px;">
        <div style="font-size:16px;font-weight:800;color:#9a9a9a;">Wedge Gapping</div>
        <button onclick="wgStartNew()" id="wgNewBtn" style="background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;padding:8px 14px;">+ New Session</button>
      </div>
      <div id="wgSessionList"></div>
    </div>

    <!-- Entry View -->
    <div id="wgEntryView" style="display:none;width:100%;max-width:400px;padding:0 10px 80px;">

      <!-- Step 1: Club Selection -->
      <div id="wgStep1">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 0 10px;">
          <button class="stepback" onclick="wgCancelEntry()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
          <div style="font-size:15px;font-weight:800;color:#9a9a9a;">Select Wedges</div>
        </div>
        <div style="font-size:11px;color:#9a9a9a;margin-bottom:12px;">Pick 1–4 wedges. Brighter = in your bag.</div>
        <div id="wgClubGrid" style="width:100%;margin-bottom:14px;"></div>
        <div id="wgStep1Msg" style="font-size:12px;color:#d4706e;min-height:16px;margin-bottom:8px;"></div>
        <button onclick="wgNextStep1()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">Next →</button>
      </div>

      <!-- Step 2: Setup -->
      <div id="wgStep2" style="display:none;">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 0 10px;">
          <button class="stepback" onclick="wgBackToStep1()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
          <div style="font-size:15px;font-weight:800;color:#9a9a9a;">Session Setup</div>
        </div>
        <div style="background:#222222;border-radius:12px;padding:14px;margin-bottom:10px;">
          <div style="font-size:11px;color:#606060;margin-bottom:8px;">Shots per swing type</div>
          <select id="wgShotCount" style="width:100%;height:38px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;font-weight:700;padding:0 10px;">
            <option value="1">1 shot</option>
            <option value="2">2 shots</option>
            <option value="3" selected>3 shots</option>
            <option value="4">4 shots</option>
            <option value="5">5 shots</option>
          </select>
        </div>
        <div style="background:#222222;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:11px;color:#606060;margin-bottom:10px;">Swing type</div>
          <div style="display:flex;gap:8px;">
            <button id="wgTypeBtnPercent"  onclick="wgSelectType('percent')"  style="flex:1;height:40px;background:#282828;border:1px solid #3d3d3d;border-radius:10px;color:#606060;font-size:13px;font-weight:700;cursor:pointer;">Percent</button>
            <button id="wgTypeBtnFraction" onclick="wgSelectType('fraction')" style="flex:1;height:40px;background:#282828;border:1px solid #3d3d3d;border-radius:10px;color:#606060;font-size:13px;font-weight:700;cursor:pointer;">Fraction</button>
            <button id="wgTypeBtnBody"     onclick="wgSelectType('body')"     style="flex:1;height:40px;background:#282828;border:1px solid #3d3d3d;border-radius:10px;color:#606060;font-size:13px;font-weight:700;cursor:pointer;">Body</button>
          </div>
          <div id="wgSwingPreview" style="font-size:11px;color:#9a9a9a;margin-top:8px;text-align:center;min-height:14px;"></div>
        </div>
        <div id="wgStep2Msg" style="font-size:12px;color:#d4706e;min-height:16px;margin-bottom:8px;"></div>
        <button onclick="wgNextStep2()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">Next →</button>
      </div>

      <!-- Step 3: Data Entry -->
      <div id="wgStep3" style="display:none;">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 0 10px;">
          <button class="stepback" onclick="wgBackToStep2()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
          <div style="font-size:15px;font-weight:800;color:#9a9a9a;">Enter Carry (yds)</div>
        </div>
        <div id="wgInputArea" style="display:flex;flex-direction:column;gap:12px;margin-bottom:14px;"></div>
        <div id="wgStep3Msg" style="font-size:12px;min-height:16px;margin-bottom:8px;color:#d4706e;"></div>
        <button onclick="wgSaveSession()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#00b87a;font-size:14px;font-weight:700;cursor:pointer;">Save Session</button>
      </div>

    </div>
  </div>

  <!-- TAB 4: SPEED -->
  <div id="bagTabContentSpeed" style="width:100%;display:none;flex-direction:column;align-items:center;">

    <!-- History view (default) -->
    <div id="spHistoryView" style="width:100%;max-width:360px;">
      <button onclick="spStartNewSession()" style="width:100%;height:44px;background:#007a52;border:none;border-radius:12px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:14px;">+ New Speed Session</button>

      <!-- Filters -->
      <div class="fhead end" style="margin-bottom:12px;"><div class="fmenu"><button type="button" class="fbtn">&#9776; <span>Filter</span></button><div class="fpanel" hidden><label class="frow"><span>Clubs</span><select id="spClubFilterSel" onchange="spSetClubFilter(this.value)" class="glassselect">
          <option value="all">All Clubs</option>
          <option value="driver">Driver</option>
          <option value="woods">Woods</option>
          <option value="hybrids">Hybrids</option>
          <option value="irons">Irons</option>
          <option value="wedges">Wedges</option>
        </select></label><label class="frow"><span>Time</span><select id="spDateFilterSel" onchange="spSetDateFilter(this.value)" class="glassselect">
          <option value="all">All Time</option>
          <option value="1mo">Last Month</option>
          <option value="3mo">Last 3 Months</option>
          <option value="6mo">Last 6 Months</option>
          <option value="1yr">Last 12 Months</option>
        </select></label><div class="factions"><button type="button" class="fclear">Clear</button><button type="button" class="fdone">Done</button></div></div></div></div>

      <!-- Summary averages -->
      <div id="spSummaryCard" class="glasstile" style="padding:14px;margin-bottom:12px;display:none;">
        <div style="font-size:11px;color:#44b8f0;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Filtered Averages</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;" id="spSummaryGrid"></div>
      </div>

      <!-- Session list -->
      <div id="spSessionList" style="display:flex;flex-direction:column;gap:8px;"></div>
    </div>

    <!-- Entry flow -->
    <div id="spEntryView" style="width:100%;max-width:360px;display:none;">
      <!-- Step 1: Select club -->
      <div id="spStep1">
        <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <button class="stepback" onclick="spCancelEntry()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;flex-shrink:0;">←</button>
            <div style="font-size:15px;font-weight:800;color:#9a9a9a;">Select a Club</div>
          </div>
          <div id="spClubGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"></div>
          <div style="font-size:11px;color:#9a9a9a;margin-bottom:8px;text-align:center;">— or add a new club —</div>
          <select id="spNewClubSelect" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;-webkit-appearance:none;appearance:none;">
            <option value="" disabled selected>Select a club...</option>
          </select>
          <button onclick="spPickNewClub()" style="width:100%;height:38px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;">+ Add & Select</button>
        </div>
      </div>

      <!-- Step 2: Shot count -->
      <div id="spStep2" style="display:none;">
        <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <button class="stepback" onclick="spBackToStep1()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
            <div style="font-size:16px;font-weight:800;color:#9a9a9a;" id="spSelectedClubLabel"></div>
            <div style="width:32px;"></div>
          </div>
          <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">How many swings?</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;" id="spShotCountBtns"></div>
        </div>
      </div>

      <!-- Step 3: Enter shots -->
      <div id="spStep3" style="display:none;">
        <div style="background:#222222;border-radius:14px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <button class="stepback" onclick="spBackToStep2()" style="background:#333333;border:none;color:#ffffff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">←</button>
            <div style="font-size:15px;font-weight:800;color:#9a9a9a;" id="spStep3ClubLabel"></div>
            <div style="width:32px;"></div>
          </div>
          <div style="display:grid;grid-template-columns:20px 1fr 1fr 1fr 1fr;gap:4px;align-items:center;margin-bottom:6px;">
            <div></div>
            <div style="font-size:9px;color:#f0c830;font-weight:700;text-align:center;">CLB SPD</div>
            <div style="font-size:9px;color:#44b8f0;font-weight:700;text-align:center;">BALL SPD</div>
            <div style="font-size:9px;color:#9a9a9a;font-weight:700;text-align:center;">CARRY</div>
            <div style="font-size:9px;color:#9a9a9a;font-weight:700;text-align:center;">TOTAL</div>
          </div>
          <div id="spShotInputs" style="display:flex;flex-direction:column;gap:5px;max-height:320px;overflow-y:auto;margin-bottom:12px;"></div>
          <textarea id="spSessionNote" placeholder="Notes (e.g. max effort, course swings, wind...)" style="width:100%;box-sizing:border-box;background:#222222;border:1px solid #333333;border-radius:10px;color:#9a9a9a;font-size:12px;padding:8px 10px;resize:none;height:56px;margin-bottom:8px;font-family:inherit;"></textarea>
          <button onclick="spSaveSession()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#00b87a;font-size:14px;font-weight:700;cursor:pointer;">Save Session</button>
          <div id="spMsg" style="font-size:12px;min-height:16px;text-align:center;margin-top:6px;color:#00b87a;"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Existing data conflict modal -->
  <div id="fyConflictModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:200;align-items:center;justify-content:center;">
    <div style="background:#222222;border-radius:16px;padding:20px;width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Existing Shot Data</div>
      <div id="fyConflictMsg" style="font-size:13px;color:#9a9a9a;margin-bottom:16px;line-height:1.5;"></div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="fyResolveConflict('add')" style="width:100%;height:42px;background:#2d7abc;border:none;border-radius:10px;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;">Add to Existing Shots</button>
        <button onclick="fyResolveConflict('replace')" style="width:100%;height:42px;background:#2a1a1a;border:none;border-radius:10px;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;">Replace with New Data Only</button>
        <button onclick="fyResolveConflict('cancel')" style="width:100%;height:42px;background:#333333;border:none;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>
      </div>
    </div>
  </div>
</div>

<!-- GAP VISUALIZER PAGE -->
<div id="gapVisualizerPage" class="page" style="justify-content:flex-start;padding-top:15px;overflow-y:auto;padding-bottom:80px;align-items:center;">
  <button class="back-btn-top" aria-label="Back" onclick="appBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:800;">${ic('bars')} Gap Visualizer</div>
    <div style="font-size:12px;color:#606060;margin-top:4px;">Full swing distances &amp; ¾ swing gaps</div>
  </div>
  <div style="width:100%;max-width:400px;padding:0 16px;box-sizing:border-box;">
    <!-- Club groups -->
    <div class="tabs many" style="display:flex;margin-bottom:14px;">
      <button id="gvFilterAll" onclick="setGapVizFilter('all')" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #2d7abc;background:#2d7abc;color:#ffffff;">All</button>
      <button id="gvFilterWoods" onclick="setGapVizFilter('woods')" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #3d3d3d;background:transparent;color:#9a9a9a;">Woods</button>
      <button id="gvFilterIrons" onclick="setGapVizFilter('irons')" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #3d3d3d;background:transparent;color:#9a9a9a;">Irons</button>
      <button id="gvFilterWedges" onclick="setGapVizFilter('wedges')" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #3d3d3d;background:transparent;color:#9a9a9a;">Wedges</button>
      <button id="gvFilterCustom" onclick="setGapVizFilter('custom')" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #3d3d3d;background:transparent;color:#9a9a9a;">Custom</button>
    </div>
    <!-- Custom club picker (hidden by default) -->
    <div id="gvCustomPicker" style="display:none;background:#222222;border-radius:12px;padding:12px;margin-bottom:14px;">
      <div style="font-size:11px;color:#44b8f0;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Select Clubs</div>
      <div id="gvCustomClubGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
    </div>
    <div id="gapVizEmpty" style="display:none;background:#222222;border-radius:12px;padding:24px;text-align:center;color:#9a9a9a;font-size:13px;line-height:1.7;">
      No club data to visualize.<br>Add clubs and distances in My Bag first.
    </div>
    <div id="gapVizChartWrap" style="position:relative;width:100%;">
      <canvas id="gapVizChart"></canvas>
    </div>
    <div id="gapVizLegend" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px;"></div>
  </div>
</div>`;

export const COMBINES_PAGES = `<div id="lineDrillPage" class="page" style="justify-content:flex-start;padding:0;overflow:hidden;">
  <!-- Header -->
  <div class="fixedhead" style="background:#1e1e1e;border-bottom:2px solid #00b87a;width:100%;text-align:center;padding:11px 0;position:relative;flex-shrink:0;">
    <button class="back-btn-top" aria-label="Back" onclick="lineDrillBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div style="font-size:1.2rem;font-weight:800;color:#ffffff;">Line Drill</div>
  </div>

  <!-- Scrollable body -->
  <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;width:100%;">
    <div style="max-width:520px;margin:0 auto;padding:14px 14px 100px;">

      <!-- SETUP VIEW -->
      <div id="ld-setup-view">
        <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="font-size:13px;color:#ffffff;line-height:1.5;">
            <strong style="color:#00b87a;">Line Drill</strong> tests approach accuracy. We give you a random yardage; you hit your club for that distance. Enter how many yards offline the shot finished — that's your score for the shot. Lower is better.
          </div>
          <div style="font-size:11px;color:#d49a10;margin-top:8px;font-weight:700;">${ic('warn')} Requires a launch monitor for offline measurement.</div>
          <div style="font-size:11px;color:#9a9a9a;margin-top:8px;line-height:1.5;">
            <strong style="color:#ffffff;">Benchmarks (total offline):</strong><br>
            • Best Pro: ~40<br>
            • Tour Pro avg: ~95<br>
            • All-American Junior: ~115
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Version</div>
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <button id="ld-version-std" onclick="lineDrillSetVersion('standard')" style="flex:1;height:46px;background:#00b87a;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Standard (20)</button>
          <button id="ld-version-short" onclick="lineDrillSetVersion('short')" style="flex:1;height:46px;background:#282828;color:#606060;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Short (10)</button>
        </div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Your Carry Distances</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <div style="flex:1;font-size:14px;font-weight:700;color:#ffffff;">Pitching Wedge</div>
          <input type="number" id="ld-pw-carry" value="130" min="30" max="200" inputmode="numeric" style="width:88px;height:46px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:15px;">
          <span style="color:#606060;font-size:13px;">yds</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <select id="ld-wood-club" style="flex:1;height:46px;text-align:center;text-align-last:center;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;font-size:14px;font-weight:700;padding:0 8px;box-sizing:border-box;">
            <option value="3w">3 Wood</option>
            <option value="4w">4 Wood</option>
            <option value="5w">5 Wood</option>
            <option value="7w">7 Wood</option>
          </select>
          <input type="number" id="ld-wood-carry" value="240" min="120" max="400" inputmode="numeric" style="width:88px;height:46px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:15px;">
          <span style="color:#606060;font-size:13px;">yds</span>
        </div>
        <div style="font-size:11px;color:#606060;margin-bottom:14px;">Enter your PW carry and your highest wood (excluding driver). Targets are generated across that range, rounded to the nearest 5.</div>

        <button onclick="lineDrillStart()" style="width:100%;height:50px;background:#007a52;color:#ffffff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;max-width:none;">Start Drill →</button>
        <div id="ld-setup-msg" style="font-size:12px;color:#d4706e;text-align:center;margin-top:8px;min-height:16px;"></div>
      </div>

      <!-- TRACKER VIEW -->
      <div id="ld-tracker-view" style="display:none;">
        <!-- Progress -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:12px;color:#606060;">Shot <span id="ld-shot-num" style="color:#ffffff;font-weight:700;">1</span> of <span id="ld-shot-total" style="color:#ffffff;font-weight:700;">20</span></div>
          <div style="font-size:12px;color:#606060;">Total: <span id="ld-running-total" style="color:#00b87a;font-weight:700;">0</span> yds</div>
        </div>
        <div style="background:#282828;height:6px;border-radius:3px;overflow:hidden;margin-bottom:14px;">
          <div id="ld-progress-bar" style="background:#00b87a;height:100%;width:0%;transition:width 0.2s;"></div>
        </div>

        <!-- Target yardage -->
        <div style="background:#00402c;border:2px solid #00b87a;border-radius:14px;padding:22px 14px;text-align:center;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9affc8;margin-bottom:6px;">Target Distance</div>
          <div id="ld-target-yds" style="font-size:54px;font-weight:800;color:#ffffff;line-height:1;">175</div>
          <div style="font-size:13px;color:#9affc8;margin-top:4px;">yards — hit your club for this</div>
        </div>

        <!-- Offline entry -->
        <div style="background:#222222;border:1px solid #333333;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:12px;color:#606060;margin-bottom:8px;text-align:center;">Offline (yards)</div>
          <input type="number" id="ld-offline-input" placeholder="0" inputmode="decimal" min="0" step="0.1" style="width:100%;height:60px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:32px;font-weight:800;box-sizing:border-box;">
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="ld-dir-left" onclick="lineDrillSetDir('L')" style="flex:1;height:50px;background:#282828;color:#606060;border:1px solid #333333;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">◀ Left</button>
            <button id="ld-dir-right" onclick="lineDrillSetDir('R')" style="flex:1;height:50px;background:#282828;color:#606060;border:1px solid #333333;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">Right ▶</button>
          </div>
        </div>

        <button id="ld-next-btn" onclick="lineDrillRecordShot()" style="width:100%;height:52px;background:#007a52;color:#ffffff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;max-width:none;">Record Shot →</button>
        <button onclick="lineDrillBackToSetup()" style="width:100%;height:40px;background:transparent;color:#606060;border:none;font-size:13px;cursor:pointer;margin-top:8px;max-width:none;">Cancel Drill</button>

        <!-- Shots so far -->
        <div id="ld-shots-list" style="margin-top:14px;"></div>
      </div>

      <!-- SUMMARY VIEW -->
      <div id="ld-summary-view" style="display:none;">
        <!-- Total score -->
        <div style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:14px;padding:20px 14px;text-align:center;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aad4ff;margin-bottom:4px;">Final Score</div>
          <div id="ld-final-score" style="font-size:54px;font-weight:800;color:#ffffff;line-height:1;">0</div>
          <div style="font-size:13px;color:#aad4ff;margin-top:4px;">total yards offline</div>
          <div id="ld-save-msg" style="font-size:12px;text-align:center;margin-top:8px;min-height:16px;color:#9affc8;"></div>
        </div>

        <!-- Stats grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Misses Left</div>
            <div id="ld-stat-left" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="ld-stat-left-pct" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0%</div>
            <div id="ld-stat-left-avg" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0.0 yds avg</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Misses Right</div>
            <div id="ld-stat-right" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="ld-stat-right-pct" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0%</div>
            <div id="ld-stat-right-avg" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0.0 yds avg</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Avg Offline</div>
            <div id="ld-stat-avg" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div style="font-size:11px;color:#9a9a9a;margin-top:2px;">yds/shot</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Biggest Miss</div>
            <div id="ld-stat-biggest" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="ld-stat-biggest-side" style="font-size:11px;color:#9a9a9a;margin-top:2px;">—</div>
          </div>
        </div>

        <button onclick="lineDrillBackToSetup()" style="width:100%;height:44px;background:#282828;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Run Another Drill</button>

        <!-- Shot table -->
        <div style="margin-top:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:6px;">Shots</div>
          <div id="ld-summary-shots" style="background:#1e1e1e;border-radius:8px;overflow:hidden;"></div>
        </div>
      </div>

    </div>
  </div>
</div>

<div id="driverDrillPage" class="page" style="justify-content:flex-start;padding:0;overflow:hidden;">
  <!-- Header -->
  <div class="fixedhead" style="background:#1e1e1e;border-bottom:2px solid #00b87a;width:100%;text-align:center;padding:11px 0;position:relative;flex-shrink:0;">
    <button class="back-btn-top" aria-label="Back" onclick="driverDrillBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div style="font-size:1.2rem;font-weight:800;color:#ffffff;">Driver Combine</div>
  </div>

  <!-- Scrollable body -->
  <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;width:100%;">
    <div style="max-width:520px;margin:0 auto;padding:14px 14px 100px;">

      <!-- SETUP VIEW -->
      <div id="dd-setup-view">
        <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="font-size:13px;color:#ffffff;line-height:1.5;">
            <strong style="color:#00b87a;">Driver Combine</strong> — hit drives one at a time. After each shot enter the drive distance, how many yards offline it finished, and whether the miss was Left or Right. Score = average drive distance net of offline (drive − offline).
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Number of Shots</div>
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <button id="dd-version-std"  onclick="driverDrillSetVersion(6)"  style="flex:1;height:46px;background:#00b87a;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Standard (6)</button>
          <button id="dd-version-long" onclick="driverDrillSetVersion(12)" style="flex:1;height:46px;background:#282828;color:#606060;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Long (12)</button>
        </div>
        <div id="dd-custom-row" style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
          <span style="font-size:12px;color:#606060;">Custom:</span>
          <input type="number" id="dd-custom" value="6" min="1" max="50" inputmode="numeric" oninput="driverDrillSetVersion('custom')" style="flex:1;height:42px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:15px;">
          <span style="color:#606060;font-size:13px;">shots</span>
        </div>

        <button onclick="driverDrillStart()" style="width:100%;height:50px;background:#007a52;color:#ffffff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;max-width:none;">Start Drill →</button>
        <div id="dd-setup-msg" style="font-size:12px;color:#d4706e;text-align:center;margin-top:8px;min-height:16px;"></div>
      </div>

      <!-- TRACKER VIEW -->
      <div id="dd-tracker-view" style="display:none;">
        <!-- Progress -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:12px;color:#606060;">Shot <span id="dd-shot-num" style="color:#ffffff;font-weight:700;">1</span> of <span id="dd-shot-total" style="color:#ffffff;font-weight:700;">6</span></div>
          <div style="font-size:12px;color:#606060;">Avg net: <span id="dd-running-avg" style="color:#00b87a;font-weight:700;">0</span> yds</div>
        </div>
        <div style="background:#282828;height:6px;border-radius:3px;overflow:hidden;margin-bottom:14px;">
          <div id="dd-progress-bar" style="background:#00b87a;height:100%;width:0%;transition:width 0.2s;"></div>
        </div>

        <!-- Drive distance -->
        <div style="background:#222222;border:1px solid #333333;border-radius:12px;padding:14px;margin-bottom:10px;">
          <div style="font-size:12px;color:#606060;margin-bottom:8px;text-align:center;">Total Drive Distance (yards)</div>
          <input type="number" id="dd-drive-input" placeholder="0" inputmode="numeric" min="0" style="width:100%;height:60px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:32px;font-weight:800;box-sizing:border-box;">
        </div>

        <!-- Offline + L/R -->
        <div style="background:#222222;border:1px solid #333333;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:12px;color:#606060;margin-bottom:8px;text-align:center;">Offline (yards)</div>
          <input type="number" id="dd-offline-input" placeholder="0" inputmode="decimal" min="0" step="0.1" style="width:100%;height:60px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:10px;text-align:center;font-size:32px;font-weight:800;box-sizing:border-box;">
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="dd-dir-left" onclick="driverDrillSetDir('L')" style="flex:1;height:50px;background:#282828;color:#606060;border:1px solid #333333;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">◀ Left</button>
            <button id="dd-dir-right" onclick="driverDrillSetDir('R')" style="flex:1;height:50px;background:#282828;color:#606060;border:1px solid #333333;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;max-width:none;">Right ▶</button>
          </div>
        </div>

        <button id="dd-next-btn" onclick="driverDrillRecordShot()" style="width:100%;height:52px;background:#007a52;color:#ffffff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;max-width:none;">Record Shot →</button>
        <button onclick="driverDrillBackToSetup()" style="width:100%;height:40px;background:transparent;color:#606060;border:none;font-size:13px;cursor:pointer;margin-top:8px;max-width:none;">Cancel Drill</button>

        <!-- Shots so far -->
        <div id="dd-shots-list" style="margin-top:14px;"></div>
      </div>

      <!-- SUMMARY VIEW -->
      <div id="dd-summary-view" style="display:none;">
        <!-- Final score -->
        <div style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:14px;padding:20px 14px;text-align:center;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aad4ff;margin-bottom:4px;">Final Score</div>
          <div id="dd-final-score" style="font-size:54px;font-weight:800;color:#ffffff;line-height:1;">0</div>
          <div style="font-size:13px;color:#aad4ff;margin-top:4px;">avg net yards (drive − offline)</div>
          <div id="dd-save-msg" style="font-size:12px;text-align:center;margin-top:8px;min-height:16px;color:#9affc8;"></div>
        </div>

        <!-- Stats grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Misses Left</div>
            <div id="dd-stat-left" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="dd-stat-left-pct" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0%</div>
            <div id="dd-stat-left-avg" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0.0 yds avg</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Misses Right</div>
            <div id="dd-stat-right" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="dd-stat-right-pct" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0%</div>
            <div id="dd-stat-right-avg" style="font-size:11px;color:#9a9a9a;margin-top:2px;">0.0 yds avg</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Avg Drive</div>
            <div id="dd-stat-avg-drive" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div style="font-size:11px;color:#9a9a9a;margin-top:2px;">yds</div>
          </div>
          <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Biggest Miss</div>
            <div id="dd-stat-biggest" style="font-size:22px;font-weight:800;color:#ffffff;">0</div>
            <div id="dd-stat-biggest-side" style="font-size:11px;color:#9a9a9a;margin-top:2px;">—</div>
          </div>
        </div>

        <button onclick="driverDrillBackToSetup()" style="width:100%;height:44px;background:#282828;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;max-width:none;">Run Another Drill</button>

        <!-- Shot table -->
        <div style="margin-top:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:6px;">Shots</div>
          <div id="dd-summary-shots" style="background:#1e1e1e;border-radius:8px;overflow:hidden;"></div>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- EVAL COMBINE -->
<div id="evalCombinePage" class="page" style="justify-content:flex-start;padding:0;overflow:hidden;">
  <div class="fixedhead" style="background:#1e1e1e;border-bottom:2px solid #00b87a;width:100%;text-align:center;padding:11px 0;position:relative;flex-shrink:0;">
    <button class="back-btn-top" aria-label="Back" onclick="evalCombineBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div style="font-size:1.2rem;font-weight:800;color:#ffffff;">Evaluation Test</div>
  </div>
  <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;width:100%;">
    <div style="max-width:520px;margin:0 auto;padding:14px 14px 100px;">

      <!-- MODE SELECT -->
      <div id="eval-mode-view">
        <div style="background:#222222;border:1px solid #333333;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="font-size:13px;color:#ffffff;line-height:1.5;">
            The <strong style="color:#00b87a;">Evaluation Test</strong> runs a series of mini combines to build a baseline of your game. You'll get a total score out of 100, your strokes gained, and a handicap comparison.
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Start</div>
        <button onclick="evalStart('lm')" style="width:100%;height:auto;padding:16px;background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;text-align:left;color:#ffffff;cursor:pointer;margin-bottom:10px;max-width:none;">
          <div style="font-size:1rem;font-weight:800;">Launch Monitor</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;">Full evaluation using launch monitor data</div>
        </button>
      </div>

      <!-- CHECKLIST -->
      <div id="eval-steps-view" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:12px;color:#606060;">Launch Monitor Test</div>
          <div style="font-size:12px;color:#606060;">Step <span id="eval-step-num" style="color:#ffffff;font-weight:700;">1</span> of 4</div>
        </div>
        <div style="background:#282828;height:6px;border-radius:3px;overflow:hidden;margin-bottom:14px;">
          <div id="eval-progress-bar" style="background:#00b87a;height:100%;width:0%;transition:width 0.2s;"></div>
        </div>
        <div id="eval-steps-list"></div>
        <button onclick="evalCancel()" style="width:100%;height:40px;background:transparent;color:#606060;border:none;font-size:13px;cursor:pointer;margin-top:8px;max-width:none;">Cancel Test</button>
      </div>

      <!-- RESULTS -->
      <div id="eval-results-view" style="display:none;">
        <div style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:14px;padding:20px 14px;text-align:center;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aad4ff;margin-bottom:4px;">Evaluation Test Score</div>
          <div id="eval-total-score" style="font-size:54px;font-weight:800;color:#ffffff;line-height:1;">0</div>
          <div style="font-size:13px;color:#aad4ff;margin-top:2px;">out of 100</div>
          <div id="eval-total-sg" style="font-size:13px;color:#9affc8;margin-top:6px;font-weight:700;">0.0 total SG</div>
          <div id="eval-hcp-compare" style="font-size:12px;color:#aad4ff;margin-top:4px;"></div>
          <div id="eval-save-msg" style="font-size:12px;text-align:center;margin-top:8px;min-height:16px;color:#9affc8;"></div>
        </div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:8px;">Category Breakdown</div>
        <div id="eval-breakdown"></div>
        <button onclick="evalCombineBack()" style="width:100%;height:44px;background:#282828;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:12px;max-width:none;">Done</button>
      </div>

    </div>
  </div>
</div>

<div id="combinesPage" class="page" style="justify-content:flex-start;padding:0;overflow:hidden;">

  <!-- Fixed header -->
  <div class="fixedhead" style="background:#1e1e1e;border-bottom:2px solid #00b87a;width:100%;text-align:center;padding:11px 0;position:relative;flex-shrink:0;">
    <button id="comb-header-back-btn" class="back-btn-top" aria-label="Back" onclick="combHeaderBack()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div id="comb-page-title" style="font-size:1.2rem;font-weight:800;color:#ffffff;">Combines</div>
    <div id="combStudentBanner" style="display:none;background:#007a52;color:#ffffff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;margin-top:4px;"></div>
  </div>

  <!-- Scrollable body -->
  <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;width:100%;">
    <div style="max-width:520px;margin:0 auto;padding:14px 12px 80px;">

      <!-- HOME VIEW (menu grid + history) -->
      <div id="comb-home-view">

        <!-- Combine type picker -->
        <div id="comb-practice-sub">
          <div style="font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:14px;text-align:center;">Choose a Combine</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button onclick="combShowModeSelect('putting')" style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;box-sizing:border-box;">
              <div style="font-size:1rem;font-weight:800;">Putting</div>
              <div style="font-size:0.82rem;color:#44b8f0;line-height:1.4;margin-top:4px;">Test putts from set distances and breaks.</div>
            </button>
            <button onclick="combShowShortGameSelect()" style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;box-sizing:border-box;">
              <div style="font-size:1rem;font-weight:800;">Short Game</div>
              <div style="font-size:0.82rem;color:#44b8f0;line-height:1.4;margin-top:4px;">Proximity based or up &amp; downs around the green.</div>
            </button>
            <button onclick="combShowModeSelect('wedge')" style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;box-sizing:border-box;">
              <div style="font-size:1rem;font-weight:800;">Wedge Distances</div>
              <div style="font-size:0.82rem;color:#44b8f0;line-height:1.4;margin-top:4px;">Dial in carry distances from 40–125 yards.</div>
            </button>
          </div>
        </div><!-- /comb-practice-sub -->

        <!-- Short Game type select (Proximity vs Up & Downs) -->
        <div id="comb-shortgame-select" style="display:none;">
          <div style="font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:14px;text-align:center;">Short Game</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button onclick="combShowModeSelect('chip-prox')" style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;white-space:normal;word-break:break-word;">
              <div style="font-size:1rem;font-weight:800;">Proximity Based</div>
              <div style="font-size:0.82rem;color:#44b8f0;line-height:1.4;white-space:normal;word-break:break-word;">Scored on how close you hit it to the hole. Use this option if you're not able to putt out.</div>
            </button>
            <button onclick="combShowModeSelect('chip-hole')" style="background:#00402c;border:2px solid #007a52;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;white-space:normal;word-break:break-word;">
              <div style="font-size:1rem;font-weight:800;">Up & Downs</div>
              <div style="font-size:0.82rem;color:#00b87a;line-height:1.4;white-space:normal;word-break:break-word;">Chip and hole out each hole. Use this option if you're able to putt.</div>
            </button>
          </div>
        </div><!-- /comb-shortgame-select -->

        <!-- Mode select sub-view (Combine vs Custom) -->
        <div id="comb-mode-select" style="display:none;">
          <div id="comb-mode-type-label" style="font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:14px;text-align:center;"></div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button onclick="combOpenFromModeSelect('combine')" style="background:#1a4a8a;border:2px solid #2d7abc;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;white-space:normal;word-break:break-word;">
              <div style="font-size:1rem;font-weight:800;">Combine</div>
              <div style="font-size:0.82rem;color:#44b8f0;line-height:1.4;white-space:normal;word-break:break-word;">Fixed set of yardages scrambled into a new random order each session. Use this to benchmark and track progress over time.</div>
            </button>
            <button onclick="combOpenFromModeSelect('custom')" style="background:#00402c;border:2px solid #00b87a;border-radius:12px;padding:16px;text-align:center;align-items:center;color:#ffffff;cursor:pointer;height:auto;max-width:none;width:100%;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;white-space:normal;word-break:break-word;">
              <div style="font-size:1rem;font-weight:800;">Custom</div>
              <div style="font-size:0.82rem;color:#00b87a;line-height:1.4;white-space:normal;word-break:break-word;">Enter your own yardage range and number of holes. Great for targeted practice at specific distances.</div>
            </button>
          </div>
        </div><!-- /comb-mode-select -->

      </div><!-- /comb-home-view -->

      <!-- TRACKER VIEW -->
      <div id="comb-tracker-view" style="display:none;">

        <!-- Settings bar -->
        <div id="comb-settings-bar" style="background:#222222;border:1px solid #333333;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;">
            <div id="comb-hcp-group" style="display:flex;align-items:center;gap:6px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;">HCP</span>
              <select id="comb-handicap" onchange="combRecalcAll()" style="background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 8px;-webkit-appearance:none;appearance:none;">
                <option value="Tour Pro">Tour Pro</option>
                <option value="Scratch" selected>Scratch</option>
                <option value="5">5</option><option value="10">10</option>
                <option value="15">15</option><option value="20">20</option>
                <option value="25">25</option><option value="30">30</option>
              </select>
            </div>
            <div id="comb-wedge-score-grp" style="display:none;align-items:center;gap:6px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;">Mode</span>
              <div style="display:flex;background:#282828;border-radius:6px;padding:2px;border:1px solid #333333;">
                <div id="comb-tbtn-sg"  onclick="combSetWedge('sg')"  style="padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.78rem;font-weight:700;color:#ffffff;background:#00b87a;">SG</div>
                <div id="comb-tbtn-pts" onclick="combSetWedge('pts')" style="padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.78rem;font-weight:700;color:#606060;">0–100</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;"># Holes</span>
              <input type="number" inputmode="numeric" id="comb-holes-custom" value="9" min="1" onchange="combSetup()" style="width:50px;background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 6px;text-align:center;">
              <select id="comb-holes-combine" onchange="combSetup()" style="display:none;background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 8px;-webkit-appearance:none;appearance:none;">
                <option id="comb-opt-6" value="6">6</option>
                <option value="9" selected>9</option>
                <option value="18">18</option>
              </select>
            </div>
            <div id="comb-wedge-range-grp" style="display:none;align-items:center;gap:4px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;">Yds</span>
              <input type="number" inputmode="numeric" id="comb-w-min" value="40" style="width:52px;background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 6px;text-align:center;">
              <span style="color:#606060;">–</span>
              <input type="number" inputmode="numeric" id="comb-w-max" value="125" style="width:52px;background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 6px;text-align:center;">
              <button onclick="combSetup()" style="padding:6px 14px;background:#00b87a;color:#ffffff;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;white-space:nowrap;height:auto;max-width:none;width:auto;">Gen</button>
            </div>
            <div id="comb-putting-type-grp" style="display:none;align-items:center;gap:6px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;">Type</span>
              <select id="comb-p-type" onchange="combSetup()" style="background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 8px;-webkit-appearance:none;appearance:none;">
                <option value="normal">Normal</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div id="comb-wedge-type-grp" style="display:none;align-items:center;gap:6px;font-size:0.84rem;">
              <span style="color:#606060;font-size:0.75rem;">Type</span>
              <select id="comb-w-type" onchange="combSetup()" style="background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;font-size:0.9rem;padding:5px 8px;-webkit-appearance:none;appearance:none;">
                <option value="std">Std 40–125</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Nav bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="width:70px;"></div>
          <h2 id="comb-title" style="margin:0;color:#00b87a;font-size:1rem;font-weight:800;text-align:center;flex:1;padding:0 6px;"></h2>
          <div style="width:70px;"></div>
        </div>

        <!-- Scoreboard -->
        <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;background:#00402c;border:1px solid #00b87a;padding:10px;border-radius:10px;margin-bottom:10px;text-align:center;">
          <div id="comb-exp-box">
            <div style="font-size:0.65rem;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Expected</div>
            <div id="comb-total-exp" style="font-size:1.4rem;font-weight:700;">0.00</div>
          </div>
          <div id="comb-strokes-box" style="display:none;">
            <div style="font-size:0.65rem;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Strokes</div>
            <div id="comb-total-strokes" style="font-size:1.4rem;font-weight:700;">0</div>
          </div>
          <div>
            <div id="comb-total-label" style="font-size:0.65rem;color:#606060;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Total SG</div>
            <div id="comb-total-val" style="font-size:1.4rem;font-weight:700;">0.00</div>
          </div>
        </div>

        <!-- Date & Note toggle -->
        <button id="comb-meta-toggle" onclick="combToggleMeta()" style="width:100%;background:transparent;border:1px dashed #3d3d3d;color:#606060;border-radius:8px;padding:8px;font-size:0.85rem;cursor:pointer;margin-bottom:8px;touch-action:manipulation;height:auto;max-width:none;">＋ Add Date &amp; Note</button>
        <div id="comb-meta-panel" style="display:none;background:#222222;border:1px solid #333333;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:110px;">
              <label style="font-size:0.68rem;color:#606060;text-transform:uppercase;letter-spacing:.5px;">Date</label>
              <input type="date" id="comb-date" style="background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;padding:7px 10px;font-size:0.92rem;width:100%;-webkit-appearance:none;appearance:none;">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:130px;">
              <label style="font-size:0.68rem;color:#606060;text-transform:uppercase;letter-spacing:.5px;">Note</label>
              <input type="text" id="comb-note" placeholder="e.g. tried new grip, using Scotty Cameron…" style="background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;padding:7px 10px;font-size:0.92rem;width:100%;">
            </div>
          </div>
        </div>

        <!-- Save button -->
        <button id="comb-save-btn" onclick="combSave()" style="width:100%;padding:11px;background:#007a52;color:#ffffff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:6px;touch-action:manipulation;height:auto;max-width:none;">${ic('save')} Save to Profile</button>
        <div id="comb-save-msg" style="font-size:0.78rem;text-align:center;min-height:16px;margin-bottom:8px;color:#00b87a;"></div>

        <!-- Table -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:8px;">
          <table id="comb-table" style="width:100%;border-collapse:collapse;">
            <thead id="comb-head"></thead>
            <tbody id="comb-body"></tbody>
          </table>
        </div>
      </div><!-- /tracker-view -->

    </div><!-- /inner -->
  </div><!-- /scroll -->
</div><!-- /combinesPage -->`;

export const MORE_MODALS = `

<!-- Drill Completion Note Modal -->
<div id="drillCompleteModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:200;align-items:center;justify-content:center;">
  <div style="background:#222222;border-radius:16px;padding:20px;width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Session Note</div>
    <div style="font-size:12px;color:#606060;margin-bottom:12px;">How did it go? (optional)</div>
    <textarea id="drillCompleteNoteInput" placeholder="e.g. Did 3–8 ft gates for 10 mins, holed 7/10..." style="width:100%;background:#282828;border:1px solid #333333;border-radius:8px;color:#ffffff;font-size:13px;padding:10px;resize:vertical;min-height:80px;box-sizing:border-box;font-family:inherit;"></textarea>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button onclick="confirmDrillComplete()" style="flex:1;background:#007a52;color:#00b87a;font-weight:700;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;height:auto;max-width:none;width:auto;">✓ Mark Done</button>
      <button onclick="closeDrillCompleteModal()" style="flex:1;background:#282828;color:#606060;font-weight:700;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;height:auto;max-width:none;width:auto;">Cancel</button>
    </div>
  </div>
</div>`;

export const SG_PARTS = `<!-- Strokes gained explainer: kept here (hidden) and moved into the Learn screens when opened. -->
<div id="helpContent_sg" style="display:none;">
      <!-- SG Explained content -->
      <div id="sgSubContent_explained">
        <div id="sgExplainerGraphic" style="background:#222222;border-radius:14px;overflow:hidden;"></div>
      </div>
</div>`;
