/**
 * Pure scoring, combo multiplier, milestone rules, stage transition math,
 * and toddler-safe light challenge rules (Age Mode, Stage Agility, Shy Peek-a-Boo,
 * Playful Boing Obstacle, and Visual Mini-Missions).
 * Decoupled from Three.js and React for deterministic unit testing.
 */

export type GamePlayMode = 'sensory' | 'score';
export type AgeMode = 'bayi' | 'balita';
export type TransitionPhase = 'idle' | 'fade-out' | 'hold' | 'fade-in';
export type MissionTargetType = 'star' | 'balloon' | 'chick' | 'bunny' | 'kitten';

/**
 * Centralized configuration object at the top of the code for all challenge parameters,
 * multipliers, durations, bonuses, and safety limits.
 */
export const CHALLENGE_CONFIG = {
  DEFAULT_AGE_MODE: 'balita' as AgeMode,
  AGE_MODE_HOLD_DURATION_MS: 2000, // Hold corner button for 2 seconds to switch Age Mode

  // 1. Stage Agility & Size Multipliers (Mode Balita vs Mode Bayi)
  BAYI_SPEED_MULTIPLIER: 0.72, // Constant, slow, soothing speed for babies (6m - 2y)
  BAYI_SCALE_MULTIPLIER: 1.0,  // Full 100% toy size for babies
  STAGE_SPEED_MULTIPLIERS: [1.0, 1.15, 1.3, 1.45] as const, // Tahap 1, 2, 3, 4+
  STAGE_SCALE_MULTIPLIERS: [1.0, 0.95, 0.90, 0.85] as const, // 100%, 95%, 90%, 85%
  MIN_OBJECT_SCALE: 0.70, // Never smaller than 70% of initial size for small fingers

  // 2. Shy Peek-a-Boo Object (Objek Malu-Malu behind cloud or bush)
  SHY_VISIBLE_DURATION_STAGE_1_2_SEC: 3.0, // Visible 3.0s in Tahap 1-2
  SHY_VISIBLE_DURATION_STAGE_3_4_SEC: 2.5, // Visible 2.5s in Tahap 3-4+
  SHY_RESPAWN_COOLDOWN_SEC: 3.8,           // Quiet pause before peeking out again
  SHY_BONUS_POINTS: 30,                    // +30 points when swiped/tapped while visible

  // 3. Playful Obstacle (Rintangan Lucu: Awan Jahil / Bola Karet starting Tahap 2)
  OBSTACLE_START_STAGE: 2,        // Appears starting from Tahap 2
  MAX_OBSTACLES_ON_SCREEN: 1,     // Maximum 1 obstacle at a time
  OBSTACLE_COMBO_PAUSE_SEC: 1.0,  // Freezes combo for 1s on boing, 0 points lost, combo never drops

  // 4. Visual Mini-Missions (Misi Mini)
  MISSION_TARGET_COUNT: 3,        // Swipe/tap 3 matching objects (e.g. 3 yellow stars)
  MISSION_BONUS_POINTS: 60,       // +60 bonus points on completion
  MISSION_BONUS_GOLDEN_STARS: 1,  // +1 golden star reward
  MISSION_SILENT_ROTATE_SEC: 45,  // Silently switches mission after 45s with zero fail message

  // Photosensitivity & Audio Safety
  MAX_FLASH_FREQUENCY_HZ: 1.5,    // Strictly below 3 Hz limit
} as const;

export const COMBO_WINDOW_SECONDS = 3.2;
export const MAX_COMBO_MULTIPLIER = 5;
export const DEFAULT_TRANSITION_DURATION_MS = 1400;

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

export interface MiniMission {
  id: number;
  targetType: MissionTargetType;
  targetLabel: string;
  accentHex: string;
  currentCount: number;
  targetCount: number;
  elapsedSeconds: number;
  timeoutSeconds: number;
}

export interface ScoreState {
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  comboTimer: number;       // seconds remaining before combo resets
  comboPauseTimer: number;  // seconds remaining of playful obstacle 1s combo freeze
  starsCollected: number;
  goldenStarsEarned: number; // earned from completing mini-missions
  shyObjectsCaught: number;
  targetScore: number;
  stage: number;
  level: number;
  ageMode: AgeMode;
  activeMission: MiniMission | null;
  celebrationTriggered: boolean;
}

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

