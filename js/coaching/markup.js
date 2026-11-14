// Page markup for Coaching, taken from the coaching app (v6/index.html): the
// Coaching page (student and coach views) and the coach's Student View page.

export const COACHING_PAGE = `<div id="coachingCornerPage" class="page" style="justify-content:flex-start;padding-top:0;overflow-y:hidden;padding-bottom:0;align-items:center;">
  <button class="back-btn-top" onclick="show('homePage')" style="z-index:10;"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>

  <!-- HEADER -->
  <div style="width:100%;max-width:420px;padding:28px 16px 0;box-sizing:border-box;flex-shrink:0;">
    <div style="font-size:22px;font-weight:800;margin-bottom:2px;text-align:center;">🎓 Coaching</div>
    <div id="coachingSubtitle" style="font-size:12px;color:#2e2e2e;text-align:center;margin-bottom:10px;">Loading...</div>
  </div>

  <!-- LOGIN GATE -->
  <div id="coachingLoginGate" style="display:none;width:100%;max-width:420px;padding:0 16px;box-sizing:border-box;">
    <div style="background:#222222;border-radius:14px;padding:28px 20px;text-align:center;margin-top:20px;">
      <div style="font-size:36px;margin-bottom:12px;">🔒</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px;">Sign In Required</div>
      <div style="font-size:13px;color:#606060;margin-bottom:18px;">Create an account or log in to access coaching features.</div>
      <button onclick="show('authPage')" style="background:#2d7abc;width:100%;height:44px;font-size:14px;font-weight:700;max-width:none;">Log In / Sign Up</button>
    </div>
  </div>

  <!-- ======================================== -->
  <!-- STUDENT VIEW (tabbed)                    -->
  <!-- ======================================== -->
  <div id="coachingStudentView" style="display:none;width:100%;max-width:420px;flex:1;overflow:hidden;display:flex;flex-direction:column;">

    <!-- Tab bar -->
    <div style="display:flex;gap:0;width:100%;flex-shrink:0;border-radius:10px;overflow:hidden;">
      <button id="cstTab0" onclick="showStudentCoachingTab(0)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#2d7abc;border-radius:0;border:none;color:#ffffff;max-width:none;width:auto;padding:0;margin:0;">Feedback</button>
      <button id="cstTab1" onclick="showStudentCoachingTab(1)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Drills</button>
      <button id="cstTab2" onclick="showStudentCoachingTab(2)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Goals</button>
      <button id="cstTab3" onclick="showStudentCoachingTab(3)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Messages</button>
      <button id="cstTab4" onclick="showStudentCoachingTab(4)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Info</button>
    </div>

    <!-- Tab content -->
    <div id="cstTabContentWrap" style="flex:1;overflow:hidden;padding:14px 16px 40px;">

      <!-- TAB 0: Feedback -->
      <div id="cstTabContent0" style="display:flex;flex-direction:column;height:100%;margin:-14px -16px -40px;">

        <!-- Sticky search + filters -->
        <div style="flex-shrink:0;padding:12px 16px 8px;background:#1e1e1e;border-bottom:1px solid #282828;">
          <input id="feedbackSearch" oninput="filterStudentFeedback()" placeholder="Search notes..." style="width:100%;height:38px;font-size:13px;box-sizing:border-box;display:block;text-align:center;margin-bottom:6px;">
          <div style="display:flex;gap:6px;">
            <select id="feedbackFilterType" onchange="filterStudentFeedback()" style="flex:1;height:36px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
              <option value="all">All Types</option>
              <option value="lesson">Lesson Notes</option>
              <option value="general">General Feedback</option>
            </select>
            <select id="feedbackFilterDate" onchange="filterStudentFeedback()" style="flex:1;height:36px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
              <option value="all">All Time</option>
              <option value="1">Last Month</option>
              <option value="3">Last 3 Months</option>
              <option value="6">Last 6 Months</option>
              <option value="12">Last Year</option>
            </select>
          </div>
          <div id="feedbackFilterCount" style="font-size:11px;color:#2e2e2e;text-align:right;min-height:14px;margin-top:4px;"></div>
        </div>

        <!-- Scrollable notes only -->
        <div id="coachingNotesList" style="flex:1;overflow-y:auto;padding:0 16px 80px;">
          <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No feedback from your coach yet.</div>
        </div>
      </div>

      <!-- TAB 1: Drills & Combines -->
      <div id="cstTabContent1" style="display:none;height:100%;overflow-y:auto;padding:14px 0 80px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">🎯 Assigned Drills</div>
        <div id="coachingAssignedDrillsList">
          <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No drills assigned yet.</div>
        </div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin:18px 0 10px;">🏌️ Assigned Combines</div>
        <div id="coachingAssignedCombinesList">
          <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No combines assigned yet.</div>
        </div>
      </div>

      <!-- TAB 2: Goals & Handicap -->
      <div id="cstTabContent2" style="display:none;height:100%;overflow-y:auto;padding:14px 0 80px;">
        <!-- Handicap Index Card -->
        <div style="background:#222222;border-radius:14px;padding:16px 18px;margin-bottom:14px;text-align:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:6px;">My Handicap Index</div>
          <div id="cstHandicapDisplay" style="font-size:32px;font-weight:800;color:#00b87a;padding:2px 0;">--</div>
          <div id="cstHandicapInfo" style="font-size:11px;color:#2e2e2e;line-height:1.4;"></div>
          <div id="cstHandicapTrend" style="display:flex;align-items:flex-end;gap:2px;height:50px;justify-content:center;margin-top:8px;"></div>
        </div>
        <!-- My Goals -->
        <div style="background:#222222;border-radius:14px;padding:16px 18px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">My Goals</div>
          <div id="cstGoalsList"></div>
          <button onclick="toggleCstAddGoal()" id="cstAddGoalBtn" style="background:#007a52;font-size:12px;height:34px;width:100%;max-width:none;margin-top:8px;">+ Add Goal</button>
          <div id="cstAddGoalForm" style="display:none;margin-top:8px;">
            <select id="cstGoalCategory" style="width:100%;height:36px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;margin-bottom:6px;">
              <option value="handicap">Handicap Index</option>
              <option value="scoring_avg">Scoring Average (18-hole)</option>
              <option value="fairways">Fairway % Hit</option>
              <option value="gir">GIR %</option>
              <option value="putts">Putts Per Round</option>
              <option value="sg_total">SG: Total</option>
              <option value="sg_ott">SG: Off The Tee</option>
              <option value="sg_app">SG: Approach</option>
              <option value="sg_arg">SG: Around Green</option>
              <option value="sg_putt">SG: Putting</option>
              <option value="custom">Custom Goal</option>
            </select>
            <input id="cstGoalTarget" type="text" placeholder="Target value (e.g. 10.0)" style="width:100%;height:36px;box-sizing:border-box;margin-bottom:6px;">
            <input id="cstGoalDeadline" type="date" style="width:100%;height:36px;box-sizing:border-box;margin-bottom:6px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 8px;">
            <input id="cstGoalNote" type="text" placeholder="Note (optional)" style="width:100%;height:36px;box-sizing:border-box;margin-bottom:6px;">
            <div style="display:flex;gap:6px;">
              <button onclick="saveCstGoal()" style="flex:1;height:34px;background:#2d7abc;font-size:12px;font-weight:700;border:none;border-radius:8px;color:#ffffff;cursor:pointer;">Save</button>
              <button onclick="toggleCstAddGoal()" style="flex:1;height:34px;background:#333333;font-size:12px;font-weight:700;border:none;border-radius:8px;color:#9a9a9a;cursor:pointer;">Cancel</button>
            </div>
            <div id="cstGoalFormMsg" style="font-size:11px;min-height:14px;text-align:center;margin-top:4px;"></div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Messages -->
      <div id="cstTabContent3" style="display:none;height:100%;display:flex;flex-direction:column;margin:-14px -16px -40px;">
        <div id="cstMessagesList" style="flex:1;overflow-y:auto;padding:14px 16px 10px;">
          <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No messages yet.</div>
        </div>
        <div style="flex-shrink:0;padding:8px 16px 20px;background:#1e1e1e;border-top:1px solid #282828;">
          <div id="cstMsgStatus" style="font-size:11px;min-height:14px;text-align:center;margin-bottom:4px;"></div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="cstMsgInput" placeholder="Message your coach..." onkeydown="if(event.key==='Enter')sendStudentMessage()" style="flex:1;height:40px;box-sizing:border-box;font-size:14px;">
            <button onclick="sendStudentMessage()" style="background:#2d7abc;border:none;border-radius:8px;color:#ffffff;font-size:13px;font-weight:700;padding:0 16px;cursor:pointer;height:40px;max-width:none;width:auto;">Send</button>
          </div>
        </div>
      </div>

      <!-- TAB 4: Info -->
      <div id="cstTabContent4" style="display:none;height:100%;overflow-y:auto;padding:14px 0 80px;">
        <!-- Invite Code -->
        <div style="background:linear-gradient(135deg,#1a4a8a,#1a4a8a);border-radius:14px;padding:18px 20px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.55);margin-bottom:6px;">Your Invite Code</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div id="coachingMyCode" style="font-size:30px;font-weight:800;letter-spacing:6px;font-family:monospace;color:#44b8f0;"></div>
            <button onclick="copyCoachingCode()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;color:#ffffff;font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer;height:auto;max-width:none;width:auto;">COPY</button>
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Share this code with your coach to connect.</div>
          <div id="coachingCodeCopied" style="font-size:11px;color:#00b87a;min-height:14px;margin-top:2px;"></div>
        </div>
        <!-- My Coach -->
        <div style="background:#222222;border-radius:14px;padding:18px 20px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">My Coach</div>
          <div id="coachingMyCoachContent">
            <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;"><div style="font-size:28px;margin-bottom:8px;">👤</div>No coach connected yet.<br>Share your invite code above!</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:14px;">
          <button onclick="requestCoachRole()" style="background:transparent;border:none;color:#44b8f0;font-size:13px;text-decoration:underline;height:auto;width:auto;max-width:none;cursor:pointer;">Are you a coach? Request coach access</button>
          <div id="roleMsg" style="font-size:12px;min-height:14px;margin-top:4px;"></div>
        </div>
      </div>
    </div><!-- end tab content scroll -->
  </div><!-- end student view -->

  <!-- ======================================== -->
  <!-- COACH VIEW (tabbed)                      -->
  <!-- ======================================== -->
  <div id="coachingCoachView" style="display:none;width:100%;max-width:420px;flex:1;overflow:hidden;display:flex;flex-direction:column;">

    <!-- Tab bar -->
    <div style="display:flex;gap:0;width:100%;flex-shrink:0;border-radius:10px;overflow:hidden;">
      <button id="cctTab0" onclick="showCoachCoachingTab(0)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#2d7abc;border-radius:0;border:none;color:#ffffff;max-width:none;width:auto;padding:0;margin:0;">Home</button>
      <button id="cctTab1" onclick="showCoachCoachingTab(1)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Notes</button>
      <button id="cctTab2" onclick="showCoachCoachingTab(2)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Assign</button>
      <button id="cctTab3" onclick="showCoachCoachingTab(3)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Messages</button>
      <button id="cctTab4" onclick="showCoachCoachingTab(4)" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">Students</button>
    </div>

    <!-- Tab content -->
    <div style="flex:1;overflow-y:auto;padding:14px 16px 80px;">

      <!-- TAB 0: Home -->
      <div id="cctTabContent0">
        <!-- Students playing right now (this app's live view) -->
        <div id="coachLiveSection" style="display:none;background:#222222;border-radius:14px;padding:14px 16px;margin-bottom:14px;border:1px solid #c8102e;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ff6b7f;margin-bottom:8px;">\u25cf Live now</div>
          <div id="coachLiveList"></div>
        </div>
        <!-- Stats bar -->
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <div style="flex:1;background:#222222;border-radius:12px;padding:14px 6px;text-align:center;">
            <div id="coachStatStudents" style="font-size:24px;font-weight:800;color:#44b8f0;">–</div>
            <div style="font-size:10px;color:#2e2e2e;margin-top:2px;">Students</div>
          </div>
          <div style="flex:1;background:#222222;border-radius:12px;padding:14px 6px;text-align:center;">
            <div id="coachStatNewRounds" style="font-size:24px;font-weight:800;color:#00b87a;">–</div>
            <div style="font-size:10px;color:#2e2e2e;margin-top:2px;">New Rounds</div>
          </div>
          <div style="flex:1;background:#222222;border-radius:12px;padding:14px 6px;text-align:center;">
            <div id="coachStatNotes" style="font-size:24px;font-weight:800;color:#f0c830;">–</div>
            <div style="font-size:10px;color:#2e2e2e;margin-top:2px;">Notes Sent</div>
          </div>
        </div>
        <!-- Admin: Pending Coach Requests (only visible to admin) -->
        <div id="coachRequestsSection" style="display:none;background:#222222;border-radius:14px;padding:16px 18px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f0c830;margin-bottom:10px;">⏳ Pending Coach Requests</div>
          <div id="coachRequestsList"><div style="color:#2e2e2e;font-size:13px;">Loading...</div></div>
        </div>

        <!-- Recent activity -->
        <div style="background:#222222;border-radius:14px;padding:16px 18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;">🔔 Recent Activity</div>
            <button onclick="markCoachNotificationsRead()" id="markReadBtn" style="display:none;background:transparent;border:none;color:#44b8f0;font-size:11px;font-weight:700;cursor:pointer;height:auto;width:auto;max-width:none;padding:0;">Mark all read</button>
          </div>
          <div id="coachActivityList"><div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;">No recent activity.</div></div>
        </div>
      </div>

      <!-- TAB 1: Lesson Notes -->
      <div id="cctTabContent1" style="display:none;">

        <!-- Type toggle -->
        <div style="display:flex;gap:0;border-radius:10px;overflow:hidden;margin-bottom:12px;">
          <button id="coachNoteTypeLesson" onclick="setCoachNoteType('lesson')" style="flex:1;height:38px;font-size:12px;font-weight:700;background:#2d7abc;border-radius:0;border:none;color:#ffffff;max-width:none;width:auto;padding:0;margin:0;">📅 Lesson Note</button>
          <button id="coachNoteTypeGeneral" onclick="setCoachNoteType('general')" style="flex:1;height:38px;font-size:12px;font-weight:700;background:#282828;border-radius:0;border:none;color:#606060;max-width:none;width:auto;padding:0;margin:0;">💬 General Feedback</button>
        </div>

        <!-- Student search -->
        <div style="position:relative;margin-bottom:8px;">
          <input id="coachNoteStudentSearch" oninput="filterCoachNoteStudents()" placeholder="🔍 Search student name..." style="width:100%;height:40px;font-size:14px;box-sizing:border-box;">
          <div id="coachNoteStudentDropdown" style="display:none;position:absolute;top:44px;left:0;right:0;background:#282828;border:1px solid #3d3d3d;border-radius:8px;z-index:50;max-height:180px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>
        </div>
        <input type="hidden" id="coachNoteStudentSelect" value="">
        <input type="hidden" id="coachNoteType" value="lesson">
        <div id="coachNoteSelectedStudent" style="display:none;background:#2d7abc;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:13px;font-weight:700;color:#44b8f0;align-items:center;justify-content:space-between;">
          <span id="coachNoteSelectedName"></span>
          <button onclick="clearCoachNoteStudent()" style="background:transparent;border:none;color:#606060;font-size:18px;cursor:pointer;height:auto;width:auto;max-width:none;padding:0;line-height:1;">×</button>
        </div>

        <!-- Lesson date (only shown for lesson type) -->
        <div id="coachNoteLessonDateRow" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-size:12px;color:#606060;white-space:nowrap;flex-shrink:0;">Lesson Date:</div>
          <input type="date" id="coachNoteLessonDate" style="flex:1;height:40px;font-size:13px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 10px;box-sizing:border-box;">
        </div>

        <textarea id="coachNoteText" placeholder="Write feedback, notes, focus areas, or encouragement..." style="width:100%;min-height:100px;background:#282828;color:#ffffff;border:1px solid #333333;border-radius:8px;padding:10px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit;margin-bottom:8px;"></textarea>
        <button onclick="sendCoachNote()" style="background:#2d7abc;width:100%;height:44px;font-size:14px;font-weight:700;max-width:none;">Send Feedback</button>
        <div id="coachNoteMsg" style="font-size:12px;min-height:14px;text-align:center;margin-top:6px;"></div>
      </div>

      <!-- TAB 2: Assign -->
      <div id="cctTabContent2" style="display:none;">

        <!-- Assign a Combine -->
        <div style="background:#222222;border-radius:14px;padding:16px 18px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:12px;">🏌️ Assign a Combine</div>
          <select id="coachCombStudentSelect" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;margin-bottom:8px;padding:0 10px;">
            <option value="">Select student...</option>
          </select>
          <select id="coachCombTypeSelect" onchange="coachCombTypeChanged()" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;margin-bottom:8px;padding:0 10px;">
            <option value="">Select combine type...</option>
            <option value="Putting">Putting Combine</option>
            <option value="Chipping (Prox)">Chipping Proximity</option>
            <option value="Chip Hole Out">Chip Hole Out</option>
            <option value="Wedge">Wedge Combine</option>
          </select>

          <!-- Mode: Combine vs Custom -->
          <div id="coachCombModeRow" style="display:none;margin-bottom:8px;">
            <div style="display:flex;gap:6px;">
              <button id="coachCombModeBtn_combine" onclick="coachCombSetMode('combine')" style="flex:1;height:36px;font-size:12px;font-weight:700;background:#1a4a8a;border:2px solid #2d7abc;border-radius:8px;color:#ffffff;cursor:pointer;max-width:none;">Combine</button>
              <button id="coachCombModeBtn_custom" onclick="coachCombSetMode('custom')" style="flex:1;height:36px;font-size:12px;font-weight:700;background:#282828;border:2px solid #3d3d3d;border-radius:8px;color:#606060;cursor:pointer;max-width:none;">Custom</button>
            </div>
            <div id="coachCombModeDesc" style="font-size:10px;color:#2e2e2e;margin-top:4px;text-align:center;">Fixed set of yardages, scrambled randomly</div>
          </div>

          <!-- Combine mode options -->
          <div id="coachCombCombineOpts" style="display:none;margin-bottom:8px;">
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="font-size:11px;color:#606060;white-space:nowrap;">Shots:</div>
              <select id="coachCombShotCount" onchange="coachCombBuildShots()" style="flex:1;height:36px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:13px;padding:0 8px;">
                <option value="6">6 shots</option>
                <option value="9" selected>9 shots</option>
                <option value="18">18 shots</option>
              </select>
            </div>
            <!-- Putting sub-type -->
            <div id="coachCombPuttTypeRow" style="display:none;margin-top:6px;">
              <select id="coachCombPuttType" onchange="coachCombBuildShots()" style="width:100%;height:36px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:13px;padding:0 8px;">
                <option value="short">Short Putts (4–15 ft)</option>
                <option value="normal">Mixed Putts (4–35 ft)</option>
              </select>
            </div>
          </div>

          <!-- Custom mode options -->
          <div id="coachCombCustomOpts" style="display:none;margin-bottom:8px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
              <div style="font-size:11px;color:#606060;white-space:nowrap;">Shots:</div>
              <input id="coachCombCustomHoles" type="number" value="9" min="1" max="30" style="width:55px;height:36px;font-size:13px;text-align:center;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0;">
            </div>
            <div id="coachCombRangeRow" style="display:none;">
              <div style="display:flex;gap:6px;align-items:center;">
                <div style="font-size:11px;color:#606060;">Range:</div>
                <input id="coachCombCustomMin" type="number" value="50" style="width:55px;height:36px;font-size:13px;text-align:center;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0;">
                <div style="font-size:11px;color:#2e2e2e;">to</div>
                <input id="coachCombCustomMax" type="number" value="120" style="width:55px;height:36px;font-size:13px;text-align:center;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0;">
                <div style="font-size:10px;color:#2e2e2e;" id="coachCombRangeUnit">yds</div>
              </div>
            </div>
            <button onclick="coachCombBuildCustom()" style="width:100%;height:34px;margin-top:6px;font-size:12px;font-weight:700;background:#00b87a;border:none;border-radius:8px;color:#ffffff;cursor:pointer;max-width:none;">Generate Shots</button>
          </div>

          <!-- Shot preview -->
          <div id="coachCombShotsBuilder" style="display:none;margin-bottom:8px;">
            <div style="font-size:11px;font-weight:700;color:#44b8f0;margin-bottom:6px;">Shot Setup <span style="font-weight:400;color:#2e2e2e;">(edit distances below)</span></div>
            <div id="coachCombShotsList" style="max-height:220px;overflow-y:auto;background:#1e1e1e;border-radius:10px;padding:8px;"></div>
          </div>

          <!-- Target score & due date -->
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-size:11px;color:#606060;margin-bottom:4px;">Target Score (optional)</div>
              <input id="coachCombTarget" type="number" placeholder="e.g. 18" style="width:100%;height:40px;font-size:13px;box-sizing:border-box;">
            </div>
            <div style="flex:1;">
              <div style="font-size:11px;color:#606060;margin-bottom:4px;">Due Date (optional)</div>
              <input id="coachCombDueDate" type="date" style="width:100%;height:40px;font-size:13px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;padding:0 8px;box-sizing:border-box;">
            </div>
          </div>
          <input id="coachCombNote" placeholder="Instructions or goals for this combine..." style="width:100%;height:40px;font-size:13px;margin-bottom:8px;">
          <button onclick="sendCoachCombineAssignment()" style="background:#007a52;width:100%;height:42px;font-size:14px;font-weight:700;max-width:none;">Assign Combine</button>
          <div id="coachCombMsg" style="font-size:12px;min-height:14px;text-align:center;margin-top:6px;"></div>
        </div>

        <!-- Assign a Drill -->
        <div style="background:#222222;border-radius:14px;padding:16px 18px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:12px;">🎯 Assign a Drill</div>
          <select id="coachDrillStudentSelect" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;margin-bottom:8px;padding:0 10px;">
            <option value="">Select student...</option>
          </select>
          <select id="coachDrillCategorySelect" onchange="populateCoachDrillList()" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;margin-bottom:8px;padding:0 10px;">
            <option value="">Select category...</option>
            <option value="putting">Putting</option>
            <option value="shortgame">Short Game</option>
            <option value="fullswing">Full Swing</option>
          </select>
          <select id="coachDrillSelect" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:14px;margin-bottom:8px;padding:0 10px;">
            <option value="">Select drill...</option>
          </select>
          <input id="coachDrillNote" placeholder="Optional note..." style="width:100%;height:40px;font-size:13px;margin-bottom:8px;">
          <button onclick="sendCoachDrillAssignment()" style="background:#2d7abc;width:100%;height:42px;font-size:14px;font-weight:700;max-width:none;">Assign Drill</button>
          <div id="coachDrillMsg" style="font-size:12px;min-height:14px;text-align:center;margin-top:6px;"></div>
        </div>
      </div>

      <!-- TAB 3: Messages -->
      <div id="cctTabContent3" style="display:none;">
        <div style="margin-bottom:10px;">
          <select id="coachMsgStudentSelect" onchange="loadCoachMessages()" style="width:100%;height:40px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:13px;padding:0 10px;">
            <option value="">Select a student...</option>
          </select>
        </div>
        <div id="cctMessagesList" style="min-height:100px;max-height:400px;overflow-y:auto;margin-bottom:10px;">
          <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Select a student to view messages.</div>
        </div>
        <div id="cctMsgStatus" style="font-size:11px;min-height:14px;text-align:center;margin-bottom:4px;"></div>
        <div id="cctMsgInputWrap" style="display:none;gap:8px;">
          <input type="text" id="cctMsgInput" placeholder="Message student..." onkeydown="if(event.key==='Enter')sendCoachMessage()" style="flex:1;height:40px;box-sizing:border-box;font-size:14px;">
          <button onclick="sendCoachMessage()" style="background:#2d7abc;border:none;border-radius:8px;color:#ffffff;font-size:13px;font-weight:700;padding:0 16px;cursor:pointer;height:40px;max-width:none;width:auto;">Send</button>
        </div>
      </div>

      <!-- TAB 4: Students / Teams -->
      <div id="cctTabContent4" style="display:none;">
        <!-- Add student -->
        <div style="background:#222222;border-radius:14px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#606060;margin-bottom:10px;">Add Student by Invite Code</div>
          <div style="display:flex;gap:6px;">
            <input id="coachAddStudentCode" placeholder="Enter invite code" style="flex:1;text-transform:uppercase;letter-spacing:2px;font-family:monospace;text-align:center;height:40px;font-size:14px;">
            <button onclick="coachAddStudentFromCoachingPage()" style="width:70px;height:40px;font-size:12px;font-weight:700;background:#2d7abc;border-radius:8px;max-width:none;">ADD</button>
          </div>
          <div id="coachAddStudentMsg" style="font-size:12px;min-height:14px;text-align:center;margin-top:6px;"></div>
        </div>

        <!-- TEAM LIST VIEW (default) -->
        <div id="coachTeamListView">
          <!-- Create team -->
          <div style="display:flex;gap:6px;margin-bottom:12px;">
            <input id="coachNewTeamName" placeholder="New team name..." style="flex:1;height:38px;font-size:13px;border-radius:8px;max-width:none;text-align:left;">
            <button onclick="createCoachTeam()" style="height:38px;font-size:12px;font-weight:700;background:#007a52;border-radius:8px;padding:0 14px;max-width:none;width:auto;white-space:nowrap;">+ Team</button>
          </div>
          <div id="coachCreateTeamMsg" style="font-size:12px;min-height:14px;text-align:center;margin-bottom:8px;"></div>
          <!-- Team cards rendered here -->
          <div id="coachTeamCards">
            <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Loading teams...</div>
          </div>
        </div>

        <!-- TEAM DETAIL VIEW (shown when a team is tapped) -->
        <div id="coachTeamDetailView" style="display:none;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <button onclick="showCoachTeamList()" style="height:34px;font-size:18px;background:#282828;border-radius:8px;padding:0 10px;max-width:none;width:auto;color:#9a9a9a;border:1px solid #333333;">←</button>
            <div style="flex:1;min-width:0;">
              <div id="coachTeamDetailName" style="font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
              <div id="coachTeamDetailCount" style="font-size:11px;color:#606060;"></div>
            </div>
            <button id="coachTeamRenameBtn" onclick="renameCoachTeam()" style="height:34px;font-size:11px;font-weight:700;background:#282828;border:1px solid #333333;border-radius:8px;padding:0 10px;max-width:none;width:auto;color:#9a9a9a;">Rename</button>
            <button id="coachTeamDeleteBtn" onclick="deleteCoachTeam()" style="height:34px;font-size:11px;font-weight:700;background:#282828;border:1px solid #333333;border-radius:8px;padding:0 10px;max-width:none;width:auto;color:#d4706e;">Delete</button>
          </div>
          <!-- Search within team -->
          <div style="display:flex;align-items:center;background:#222222;border:1px solid #333333;border-radius:8px;padding:6px 10px;margin-bottom:8px;gap:6px;">
            <span style="color:#2e2e2e;font-size:13px;">🔍</span>
            <input id="coachTeamPlayerSearch" type="text" placeholder="Search players..." oninput="filterTeamPlayers()" style="background:transparent;border:none;color:#ffffff;font-size:12px;width:100%;outline:none;height:auto;max-width:none;text-align:left;padding:0;">
          </div>
          <!-- Player list for this team -->
          <div id="coachTeamPlayerList">
            <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No players.</div>
          </div>
        </div>
      </div>

    </div><!-- end coach tab content scroll -->
  </div><!-- end coach view -->
</div>

`;

