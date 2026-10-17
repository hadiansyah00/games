import React from 'react';
import { StageCelebrationMeta, TransitionEnvelope } from '../game/score_rules';

interface StageTransitionCurtainProps {
  envelope: TransitionEnvelope;
  meta: StageCelebrationMeta;
}

export const StageTransitionCurtain: React.FC<StageTransitionCurtainProps> = ({
  envelope,
  meta,
}) => {
  if (envelope.phase === 'idle' && envelope.opacity <= 0.01) {
    return null;
  }

  const isDarkTheme = meta.themeId === 'night';
  const textColor = isDarkTheme ? '#FEF9C3' : '#451A03';
  const subTextColor = isDarkTheme ? '#E0E7FF' : '#78350F';

  return (
    <div
      data-testid="stage-transition-curtain"
      data-phase={envelope.phase}
      aria-live="polite"
      className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      style={{
        opacity: envelope.opacity,
        background: meta.curtainBg,
        transition: 'opacity 60ms linear',
      }}
    >
      {/* Decorative Floating Sparkle Rings */}
      <div
        className="relative flex flex-col items-center justify-center max-w-md w-full rounded-3xl p-7 shadow-2xl border-4"
        style={{
          transform: `scale(${envelope.starScale.toFixed(3)})`,
          backgroundColor: isDarkTheme
            ? 'rgba(30, 27, 75, 0.88)'
            : 'rgba(255, 251, 235, 0.92)',
          borderColor: meta.accentHex,
        }}
      >
        {/* Cheerful Multi-Star & Rainbow SVG Emblem */}
        <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full drop-shadow-lg"
            aria-hidden="true"
          >
            {/* Outer Soft Glow Circle */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill={meta.accentHex}
              fillOpacity="0.22"
            />
            {/* Cheerful Rainbow Arc */}
            <path
              d="M22 72 A38 38 0 0 1 98 72"
              fill="none"
              stroke="#FB7185"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M28 72 A32 32 0 0 1 92 72"
              fill="none"
              stroke="#FACC15"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M34 72 A26 26 0 0 1 86 72"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Main Center Star */}
            <path
              d="M60 16 L69.5 38.5 L94 40.8 L75.5 57 L81 81 L60 68.2 L39 81 L44.5 57 L26 40.8 L50.5 38.5 Z"
              fill="#FACC15"
              stroke="#78350F"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Cute Smiling Star Face */}
            <circle cx="53" cy="50" r="3" fill="#451A03" />
            <circle cx="67" cy="50" r="3" fill="#451A03" />
            <path
              d="M54 57 Q60 63 66 57"
              fill="none"
              stroke="#451A03"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Stage Pill Badge */}
        <div
          className="px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-2 shadow-sm"
          style={{
            backgroundColor: meta.accentHex,
            color: '#451A03',
          }}
        >
          TAHAP SKOR {meta.stage}
        </div>

        {/* Stage Title */}
        <h2
          data-testid="stage-transition-title"
          className="text-2xl sm:text-3xl font-black tracking-tight text-center"
          style={{ color: textColor }}
        >
          {meta.title}
        </h2>

        {/* Stage Subtitle */}
        <p
          className="text-sm sm:text-base font-bold mt-1.5 text-center"
          style={{ color: subTextColor }}
        >
          {meta.subtitle}
        </p>

        {/* Cheerful Animated Progress Dots */}
        <div className="flex items-center gap-2 mt-4">
          {[0, 1, 2].map((idx) => {
            const active = envelope.progress >= idx * 0.3;
            return (
              <span
                key={idx}
                className="w-3 h-3 rounded-full transition-transform duration-150"
                style={{
                  backgroundColor: active ? meta.accentHex : 'rgba(120, 53, 15, 0.25)',
                  transform: active ? 'scale(1.25)' : 'scale(0.9)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
