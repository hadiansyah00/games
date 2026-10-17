import React from 'react';
import { Play, Trophy, Sparkles } from 'lucide-react';
import { GamePlayMode } from '../game/score_rules';

interface TitleScreenProps {
  selectedMode: GamePlayMode;
  onSelectMode: (mode: GamePlayMode) => void;
  bestScore: number;
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMode,
  onSelectMode,
  bestScore,
  onStart,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-between p-6 sm:p-10 select-none pointer-events-none"
      style={{
        background:
          'linear-gradient(180deg, rgba(254, 249, 195, 0.82) 0%, rgba(254, 240, 138, 0.25) 48%, rgba(254, 249, 195, 0.88) 100%)',
      }}
      role="region"
      aria-label="Layar Mulai Permainan"
    >
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-950/85 text-amber-100 text-xs font-bold shadow-md border border-amber-400/40">
          <Sparkles size={14} className="text-amber-300" />
          <span>Dunia 3D Interaktif · Balita & Anak</span>
        </div>

        {bestScore > 0 && (
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-950/85 text-amber-200 text-xs font-bold shadow-md border border-amber-400/40"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <Trophy size={14} className="text-amber-400" />
            <span>REKOR: {Math.round(bestScore)}</span>
          </div>
        )}
      </div>

      {/* Upper-Center Bespoke SVG Title Lockup & Mode Selection */}
      <div className="flex flex-col items-center text-center max-w-lg mx-auto pointer-events-auto my-auto">
        {/* Custom Inline SVG 3D Emblem */}
        <svg
          className="w-28 h-28 sm:w-32 sm:h-32 drop-shadow-lg mb-2"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer Crest Shield Ring */}
          <circle cx="100" cy="100" r="86" fill="#78350F" />
          <circle cx="100" cy="100" r="80" fill="#F59E0B" />
          <circle cx="100" cy="100" r="72" fill="#FEF08A" />

          {/* 3D Star Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <circle
              key={deg}
              cx={100 + Math.cos((deg * Math.PI) / 180) * 66}
              cy={100 + Math.sin((deg * Math.PI) / 180) * 66}
              r="10"
              fill="#FBBF24"
            />
          ))}

          {/* Smiling 3D Sun Mascot Core */}
          <circle cx="100" cy="100" r="56" fill="#F59E0B" />
          <circle cx="100" cy="97" r="52" fill="#FDE047" />

          {/* Rosy Cheeks */}
          <circle cx="72" cy="110" r="11" fill="#FB7185" />
          <circle cx="128" cy="110" r="11" fill="#FB7185" />

          {/* Expressive Eyes */}
          <circle cx="80" cy="90" r="9" fill="#0F172A" />
          <circle cx="77" cy="87" r="3" fill="#FFFFFF" />
          <circle cx="120" cy="90" r="9" fill="#0F172A" />
          <circle cx="117" cy="87" r="3" fill="#FFFFFF" />

          {/* Happy Smile */}
          <path
            d="M82 112 C 90 128, 110 128, 118 112"
            stroke="#78350F"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        <h1 className="text-4xl sm:text-5xl font-black text-amber-950 tracking-tight drop-shadow-sm">
          Balita <span className="text-amber-700">Ceria 3D</span>
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-amber-950/90 font-semibold max-w-md">
          Dunia mainan 3D interaktif dengan tangkap bintang, skor kombo, dan musik harmonis
        </p>

        {/* Mode Selector Cards (<= 3 actions total) */}
        <div className="mt-5 grid grid-cols-2 gap-3 w-full max-w-md">
          <button
            type="button"
            onClick={() => onSelectMode('score')}
            aria-pressed={selectedMode === 'score'}
            className={`p-3.5 rounded-2xl border-2 text-left transition ${
              selectedMode === 'score'
                ? 'bg-amber-950 text-amber-50 border-amber-400 shadow-lg'
                : 'bg-white/90 text-amber-950 border-amber-300 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <Trophy size={16} className="text-amber-400" />
              <span>Mode Skor 3D</span>
            </div>
            <p
              className={`text-xs mt-1 ${
                selectedMode === 'score' ? 'text-amber-200' : 'text-amber-800'
              }`}
            >
              Tangkap bintang & mainan 3D, kumpulkan poin & kombo!
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('sensory')}
            aria-pressed={selectedMode === 'sensory'}
            className={`p-3.5 rounded-2xl border-2 text-left transition ${
              selectedMode === 'sensory'
                ? 'bg-amber-950 text-amber-50 border-amber-400 shadow-lg'
                : 'bg-white/90 text-amber-950 border-amber-300 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <Sparkles size={16} className="text-emerald-400" />
              <span>Mode Bebas</span>
            </div>
            <p
              className={`text-xs mt-1 ${
                selectedMode === 'sensory' ? 'text-amber-200' : 'text-amber-800'
              }`}
            >
              Bermain bebas tanpa batas untuk stimulasi bayi & balita.
            </p>
          </button>
        </div>

        {/* Primary Start CTA */}
        <button
          type="button"
          onClick={onStart}
          data-start="true"
          aria-label="Mulai Bermain"
          className="mt-6 px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xl shadow-xl transition flex items-center gap-3 border-2 border-emerald-300 cursor-pointer"
        >
          <Play size={26} className="fill-white" />
          <span>Mulai Main 3D!</span>
        </button>
      </div>

      {/* Flat Control Hint Line */}
      <div className="text-xs sm:text-sm text-amber-950 font-semibold tracking-wide pt-2 w-full text-center">
        Sentuh / Geser Mainan 3D · Tekan Spasi / Enter untuk Mulai · H Sembunyikan Dock
      </div>
    </div>
  );
};
