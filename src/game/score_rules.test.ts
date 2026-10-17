import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialScoreState,
  getBasePointsForType,
  registerScoreHit,
  tickComboTimer,
  advanceScoreTarget,
  MAX_COMBO_MULTIPLIER,
} from './score_rules.ts';

test('getBasePointsForType returns higher points for stars than basic toys', () => {
  assert.equal(getBasePointsForType('star'), 30);
  assert.equal(getBasePointsForType('balloon'), 20);
  assert.equal(getBasePointsForType('kitten'), 15);
  assert.equal(getBasePointsForType('bubble'), 10);
});

test('registerScoreHit increments score, builds combo, and updates bestScore', () => {
  let state = createInitialScoreState(50, 200);

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
  let state = createInitialScoreState(0, 1000);
  for (let i = 0; i < 8; i++) {
    state = registerScoreHit(state, 'kitten', true).nextState;
  }
  assert.equal(state.combo, MAX_COMBO_MULTIPLIER);

  // Tick timer past window
  const decayed = tickComboTimer(state, 5.0);
  assert.equal(decayed.combo, 1);
  assert.equal(decayed.comboTimer, 0);
});

test('milestoneReached triggers when crossing targetScore and advanceScoreTarget raises goal', () => {
  let state = createInitialScoreState(0, 50);
  const res1 = registerScoreHit(state, 'star', false); // +30 -> 30
  assert.equal(res1.milestoneReached, false);

  const res2 = registerScoreHit(res1.nextState, 'star', false); // +60 -> 90 >= 50
  assert.equal(res2.milestoneReached, true);
  assert.equal(res2.nextState.celebrationTriggered, true);

  const nextStage = advanceScoreTarget(res2.nextState);
  assert.equal(nextStage.celebrationTriggered, false);
  assert.ok(nextStage.targetScore > 50);
});
