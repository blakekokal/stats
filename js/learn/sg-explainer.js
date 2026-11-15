export function renderSGExplainer() {
  var el = document.getElementById('sgExplainerGraphic');
  if (el.getAttribute('data-rendered')) return;
  el.setAttribute('data-rendered', '1');
  
  el.innerHTML = ''
    // Title
    + '<div style="padding:20px 20px 0;text-align:center;">'
    + '<div style="font-size:20px;font-weight:900;color:#ffffff;margin-bottom:4px;">Strokes Gained Explained</div>'
    + '<div style="font-size:12px;color:#606060;line-height:1.5;">Strokes Gained measures how each shot compares to the expected performance from that position.</div>'
    + '</div>'

    // ── HANDICAP SECTION ──
    + '<div style="padding:16px 16px 0;">'
    + '<div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:6px;">📊 Why Handicap Matters</div>'
    + '<div style="font-size:12px;color:#9a9a9a;line-height:1.6;margin-bottom:10px;">Expected strokes change based on skill level. A tour pro and a 10-handicap face the same hole very differently:</div>'
    + '</div>'
    
    + '<div style="padding:0 16px;display:flex;gap:6px;margin-bottom:14px;">'
    + '<div style="flex:1;background:#1e1e1e;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">'
    + '<div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Tour Pro</div>'
    + '<div style="font-size:11px;color:#9a9a9a;margin-top:4px;">400 yd Par 4</div>'
    + '<div style="font-size:26px;font-weight:900;color:#44b8f0;margin-top:4px;">3.99</div>'
    + '<div style="font-size:10px;color:#2e2e2e;">expected strokes</div></div>'
    + '<div style="flex:1;background:#1e1e1e;border:1px solid #333333;border-radius:10px;padding:12px;text-align:center;">'
    + '<div style="font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:1px;font-weight:700;">10 Handicap</div>'
    + '<div style="font-size:11px;color:#9a9a9a;margin-top:4px;">400 yd Par 4</div>'
    + '<div style="font-size:26px;font-weight:900;color:#f0c830;margin-top:4px;">4.73</div>'
    + '<div style="font-size:10px;color:#2e2e2e;">expected strokes</div></div>'
    + '</div>'
    
    + '<div style="padding:0 16px 14px;">'
    + '<div style="font-size:11px;color:#606060;line-height:1.6;background:#1e1e1e;border-radius:8px;padding:10px 12px;">Your handicap setting determines what "expected" means for <em>you</em>. SG is always measured against players of the same skill level — so a scratch golfer and a 15 handicap can both gain or lose strokes relative to their own benchmark.</div>'
    + '</div>'

    // ── EXAMPLE 1: TWO PLAYERS ──
    + '<div style="padding:0 16px;">'
    + '<div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:4px;">🏌️ Example 1: Comparing Two Drives</div>'
    + '<div style="font-size:12px;color:#9a9a9a;line-height:1.5;margin-bottom:10px;">Both players are <span style="color:#f0c830;font-weight:700;">10 handicaps</span> on a <span style="color:#ffffff;font-weight:700;">400-yard Par 4</span>.</div>'
    + '</div>'
    
    // Image - Two players comparison
    + '<div style="padding:0 12px;">'
    + '<img src="assets/sg-explainer/comparing-drives.jpg" style="width:100%;height:auto;border-radius:12px;" alt="Comparing Two Drives"/>'
    + '</div>'
    
    // Player comparison cards
    + '<div style="padding:8px 16px 0;display:flex;gap:6px;">'
    + '<div style="flex:1;background:#1a4a8a;border:1px solid #2d7abc;border-radius:10px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:#44b8f0;text-transform:uppercase;letter-spacing:1px;">Player 1</div>'
    + '<div style="font-size:11px;color:#9a9a9a;margin-top:4px;">250 yd drive → 150 out</div>'
    + '<div style="font-size:10px;color:#2e2e2e;margin-top:2px;">Expected from 150 yds:</div>'
    + '<div style="font-size:18px;font-weight:900;color:#44b8f0;">3.18 <span style="font-size:10px;color:#2e2e2e;">shots</span></div>'
    + '</div>'
    + '<div style="flex:1;background:#00402c;border:1px solid #007a52;border-radius:10px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:#00b87a;text-transform:uppercase;letter-spacing:1px;">Player 2</div>'
    + '<div style="font-size:11px;color:#9a9a9a;margin-top:4px;">300 yd drive → 100 out</div>'
    + '<div style="font-size:10px;color:#2e2e2e;margin-top:2px;">Expected from 100 yds:</div>'
    + '<div style="font-size:18px;font-weight:900;color:#00b87a;">2.82 <span style="font-size:10px;color:#2e2e2e;">shots</span></div>'
    + '</div></div>'
    
    // The math
    + '<div style="padding:10px 16px 14px;">'
    + '<div style="background:#1e1e1e;border:1px solid #333333;border-radius:10px;padding:12px;">'
    + '<div style="font-size:11px;color:#606060;margin-bottom:6px;">Player 2\'s extra 50 yards is worth:</div>'
    + '<div style="font-family:monospace;font-size:12px;color:#9a9a9a;line-height:2;">'
    + '<span style="color:#606060;">P1 expected remaining:</span> <span style="color:#44b8f0;">3.18</span><br>'
    + '<span style="color:#606060;">P2 expected remaining:</span> <span style="color:#00b87a;">2.82</span><br>'
    + '<span style="color:#606060;">Difference:</span> 3.18 − 2.82 = <span style="color:#00b87a;font-weight:700;">+0.36 strokes gained</span>'
    + '</div>'
    + '<div style="font-size:11px;color:#606060;margin-top:8px;line-height:1.5;">Player 2 <span style="color:#00b87a;font-weight:600;">gained 0.36 strokes</span> over Player 1 off the tee. That extra 50 yards made a measurable difference.</div>'
    + '</div></div>'

    // ── EXAMPLE 2: FULL HOLE ──
    + '<div style="padding:0 16px;">'
    + '<div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:4px;">⛳ Example 2: Full Hole Breakdown</div>'
    + '<div style="font-size:12px;color:#9a9a9a;line-height:1.5;margin-bottom:10px;"><span style="color:#f0c830;font-weight:700;">10-handicap</span> player on a <span style="color:#ffffff;font-weight:700;">400-yard Par 4</span>. Expected strokes from the tee: <span style="color:#00b87a;font-weight:700;">4.73</span></div>'
    + '</div>'
    
    // Image - Full hole with 3 shots
    + '<div style="padding:0 12px;">'
    + '<img src="assets/sg-explainer/full-hole.jpg" style="width:100%;height:auto;border-radius:12px;" alt="Full Hole Breakdown"/>'
    + '</div>'
    
    // Shot-by-shot breakdown
    + '<div style="padding:8px 16px 0;">'
    + '<div style="font-size:12px;font-weight:800;color:#ffffff;margin-bottom:8px;">Shot-by-Shot SG Breakdown</div>'
    + '</div>'
    
    // Shot 1 card
    + '<div style="padding:0 16px 6px;">'
    + '<div style="background:#1e1e1e;border-left:3px solid #44b8f0;border-radius:8px;padding:10px 12px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<div style="font-size:12px;font-weight:800;color:#44b8f0;">① Tee Shot — 250 yd Drive</div>'
    + '<div style="font-size:14px;font-weight:900;color:#d4706e;">−0.18</div></div>'
    + '<div style="font-family:monospace;font-size:11px;color:#606060;line-height:1.8;">'
    + 'Expected from tee (400 yds): <span style="color:#00b87a;">4.73</span><br>'
    + 'Shot taken: <span style="color:#ffffff;">1</span><br>'
    + 'Expected from 150 yds (FW): <span style="color:#00b87a;">3.55</span><br>'
    + 'SG = 4.73 − 1 − 3.55 = <span style="color:#d4706e;font-weight:700;">−0.18</span>'
    + '</div>'
    + '<div style="font-size:10px;color:#606060;margin-top:4px;">A decent drive but slightly below average for a 10 HCP.</div>'
    + '</div></div>'
    
    // Shot 2 card
    + '<div style="padding:0 16px 6px;">'
    + '<div style="background:#1e1e1e;border-left:3px solid #00a06d;border-radius:8px;padding:10px 12px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<div style="font-size:12px;font-weight:800;color:#00b87a;">② Approach — 150 yds to 10 ft</div>'
    + '<div style="font-size:14px;font-weight:900;color:#00b87a;">+0.70</div></div>'
    + '<div style="font-family:monospace;font-size:11px;color:#606060;line-height:1.8;">'
    + 'Expected from 150 yds (FW): <span style="color:#00b87a;">3.55</span><br>'
    + 'Shot taken: <span style="color:#ffffff;">1</span><br>'
    + 'Expected from 10 ft (putt): <span style="color:#00b87a;">1.85</span><br>'
    + 'SG = 3.55 − 1 − 1.85 = <span style="color:#00b87a;font-weight:700;">+0.70</span>'
    + '</div>'
    + '<div style="font-size:10px;color:#606060;margin-top:4px;">Great approach! Hitting to 10 ft from 150 yds gains significant strokes.</div>'
    + '</div></div>'
    
    // Shot 3 card
    + '<div style="padding:0 16px 6px;">'
    + '<div style="background:#1e1e1e;border-left:3px solid #44b8f0;border-radius:8px;padding:10px 12px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<div style="font-size:12px;font-weight:800;color:#44b8f0;">③ Putt — 10 ft, Holed!</div>'
    + '<div style="font-size:14px;font-weight:900;color:#00b87a;">+0.85</div></div>'
    + '<div style="font-family:monospace;font-size:11px;color:#606060;line-height:1.8;">'
    + 'Expected from 10 ft: <span style="color:#00b87a;">1.85</span><br>'
    + 'Putts taken: <span style="color:#ffffff;">1</span><br>'
    + 'SG = 1.85 − 1 = <span style="color:#00b87a;font-weight:700;">+0.85</span>'
    + '</div>'
    + '<div style="font-size:10px;color:#606060;margin-top:4px;">Making a 10-footer gains almost a full stroke — only ~33% of 10 HCPs make this.</div>'
    + '</div></div>'
    
    // Total summary
    + '<div style="padding:4px 16px 14px;">'
    + '<div style="background:linear-gradient(135deg,#00402c,#1e1e1e);border:1px solid #007a52;border-radius:12px;padding:14px;text-align:center;">'
    + '<div style="font-size:11px;color:#606060;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Hole Total</div>'
    + '<div style="font-size:11px;color:#9a9a9a;margin-bottom:6px;">Scored a <span style="color:#ffffff;font-weight:700;">Birdie 3</span> on a Par 4 (expected: 4.73)</div>'
    + '<div style="display:flex;justify-content:center;gap:12px;margin-bottom:8px;">'
    + '<div><div style="font-size:10px;color:#44b8f0;">OTT</div><div style="font-size:14px;font-weight:800;color:#d4706e;">−0.18</div></div>'
    + '<div><div style="font-size:10px;color:#00b87a;">APP</div><div style="font-size:14px;font-weight:800;color:#00b87a;">+0.70</div></div>'
    + '<div><div style="font-size:10px;color:#44b8f0;">PUTT</div><div style="font-size:14px;font-weight:800;color:#00b87a;">+0.85</div></div>'
    + '</div>'
    + '<div style="border-top:1px solid #333333;padding-top:8px;">'
    + '<div style="font-size:22px;font-weight:900;color:#00b87a;">+1.37 SG</div>'
    + '<div style="font-size:10px;color:#606060;margin-top:2px;">Total strokes gained on this hole</div>'
    + '</div></div></div>'

    // ── CATEGORIES ──
    + '<div style="padding:0 16px 4px;">'
    + '<div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:8px;">The 4 Categories</div>'
    + '</div>'
    + '<div style="padding:0 16px 10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
    + sgCatCard('SG: Off the Tee', 'Tee shots on Par 4s & 5s', '#44b8f0')
    + sgCatCard('SG: Approach', 'Shots into the green', '#00a06d')
    + sgCatCard('SG: Around Green', 'Chips, pitches & bunker shots', '#f0c830')
    + sgCatCard('SG: Putting', 'Everything on the green', '#44b8f0')
    + '</div>'
    
    // Positive vs Negative
    + '<div style="padding:4px 16px 20px;">'
    + '<div style="display:flex;gap:6px;">'
    + '<div style="flex:1;background:#00402c;border:1px solid #00402c;border-radius:10px;padding:10px;text-align:center;">'
    + '<div style="font-size:18px;font-weight:900;color:#00b87a;">+SG</div>'
    + '<div style="font-size:10px;color:#00b87a;margin-top:2px;">Better than expected</div></div>'
    + '<div style="flex:1;background:#2a1a1a;border:1px solid #e06060;border-radius:10px;padding:10px;text-align:center;">'
    + '<div style="font-size:18px;font-weight:900;color:#d4706e;">−SG</div>'
    + '<div style="font-size:10px;color:#d4706e;margin-top:2px;">Worse than expected</div></div>'
    + '</div></div>'
    + '</div>';
}

function sgCard(title, val, desc, color) {
  return '<div style="background:#1e1e1e;border-left:3px solid '+color+';border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">'
    + '<div><div style="font-size:12px;font-weight:700;color:#ffffff;">'+title+'</div>'
    + '<div style="font-size:10px;color:#2e2e2e;margin-top:1px;">'+desc+'</div></div>'
    + '<div style="font-size:18px;font-weight:900;color:'+color+';font-family:monospace;">'+val+'</div></div>';
}

function sgCatCard(title, desc, color) {
  return '<div style="background:#1e1e1e;border-radius:10px;padding:10px;border-top:3px solid '+color+';">'
    + '<div style="font-size:11px;font-weight:800;color:'+color+';margin-bottom:2px;">'+title+'</div>'
    + '<div style="font-size:10px;color:#606060;line-height:1.3;">'+desc+'</div></div>';
}