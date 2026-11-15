import { S } from './core.js';
import { sgFairwayData, sgPuttingData, sgRecoveryData, sgRoughData, sgSandData, sgTeeData } from './sg-tables.js';

// The handicap level to compare to when none is given: the one on the profile.
function getSelectedHandicap(){
  const m = S.currentUser && S.currentUser.user_metadata;
  return (m && m.hcp_preference) || 'pro';
}

export function getExpectedStrokes(distance, lie, handicapOverride){
  const hcp = handicapOverride || getSelectedHandicap();
  let dataSet;
  if(lie === 'TEE') dataSet = sgTeeData;
  else if(lie === 'FAIRWAY' || lie === 'GREEN') dataSet = sgFairwayData;
  else if(lie === 'ROUGH' || lie === 'LEFT ROUGH' || lie === 'RIGHT ROUGH' || 
          lie === 'MISS LEFT' || lie === 'MISS RIGHT' || lie === 'MISS SHORT' || lie === 'MISS LONG') dataSet = sgRoughData;
  else if(lie === 'SAND' || lie === 'GS BUNKER' || lie === 'FW BUNKER') dataSet = sgSandData;
  else if(lie === 'RECOVERY') dataSet = sgRecoveryData;
  else dataSet = sgRoughData; // Default to rough
  
  const table = dataSet[hcp] || dataSet['pro'];
  
  if(table[distance]) return table[distance];
  
  // Interpolate
  const distances = Object.keys(table).map(Number).sort((a,b)=>a-b);
  if(distance < distances[0]) return table[distances[0]];
  if(distance > distances[distances.length-1]) return table[distances[distances.length-1]];
  
  for(let i=0; i<distances.length-1; i++){
    if(distance > distances[i] && distance < distances[i+1]){
      const d1 = distances[i], d2 = distances[i+1];
      const e1 = table[d1], e2 = table[d2];
      return e1 + (e2-e1) * (distance-d1) / (d2-d1);
    }
  }
  return 3; // Fallback
}

export function getExpectedPutts(distance, handicapOverride){
  if(distance <= 0) return 0;
  const hcp = handicapOverride || getSelectedHandicap();
  const table = sgPuttingData[hcp] || sgPuttingData['pro'];
  
  if(table[distance]) return table[distance];
  // Interpolate for distances not in table
  const distances = Object.keys(table).map(Number).sort((a,b)=>a-b);
  if(distance < distances[0]) return table[distances[0]];
  if(distance > distances[distances.length-1]){
    // Extrapolate beyond max
    const maxD = distances[distances.length-1];
    return table[maxD] + (distance - maxD) * 0.004;
  }
  for(let i=0; i<distances.length-1; i++){
    if(distance > distances[i] && distance < distances[i+1]){
      const d1 = distances[i], d2 = distances[i+1];
      const e1 = table[d1], e2 = table[d2];
      return e1 + (e2-e1) * (distance-d1) / (d2-d1);
    }
  }
  return 2;
}