export const STUDENT_VIEW_PAGE = `<div id="studentViewPage" class="page" style="justify-content:flex-start;padding-top:10px;overflow-y:hidden;padding-bottom:0;position:relative;">
  <button class="back-btn-top" onclick="goToCoaching()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div id="studentViewHeader" style="text-align:center;margin-bottom:6px;flex-shrink:0;">
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
      <div id="studentViewName" style="font-size:20px;font-weight:800;"></div>
      <div id="studentViewHcpBadge" onclick="toggleStudentHcpDropdown(event)" style="display:none;position:relative;background:#1a4a8a;border:1px solid #2d7abc;border-radius:20px;padding:3px 9px;font-size:11px;font-weight:700;color:#44b8f0;white-space:nowrap;cursor:pointer;user-select:none;">
        <span id="studentViewHcpLabel"></span><span style="opacity:0.5;margin-left:4px;font-size:9px;">▼</span>
        <div id="studentHcpDropdown" style="display:none;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#222222;border:1px solid #333333;border-radius:10px;padding:6px;z-index:100;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.6);">
          <div style="font-size:10px;color:#2e2e2e;text-align:center;padding:2px 0 6px;border-bottom:1px solid #282828;margin-bottom:4px;">Compare stats to</div>
        </div>
      </div>
    </div>
    <div id="studentViewEmail" style="font-size:12px;color:#606060;"></div>
  </div>
  <div style="display:flex;gap:0;width:100%;max-width:360px;margin-bottom:0;border-radius:10px;overflow:hidden;flex-shrink:0;">
    <button onclick="showStudentTab('dashboard')" id="svTabDash" style="flex:1;height:38px;font-size:10px;background:#2d7abc;border-radius:0;border:none;color:#ffffff;font-weight:700;max-width:none;width:auto;padding:0;margin:0;">Dashboard</button>
    <button onclick="showStudentTab('performance')" id="svTabPerf" style="display:none;flex:1;height:38px;font-size:10px;background:#282828;border-radius:0;border:none;color:#606060;font-weight:600;max-width:none;width:auto;padding:0;margin:0;">Analysis</button>
    <button onclick="showStudentTab('rounds')" id="svTabRounds" style="flex:1;height:38px;font-size:10px;background:#282828;border-radius:0;border:none;color:#606060;font-weight:600;max-width:none;width:auto;padding:0;margin:0;">Rounds</button>
    <button onclick="showStudentTab('practice')" id="svTabPractice" style="display:none;flex:1;height:38px;font-size:10px;background:#282828;border-radius:0;border:none;color:#606060;font-weight:600;max-width:none;width:auto;padding:0;margin:0;">Practice</button>
    <button onclick="showStudentTab('notes')" id="svTabNotes" style="flex:1;height:38px;font-size:10px;background:#282828;border-radius:0;border:none;color:#606060;font-weight:600;max-width:none;width:auto;padding:0;margin:0;">Notes</button>
    <button onclick="showStudentTab('misc')" id="svTabMisc" style="flex:1;height:38px;font-size:10px;background:#282828;border-radius:0;border:none;color:#606060;font-weight:600;max-width:none;width:auto;padding:0;margin:0;">Misc</button>
  </div>
  <div id="studentViewScroll" style="flex:1;overflow-y:auto;width:100%;display:flex;flex-direction:column;align-items:center;padding:12px 0 80px;">
    
    <!-- Student Dashboard -->
    <div id="svDashTab" style="width:100%;max-width:360px;">
      <div style="display:flex;gap:4px;justify-content:center;margin-bottom:8px;flex-wrap:nowrap;">
        <select id="svDashFilterType" onchange="applySvDashFilters()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;flex:1;min-width:0;">
          <option value="all">All Rounds</option>
          <option value="Casual">Casual</option>
          <option value="Tournament">Tournament</option>
        </select>
        <select id="svDashFilterTime" onchange="applySvDashFilters()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;flex:1;min-width:0;">
          <option value="all">All Time</option>
          <option value="1">Last Month</option>
          <option value="3">Last 3 Mo</option>
          <option value="6">Last 6 Mo</option>
          <option value="12">Last Year</option>
        </select>
        <select id="svDashHcpFilter" onchange="onSvDashHcpChange(this.value)" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;flex:1;min-width:0;">
          <option value="pro">vs Tour Pro</option>
          <option value="0">vs Scratch</option>
          <option value="5">vs 5 HCP</option>
          <option value="10">vs 10 HCP</option>
          <option value="15">vs 15 HCP</option>
          <option value="20">vs 20 HCP</option>
          <option value="25">vs 25 HCP</option>
          <option value="30">vs 30 HCP</option>
        </select>
      </div>
      <div id="svDashLoading" style="text-align:center;color:#606060;font-size:13px;">Loading stats...</div>
      <div id="svDashContent" style="display:none;"></div>
    </div>
    
    <!-- Student Performance Analysis -->
    <div id="svPerfTab" style="width:100%;max-width:360px;display:none;">
      <div style="display:flex;gap:0;border-radius:9px;overflow:hidden;margin-bottom:10px;">
        <button id="svPerfBtnRounds" onclick="setSvPerfPage('rounds')" style="flex:1;height:36px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:#2d7abc;color:#ffffff;max-width:none;width:auto;padding:0;margin:0;">Past Rounds</button>
        <button id="svPerfBtnCombines" onclick="setSvPerfPage('combines')" style="flex:1;height:36px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:transparent;color:#2e2e2e;max-width:none;width:auto;padding:0;margin:0;">Combines</button>
      </div>
      <!-- Rounds sub-page -->
      <div id="svPerfPageRounds">
        <div id="svPerfSubtitle" style="font-size:12px;color:#606060;text-align:center;margin-bottom:6px;">Loading...</div>
        <div id="svPerfNoRounds" style="display:none;background:#222222;border-radius:12px;padding:20px;text-align:center;color:#2e2e2e;font-size:13px;line-height:1.6;margin-bottom:12px;"></div>
        <div id="svPerfContent" style="display:none;">
          <div id="svPerfPriorityCard" style="border-radius:14px;padding:16px;margin-bottom:14px;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div id="svPerfCardOtt"  onclick="toggleSvPerfTab('ott')"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
            <div id="svPerfCardApp"  onclick="toggleSvPerfTab('app')"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
            <div id="svPerfCardArg"  onclick="toggleSvPerfTab('arg')"  style="border-radius:11px;padding:12px;cursor:pointer;"></div>
            <div id="svPerfCardPutt" onclick="toggleSvPerfTab('putt')" style="border-radius:11px;padding:12px;cursor:pointer;"></div>
          </div>
          <div id="svPerfTab-ott"  style="display:none;"></div>
          <div id="svPerfTab-app"  style="display:none;"></div>
          <div id="svPerfTab-arg"  style="display:none;"></div>
          <div id="svPerfTab-putt" style="display:none;"></div>
        </div>
      </div>
      <!-- Combines sub-page -->
      <div id="svPerfPageCombines" style="display:none;">
        <div id="svPerfCombineLoading" style="background:#222222;border-radius:12px;padding:18px;text-align:center;color:#2e2e2e;font-size:13px;margin-bottom:10px;">Loading combine data…</div>
        <div id="svPerfCombineGrid" style="display:none;grid-template-columns:1fr 1fr;gap:10px;align-items:start;width:100%;">
          <div style="grid-column:1/-1;">
            <div id="svPerfCombinePuttFocus"></div>
            <div id="svPerfCombinePuttOverview"></div>
            <div id="svPerfCombinePuttDetail" style="display:none;"></div>
          </div>
          <div style="grid-column:1/-1;">
            <div id="svPerfCombineWedgeFocus"></div>
            <div id="svPerfCombineWedgeOverview"></div>
            <div id="svPerfCombineWedgeDetail" style="display:none;"></div>
          </div>
        </div>
        <div id="svPerfCombineFooter" style="display:none;text-align:center;font-size:10px;color:#2e2e2e;margin-top:14px;">All stats vs scratch · combines only</div>
      </div>
    </div>

    <!-- Student Rounds -->
    <div id="svRoundsTab" style="width:100%;max-width:360px;display:none;">
      <input id="svRoundSearch" type="text" placeholder="🔍 Search course name..." oninput="filterSvRounds()" style="width:100%;max-width:360px;box-sizing:border-box;margin-bottom:6px;">
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;">
        <select id="svRoundFilterType" onchange="filterSvRounds()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;">
          <option value="all">All Types</option>
          <option value="Casual">Casual</option>
          <option value="Tournament">Tournament</option>
        </select>
        <select id="svRoundFilterHoles" onchange="filterSvRounds()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;">
          <option value="all">All Holes</option>
          <option value="9">9 Holes</option>
          <option value="18">18 Holes</option>
        </select>
        <select id="svRoundSortBy" onchange="filterSvRounds()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 6px;font-size:11px;">
          <option value="date-desc">Date: Newest</option>
          <option value="date-asc">Date: Oldest</option>
          <option value="score-asc">Score: Low→High</option>
          <option value="score-desc">Score: High→Low</option>
        </select>
      </div>
      <div id="svRoundsMsg" style="font-size:13px;color:#606060;min-height:20px;text-align:center;"></div>
      <div id="svRoundsList" style="width:100%;"></div>
    </div>
    
    <!-- (Combines tab merged into Practice tab) -->

    <!-- Student Practice Tab (Combines + Practice Sessions) -->
    <div id="svPracticePlanTab" style="width:100%;max-width:360px;display:none;">
      <!-- Toggle: Combines / Practice Sessions -->
      <div style="display:flex;gap:0;margin-bottom:12px;background:#1e1e1e;border-radius:10px;overflow:hidden;border:1px solid #333333;">
        <button id="svPracticeToggleCombines" onclick="showSvPracticeSubTab('combines')" style="flex:1;height:38px;font-size:13px;font-weight:700;background:#2d7abc;border:none;color:#ffffff;cursor:pointer;">Combines</button>
        <button id="svPracticeTogglePractice" onclick="showSvPracticeSubTab('practice')" style="flex:1;height:38px;font-size:13px;font-weight:700;background:#1e1e1e;border:none;color:#606060;cursor:pointer;">Practice Sessions</button>
      </div>

      <!-- Combines sub-tab (moved from standalone Combines tab) -->
      <div id="svPracticeCombinesContent">
        <button onclick="coachRunCombineForStudent()" style="width:100%;height:46px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;max-width:none;">Run Combine for Student</button>
        <div style="font-size:16px;font-weight:800;text-align:center;margin-bottom:8px;">🏌️ Combine History</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;">
          <select id="svCombFilterType" onchange="loadStudentCombines()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 8px;font-size:12px;">
            <option value="all">All Types</option>
            <option value="Putting">Putting</option>
            <option value="Chipping (Prox)">Chipping Prox</option>
            <option value="Chip Hole Out">Chip Hole Out</option>
            <option value="Wedge">Wedge</option>
          </select>
          <select id="svCombFilterTime" onchange="loadStudentCombines()" style="background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:4px 8px;font-size:12px;">
            <option value="all">All Time</option>
            <option value="1">Last Month</option>
            <option value="3">Last 3 Months</option>
            <option value="6">Last 6 Months</option>
          </select>
        </div>
        <div id="svCombMsg" style="font-size:13px;color:#606060;min-height:20px;text-align:center;"></div>
        <div id="svCombList" style="width:100%;"></div>
      </div>

      <!-- Practice Sessions sub-tab -->
      <div id="svPracticeSubContent" style="display:none;">
        <div id="svPracticePlanMsg" style="font-size:13px;color:#606060;min-height:20px;text-align:center;"></div>
        <div id="svPracticePlanList" style="width:100%;"></div>
      </div>
    </div>

    <!-- Student Misc Tab (Bag + Schedule) -->
    <div id="svMiscTab" style="width:100%;max-width:360px;display:none;">
      <!-- Toggle: Bag / Goals / Schedule -->
      <div style="display:flex;gap:0;margin-bottom:12px;background:#1e1e1e;border-radius:10px;overflow:hidden;border:1px solid #333333;">
        <button id="svMiscToggleBag" onclick="showSvMiscSubTab('bag')" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#2d7abc;border:none;color:#ffffff;cursor:pointer;">Bag</button>
        <button id="svMiscToggleGoals" onclick="showSvMiscSubTab('goals')" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#1e1e1e;border:none;color:#606060;cursor:pointer;">Goals</button>
        <button id="svMiscToggleSchedule" onclick="showSvMiscSubTab('schedule')" style="flex:1;height:38px;font-size:11px;font-weight:700;background:#1e1e1e;border:none;color:#606060;cursor:pointer;">Schedule</button>
      </div>

      <!-- Student Goals sub-tab -->
      <div id="svGoalsSubContent" style="display:none;">
        <div style="background:#222222;border-radius:12px;padding:14px;margin-bottom:10px;">
          <div style="font-size:14px;font-weight:800;text-align:center;margin-bottom:4px;">Handicap Index</div>
          <div id="svHandicapDisplay" style="font-size:28px;font-weight:800;color:#00b87a;text-align:center;padding:4px 0;">--</div>
          <div id="svHandicapInfo" style="font-size:11px;color:#2e2e2e;text-align:center;line-height:1.4;"></div>
        </div>
        <div style="font-size:14px;font-weight:800;text-align:center;margin-bottom:8px;">Student Goals</div>
        <div id="svGoalsList" style="width:100%;"></div>
      </div>

      <!-- Student Bag sub-tab -->
      <div id="svBagSubContent">
        <!-- Add Club Section -->
        <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Add Club</div>
          <select id="svBagClubName" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:8px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;-webkit-appearance:none;appearance:none;">
            <option value="" disabled selected>Select a club...</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div>
              <div style="font-size:11px;color:#606060;margin-bottom:4px;text-align:center;">Avg Carry (yds)</div>
              <input id="svBagCarryInput" type="number" placeholder="e.g. 240" min="0" max="400" style="width:100%;height:40px;font-size:15px;font-weight:700;text-align:center;box-sizing:border-box;">
            </div>
            <div>
              <div style="font-size:11px;color:#606060;margin-bottom:4px;text-align:center;">Avg Total (yds)</div>
              <input id="svBagTotalInput" type="number" placeholder="e.g. 260" min="0" max="450" style="width:100%;height:40px;font-size:15px;font-weight:700;text-align:center;box-sizing:border-box;">
            </div>
          </div>
          <button onclick="addSvBagClub()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">+ Add to Bag</button>
          <div id="svBagAddMsg" style="font-size:12px;min-height:16px;text-align:center;margin-top:6px;color:#00b87a;"></div>
        </div>

        <!-- Club List -->
        <div id="svBagEmptyMsg" style="background:#222222;border-radius:12px;padding:24px;text-align:center;color:#2e2e2e;font-size:13px;line-height:1.7;">
          No clubs in this student's bag yet.
        </div>
        <div id="svBagClubHeaders" style="display:none;grid-template-columns:1fr 80px 80px 36px;gap:6px;padding:0 6px 6px;font-size:11px;color:#2e2e2e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          <div>Club</div>
          <div style="text-align:center;">Carry</div>
          <div style="text-align:center;">Total</div>
          <div></div>
        </div>
        <div id="svBagClubList" style="display:flex;flex-direction:column;gap:6px;"></div>
        <div id="svBagSaveStatus" style="font-size:11px;min-height:14px;text-align:center;margin-top:8px;color:#2e2e2e;"></div>
      </div>

      <!-- Schedule sub-tab -->
      <div id="svScheduleSubContent" style="display:none;">
        <div style="background:#222222;border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Add Upcoming Round</div>
          <input id="svSchedDate" type="date" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:8px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;">
          <input id="svSchedCourse" type="text" placeholder="Course name" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:8px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;">
          <input id="svSchedTournament" type="text" placeholder="Tournament name (optional)" style="width:100%;height:40px;font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:10px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;">
          <button onclick="addSvScheduleEntry()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">+ Add to Schedule</button>
          <div id="svSchedAddMsg" style="font-size:12px;min-height:16px;text-align:center;margin-top:6px;color:#00b87a;"></div>
        </div>
        <div style="font-size:16px;font-weight:800;text-align:center;margin-bottom:8px;">📅 Upcoming Rounds</div>
        <div id="svSchedEmptyMsg" style="background:#222222;border-radius:12px;padding:24px;text-align:center;color:#2e2e2e;font-size:13px;line-height:1.7;">
          No upcoming rounds scheduled.
        </div>
        <div id="svSchedList" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
    </div>

    <!-- Student Notes Tab -->
    <div id="svNotesTab" style="width:100%;max-width:360px;display:none;">

      <!-- Send note form -->
      <div style="background:#1a4a8a;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #2d7abc;">
        <div style="font-size:12px;font-weight:700;color:#44b8f0;margin-bottom:8px;">Send Feedback</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <select id="svNoteType" style="flex:1;height:34px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
            <option value="lesson">Lesson Note</option>
            <option value="general">General Feedback</option>
          </select>
          <input id="svNoteLessonDate" type="date" style="flex:1;height:34px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
        </div>
        <textarea id="svNoteText" placeholder="Write feedback..." rows="3" style="width:100%;box-sizing:border-box;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:13px;padding:8px;resize:vertical;margin-bottom:8px;"></textarea>
        <div style="display:flex;align-items:center;gap:6px;">
          <button onclick="sendSvNote()" id="svNoteSendBtn" style="flex:1;height:38px;font-size:13px;font-weight:700;background:#2d7abc;border:none;border-radius:8px;color:#ffffff;max-width:none;cursor:pointer;">Send</button>
          <button onclick="cancelSvNoteEdit()" id="svNoteCancelBtn" style="display:none;height:38px;font-size:13px;font-weight:700;background:#333333;border:none;border-radius:8px;color:#9a9a9a;max-width:none;cursor:pointer;padding:0 14px;">Cancel</button>
          <div id="svNoteMsg" style="font-size:11px;min-height:14px;flex:1;"></div>
        </div>
      </div>

      <!-- Sticky filters -->
      <div style="position:sticky;top:0;background:#1e1e1e;z-index:5;padding-bottom:8px;margin-bottom:4px;border-bottom:1px solid #282828;">
        <input id="svNotesSearch" oninput="filterSvNotes()" placeholder="Search notes..." style="width:100%;height:38px;font-size:13px;box-sizing:border-box;text-align:center;margin-bottom:6px;">
        <div style="display:flex;gap:6px;">
          <select id="svNotesFilterType" onchange="filterSvNotes()" style="flex:1;height:34px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
            <option value="all">All Types</option>
            <option value="lesson">Lesson Notes</option>
            <option value="general">General Feedback</option>
          </select>
          <select id="svNotesFilterDate" onchange="filterSvNotes()" style="flex:1;height:34px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:8px;font-size:12px;padding:0 8px;">
            <option value="all">All Time</option>
            <option value="1">Last Month</option>
            <option value="3">Last 3 Months</option>
            <option value="6">Last 6 Months</option>
            <option value="12">Last Year</option>
          </select>
        </div>
        <div id="svNotesCount" style="font-size:11px;color:#2e2e2e;text-align:right;min-height:14px;margin-top:4px;"></div>
      </div>

      <!-- Notes list -->
      <div id="svNotesList">
        <div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Loading notes...</div>
      </div>
    </div>

  </div>
</div>
`;

