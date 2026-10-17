import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PENTATONIC_FREQUENCIES,
  DREAMY_FREQUENCIES,
  getFrequencyFromPosition,
  getSafeVolume,
  getSwipeArpeggio,
} from './sound_scales.ts';

test('pentatonic scale has strictly ascending harmonious frequencies', () => {
  assert.ok(PENTATONIC_FREQUENCIES.length >= 10);
  for (let i = 1; i < PENTATONIC_FREQUENCIES.length; i++) {
    assert.ok(
      PENTATONIC_FREQUENCIES[i] > PENTATONIC_FREQUENCIES[i - 1],
      `Frequency at index ${i} must be greater than previous`
    );
  }
});

test('getFrequencyFromPosition returns valid frequencies within the scale', () => {
  // Bottom of screen -> deeper note
  const bottomFreq = getFrequencyFromPosition(100, 750, 400, 800);
  // Top of screen -> higher note
  const topFreq = getFrequencyFromPosition(100, 50, 400, 800);

  assert.ok(PENTATONIC_FREQUENCIES.includes(bottomFreq));
  assert.ok(PENTATONIC_FREQUENCIES.includes(topFreq));
  assert.ok(topFreq >= bottomFreq, 'Top screen touch should yield higher pitch');
});

test('getSafeVolume enforces safe ceiling and respect mute', () => {
  assert.equal(getSafeVolume(1.0, false), 0.22, 'Must clamp high volumes to 0.22 max');
  assert.equal(getSafeVolume(0.15, false), 0.15);
  assert.equal(getSafeVolume(0.5, true), 0, 'Muted state must return 0');
});

test('getSwipeArpeggio returns consecutive chord notes based on speed', () => {
  const base = PENTATONIC_FREQUENCIES[3]; // G4
  const slowSwipe = getSwipeArpeggio(base, 100);
  const fastSwipe = getSwipeArpeggio(base, 600);

  assert.equal(slowSwipe.length, 2);
  assert.equal(fastSwipe.length, 4);
  assert.equal(slowSwipe[0], base);
  assert.ok(slowSwipe[1] >= slowSwipe[0]);
});
