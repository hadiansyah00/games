/**
 * Web Audio API procedural sound engine for toddler sensory stimulation.
 * Zero external audio files required: 100% instant load, zero latency, offline ready.
 */

import {
  PENTATONIC_FREQUENCIES,
  DREAMY_FREQUENCIES,
  getFrequencyFromPosition,
  getSafeVolume,
  getSwipeArpeggio,
} from './sound_scales';

class BabySoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private lastSoundTime: number = 0;
  private minIntervalMs: number = 40; // prevents overwhelming infant ears during rapid jitter

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.20, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio not supported or blocked
    }
  }

  public ensureRunning() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.20, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Play a pleasant bell / chime / marimba tone based on position
   */
  public playChime(x: number, y: number, width: number, height: number, theme: string = 'meadow') {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastSoundTime < this.minIntervalMs) return;
    this.lastSoundTime = now;

    const scale = theme === 'night' ? DREAMY_FREQUENCIES : PENTATONIC_FREQUENCIES;
    const freq = getFrequencyFromPosition(x, y, width, height, scale);
    const audioTime = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Warm bell sound: Sine wave blended with subtle triangle overtone
    osc.type = theme === 'highcontrast' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, audioTime);

    // Soft attack, gentle exponential decay
    const peakVolume = getSafeVolume(0.18, this.isMuted);
    gain.gain.setValueAtTime(0.0001, audioTime);
    gain.gain.linearRampToValueAtTime(peakVolume, audioTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(audioTime);
    osc.stop(audioTime + 0.7);
  }

  /**
   * Play bubbly pop sound (water drop / bubble burst)
   */
  public playBubblePop(freq = 480) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const audioTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Frequency drops rapidly to create a bubbly pop sound
    osc.frequency.setValueAtTime(freq, audioTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.6, audioTime + 0.03);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, audioTime + 0.12);

    const peakVolume = getSafeVolume(0.19, this.isMuted);
    gain.gain.setValueAtTime(0.001, audioTime);
    gain.gain.linearRampToValueAtTime(peakVolume, audioTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(audioTime);
    osc.stop(audioTime + 0.2);
  }

  /**
   * Play happy animal chirp / bird / cute squeak sound
   */
  public playCuteSqueak(pitch = 600) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const audioTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, audioTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.35, audioTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.1, audioTime + 0.14);

    const peakVolume = getSafeVolume(0.14, this.isMuted);
    gain.gain.setValueAtTime(0.001, audioTime);
    gain.gain.linearRampToValueAtTime(peakVolume, audioTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(audioTime);
    osc.stop(audioTime + 0.25);
  }

  /**
   * Play a cheerful arpeggio cascade when swiping swiftly
   */
  public playSwipeArpeggio(x: number, y: number, speed: number, width: number, height: number, theme: string = 'meadow') {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastSoundTime < 60) return;
    this.lastSoundTime = now;

    const scale = theme === 'night' ? DREAMY_FREQUENCIES : PENTATONIC_FREQUENCIES;
    const baseFreq = getFrequencyFromPosition(x, y, width, height, scale);
    const notes = getSwipeArpeggio(baseFreq, speed, scale);

    const audioTime = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = audioTime + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      const vol = getSafeVolume(0.12 - idx * 0.015, this.isMuted);
      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(vol, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.5);
    });
  }

  /**
   * Play ascending star collect sound scaled by combo multiplier
   */
  public playStarCollect(combo: number = 1) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const baseIdx = Math.min(PENTATONIC_FREQUENCIES.length - 3, 4 + combo);
    const notes = [
      PENTATONIC_FREQUENCIES[baseIdx],
      PENTATONIC_FREQUENCIES[Math.min(PENTATONIC_FREQUENCIES.length - 1, baseIdx + 2)],
    ];

    const audioTime = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = audioTime + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const vol = getSafeVolume(0.16, this.isMuted);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  /**
   * Play cheerful celebration chord fanfare when reaching a target score milestone
   */
  public playVictoryFanfare() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const audioTime = this.ctx.currentTime;

    chord.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = audioTime + i * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const vol = getSafeVolume(0.15, this.isMuted);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  }

  /**
   * Play a joyful ascending pentatonic harp glissando during stage fade-out/fade-in transitions
   */
  public playStageTransitionWhoosh() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const notes = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 1046.5]; // G4 -> C6 pentatonic sweep
    const audioTime = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = audioTime + i * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const vol = getSafeVolume(0.14 - i * 0.01, this.isMuted);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  /**
   * Play a soft, funny elastic "boing!" sound when touching a Playful Obstacle (Awan Jahil / Bola Karet)
   */
  public playGentleBoing() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const audioTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Elastic pitch wobble: 220Hz -> 390Hz -> 250Hz -> 340Hz
    osc.frequency.setValueAtTime(220, audioTime);
    osc.frequency.exponentialRampToValueAtTime(390, audioTime + 0.09);
    osc.frequency.exponentialRampToValueAtTime(250, audioTime + 0.19);
    osc.frequency.exponentialRampToValueAtTime(340, audioTime + 0.30);

    const vol = getSafeVolume(0.16, this.isMuted);
    gain.gain.setValueAtTime(0.0001, audioTime);
    gain.gain.linearRampToValueAtTime(vol, audioTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.36);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(audioTime);
    osc.stop(audioTime + 0.38);
  }

  /**
   * Play a joyful peek-a-boo chime when catching the Shy Object (+30 points)
   */
  public playPeekABooGiggle() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const audioTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = audioTime + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const vol = getSafeVolume(0.15, this.isMuted);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /**
   * Play a warm celebration melody when completing a Mini-Mission (+60 points & +1 Golden Star)
   */
  public playMissionCompleteFanfare() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5]; // C5 D5 E5 G5 C6
    const audioTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = audioTime + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const vol = getSafeVolume(0.16, this.isMuted);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }
}

export const babySound = new BabySoundEngine();
