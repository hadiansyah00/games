import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AgeMode,
  CHALLENGE_CONFIG,
  MiniMission,
  MissionTargetType,
} from '../game/score_rules';
import { babySound } from '../game/sound';

/**
 * Custom SVG Pictogram Icon for each Mini-Mission target object so toddlers
 * understand the mission purely from pictures without needing to read text.
 */
export const MissionTargetSvgIcon: React.FC<{
  targetType: MissionTargetType;
  className?: string;
}> = ({ targetType, className = 'w-9 h-9' }) => {
  switch (targetType) {
    case 'star':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <path
            d="M24 4 L29.8 16.8 L43.8 18.2 L33.2 27.6 L36.2 41.4 L24 34.2 L11.8 41.4 L14.8 27.6 L4.2 18.2 L18.2 16.8 Z"
            fill="#FACC15"
            stroke="#78350F"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="19.5" cy="22" r="2.2" fill="#451A03" />
          <circle cx="28.5" cy="22" r="2.2" fill="#451A03" />
          <path
            d="M20 26.5 Q24 30 28 26.5"
            fill="none"
            stroke="#451A03"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'balloon':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <path
            d="M24 36 C24 40, 20 43, 24 46"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse
            cx="24"
            cy="20"
            rx="13"
            ry="15"
            fill="#FB7185"
            stroke="#881337"
            strokeWidth="2.5"
          />
          <ellipse cx="19" cy="14" rx="3" ry="5" fill="#FFE4E6" opacity="0.7" />
          <circle cx="20" cy="20" r="2" fill="#451A03" />
          <circle cx="28" cy="20" r="2" fill="#451A03" />
          <path
            d="M21 24 Q24 27 27 24"
            fill="none"
            stroke="#451A03"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'chick':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle
            cx="24"
            cy="26"
            r="14"
            fill="#FDE047"
            stroke="#78350F"
            strokeWidth="2.5"
          />
          <path
            d="M21 12 L24 7 L27 12"
            fill="#FDE047"
            stroke="#78350F"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="24" r="2.2" fill="#1E293B" />
          <circle cx="29" cy="24" r="2.2" fill="#1E293B" />
          <polygon points="24,25 20,29 28,29" fill="#F97316" />
        </svg>
      );

    case 'bunny':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <rect
            x="15"
            y="5"
            width="6"
            height="16"
            rx="3"
            fill="#38BDF8"
            stroke="#0C4A6E"
            strokeWidth="2"
          />
          <rect
            x="27"
            y="5"
            width="6"
            height="16"
            rx="3"
            fill="#38BDF8"
            stroke="#0C4A6E"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="28"
            r="13"
            fill="#38BDF8"
            stroke="#0C4A6E"
            strokeWidth="2.5"
          />
          <circle cx="19.5" cy="26" r="2.2" fill="#0F172A" />
          <circle cx="28.5" cy="26" r="2.2" fill="#0F172A" />
          <circle cx="24" cy="29.5" r="2" fill="#FB7185" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <polygon
            points="12,22 14,9 22,16"
            fill="#C084FC"
            stroke="#4C1D95"
            strokeWidth="2"
          />
          <polygon
            points="36,22 34,9 26,16"
            fill="#C084FC"
            stroke="#4C1D95"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="27"
            r="13"
            fill="#C084FC"
            stroke="#4C1D95"
            strokeWidth="2.5"
          />
          <circle cx="19.5" cy="25.5" r="2.2" fill="#0F172A" />
          <circle cx="28.5" cy="25.5" r="2.2" fill="#0F172A" />
          <circle cx="24" cy="29" r="2" fill="#FB7185" />
        </svg>
      );
  }
};

interface MiniMissionBadgeProps {
  mission: MiniMission | null;
  goldenStarsEarned: number;
  comboPaused: boolean;
}

/**
 * Visual-first Mini-Mission HUD badge for Mode Balita.
 * Shows target object picture + 3 visual slot stars + golden star reward counter.
 */