// Pop-ups: asking for coach access, a note when finishing a drill, and a drill's details.
export const MODALS = `  <div id="coachRequestModal" onclick="if(event.target===this)document.getElementById('coachRequestModal').style.display='none'" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:500;align-items:center;justify-content:center;">
    <div style="background:#222222;border-radius:16px;padding:24px 20px;width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div style="font-size:22px;">🏌️</div>
      <div style="font-size:16px;font-weight:800;text-align:center;">Become a Coach</div>
      <div style="font-size:13px;color:#9a9a9a;text-align:center;line-height:1.6;">Coach accounts require admin approval. Tap below to send a request — you'll be notified once it's approved.</div>
      <div id="coachRequestModalMsg" style="font-size:12px;min-height:14px;text-align:center;"></div>
      <button id="coachRequestSendBtn" onclick="submitCoachRequest()" style="width:100%;height:42px;background:#007a52;border:none;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">Send Request</button>
      <button onclick="document.getElementById('coachRequestModal').style.display='none'" style="width:100%;height:36px;background:#333333;border:none;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
    </div>
  </div>
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
</div>
<div id="drillInfoModal" onclick="if(event.target===this)this.style.display='none'" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:200;align-items:center;justify-content:center;">
  <div style="background:#222222;border-radius:16px;padding:20px;width:340px;max-width:92vw;max-height:86vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
    <div id="drillInfoBody"></div>
    <button onclick="document.getElementById('drillInfoModal').style.display='none'" style="width:100%;height:40px;background:#333333;border-radius:10px;font-size:13px;max-width:none;">Close</button>
  </div>
</div>`;
