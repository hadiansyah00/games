/**
 * Pure scoring, combo multiplier, and milestone rules for Score Mode.
 * Decoupled from Three.js and React for deterministic unit testing.
 */

export type GamePlayMode = 'sensory' | 'score';

export interface ScoreState {
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  comboTimer: number; // seconds remaining before combo resets
  starsCollected: number;
  targetScore: number;
  level: number;
  celebrationTriggered: boolean;
}

export const COMBO_WINDOW_SECONDS = 3.2;
export const MAX_COMBO_MULTIPLIER = 5;

export function createInitialScoreState(bestScore = 0, targetScore = 200): ScoreState {
  return {
    score: 0,
    bestScore: Math.max(0, bestScore),
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    starsCollected: 0,
    targetScore,
    level: 1,
    celebrationTriggered: false,
  };
}

/**
 * Base point values by toy/entity type.
 */
export function getBasePointsForType(type: string): number {
  switch (type) {
    case 'star':
    case 'contrast_star':
      return 30;
    case 'balloon':
    case 'sun':
      return 20;
    case 'kitten':
    case 'bunny':
    case 'bear':
    case 'chick':
    case 'puppy':
      return 15;
    default:
      return 10;
  }
}

/**
 * Registers a hit/tap/swipe collection in Score Mode and updates combo + milestones.
 */
export function registerScoreHit(
  state: ScoreState,
  entityType: string,
  isSwipeBonus = false
): { nextState: ScoreState; pointsAwarded: number; milestoneReached: boolean } {
  const basePoints = getBasePointsForType(entityType);
  const swipeBonus = isSwipeBonus ? 5 : 0;
  const activeCombo = state.comboTimer > 0 ? Math.min(MAX_COMBO_MULTIPLIER, state.combo + 1) : 1;
  const pointsAwarded = (basePoints + swipeBonus) * activeCombo;

  const newScore = state.score + pointsAwarded;
  const newBest = Math.max(state.bestScore, newScore);
  const newMaxCombo = Math.max(state.maxCombo, activeCombo);
  const newStars = state.starsCollected + 1;

  // Check if player crossed target score milestone
  const milestoneReached = !state.celebrationTriggered && newScore >= state.targetScore;
  const newLevel = Math.floor(newScore / 200) + 1;

  const nextState: ScoreState = {
    score: newScore,
    bestScore: newBest,
    combo: activeCombo,
    maxCombo: newMaxCombo,
    comboTimer: COMBO_WINDOW_SECONDS,
    starsCollected: newStars,
    targetScore: state.targetScore,
    level: newLevel,
    celebrationTriggered: state.celebrationTriggered || milestoneReached,
  };

  return {
    nextState,
    pointsAwarded,
    milestoneReached,
  };
}

/**
 * Advances combo decay timer by dt seconds.
 */
export function tickComboTimer(state: ScoreState, dt: number): ScoreState {
  if (state.comboTimer <= 0) {
    if (state.combo !== 1) {
      return { ...state, combo: 1, comboTimer: 0 };
    }
    return state;
  }

  const remaining = Math.max(0, state.comboTimer - Math.max(0, dt));
  return {
    ...state,
    comboTimer: remaining,
    combo: remaining > 0 ? state.combo : 1,
  };
}

/**
 * Starts the next target stage without losing current score.
 */
export function advanceScoreTarget(state: ScoreState): ScoreState {
  return {
    ...state,
    targetScore: state.targetScore + 250,
    celebrationTriggered: false,
  };
}