export const MiniMissionBadge: React.FC<MiniMissionBadgeProps> = ({
  mission,
  goldenStarsEarned,
  comboPaused,
}) => {
  if (!mission) return null;

  const slots = Array.from({ length: mission.targetCount }, (_, i) => i < mission.currentCount);

  return (
    <div
      data-testid="mini-mission-hud"
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border-2 border-amber-300 shadow-lg"
      style={{
        backgroundColor: 'rgba(69, 26, 3, 0.88)',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={`Misi Mini: Sentuh ${mission.targetCount} ${mission.targetLabel}`}
    >
      {/* Visual Target Object Picture Frame */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-amber-300/80 shadow-inner shrink-0"
        style={{ backgroundColor: 'rgba(254, 240, 138, 0.18)' }}
      >
        <MissionTargetSvgIcon targetType={mission.targetType} className="w-8 h-8" />
      </div>

      {/* 3 Visual Progress Slots (No reading required!) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          {slots.map((filled, idx) => (
            <div
              key={idx}
              data-testid={`mission-slot-${idx}`}
              data-filled={filled ? 'true' : 'false'}
              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-transform duration-200 ${
                filled
                  ? 'bg-amber-400 border-amber-200 scale-110 shadow-sm'
                  : 'bg-amber-950/90 border-amber-700 scale-95'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
                <path
                  d="M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6L12 2Z"
                  fill={filled ? '#451A03' : 'rgba(253, 224, 71, 0.25)'}
                />
              </svg>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            +60 Poin
          </span>
          {goldenStarsEarned > 0 && (
            <span
              data-testid="golden-stars-earned"
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black leading-none"
            >
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 shrink-0" aria-hidden="true">
                <path
                  d="M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6L12 2Z"
                  fill="#451A03"
                />
              </svg>
              <span>{goldenStarsEarned}</span>
            </span>
          )}
          {comboPaused && (
            <span
              data-testid="combo-paused-pill"
              className="px-1.5 py-0.5 rounded-full bg-purple-300 text-purple-950 text-[10px] font-black leading-none"
            >
              Boing! 1d
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface AgeModeHoldButtonProps {
  ageMode: AgeMode;
  onChangeAgeMode: (nextMode: AgeMode) => void;
}

/**
 * Child-safe Corner Button to switch between Mode "Bayi" (6m-2y) and Mode "Balita" (2-4y).
 * Must be held continuously for 2 seconds (2000ms) so toddlers cannot trigger it accidentally.
 */
export const AgeModeHoldButton: React.FC<AgeModeHoldButtonProps> = ({
  ageMode,
  onChangeAgeMode,
}) => {
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const holdTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    stopHold();
    startTimeRef.current = performance.now();
    setHoldProgress(0.04);

    holdTimerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const ratio = Math.min(1, elapsed / CHALLENGE_CONFIG.AGE_MODE_HOLD_DURATION_MS);
      setHoldProgress(ratio);

      if (ratio >= 1) {
        if (holdTimerRef.current !== null) {
          window.clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setHoldProgress(0);
        const nextMode: AgeMode = ageMode === 'balita' ? 'bayi' : 'balita';
        babySound.ensureRunning();
        babySound.playStarCollect(2);
        onChangeAgeMode(nextMode);
      }
    }, 40);
  }, [ageMode, onChangeAgeMode, stopHold]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  const isBalita = ageMode === 'balita';

  return (
    <button
      type="button"
      data-testid="age-mode-hold-button"
      data-age-mode={ageMode}
      tabIndex={-1}
      onPointerDown={(e) => {
        e.stopPropagation();
        startHold();
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      aria-label={`Mode Usia Saat Ini: ${
        isBalita ? 'Balita 2 sampai 4 tahun' : 'Bayi 6 bulan sampai 2 tahun'
      }. Tahan 2 detik untuk mengganti mode usia.`}
      className="relative overflow-hidden flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl border-2 border-amber-400/90 shadow-lg text-left select-none cursor-pointer transition active:scale-95"
      style={{
        backgroundColor: 'rgba(69, 26, 3, 0.88)',
      }}
    >
      {/* 2-Second Hold Fill Progress Bar */}
      {holdProgress > 0 && (
        <div
          data-testid="age-mode-hold-progress"
          className="absolute inset-y-0 left-0 bg-emerald-400/35 pointer-events-none transition-none"
          style={{ width: `${Math.round(holdProgress * 100)}%` }}
        />
      )}

      {/* Cute Mode Pictogram Icon */}
      <div
        className={`relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0 ${
          isBalita
            ? 'bg-amber-400 text-amber-950'
            : 'bg-sky-300 text-sky-950'
        }`}
      >
        {isBalita ? '2-4t' : 'Bayi'}
      </div>

      <div className="relative z-10 leading-tight">
        <div className="text-[11px] sm:text-xs font-black text-white">
          {isBalita ? 'Mode Balita' : 'Mode Bayi'}
        </div>
        <div className="text-[9px] sm:text-[10px] font-bold text-amber-300">
          {holdProgress > 0
            ? `Tahan... ${Math.ceil((1 - holdProgress) * 2)}d`
            : 'Tahan 2dtk ubah'}
        </div>
      </div>
    </button>
  );
};
