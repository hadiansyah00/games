/**
 * Musical scale frequencies and tone helpers for the toddler sensory sound synthesizer.
 * Based on major pentatonic and warm harmonic scales so any touch creates beautiful music.
 */

// Frequencies (Hz) for C Major Pentatonic across 3 octaves (C4 to A6)
export const PENTATONIC_FREQUENCIES: readonly number[] = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50, // C6
  1174.66, // D6
  1318.51, // E6
  1567.98, // G6
  1760.00, // A6
];

// Frequencies for a Dreamy Lydian scale (great for the Starry Night theme)
export const DREAMY_FREQUENCIES: readonly number[] = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  369.99, // F#4 (Lydian sparkle)
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  783.99, // G5
  880.00, // A5
];

export type InstrumentType = 'xylophone' | 'bubble_pop' | 'playful_chirp' | 'harp_glissando';

/**
 * Returns a note frequency based on touch position on screen (e.g. higher Y or higher X gives higher pitch).
 */
export function getFrequencyFromPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: readonly number[] = PENTATONIC_FREQUENCIES
): number {
  if (scale.length === 0) return 440;
  // Invert Y so bottom is deeper pitch, top is higher pitch (like a piano or marimba)
  const normY = 1 - Math.max(0, Math.min(1, y / Math.max(1, viewportHeight)));
  const normX = Math.max(0, Math.min(1, x / Math.max(1, viewportWidth)));
  // Combine 70% Y and 30% X for natural intuitive musical mapping
  const normalized = normY * 0.7 + normX * 0.3;
  const index = Math.floor(normalized * scale.length);
  const clampedIndex = Math.max(0, Math.min(scale.length - 1, index));
  return scale[clampedIndex];
}

/**
 * Safe sound gain limits to protect infant/toddler hearing.
 */
export function getSafeVolume(requestedVolume: number, isMuted: boolean): number {
  if (isMuted) return 0;
  // Maximum ceiling is 0.22 to ensure gentle, non-piercing volume on mobile speakers
  return Math.max(0, Math.min(0.22, requestedVolume));
}

/**
 * Generates arpeggio frequencies for a swipe gesture based on speed.
 */
export function getSwipeArpeggio(
  baseFreq: number,
  speed: number,
  scale: readonly number[] = PENTATONIC_FREQUENCIES
): number[] {
  const baseIdx = scale.indexOf(baseFreq);
  const startIdx = baseIdx >= 0 ? baseIdx : Math.floor(scale.length / 2);
  const steps = speed > 400 ? 4 : speed > 200 ? 3 : 2;

  const notes: number[] = [];
  for (let i = 0; i < steps; i++) {
    const idx = Math.min(scale.length - 1, startIdx + i);
    notes.push(scale[idx]);
  }
  return notes;
}
