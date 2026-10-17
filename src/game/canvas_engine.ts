/**
 * High-performance 60fps sensory canvas engine.
 * Handles multi-touch gestures, swipe trails, character springs, and particles.
 */

import {
  clampDeltaTime,
  updateSpring,
  handleBoundaryCollision,
  applyFriction,
  isPointInsideCircle,
  calculateSwipeImpulse,
  PhysicsEntity,
} from './physics';
import { drawCharacter, RenderableCharacter } from './characters';
import { THEMES, ThemeConfig, CharacterType } from './themes';
import { babySound } from './sound';

export interface TouchTrailPoint {
  x: number;
  y: number;
  time: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'bubble' | 'sparkle';
}

export interface ToyEntity extends PhysicsEntity, RenderableCharacter {
  id: number;
  driftAngle: number;
  driftSpeed: number;
  targetRadius: number;
}

export class ToddlerCanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private theme: ThemeConfig;
  private animFrameId: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  // Multi-touch tracking
  private activePointers: Map<number, { lastX: number; lastY: number; lastTime: number; startX: number; startY: number; startTime: number }> = new Map();

  // Entities and particles
  private toys: ToyEntity[] = [];
  private particles: Particle[] = [];
  private nextToyId: number = 1;
  private maxToys: number = 14;

  // Background ambient ripples
  private ripples: Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number; color: string }> = [];

  constructor(canvas: HTMLCanvasElement, initialThemeId: string = 'meadow') {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2d context');
    this.ctx = context;
    this.theme = THEMES[initialThemeId] || THEMES.meadow;
    this.handleResize();
    this.spawnInitialToys();
  }

  public setTheme(themeId: string) {
    if (THEMES[themeId]) {
      this.theme = THEMES[themeId];
      // Adapt existing toys to current theme's palette
      this.toys.forEach((toy) => {
        toy.type = this.pickRandomType();
      });
    }
  }

  public getTheme(): ThemeConfig {
    return this.theme;
  }

  public clearAllToys() {
    // Pop all current toys with confetti particles
    this.toys.forEach((toy) => {
      this.burstParticles(toy.x, toy.y, 10, toy.color);
    });
    this.toys = [];
    babySound.playBubblePop(520);
  }

  public handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.scale(dpr, dpr);
    }
  }

  private pickRandomType(): CharacterType {
    const types = this.theme.entityTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomPaletteColor(): string {
    const colors = this.theme.trailColors;
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private spawnInitialToys() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = Math.min(6, Math.max(3, Math.floor(w / 260)));

    for (let i = 0; i < count; i++) {
      const x = w * 0.2 + Math.random() * (w * 0.6);
      const y = h * 0.25 + Math.random() * (h * 0.5);
      this.createToy(x, y, 0, 0, false);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /* ---------------- Pointer & Touch Handlers ---------------- */

  public onPointerDown(id: number, x: number, y: number) {
    babySound.ensureRunning();
    const now = performance.now();
    this.activePointers.set(id, {
      lastX: x,
      lastY: y,
      lastTime: now,
      startX: x,
      startY: y,
      startTime: now,
    });

    // Check if tapped directly on an existing toy
    let tappedToy = false;
    for (let i = this.toys.length - 1; i >= 0; i--) {
      const toy = this.toys[i];
      if (isPointInsideCircle(x, y, toy.x, toy.y, toy.radius, 1.4)) {
        this.tickleToy(toy);
        tappedToy = true;
        break;
      }
    }

    if (!tappedToy) {
      // Spawn fresh toy with musical chime and ripple
      this.createToy(x, y, (Math.random() - 0.5) * 80, -100 - Math.random() * 80, true);
      this.addRipple(x, y, this.getRandomPaletteColor());
      babySound.playChime(x, y, window.innerWidth, window.innerHeight, this.theme.soundMode);
    }

    this.burstParticles(x, y, 6, this.getRandomPaletteColor());
  }

  public onPointerMove(id: number, x: number, y: number) {
    const ptr = this.activePointers.get(id);
    if (!ptr) {
      // Hovering or untracked pointer, just add gentle sparkle
      return;
    }

    const now = performance.now();
    const dt = Math.max(1, now - ptr.lastTime);
    const dx = x - ptr.lastX;
    const dy = y - ptr.lastY;
    const dist = Math.hypot(dx, dy);

    if (dist > 6) {
      // Swipe detected: spawn sparkles along trail
      const speed = (dist / dt) * 1000;
      this.spawnTrailSparkles(ptr.lastX, ptr.lastY, x, y, Math.min(6, Math.floor(dist / 14)));

      // If moving with sufficient velocity, push nearby toys
      if (speed > 120) {
        const impulse = calculateSwipeImpulse(ptr.lastX, ptr.lastY, x, y, dt, 700);
        this.pushNearbyToys(x, y, impulse.x, impulse.y, 160);
      }

      // Play soft arpeggio on swift swiping
      if (speed > 250) {
        babySound.playSwipeArpeggio(x, y, speed, window.innerWidth, window.innerHeight, this.theme.soundMode);
      }

      ptr.lastX = x;
      ptr.lastY = y;
      ptr.lastTime = now;
    }
  }

  public onPointerUp(id: number, x: number, y: number) {
    const ptr = this.activePointers.get(id);
    if (ptr) {
      const now = performance.now();
      const dt = Math.max(1, now - ptr.lastTime);
      const impulse = calculateSwipeImpulse(ptr.lastX, ptr.lastY, x, y, dt, 800);
      if (Math.hypot(impulse.x, impulse.y) > 80) {
        this.pushNearbyToys(x, y, impulse.x, impulse.y, 180);
      }
    }
    this.activePointers.delete(id);
  }

  public onPointerCancel(id: number) {
    this.activePointers.delete(id);
  }

  /* ---------------- Toy Interactions & Physics ---------------- */

  public createToy(x: number, y: number, vx = 0, vy = 0, popAnimation = true): ToyEntity {
    // If exceeded max toys, gently retire the oldest one
    if (this.toys.length >= this.maxToys) {
      const oldest = this.toys.shift();
      if (oldest) {
        this.burstParticles(oldest.x, oldest.y, 8, oldest.color);
      }
    }

    const type = this.pickRandomType();
    const radius = 38 + Math.random() * 20;
    const colors = this.theme.trailColors;
    const color = colors[Math.floor(Math.random() * colors.length)];

    const toy: ToyEntity = {
      id: this.nextToyId++,
      type,
      x,
      y,
      vx,
      vy,
      radius: popAnimation ? radius * 0.2 : radius,
      targetRadius: radius,
      rotation: 0,
      vRot: (Math.random() - 0.5) * 2,
      scaleX: popAnimation ? 0.3 : 1,
      scaleY: popAnimation ? 0.3 : 1,
      scaleVx: 0,
      scaleVy: 0,
      targetScale: 1,
      alpha: 1,
      life: 0,
      maxLife: 9999,
      isFloating: true,
      color,
      secondaryColor: '#FFFFFF',
      blinkTimer: 100 + Math.random() * 200,
      isBlinking: false,
      eyeLookX: 0,
      eyeLookY: 0,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: 20 + Math.random() * 25,
    };

    this.toys.push(toy);
    return toy;
  }

  private tickleToy(toy: ToyEntity) {
    // Bounce upwards with delightful squash
    toy.vy = -350 - Math.random() * 150;
    toy.vx += (Math.random() - 0.5) * 160;
    toy.scaleX = 1.45;
    toy.scaleY = 0.65;
    toy.vRot = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 4);
    toy.isBlinking = true;
    toy.blinkTimer = 25;

    // Burst happy mini stars
    this.burstParticles(toy.x, toy.y, 14, toy.color);
    babySound.playCuteSqueak(650 + Math.random() * 250);
  }

  private pushNearbyToys(x: number, y: number, impulseX: number, impulseY: number, radius: number) {
    for (const toy of this.toys) {
      const dx = toy.x - x;
      const dy = toy.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius && dist > 1) {
        const factor = (1 - dist / radius) * 0.85;
        toy.vx += impulseX * factor;
        toy.vy += impulseY * factor;
        toy.scaleX = 1.25;
        toy.scaleY = 0.8;
      }
    }
  }

  /* ---------------- Particle & Visual Effects ---------------- */

  private addRipple(x: number, y: number, color: string) {
    this.ripples.push({
      x,
      y,
      radius: 10,
      maxRadius: 90 + Math.random() * 40,
      alpha: 0.6,
      color,
    });
  }

  private spawnTrailSparkles(x1: number, y1: number, x2: number, y2: number, count: number) {
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 12;
      const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 12;
      const color = this.getRandomPaletteColor();

      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40 - 20,
        size: 7 + Math.random() * 8,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3,
        shape: Math.random() > 0.4 ? 'star' : 'bubble',
      });
    }
  }

  public burstParticles(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + Math.random() * 0.5;
      const speed = 70 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 8 + Math.random() * 10,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
        shape: Math.random() > 0.5 ? 'star' : 'sparkle',
      });
    }
  }

  /* ---------------- Main 60 FPS Render Loop ---------------- */

  private loop = (currentTime: number) => {
    if (!this.isRunning) return;

    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const dt = clampDeltaTime(rawDt, 0.05);

    this.update(dt, currentTime);
    this.render(currentTime);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number, now: number) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bounds = { width: w, height: h };

    // Update Toys
    for (const toy of this.toys) {
      // Scale-in pop animation on spawn
      if (toy.radius < toy.targetRadius) {
        toy.radius += (toy.targetRadius - toy.radius) * Math.min(1, dt * 14);
      }

      // Spring squash-and-stretch
      const springX = updateSpring(toy.scaleX, toy.scaleVx, toy.targetScale, 190, 14, dt);
      toy.scaleX = springX.value;
      toy.scaleVx = springX.velocity;

      const springY = updateSpring(toy.scaleY, toy.scaleVy, toy.targetScale, 190, 14, dt);
      toy.scaleY = springY.value;
      toy.scaleVy = springY.velocity;

      // Gentle ambient drift
      toy.driftAngle += dt * 0.8;
      const driftFx = Math.cos(toy.driftAngle) * toy.driftSpeed;
      const driftFy = Math.sin(toy.driftAngle * 0.7) * (toy.driftSpeed * 0.6);

      toy.vx += driftFx * dt;
      toy.vy += (driftFy - 15) * dt; // slight upward helium buoyancy

      // Keep toys clear of top-right utility buttons (parent controls)
      if (toy.x > w - 130 && toy.y < 90) {
        toy.vx -= 120 * dt;
        toy.vy += 80 * dt;
      }

      // Apply drag friction
      const dampedV = applyFriction(toy.vx, toy.vy, 0.94, dt);
      toy.vx = dampedV.x;
      toy.vy = dampedV.y;

      // Integrate position
      toy.x += toy.vx * dt;
      toy.y += toy.vy * dt;

      // Handle soft boundary collisions
      const collided = handleBoundaryCollision(toy, bounds, 0.75);
      if (collided) {
        babySound.playBubblePop(380 + Math.random() * 120);
      }

      // Rotation dampening
      toy.rotation += toy.vRot * dt;
      toy.vRot *= Math.pow(0.85, dt * 60);

      // Blinking timer
      toy.blinkTimer -= dt * 60;
      if (toy.blinkTimer <= 0) {
        if (!toy.isBlinking) {
          toy.isBlinking = true;
          toy.blinkTimer = 8 + Math.random() * 6; // brief blink duration
        } else {
          toy.isBlinking = false;
          toy.blinkTimer = 160 + Math.random() * 260; // wait before next blink
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt; // gentle gravity
      p.alpha = 1 - p.life / p.maxLife;
    }

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.radius += dt * 140;
      rip.alpha -= dt * 1.2;
      if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }
  }

  private render(now: number) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;

    // Clear background with soft gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.theme.bgGradient[0]);
    grad.addColorStop(1, this.theme.bgGradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle background floating sparkles/clouds
    this.renderBackgroundAmbience(ctx, w, h, now);

    // Draw ripples
    for (const rip of this.ripples) {
      ctx.save();
      ctx.strokeStyle = rip.color;
      ctx.globalAlpha = Math.max(0, rip.alpha);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw toys
    for (const toy of this.toys) {
      drawCharacter(ctx, toy, now);
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      if (p.shape === 'star') {
        const r = p.size;
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = (j * Math.PI * 2) / 5 - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          const aInner = a + Math.PI / 5;
          ctx.lineTo(Math.cos(aInner) * (r * 0.45), Math.sin(aInner) * (r * 0.45));
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'bubble') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sparkle / cross
        const s = p.size;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderBackgroundAmbience(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    if (this.theme.id === 'meadow') {
      // Soft rolling green hill at bottom
      ctx.fillStyle = '#86EFAC';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.88);
      ctx.quadraticCurveTo(w * 0.3, h * 0.82, w * 0.65, h * 0.87);
      ctx.quadraticCurveTo(w * 0.85, h * 0.89, w, h * 0.84);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Fluffy peaceful clouds in sky
      const cloudX = ((now * 0.015) % (w + 200)) - 100;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      this.drawSimpleCloud(ctx, cloudX, h * 0.12, 60);
      this.drawSimpleCloud(ctx, (cloudX + w * 0.5) % (w + 200) - 100, h * 0.2, 45);
    } else if (this.theme.id === 'ocean') {
      // Floating light water caustics
      const wave = Math.sin(now * 0.002) * 15;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.3);
      ctx.quadraticCurveTo(w * 0.5, h * 0.3 + wave, w, h * 0.3);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    } else if (this.theme.id === 'night') {
      // Twinkling background stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 93.7) % (h * 0.7));
        const twinkle = Math.sin(now * 0.003 + i) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + twinkle * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawSimpleCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.1, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}
