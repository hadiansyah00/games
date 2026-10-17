/**
 * Pure physics and math calculations for toddler sensory game.
 * Decoupled from DOM/Canvas for fast unit testing.
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface PhysicsEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;
  scaleX: number;
  scaleY: number;
  scaleVx: number;
  scaleVy: number;
  targetScale: number;
  alpha: number;
  life: number;
  maxLife: number;
  isFloating: boolean;
}

/**
 * Clamps delta time to prevent physics explosions during frame drops or tab switching.
 */
export function clampDeltaTime(dt: number, maxDt = 0.05): number {
  if (dt <= 0 || Number.isNaN(dt)) return 0.016;
  return Math.min(dt, maxDt);
}

/**
 * Spring damping simulation for squash and stretch effects.
 * Brings scale back toward targetScale with spring stiffness and damping.
 */
export function updateSpring(
  current: number,
  velocity: number,
  target: number,
  stiffness = 180,
  damping = 12,
  dt = 0.016
): { value: number; velocity: number } {
  const force = -stiffness * (current - target);
  const dampingForce = -damping * velocity;
  const acceleration = force + dampingForce;
  const newVelocity = velocity + acceleration * dt;
  const newValue = current + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

/**
 * Boundary collision with soft restitution and squash.
 */
export function handleBoundaryCollision(
  entity: PhysicsEntity,
  bounds: { width: number; height: number },
  restitution = 0.72
): boolean {
  let collided = false;
  const r = entity.radius;

  // Left boundary
  if (entity.x - r < 0) {
    entity.x = r;
    entity.vx = -entity.vx * restitution;
    entity.scaleX = 0.75;
    entity.scaleY = 1.25;
    collided = true;
  }
  // Right boundary
  else if (entity.x + r > bounds.width) {
    entity.x = bounds.width - r;
    entity.vx = -entity.vx * restitution;
    entity.scaleX = 0.75;
    entity.scaleY = 1.25;
    collided = true;
  }

  // Top boundary
  if (entity.y - r < 0) {
    entity.y = r;
    entity.vy = -entity.vy * restitution;
    entity.scaleY = 0.75;
    entity.scaleX = 1.25;
    collided = true;
  }
  // Bottom boundary
  else if (entity.y + r > bounds.height) {
    entity.y = bounds.height - r;
    entity.vy = -entity.vy * restitution;
    entity.scaleY = 0.75;
    entity.scaleX = 1.25;
    collided = true;
  }

  return collided;
}

/**
 * Applies drag / friction to entity velocities.
 */
export function applyFriction(vx: number, vy: number, frictionPerSecond = 0.92, dt = 0.016): Vector2D {
  const factor = Math.pow(frictionPerSecond, dt * 60);
  return {
    x: vx * factor,
    y: vy * factor,
  };
}

/**
 * Checks if a point (touch/cursor) hits a circular entity.
 */
export function isPointInsideCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  hitSlopMultiplier = 1.35 // generous touch area for little toddler fingers
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const effectiveRadius = radius * hitSlopMultiplier;
  return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
}

/**
 * Calculates impulse vector from a swipe gesture.
 */
export function calculateSwipeImpulse(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  timeDurationMs: number,
  maxImpulse = 900
): Vector2D {
  const durationSec = Math.max(0.02, timeDurationMs / 1000);
  const dx = endX - startX;
  const dy = endY - startY;

  let vx = dx / durationSec;
  let vy = dy / durationSec;

  const speed = Math.hypot(vx, vy);
  if (speed > maxImpulse) {
    const ratio = maxImpulse / speed;
    vx *= ratio;
    vy *= ratio;
  }

  return { x: vx, y: vy };
}