const MISSION_CATALOG: ReadonlyArray<{
  targetType: MissionTargetType;
  targetLabel: string;
  accentHex: string;
}> = [
  {
    targetType: 'star',
    targetLabel: 'Bintang Kuning',
    accentHex: '#FACC15',
  },
  {
    targetType: 'balloon',
    targetLabel: 'Balon Ceria',
    accentHex: '#FB7185',
  },
  {
    targetType: 'chick',
    targetLabel: 'Anak Ayam',
    accentHex: '#FDE047',
  },
  {
    targetType: 'bunny',
    targetLabel: 'Kelinci Lucu',
    accentHex: '#38BDF8',
  },
  {
    targetType: 'kitten',
    targetLabel: 'Kucing Manis',
    accentHex: '#C084FC',
  },
];

/**
 * Creates a deterministic visual Mini-Mission (starts with Swipe 3 Bintang Kuning for id=1).
 */
export function createMiniMission(missionId = 1): MiniMission {
  const safeId = Math.max(1, Math.floor(missionId));
  const entry = MISSION_CATALOG[(safeId - 1) % MISSION_CATALOG.length];
  return {
    id: safeId,
    targetType: entry.targetType,
    targetLabel: entry.targetLabel,
    accentHex: entry.accentHex,
    currentCount: 0,
    targetCount: CHALLENGE_CONFIG.MISSION_TARGET_COUNT,
    elapsedSeconds: 0,
    timeoutSeconds: CHALLENGE_CONFIG.MISSION_SILENT_ROTATE_SEC,
  };
}

export function createInitialScoreState(
  bestScore = 0,
  targetScore = 200,
  ageMode: AgeMode = CHALLENGE_CONFIG.DEFAULT_AGE_MODE
): ScoreState {
  return {
    score: 0,
    bestScore: Math.max(0, bestScore),
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    comboPauseTimer: 0,
    starsCollected: 0,
    goldenStarsEarned: 0,
    shyObjectsCaught: 0,
    targetScore,
    stage: 1,
    level: 1,
    ageMode,
    activeMission: ageMode === 'balita' ? createMiniMission(1) : null,
    celebrationTriggered: false,
  };
}

/**
 * 1. Stage Speed Multiplier:
 * - Mode Bayi: constant slow speed (0.72)
 * - Mode Balita: Stage 1 = 1.0, Stage 2 = 1.15, Stage 3 = 1.3, Stage 4+ = 1.45
 */
export function getStageSpeedMultiplier(
  stage: number,
  ageMode: AgeMode = 'balita'
): number {
  if (ageMode === 'bayi') {
    return CHALLENGE_CONFIG.BAYI_SPEED_MULTIPLIER;
  }
  const idx = Math.max(
    0,
    Math.min(CHALLENGE_CONFIG.STAGE_SPEED_MULTIPLIERS.length - 1, Math.floor(stage) - 1)
  );
  return CHALLENGE_CONFIG.STAGE_SPEED_MULTIPLIERS[idx];
}

/**
 * 1. Stage Scale Multiplier:
 * - Mode Bayi: constant 100% (1.0)
 * - Mode Balita: Stage 1 = 1.00, Stage 2 = 0.95, Stage 3 = 0.90, Stage 4+ = 0.85
 * - Always clamped >= MIN_OBJECT_SCALE (0.70) so small fingers can easily touch.
 */
export function getStageScaleMultiplier(
  stage: number,
  ageMode: AgeMode = 'balita'
): number {
  if (ageMode === 'bayi') {
    return CHALLENGE_CONFIG.BAYI_SCALE_MULTIPLIER;
  }
  const idx = Math.max(
    0,
    Math.min(CHALLENGE_CONFIG.STAGE_SCALE_MULTIPLIERS.length - 1, Math.floor(stage) - 1)
  );
  const rawScale = CHALLENGE_CONFIG.STAGE_SCALE_MULTIPLIERS[idx];
  return Math.max(CHALLENGE_CONFIG.MIN_OBJECT_SCALE, rawScale);
}

/**
 * 2. Shy Object (Objek Malu-Malu) visible duration in seconds:
 * - Stage 1-2: 3.0 seconds
 * - Stage 3-4+: 2.5 seconds
 */
