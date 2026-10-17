import React, { useState } from 'react';
import { THEMES, ThemeConfig } from '../game/themes';
import { GamePlayMode } from '../game/score_rules';
import { Volume2, VolumeX, Sparkles, Maximize, RotateCcw, X, ShieldCheck, Trophy } from 'lucide-react';

interface ParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  playMode: GamePlayMode;
  onSelectPlayMode: (mode: GamePlayMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClearToys: () => void;
  onResetScore: () => void;
  onToggleFullscreen: () => void;
}

export const ParentModal: React.FC<ParentModalProps> = ({
  isOpen,
  onClose,
  currentThemeId,
  onSelectTheme,
  playMode,
  onSelectPlayMode,
  isMuted,
  onToggleMute,
  onClearToys,
  onResetScore,
  onToggleFullscreen,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  if (!isOpen) return null;

  const handleGateClick = () => {
    const next = clickCount + 1;
    if (next >= 3) {
      setUnlocked(true);
    } else {
      setClickCount(next);
    }
  };

  const handleResetGate = () => {
    setUnlocked(false);
    setClickCount(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', pointerEvents: 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Orang Tua"
    >
      <div className="w-full max-w-md bg-amber-50 rounded-3xl p-6 shadow-2xl border-4 border-amber-300 text-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label="Beruang">🧸</span>
            <h2 className="text-xl font-bold text-amber-900">Area Orang Tua & Pengaturan</h2>
          </div>
          <button
            type="button"
            onClick={handleResetGate}
            className="p-2 rounded-full hover:bg-amber-200 text-amber-800 transition active:scale-95"
            aria-label="Tutup pengaturan"
          >
            <X size={24} />
          </button>
        </div>

        {!unlocked ? (
          <div className="py-6 text-center">
            <p className="text-sm text-amber-800 mb-4 font-medium">
              Kunci Anak: Ketuk tombol di bawah <strong>3 kali</strong> untuk membuka pengaturan.
            </p>
            <button
              type="button"
              onClick={handleGateClick}
              className="px-6 py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-lg shadow-md flex items-center gap-2 mx-auto active:scale-95 transition"
              aria-label="Ketuk 3 kali untuk membuka kunci"
            >
              <ShieldCheck size={28} />
              <span>Ketuk Di Sini ({3 - clickCount} lagi)</span>
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Play Mode Switcher */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                Mode Permainan 3D
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlayMode('score')}
                  aria-pressed={playMode === 'score'}
                  className={`p-3 rounded-2xl border-2 text-left transition flex items-center gap-2 ${
                    playMode === 'score'
                      ? 'border-amber-600 bg-amber-200 text-amber-950 font-bold'
                      : 'border-amber-200 bg-white text-slate-700'
                  }`}
                >
                  <Trophy size={18} className="text-amber-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Mode Skor</div>
                    <div className="text-[11px] text-slate-600">Tangkap bintang & kombo</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectPlayMode('sensory')}
                  aria-pressed={playMode === 'sensory'}
                  className={`p-3 rounded-2xl border-2 text-left transition flex items-center gap-2 ${
                    playMode === 'sensory'
                      ? 'border-amber-600 bg-amber-200 text-amber-950 font-bold'
                      : 'border-amber-200 bg-white text-slate-700'
                  }`}
                >
                  <Sparkles size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Mode Bebas</div>
                    <div className="text-[11px] text-slate-600">Eksplorasi tanpa skor</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Theme selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                Pilih Tema Dunia 3D
              </span>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(THEMES).map((theme: ThemeConfig) => {
                  const isSelected = theme.id === currentThemeId;
                  return (
                    <button
                      type="button"
                      key={theme.id}
                      onClick={() => onSelectTheme(theme.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-600 bg-amber-200 text-amber-950 font-bold shadow-sm'
                          : 'border-amber-200 bg-white hover:bg-amber-50 text-slate-700'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span className="text-sm font-semibold">{theme.name}</span>
                      <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">{theme.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={onToggleMute}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-amber-200 hover:bg-amber-100 text-slate-700 font-medium text-xs gap-1 transition active:scale-95"
                aria-label={isMuted ? 'Bunyikan suara' : 'Bisukan suara'}
              >
                {isMuted ? <VolumeX size={20} className="text-rose-500" /> : <Volume2 size={20} className="text-emerald-600" />}
                <span>{isMuted ? 'Mati' : 'Suara'}</span>
              </button>

              <button
                type="button"
                onClick={onClearToys}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-amber-200 hover:bg-amber-100 text-slate-700 font-medium text-xs gap-1 transition active:scale-95"
                aria-label="Bersihkan semua mainan"
              >
                <RotateCcw size={20} className="text-amber-600" />
                <span>Bersihkan</span>
              </button>

              <button
                type="button"
                onClick={onResetScore}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-amber-200 hover:bg-amber-100 text-slate-700 font-medium text-xs gap-1 transition active:scale-95"
                aria-label="Reset Skor"
              >
                <Trophy size={20} className="text-amber-500" />
                <span>Reset Skor</span>
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-amber-200 hover:bg-amber-100 text-slate-700 font-medium text-xs gap-1 transition active:scale-95"
                aria-label="Layar Penuh"
              >
                <Maximize size={20} className="text-indigo-600" />
                <span>Penuh</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetGate}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold shadow-md transition active:scale-98"
            >
              Lanjutkan Bermain 🌟
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
