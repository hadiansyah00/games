import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_CONFIG,
  createInitialScoreState,
  getBasePointsForType,
  registerScoreHit,
  registerShyObjectHit,
  registerObstacleBoing,
  setScoreAgeMode,
  tickComboTimer,
  advanceScoreTarget,
  getStageCelebrationMeta,
  calculateTransitionEnvelope,
  getStageSpeedMultiplier,
  getStageScaleMultiplier,
  getShyObjectVisibleDuration,
  shouldHavePlayfulObstacle,
  MAX_COMBO_MULTIPLIER,
} from './score_rules.ts';

test('getBasePointsForType returns higher points for stars than basic toys', () => {
  assert.equal(getBasePointsForType('star'), 30);
  assert.equal(getBasePointsForType('balloon'), 20);
  assert.equal(getBasePointsForType('kitten'), 15);
  assert.equal(getBasePointsForType('bubble'), 10);
});

test('registerScoreHit increments score, builds combo, and updates bestScore', () => {
  const state = createInitialScoreState(50, 200, 'bayi');

  // First hit starts at combo 1 (since comboTimer is 0)
  const hit1 = registerScoreHit(state, 'star', false);
  assert.equal(hit1.pointsAwarded, 30);
  assert.equal(hit1.nextState.score, 30);
  assert.equal(hit1.nextState.combo, 1);
  assert.equal(hit1.nextState.bestScore, 50);

  // Second hit within combo window increases combo to 2
  const hit2 = registerScoreHit(hit1.nextState, 'star', false);
  assert.equal(hit2.nextState.combo, 2);
  assert.equal(hit2.pointsAwarded, 60);
  assert.equal(hit2.nextState.score, 90);
  assert.equal(hit2.nextState.bestScore, 90);
});

test('combo multiplier caps at MAX_COMBO_MULTIPLIER and resets when timer expires', () => {
  let state = createInitialScoreState(0, 1000, 'bayi');
  for (let i = 0; i < 8; i++) {
    state = registerScoreHit(state, 'kitten', true).nextState;
  }
  assert.equal(state.combo, MAX_COMBO_MULTIPLIER);

  // Tick timer past window
  const decayed = tickComboTimer(state, 5.0);
  assert.equal(decayed.combo, 1);
  assert.equal(decayed.comboTimer, 0);
});

test('milestoneReached triggers when crossing targetScore and advanceScoreTarget increments stage', () => {
  const state = createInitialScoreState(0, 50, 'balita');
  assert.equal(state.stage, 1);

  const res1 = registerScoreHit(state, 'star', false); // +30 -> 30
  assert.equal(res1.milestoneReached, false);

  const res2 = registerScoreHit(res1.nextState, 'star', false); // +60 -> 90 >= 50
  assert.equal(res2.milestoneReached, true);
  assert.equal(res2.nextState.celebrationTriggered, true);

  const nextStage = advanceScoreTarget({ ...res2.nextState, score: 485, targetScore: 200 });
  assert.equal(nextStage.celebrationTriggered, false);
  assert.equal(nextStage.stage, 2);
  assert.ok(nextStage.targetScore > 485);
});

test('Stage speed and scale multipliers match PRD for Mode Balita and Mode Bayi', () => {
  // Mode Balita speed multipliers: 1.0, 1.15, 1.3, 1.45
  assert.equal(getStageSpeedMultiplier(1, 'balita'), 1.0);
  assert.equal(getStageSpeedMultiplier(2, 'balita'), 1.15);
  assert.equal(getStageSpeedMultiplier(3, 'balita'), 1.3);
  assert.equal(getStageSpeedMultiplier(4, 'balita'), 1.45);
  assert.equal(getStageSpeedMultiplier(6, 'balita'), 1.45);

  // Mode Balita scale multipliers: 100%, 95%, 90%, 85% (never below 70%)
  assert.equal(getStageScaleMultiplier(1, 'balita'), 1.0);
  assert.equal(getStageScaleMultiplier(2, 'balita'), 0.95);
  assert.equal(getStageScaleMultiplier(3, 'balita'), 0.90);
  assert.equal(getStageScaleMultiplier(4, 'balita'), 0.85);
  assert.ok(getStageScaleMultiplier(10, 'balita') >= CHALLENGE_CONFIG.MIN_OBJECT_SCALE);

  // Mode Bayi has constant slow speed and 100% scale across all stages
  assert.equal(getStageSpeedMultiplier(1, 'bayi'), CHALLENGE_CONFIG.BAYI_SPEED_MULTIPLIER);
  assert.equal(getStageSpeedMultiplier(4, 'bayi'), CHALLENGE_CONFIG.BAYI_SPEED_MULTIPLIER);
  assert.equal(getStageScaleMultiplier(4, 'bayi'), 1.0);
});

