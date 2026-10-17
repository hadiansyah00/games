import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDeltaTime,
  updateSpring,
  handleBoundaryCollision,
  applyFriction,
  isPointInsideCircle,
  calculateSwipeImpulse,
} from './physics.ts';
import type { PhysicsEntity } from './physics.ts';

test('clampDeltaTime limits excessively high frame steps', () => {
  assert.equal(clampDeltaTime(0.016, 0.05), 0.016);
  assert.equal(clampDeltaTime(0.25, 0.05), 0.05);
  assert.equal(clampDeltaTime(0), 0.016);
  assert.equal(clampDeltaTime(-1), 0.016);
});

test('updateSpring moves displaced scale value toward target', () => {
  const initialScale = 0.5;
  const targetScale = 1.0;
  const initialVelocity = 0;

  const result = updateSpring(initialScale, initialVelocity, targetScale, 180, 12, 0.016);
  // Value should move up toward 1.0, velocity should be positive
  assert.ok(result.value > initialScale, 'Spring value should move toward target');
  assert.ok(result.velocity > 0, 'Velocity should be positive towards target');
});

test('handleBoundaryCollision bounces entity within bounds and squashes scale', () => {
  const bounds = { width: 800, height: 600 };
  const entity: PhysicsEntity = {
    x: 10,
    y: 300,
    vx: -150,
    vy: 0,
    radius: 40,
    rotation: 0,
    vRot: 0,
    scaleX: 1,
    scaleY: 1,
    scaleVx: 0,
    scaleVy: 0,
    targetScale: 1,
    alpha: 1,
    life: 0,
    maxLife: 10,
    isFloating: false,
  };

  const collided = handleBoundaryCollision(entity, bounds, 0.8);
  assert.equal(collided, true, 'Should detect boundary collision on left wall');
  assert.ok(entity.vx > 0, 'Horizontal velocity should reverse (bounce right)');
  assert.equal(entity.x, 40, 'Position should clamp to radius');
  assert.ok(entity.scaleX < 1, 'Should squash horizontally');
});

test('applyFriction reduces velocity over time', () => {
  const initialVx = 100;
  const initialVy = 100;
  const damped = applyFriction(initialVx, initialVy, 0.9, 0.016);

  assert.ok(Math.abs(damped.x) < Math.abs(initialVx));
  assert.ok(Math.abs(damped.y) < Math.abs(initialVy));
});

test('isPointInsideCircle correctly accounts for generous toddler touch slop', () => {
  const cx = 100;
  const cy = 100;
  const radius = 30;

  // Exact center
  assert.equal(isPointInsideCircle(100, 100, cx, cy, radius), true);
  // Just inside normal radius
  assert.equal(isPointInsideCircle(125, 100, cx, cy, radius), true);
  // Inside generous toddler slop (30 * 1.35 = 40.5)
  assert.equal(isPointInsideCircle(138, 100, cx, cy, radius), true);
  // Far outside
  assert.equal(isPointInsideCircle(160, 100, cx, cy, radius), false);
});

test('calculateSwipeImpulse produces clamped velocity vector from swipe duration', () => {
  const impulse = calculateSwipeImpulse(100, 100, 200, 100, 50, 1000);
  assert.ok(impulse.x > 0);
  assert.equal(impulse.y, 0);

  // Exceeding max impulse should be clamped
  const fastImpulse = calculateSwipeImpulse(0, 0, 1000, 1000, 10, 500);
  const speed = Math.hypot(fastImpulse.x, fastImpulse.y);
  assert.ok(speed <= 501, 'Velocity must be clamped to maxImpulse');
});