export function getShyObjectVisibleDuration(stage: number): number {
  return Math.floor(stage) <= 2
    ? CHALLENGE_CONFIG.SHY_VISIBLE_DURATION_STAGE_1_2_SEC
    : CHALLENGE_CONFIG.SHY_VISIBLE_DURATION_STAGE_3_4_SEC;
}

/**
 * 3. Determines whether a Playful Obstacle (Awan Jahil / Bola Karet) should be active:
 * - Only in Mode Balita
 * - Starts from Tahap 2 (stage >= 2)
 * - Max 1 obstacle on screen at a time
 */
export function shouldHavePlayfulObstacle(
  stage: number,
  ageMode: AgeMode,
  currentObstacleCount = 0
): boolean {
  if (ageMode !== 'balita') return false;
  if (Math.floor(stage) < CHALLENGE_CONFIG.OBSTACLE_START_STAGE) return false;
  return currentObstacleCount < CHALLENGE_CONFIG.MAX_OBSTACLES_ON_SCREEN;
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
 * Registers a hit/tap/swipe collection in Score Mode, updates combo + milestones,
 * and checks Mini-Mission progress. Never deducts points.
 */
export function registerScoreHit(
  state: ScoreState,
  entityType: string,
  isSwipeBonus = false
): {
  nextState: ScoreState;
  pointsAwarded: number;
  milestoneReached: boolean;
  missionCompleted: boolean;
  missionBonusAwarded: number;
} {
  const basePoints = getBasePointsForType(entityType);
  const swipeBonus = isSwipeBonus ? 5 : 0;

  // If combo is currently paused by a playful obstacle boing (1s), combo neither drops nor increases
  let activeCombo = state.combo;
  if (state.comboPauseTimer <= 0) {
    activeCombo =
      state.comboTimer > 0 ? Math.min(MAX_COMBO_MULTIPLIER, state.combo + 1) : 1;
  }

  const baseAward = Math.max(0, (basePoints + swipeBonus) * activeCombo);

  // Check Mini-Mission progress (Mode Balita only)
  let missionCompleted = false;
  let missionBonusAwarded = 0;
  let nextMission = state.activeMission ? { ...state.activeMission } : null;
  let nextGoldenStars = state.goldenStarsEarned;

  if (state.ageMode === 'balita' && nextMission) {
    const normalizedType = entityType === 'contrast_star' ? 'star' : entityType;
    if (normalizedType === nextMission.targetType) {
      nextMission.currentCount += 1;
      if (nextMission.currentCount >= nextMission.targetCount) {
        missionCompleted = true;
        missionBonusAwarded = CHALLENGE_CONFIG.MISSION_BONUS_POINTS;
        nextGoldenStars += CHALLENGE_CONFIG.MISSION_BONUS_GOLDEN_STARS;
        nextMission = createMiniMission(nextMission.id + 1);
      }
    }
  }

  const totalPointsAwarded = baseAward + missionBonusAwarded;
  const newScore = state.score + totalPointsAwarded;
  const newBest = Math.max(state.bestScore, newScore);
  const newMaxCombo = Math.max(state.maxCombo, activeCombo);
  const newStars = state.starsCollected + 1;

  // Check if player crossed target score milestone
  const milestoneReached = !state.celebrationTriggered && newScore >= state.targetScore;
  const newLevel = Math.floor(newScore / 200) + 1;

  const nextState: ScoreState = {
    ...state,
    score: newScore,
    bestScore: newBest,
    combo: activeCombo,
    maxCombo: newMaxCombo,
    comboTimer: COMBO_WINDOW_SECONDS,
    starsCollected: newStars,
    goldenStarsEarned: nextGoldenStars,
    activeMission: nextMission,
    level: newLevel,
    celebrationTriggered: state.celebrationTriggered || milestoneReached,
  };

  return {
    nextState,
    pointsAwarded: totalPointsAwarded,
    milestoneReached,
    missionCompleted,
    missionBonusAwarded,
  };
}

/**
 * 2. Registers a swipe/tap on a Shy Peek-a-Boo Object (Objek Malu-Malu) while visible:
 * Awards +30 points and triggers happy celebration without any risk of penalty.
 */
export function registerShyObjectHit(state: ScoreState): {
  nextState: ScoreState;
  pointsAwarded: number;
  milestoneReached: boolean;
} {
  const pointsAwarded = CHALLENGE_CONFIG.SHY_BONUS_POINTS;
  const newScore = state.score + pointsAwarded;
  const newBest = Math.max(state.bestScore, newScore);
  const milestoneReached = !state.celebrationTriggered && newScore >= state.targetScore;

  const nextState: ScoreState = {
    ...state,
    score: newScore,
    bestScore: newBest,
    comboTimer: Math.max(state.comboTimer, COMBO_WINDOW_SECONDS),
    shyObjectsCaught: state.shyObjectsCaught + 1,
    celebrationTriggered: state.celebrationTriggered || milestoneReached,
  };

  return {
    nextState,
    pointsAwarded,
    milestoneReached,
  };
}

/**
 * 3. Registers a swipe/tap on a Playful Obstacle (Rintangan Lucu: Awan Jahil / Bola Karet):
 * - Zero point deduction (score never decreases)
 * - Combo never drops
 * - Combo freezes/pauses for 1.0 second
 */
export function registerObstacleBoing(state: ScoreState): ScoreState {
  return {
    ...state,
    score: state.score, // Strictly no point deduction
    combo: state.combo, // Strictly no combo drop
    comboPauseTimer: CHALLENGE_CONFIG.OBSTACLE_COMBO_PAUSE_SEC,
  };
}

/**
 * Switches Age Mode ('bayi' vs 'balita') and updates active challenges accordingly.
 */
export function setScoreAgeMode(state: ScoreState, ageMode: AgeMode): ScoreState {
  return {
    ...state,
    ageMode,
    comboPauseTimer: ageMode === 'bayi' ? 0 : state.comboPauseTimer,
    activeMission:
      ageMode === 'balita'
        ? state.activeMission ?? createMiniMission(state.stage)
        : null,
  };
}

/**
 * Advances combo decay timer, obstacle 1s combo pause timer, and 45s silent mission rotation.
 */
export function tickComboTimer(state: ScoreState, dt: number): ScoreState {
  const safeDt = Math.max(0, dt);

  // 1. Update 45-second silent Mini-Mission rotation (Mode Balita)
  let nextMission = state.activeMission;
  if (state.ageMode === 'balita' && nextMission) {
    const nextElapsed = nextMission.elapsedSeconds + safeDt;
    if (nextElapsed >= nextMission.timeoutSeconds) {
      // Silently replace with a fresh mission without any failure message!
      nextMission = createMiniMission(nextMission.id + 1);
    } else {
      nextMission = {
        ...nextMission,
        elapsedSeconds: nextElapsed,
      };
    }
  }

  // 2. If combo is paused by Playful Obstacle (1s), count down pause without decaying comboTimer
  if (state.comboPauseTimer > 0) {
    const nextPause = Math.max(0, state.comboPauseTimer - safeDt);
    return {
      ...state,
      comboPauseTimer: nextPause,
      activeMission: nextMission,
    };
  }

  // 3. Normal combo window countdown
  if (state.comboTimer <= 0) {
    if (state.combo !== 1 || nextMission !== state.activeMission) {
      return {
        ...state,
        combo: 1,
        comboTimer: 0,
        activeMission: nextMission,
      };
    }
    return state;
  }

  const remaining = Math.max(0, state.comboTimer - safeDt);
  return {
    ...state,
    comboTimer: remaining,
    combo: remaining > 0 ? state.combo : 1,
    activeMission: nextMission,
  };
}

/**
 * Starts the next target stage without losing current score, incrementing stage counter
 * and ensuring a fresh Mini-Mission for the new stage in Mode Balita.
 */
export function advanceScoreTarget(state: ScoreState): ScoreState {
  const nextStage = state.stage + 1;
  const minAheadTarget = Math.ceil((state.score + 250) / 50) * 50;
  const nextMissionId = state.activeMission ? state.activeMission.id + 1 : nextStage;

  return {
    ...state,
    stage: nextStage,
    level: nextStage,
    targetScore: Math.max(state.targetScore + 250, minAheadTarget),
    activeMission: state.ageMode === 'balita' ? createMiniMission(nextMissionId) : null,
    celebrationTriggered: false,
  };
}
