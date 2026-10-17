/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ToddlerWorld3DEngine,
  CameraPreset,
  FloatingScorePopup,
} from './game/world_3d_engine';
import {
  GamePlayMode,
  ScoreState,
  StageCelebrationMeta,
  TransitionEnvelope,
  createInitialScoreState,
  getStageCelebrationMeta,
  calculateTransitionEnvelope,
  DEFAULT_TRANSITION_DURATION_MS,
} from './game/score_rules';
import { THEMES } from './game/themes';
import { babySound } from './game/sound';
import { TitleScreen } from './components/TitleScreen';
import { ParentModal } from './components/ParentModal';
import { StageTransitionCurtain } from './components/StageTransitionCurtain';
import {
  Settings,
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Camera,
} from 'lucide-react';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ToddlerWorld3DEngine | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  // Check ?autostart=1 parameter
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialAutostart = searchParams ? searchParams.get('autostart') === '1' : false;

  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>(
    initialAutostart ? 'playing' : 'title'
  );
  const [playMode, setPlayMode] = useState<GamePlayMode>('score');
  const [currentThemeId, setCurrentThemeId] = useState<string>('meadow');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isParentModalOpen, setIsParentModalOpen] = useState<boolean>(false);

  const [scoreState, setScoreState] = useState<ScoreState>(() =>
    createInitialScoreState(0, 200)
  );
  const [scorePopups, setScorePopups] = useState<FloatingScorePopup[]>([]);

  // Smooth Fade-Out / Fade-In Stage Transition State
  const [transitionEnvelope, setTransitionEnvelope] = useState<TransitionEnvelope>({
    phase: 'idle',
    opacity: 0,
    starScale: 0.7,
    sceneSwapped: false,
    progress: 0,
  });
  const [transitionMeta, setTransitionMeta] = useState<StageCelebrationMeta>(() =>
    getStageCelebrationMeta(1)
  );

  // Mirror state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Mount Three.js 3D Engine once in isolated container
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const handleScoreCallback = (nextScore: ScoreState, popup?: FloatingScorePopup) => {
      setScoreState(nextScore);
      if (popup) {
        setScorePopups((prev) => [...prev.slice(-6), popup]);
        setTimeout(() => {
          setScorePopups((prev) => prev.filter((item) => item.id !== popup.id));
        }, 900);
      }
      if (nextScore.celebrationTriggered) {
        setGameState('gameover');
        document.body.dataset.state = 'gameover';
      }
    };

    const engine = new ToddlerWorld3DEngine(
      container,
      'meadow',
      'score',
      handleScoreCallback
    );
    engineRef.current = engine;
    setScoreState(engine.getScoreState());
    engine.start();

    const handleResize = () => {
      engine.handleResize();
    };

    const preventTouchGestures = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('resize', handleResize);
    container.addEventListener('touchstart', preventTouchGestures, { passive: false });
    container.addEventListener('touchmove', preventTouchGestures, { passive: false });

    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearInterval(transitionTimerRef.current);
      }
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('touchstart', preventTouchGestures);
      container.removeEventListener('touchmove', preventTouchGestures);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Run smooth fade-out -> stage swap hold -> fade-in transition
  const triggerStageTransition = useCallback(
    (
      targetStage: number,
      onMidpointSwap: () => void,
      durationMs: number = DEFAULT_TRANSITION_DURATION_MS
    ) => {
      if (transitionTimerRef.current !== null) {
        window.clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      const meta = getStageCelebrationMeta(targetStage);
      setTransitionMeta(meta);
      babySound.ensureRunning();
      babySound.playStageTransitionWhoosh();

      const startTime = performance.now();
      let swapped = false;

      // Immediate initial fade-out frame
      setTransitionEnvelope(calculateTransitionEnvelope(16, durationMs));

      transitionTimerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        const env = calculateTransitionEnvelope(elapsed, durationMs);

        if (env.sceneSwapped && !swapped) {
          swapped = true;
          onMidpointSwap();
        }

        setTransitionEnvelope(env);

        if (elapsed >= durationMs) {
          if (transitionTimerRef.current !== null) {
            window.clearInterval(transitionTimerRef.current);
            transitionTimerRef.current = null;
          }
          setTransitionEnvelope({
            phase: 'idle',
            opacity: 0,
            starScale: 0.7,
            sceneSwapped: true,
            progress: 1,
          });
        }
      }, 30);
    },
    []
  );

  // Start or Resume Game
  const handleStartGame = useCallback(() => {
    babySound.ensureRunning();
    babySound.playChime(
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerWidth,
      window.innerHeight
    );
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameState('playing');
    document.body.dataset.state = 'playing';
  }, []);

  // Continue after reaching Target Score Milestone with Smooth Fade-Out / Fade-In Curtain
  const handleContinueNextTarget = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const currentStage = engineRef.current?.getScoreState().stage ?? scoreState.stage;
    const nextStage = currentStage + 1;

    // Close milestone dialog immediately as cheerful curtain fades out & reveals next stage
    setGameState('playing');
    document.body.dataset.state = 'playing';

    triggerStageTransition(
      nextStage,
      () => {
        const appliedMeta = engineRef.current?.continueNextScoreStage();
        if (appliedMeta) {
          setCurrentThemeId(appliedMeta.themeId);
        }
      },
      DEFAULT_TRANSITION_DURATION_MS
    );
  }, [scoreState.stage, triggerStageTransition]);

  // Reset Score Run with Smooth Curtain Back to Stage 1
  const handleResetScore = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameState('playing');
    document.body.dataset.state = 'playing';

    triggerStageTransition(
      1,
      () => {
        const appliedMeta = engineRef.current?.resetScoreRun();
        if (appliedMeta) {
          setCurrentThemeId(appliedMeta.themeId);
        }
      },
      900
    );
  }, [triggerStageTransition]);

  // Select Play Mode
  const handleSelectPlayMode = useCallback((mode: GamePlayMode) => {
    setPlayMode(mode);
    engineRef.current?.setPlayMode(mode);
  }, []);

  // Select Theme
  const handleSelectTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
    engineRef.current?.setTheme(themeId);
  }, []);

  // Select Camera Preset
  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  }, []);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    const nextMute = babySound.toggleMute();
    setIsMuted(nextMute);
  }, []);

  // Keyboard shortcuts (Space/Enter to start, M mute, R reset score, H hide dock)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (gameState === 'gameover') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleContinueNextTarget();
        }
      } else if (gameState === 'playing') {
        if (e.key === 'm' || e.key === 'M') {
          handleToggleMute();
        } else if (e.key === 'h' || e.key === 'H') {
          setIsDockCollapsed((prev) => !prev);
        } else if (e.key === 'r' || e.key === 'R') {
          handleResetScore();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    handleStartGame,
    handleContinueNextTarget,
    handleToggleMute,
    handleResetScore,
  ]);

  // Pointer Events forwarded to 3D Engine
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;
    engineRef.current?.onPointerDown(e.pointerId, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;
    engineRef.current?.onPointerMove(e.pointerId, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    engineRef.current?.onPointerUp(e.pointerId);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round((scoreState.score / Math.max(1, scoreState.targetScore)) * 100)
  );
  const currentStageMeta = getStageCelebrationMeta(scoreState.stage);
  const nextStageMeta = getStageCelebrationMeta(scoreState.stage + 1);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-amber-100 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Isolated Full-Viewport 3D WebGL Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Cheerful Fade-Out / Fade-In Stage Transition Curtain */}
      <StageTransitionCurtain envelope={transitionEnvelope} meta={transitionMeta} />

      {/* Floating +Score Popups */}
      {gameState === 'playing' && playMode === 'score' && (
        <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
          {scorePopups.map((p) => (
            <div
              key={p.id}
              className="absolute font-black text-2xl sm:text-3xl drop-shadow-md transition-transform duration-500 -translate-x-1/2 -translate-y-full"
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                color: '#FEF08A',
                textShadow: '0 2px 6px rgba(120, 53, 15, 0.9)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {p.text}
            </div>
          ))}
        </div>
      )}

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          selectedMode={playMode}
          onSelectMode={handleSelectPlayMode}
          bestScore={scoreState.bestScore}
          onStart={handleStartGame}
        />
      )}

      {/* Active Gameplay HUD (Top-Left Score Cluster + Collapsible Bottom Dock) */}
      {gameState === 'playing' && (
        <div className="fixed inset-0 pointer-events-none z-30">
          {/* Top-Left Score & Combo Perimeter Cluster */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2.5 pointer-events-auto">
            {playMode === 'score' ? (
              <div
                data-testid="score-hud"
                className="flex items-center gap-3 px-4 py-2 rounded-2xl border-2 border-amber-400 shadow-lg"
                style={{
                  backgroundColor: 'rgba(69, 26, 3, 0.88)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {/* Custom SVG Star Emblem */}
                <svg
                  className="w-8 h-8 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6L12 2Z"
                    fill="#FACC15"
                    stroke="#78350F"
                    strokeWidth="1.5"
                  />
                </svg>

                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      data-testid="stage-badge"
                      className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-950"
                      style={{ backgroundColor: currentStageMeta.accentHex }}
                    >
                      TAHAP {scoreState.stage}
                    </span>
                    <span className="hidden sm:inline text-[11px] font-bold text-amber-200 truncate max-w-[140px]">
                      {currentStageMeta.title}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                      SKOR
                    </span>
                    <span
                      data-testid="score-value"
                      className="text-2xl sm:text-3xl font-black text-white leading-none"
                    >
                      {Math.round(scoreState.score)}
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      / {Math.round(scoreState.targetScore)}
                    </span>
                  </div>

                  {/* Target Progress Bar */}
                  <div className="w-32 sm:w-40 h-2 bg-amber-950 rounded-full overflow-hidden mt-1 border border-amber-700">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Combo Multiplier Pill */}
                <div className="pl-2 border-l border-amber-700/80 text-center">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    KOMBO
                  </div>
                  <div
                    data-testid="combo-value"
                    className={`text-lg font-black leading-tight ${
                      scoreState.combo > 1 ? 'text-emerald-300' : 'text-amber-100'
                    }`}
                  >
                    x{Math.round(scoreState.combo)}
                  </div>
                </div>

                {/* Best Score Readout */}
                <div className="hidden sm:block pl-2 border-l border-amber-700/80 text-center">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    REKOR
                  </div>
                  <div className="text-lg font-black text-amber-200 leading-tight">
                    {Math.round(scoreState.bestScore)}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 border-amber-300 shadow-md text-amber-100 text-xs font-bold"
                style={{ backgroundColor: 'rgba(69, 26, 3, 0.82)' }}
              >
                <Sparkles size={16} className="text-amber-300" />
                <span>Mode Bebas Sensorik 3D</span>
              </div>
            )}
          </div>

          {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Clutter) */}
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[95vw] pointer-events-auto">
            {/* Collapse / Expand Handle */}
            <button
              type="button"
              onClick={(e) => {
                setIsDockCollapsed((prev) => !prev);
                e.currentTarget.blur();
              }}
              tabIndex={-1}
              aria-label={
                isDockCollapsed ? 'Tampilkan Kontrol 3D' : 'Sembunyikan Kontrol 3D'
              }
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-t-xl border-t-2 border-x-2 border-amber-400/80 text-amber-100 text-xs font-bold shadow-md cursor-pointer transition"
              style={{ backgroundColor: 'rgba(69, 26, 3, 0.9)' }}
            >
              {isDockCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{isDockCollapsed ? 'Kontrol 3D' : 'Sembunyikan'}</span>
            </button>

            {!isDockCollapsed && (
              <div
                className="flex flex-wrap items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl border-2 border-amber-400/90 shadow-xl"
                style={{ backgroundColor: 'rgba(69, 26, 3, 0.92)' }}
              >
                {/* Mode Toggle: Score vs Free Sensory */}
                <div className="flex items-center rounded-xl p-0.5 bg-amber-950 border border-amber-700">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      handleSelectPlayMode('score');
                      e.currentTarget.blur();
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      playMode === 'score'
                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                        : 'text-amber-200 hover:text-white'
                    }`}
                  >
                    <Trophy size={13} />
                    <span>Skor</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      handleSelectPlayMode('sensory');
                      e.currentTarget.blur();
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      playMode === 'sensory'
                        ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                        : 'text-amber-200 hover:text-white'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>Bebas</span>
                  </button>
                </div>

                {/* Camera Angle Presets */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-950 border border-amber-700">
                  <Camera size={13} className="text-amber-300 mr-0.5" />
                  {(
                    [
                      { id: 'overview', label: 'Taman' },
                      { id: 'closeup', label: 'Dekat' },
                      { id: 'aerial', label: 'Atas' },
                    ] as const
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        handleSelectCameraPreset(cam.id);
                        e.currentTarget.blur();
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        cameraPreset === cam.id
                          ? 'bg-amber-300 text-amber-950'
                          : 'text-amber-200 hover:text-white'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>

                {/* Theme Quick Swatches */}
                <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-950 border border-amber-700">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        handleSelectTheme(t.id);
                        e.currentTarget.blur();
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        currentThemeId === t.id
                          ? 'bg-amber-400 text-amber-950'
                          : 'text-amber-200 hover:text-white'
                      }`}
                    >
                      {t.name.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {/* Utility Icon Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      handleToggleMute();
                      e.currentTarget.blur();
                    }}
                    aria-label={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                    className="w-8 h-8 rounded-xl bg-amber-950 hover:bg-amber-800 text-amber-100 border border-amber-700 flex items-center justify-center transition cursor-pointer"
                  >
                    {isMuted ? (
                      <VolumeX size={16} className="text-rose-400" />
                    ) : (
                      <Volume2 size={16} className="text-emerald-400" />
                    )}
                  </button>

                  {playMode === 'score' && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        handleResetScore();
                        e.currentTarget.blur();
                      }}
                      aria-label="Ulangi Skor"
                      className="w-8 h-8 rounded-xl bg-amber-950 hover:bg-amber-800 text-amber-200 border border-amber-700 flex items-center justify-center transition cursor-pointer"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      setIsParentModalOpen(true);
                      e.currentTarget.blur();
                    }}
                    aria-label="Buka Pengaturan Orang Tua"
                    className="w-8 h-8 rounded-xl bg-amber-950 hover:bg-amber-800 text-amber-200 border border-amber-700 flex items-center justify-center transition cursor-pointer"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Milestone Victory / Stage Clear Celebration Modal */}
      {gameState === 'gameover' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', pointerEvents: 'auto' }}
          role="dialog"
          aria-modal="true"
          aria-label="Target Skor Tercapai"
        >
          <div className="w-full max-w-md bg-amber-50 rounded-3xl p-6 shadow-2xl border-4 border-amber-400 text-center text-amber-950">
            <div className="w-16 h-16 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center mx-auto mb-2.5 shadow-md">
              <Trophy size={36} />
            </div>
            <div className="inline-block px-3 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-extrabold uppercase tracking-wider mb-1">
              Tahap {scoreState.stage} Selesai!
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">Pesta Bintang 3D!</h2>
            <p className="text-sm text-amber-800 font-semibold mt-1">
              Target skor tercapai dengan luar biasa!
            </p>

            {/* 3 Tabular-Nums Mastery Stat Tiles */}
            <div
              className="grid grid-cols-3 gap-2.5 my-4"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <div className="p-3 rounded-2xl bg-amber-200/80 border border-amber-300">
                <div className="text-[10px] font-extrabold uppercase text-amber-800">
                  SKOR
                </div>
                <div className="text-2xl font-black text-amber-950">
                  {Math.round(scoreState.score)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-200/80 border border-amber-300">
                <div className="text-[10px] font-extrabold uppercase text-amber-800">
                  KOMBO MAKS
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  x{Math.round(scoreState.maxCombo)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-200/80 border border-amber-300">
                <div className="text-[10px] font-extrabold uppercase text-amber-800">
                  REKOR
                </div>
                <div className="text-2xl font-black text-amber-950">
                  {Math.round(scoreState.bestScore)}
                </div>
              </div>
            </div>

            {/* Next Stage Preview Pill */}
            <div className="mb-4 px-3.5 py-2 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center gap-2 text-xs font-bold text-amber-900">
              <Sparkles size={15} className="text-amber-600 shrink-0" />
              <span>
                Selanjutnya: <strong>Tahap {nextStageMeta.stage} — {nextStageMeta.title}</strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={handleContinueNextTarget}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-lg transition cursor-pointer"
              >
                Lanjut Target Berikutnya 🌟
              </button>
              <button
                type="button"
                onClick={handleResetScore}
                className="py-3.5 px-4 rounded-2xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-sm transition cursor-pointer"
              >
                Mulai Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Settings & Child Lock Modal */}
      <ParentModal
        isOpen={isParentModalOpen}
        onClose={() => setIsParentModalOpen(false)}
        currentThemeId={currentThemeId}
        onSelectTheme={handleSelectTheme}
        playMode={playMode}
        onSelectPlayMode={handleSelectPlayMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onClearToys={() => engineRef.current?.clearAllToys(true)}
        onResetScore={handleResetScore}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
}