test('Shy object duration and +30 bonus work without any negative effects', () => {
  assert.equal(getShyObjectVisibleDuration(1), 3.0);
  assert.equal(getShyObjectVisibleDuration(2), 3.0);
  assert.equal(getShyObjectVisibleDuration(3), 2.5);
  assert.equal(getShyObjectVisibleDuration(4), 2.5);

  const initial = createInitialScoreState(0, 200, 'balita');
  const hit = registerShyObjectHit(initial);
  assert.equal(hit.pointsAwarded, 30);
  assert.equal(hit.nextState.score, 30);
  assert.equal(hit.nextState.shyObjectsCaught, 1);
});

test('Playful obstacle starts in Stage 2 (Mode Balita) and pauses combo for 1s without losing points or combo', () => {
  assert.equal(shouldHavePlayfulObstacle(1, 'balita', 0), false);
  assert.equal(shouldHavePlayfulObstacle(2, 'balita', 0), true);
  assert.equal(shouldHavePlayfulObstacle(2, 'balita', 1), false); // max 1 on screen
  assert.equal(shouldHavePlayfulObstacle(3, 'bayi', 0), false);   // never in Mode Bayi

  let state = createInitialScoreState(0, 500, 'balita');
  state = registerScoreHit(state, 'balloon', false).nextState; // combo 1, score 20
  state = registerScoreHit(state, 'balloon', false).nextState; // combo 2, score 60

  const beforeScore = state.score;
  const beforeCombo = state.combo;
  const beforeTimer = state.comboTimer;

  // Hit playful obstacle -> boing!
  const boinged = registerObstacleBoing(state);
  assert.equal(boinged.score, beforeScore); // no point deduction!
  assert.equal(boinged.combo, beforeCombo); // combo does not drop!
  assert.equal(boinged.comboPauseTimer, 1.0);

  // Tick 0.6s -> still paused, comboTimer frozen
  const midPause = tickComboTimer(boinged, 0.6);
  assert.ok(Math.abs(midPause.comboPauseTimer - 0.4) < 1e-6);
  assert.equal(midPause.comboTimer, beforeTimer);
  assert.equal(midPause.combo, beforeCombo);

  // Hitting a toy during the 1s pause awards points at current combo without increasing combo
  const hitDuringPause = registerScoreHit(midPause, 'balloon', false);
  assert.equal(hitDuringPause.nextState.combo, beforeCombo);
  assert.ok(hitDuringPause.nextState.score > beforeScore);
});

test('Mini-mission awards +60 points and +1 golden star on 3 matches, and silently rotates at 45s', () => {
  let state = createInitialScoreState(0, 1000, 'balita');
  assert.ok(state.activeMission);
  assert.equal(state.activeMission?.targetType, 'star');
  assert.equal(state.activeMission?.targetCount, 3);

  // Hit 1 & 2 stars
  state = registerScoreHit(state, 'star', false).nextState;
  assert.equal(state.activeMission?.currentCount, 1);
  state = registerScoreHit(state, 'star', false).nextState;
  assert.equal(state.activeMission?.currentCount, 2);

  // 3rd star completes mission -> +60 bonus + 1 golden star + new mission!
  const thirdHit = registerScoreHit(state, 'star', false);
  assert.equal(thirdHit.missionCompleted, true);
  assert.equal(thirdHit.missionBonusAwarded, 60);
  assert.equal(thirdHit.nextState.goldenStarsEarned, 1);
  assert.equal(thirdHit.nextState.activeMission?.id, 2);
  assert.equal(thirdHit.nextState.activeMission?.currentCount, 0);

  // Tick 45 seconds without finishing -> silently rotates to mission 3 with zero penalty
  const scoreBeforeTimeout = thirdHit.nextState.score;
  const rotated = tickComboTimer(thirdHit.nextState, 45.5);
  assert.equal(rotated.score, scoreBeforeTimeout);
  assert.equal(rotated.activeMission?.id, 3);
  assert.equal(rotated.activeMission?.elapsedSeconds, 0);

  // Switching to Mode Bayi disables activeMission
  const bayiState = setScoreAgeMode(rotated, 'bayi');
  assert.equal(bayiState.activeMission, null);
});

test('getStageCelebrationMeta and calculateTransitionEnvelope work across phases', () => {
  const s1 = getStageCelebrationMeta(1);
  const s2 = getStageCelebrationMeta(2);
  assert.equal(s1.themeId, 'meadow');
  assert.equal(s2.themeId, 'ocean');

  const hold = calculateTransitionEnvelope(700, 1400);
  assert.equal(hold.phase, 'hold');
  assert.equal(hold.opacity, 1);
  assert.equal(hold.sceneSwapped, true);
});
