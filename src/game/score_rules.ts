/**
 * Pure scoring, combo multiplier, milestone rules, and stage transition math
 * for Score Mode. Decoupled from Three.js and React for deterministic unit testing.
 */

export type GamePlayMode = 'sensory' | 'score';

export type TransitionPhase = 'idle' | 'fade-out' | 'hold' | 'fade-in';

export interface StageCelebrationMeta {
  stage: number;
  title: string;
  subtitle: string;
  themeId: string;
  accentHex: string;
  curtainBg: string;
}

export interface TransitionEnvelope {
  phase: TransitionPhase;
  opacity: number;
  starScale: number;
  sceneSwapped: boolean;
  progress: number;
}

export interface ScoreState {
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  comboTimer: number; // seconds remaining before combo resets
  starsCollected: number;
  targetScore: number;
  stage: number;
  level: number;
  celebrationTriggered: boolean;
}

export const COMBO_WINDOW_SECONDS = 3.2;
export const MAX_COMBO_MULTIPLIER = 5;
export const DEFAULT_TRANSITION_DURATION_MS = 1400;

const STAGE_CATALOG: ReadonlyArray<{
  title: string;
  subtitle: string;
  themeId: string;
  accentHex: string;
  curtainBg: string;
}> = [
  {
    title: 'Taman Pelangi Ceria',
    subtitle: 'Kumpulkan bintang emas bersama teman hewan!',
    themeId: 'meadow',
    accentHex: '#FACC15',
    curtainBg: 'radial-gradient(circle, rgba(254,240,138,0.98) 0%, rgba(245,158,11,0.98) 100%)',
  },
  {
    title: 'Samudra Bintang Berkilau',
    subtitle: 'Gelembung lembut & bintang laut yang riang!',
    themeId: 'ocean',
    accentHex: '#38BDF8',
    curtainBg: 'radial-gradient(circle, rgba(224,242,254,0.98) 0%, rgba(14,165,233,0.98) 100%)',
  },
  {
    title: 'Langit Malam Impian',
    subtitle: 'Bintang emas bersinar di langit malam yang tenang!',
    themeId: 'night',
    accentHex: '#C084FC',
    curtainBg: 'radial-gradient(circle, rgba(196,181,253,0.98) 0%, rgba(49,46,129,0.98) 100%)',
  },
  {
    title: 'Festival Warna Kontras',
    subtitle: 'Pesta bintang warna-warni penuh keceriaan!',
    themeId: 'contrast',
    accentHex: '#FB7185',
    curtainBg: 'radial-gradient(circle, rgba(254,205,211,0.98) 0%, rgba(225,29,72,0.98) 100%)',
  },
];

export function createInitialScoreState(bestScore = 0, targetScore = 200): ScoreState {
  return {
    score: 0,
    bestScore: Math.max(0, bestScore),
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    starsCollected: 0,
    targetScore,
    stage: 1,
    level: 1,
    celebrationTriggered: false,
  };
}

/**
 * Returns metadata (title, subtitle, theme, colors) for a given score stage.
 */
export function getStageCelebrationMeta(stage: number): StageCelebrationMeta {
  const safeStage = Math.max(1, Math.floor(stage));
  const entry = STAGE_CATALOG[(safeStage - 1) % STAGE_CATALOG.length];
  return {
    stage: safeStage,
    title: entry.title,
    subtitle: entry.subtitle,
    themeId: entry.themeId,
    accentHex: entry.accentHex,
    curtainBg: entry.curtainBg,
  };
}

/**
 * Smoothstep Hermite interpolation between 0 and 1.
 */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Computes the cheerful fade-out / hold / fade-in transition envelope for a given elapsed time.
 */
export function calculateTransitionEnvelope(
  elapsedMs: number,
  totalDurationMs = DEFAULT_TRANSITION_DURATION_MS
): TransitionEnvelope {
  const duration = Math.max(100, totalDurationMs);
  if (elapsedMs < 0 || elapsedMs >= duration) {
    return {
      phase: 'idle',
      opacity: 0,
      starScale: 0.7,
      sceneSwapped: elapsedMs >= duration,
      progress: elapsedMs >= duration ? 1 : 0,
    };
  }

  const progress = elapsedMs / duration;

  // 0.00 -> 0.38: Cheerful Fade-Out into stage curtain
  if (progress < 0.38) {
    const localT = smoothstep(progress / 0.38);
    return {
      phase: 'fade-out',
      opacity: localT,
      starScale: 0.65 + localT * 0.45,
      sceneSwapped: false,
      progress,
    };
  }

  // 0.38 -> 0.64: Hold peak curtain while 3D scene swaps stage & spawns stars
  if (progress < 0.64) {
    const pulse = Math.sin(((progress - 0.38) / 0.26) * Math.PI) * 0.08;
    return {
      phase: 'hold',
      opacity: 1,
      starScale: 1.1 + pulse,
      sceneSwapped: progress >= 0.45,
      progress,
    };
  }

  // 0.64 -> 1.00: Smooth Fade-In revealing the new 3D stage
  const fadeOutT = smoothstep((progress - 0.64) / 0.36);
  return {
    phase: 'fade-in',
    opacity: 1 - fadeOutT,
    starScale: 1.1 - fadeOutT * 0.3,
    sceneSwapped: true,
    progress,
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
    stage: state.stage,
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
 * Starts the next target stage without losing current score, incrementing stage counter.
 * Guarantees the next targetScore is always ahead of current score even after high-combo overshoots.
 */
export function advanceScoreTarget(state: ScoreState): ScoreState {
  const nextStage = state.stage + 1;
  const minAheadTarget = Math.ceil((state.score + 250) / 50) * 50;
  return {
    ...state,
    stage: nextStage,
    level: nextStage,
    targetScore: Math.max(state.targetScore + 250, minAheadTarget),
    celebrationTriggered: false,
  };
}
