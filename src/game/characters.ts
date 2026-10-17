/**
 * High-performance procedural vector rendering for toddler characters and shapes.
 * Crisp at all devicePixelRatio levels with delightful squishy animations.
 */

import { CharacterType } from './themes';

export interface RenderableCharacter {
  type: CharacterType;
  x: number;
  y: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  color: string;
  secondaryColor: string;
  alpha: number;
  blinkTimer: number;
  isBlinking: boolean;
  eyeLookX: number;
  eyeLookY: number;
}

/**
 * Draw character onto 2D canvas context with squash, stretch and rotation.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, char: RenderableCharacter, now: number) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, char.alpha));
  ctx.translate(char.x, char.y);
  ctx.rotate(char.rotation);
  ctx.scale(char.scaleX, char.scaleY);

  const r = char.radius;
  const isBlink = char.isBlinking;

  switch (char.type) {
    case 'kitten':
      drawKitten(ctx, r, char.color, char.secondaryColor, isBlink, char.eyeLookX, char.eyeLookY);
      break;
    case 'chick':
      drawChick(ctx, r, isBlink, now);
      break;
    case 'bunny':
      drawBunny(ctx, r, char.color, isBlink);
      break;
    case 'bear':
      drawBear(ctx, r, char.color, isBlink);
      break;
    case 'puppy':
      drawPuppy(ctx, r, char.color, isBlink);
      break;
    case 'star':
      drawStar(ctx, r, char.color, isBlink, now);
      break;
    case 'sun':
      drawSun(ctx, r, now);
      break;
    case 'balloon':
      drawBalloon(ctx, r, char.color, now);
      break;
    case 'bubble':
      drawBubble(ctx, r, now);
      break;
    case 'flower':
      drawFlower(ctx, r, char.color, now);
      break;
    case 'fish':
      drawFish(ctx, r, char.color, now);
      break;
    case 'jellyfish':
      drawJellyfish(ctx, r, char.color, now);
      break;
    case 'moon':
      drawMoon(ctx, r, now);
      break;
    case 'contrast_ring':
      drawContrastRing(ctx, r, now);
      break;
    case 'contrast_star':
      drawContrastStar(ctx, r, now);
      break;
    default:
      drawStar(ctx, r, char.color, isBlink, now);
      break;
  }

  ctx.restore();
}

/* ---------------- Helper Character Drawing Functions ---------------- */

function drawKitten(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  _accent: string,
  isBlink: boolean,
  eyeX: number,
  eyeY: number
) {
  // Ears
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.3);
  ctx.lineTo(-r * 0.75, -r * 1.1);
  ctx.lineTo(-r * 0.2, -r * 0.75);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.3);
  ctx.lineTo(r * 0.75, -r * 1.1);
  ctx.lineTo(r * 0.2, -r * 0.75);
  ctx.closePath();
  ctx.fill();

  // Inner ears (pink)
  ctx.fillStyle = '#FDA4AF';
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, -r * 0.4);
  ctx.lineTo(-r * 0.7, -r * 0.95);
  ctx.lineTo(-r * 0.28, -r * 0.72);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(r * 0.65, -r * 0.4);
  ctx.lineTo(r * 0.7, -r * 0.95);
  ctx.lineTo(r * 0.28, -r * 0.72);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks blush
  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.arc(-r * 0.55, r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  drawEyes(ctx, r * 0.38, -r * 0.1, r * 0.18, isBlink, eyeX, eyeY);

  // Nose (pink)
  ctx.fillStyle = '#F43F5E';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.12);
  ctx.lineTo(-r * 0.12, r * 0.24);
  ctx.lineTo(r * 0.12, r * 0.24);
  ctx.closePath();
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-r * 0.12, r * 0.28, r * 0.14, 0.1, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.12, r * 0.28, r * 0.14, Math.PI * 0.15, Math.PI * 0.9);
  ctx.stroke();

  // Whiskers
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.15);
  ctx.lineTo(-r * 0.95, r * 0.1);
  ctx.moveTo(-r * 0.4, r * 0.3);
  ctx.lineTo(-r * 0.92, r * 0.4);
  ctx.moveTo(r * 0.4, r * 0.15);
  ctx.lineTo(r * 0.95, r * 0.1);
  ctx.moveTo(r * 0.4, r * 0.3);
  ctx.lineTo(r * 0.92, r * 0.4);
  ctx.stroke();
}

function drawChick(ctx: CanvasRenderingContext2D, r: number, isBlink: boolean, now: number) {
  // Wing flutter
  const wingWobble = Math.sin(now * 0.008) * 0.15;

  // Wings
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.ellipse(-r * 0.9, r * 0.1, r * 0.3, r * 0.2, -0.4 + wingWobble, 0, Math.PI * 2);
  ctx.ellipse(r * 0.9, r * 0.1, r * 0.3, r * 0.2, 0.4 - wingWobble, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = '#F87171';
  ctx.beginPath();
  ctx.arc(-r * 0.5, r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.5, r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  drawEyes(ctx, r * 0.34, -r * 0.12, r * 0.15, isBlink, 0, 0);

  // Beak (cute orange)
  ctx.fillStyle = '#FB923C';
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, r * 0.08);
  ctx.lineTo(r * 0.18, r * 0.08);
  ctx.lineTo(0, r * 0.32);
  ctx.closePath();
  ctx.fill();
}

function drawBunny(ctx: CanvasRenderingContext2D, r: number, color: string, isBlink: boolean) {
  // Long bunny ears
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 1.1, r * 0.25, r * 0.65, -0.15, 0, Math.PI * 2);
  ctx.ellipse(r * 0.4, -r * 1.1, r * 0.25, r * 0.65, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#FDA4AF';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 1.1, r * 0.14, r * 0.45, -0.15, 0, Math.PI * 2);
  ctx.ellipse(r * 0.4, -r * 1.1, r * 0.14, r * 0.45, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = '#F472B6';
  ctx.beginPath();
  ctx.arc(-r * 0.5, r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.arc(r * 0.5, r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  drawEyes(ctx, r * 0.35, -r * 0.08, r * 0.16, isBlink, 0, 0);

  // Little pink nose
  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Smiling mouth
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-r * 0.1, r * 0.26, r * 0.12, 0, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.1, r * 0.26, r * 0.12, Math.PI * 0.15, Math.PI);
  ctx.stroke();
}

function drawBear(ctx: CanvasRenderingContext2D, r: number, color: string, isBlink: boolean) {
  // Ears
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-r * 0.72, -r * 0.72, r * 0.38, 0, Math.PI * 2);
  ctx.arc(r * 0.72, -r * 0.72, r * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#FDE68A';
  ctx.beginPath();
  ctx.arc(-r * 0.72, -r * 0.72, r * 0.2, 0, Math.PI * 2);
  ctx.arc(r * 0.72, -r * 0.72, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.22, r * 0.45, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.23);
  ctx.lineTo(0, r * 0.35);
  ctx.stroke();

  // Eyes
  drawEyes(ctx, r * 0.36, -r * 0.12, r * 0.15, isBlink, 0, 0);
}

function drawPuppy(ctx: CanvasRenderingContext2D, r: number, color: string, isBlink: boolean) {
  // Floppy ears
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-r * 0.85, -r * 0.1, r * 0.28, r * 0.6, -0.3, 0, Math.PI * 2);
  ctx.ellipse(r * 0.85, -r * 0.1, r * 0.28, r * 0.6, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Tongue sticking out!
  ctx.fillStyle = '#F43F5E';
  ctx.beginPath();
  ctx.ellipse(r * 0.05, r * 0.4, r * 0.12, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.2, r * 0.35, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.14, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  drawEyes(ctx, r * 0.35, -r * 0.1, r * 0.15, isBlink, 0, 0);
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, color: string, isBlink: boolean, now: number) {
  const points = 5;
  const innerR = r * 0.52;
  const outerR = r * 1.1;
  const rot = (now * 0.0008) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(rot);
  ctx.fillStyle = color || '#FACC15';
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Big smiling face in center of star
  drawEyes(ctx, r * 0.25, -r * 0.06, r * 0.14, isBlink, 0, 0);

  // Big happy mouth
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r * 0.2, 0.1, Math.PI * 0.9);
  ctx.stroke();
}

function drawSun(ctx: CanvasRenderingContext2D, r: number, now: number) {
  const rays = 12;
  const rot = (now * 0.001) % (Math.PI * 2);

  // Rotating soft round rays
  ctx.save();
  ctx.rotate(rot);
  ctx.fillStyle = '#FBBF24';
  for (let i = 0; i < rays; i++) {
    const angle = (i * Math.PI * 2) / rays;
    const rayDist = r * 1.05;
    const rx = Math.cos(angle) * rayDist;
    const ry = Math.sin(angle) * rayDist;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Core sun disk
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Rosy cheeks
  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.arc(-r * 0.45, r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.45, r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eyes and smile
  drawEyes(ctx, r * 0.3, -r * 0.1, r * 0.14, false, 0, 0);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.25, 0.1, Math.PI * 0.9);
  ctx.stroke();
}

function drawBalloon(ctx: CanvasRenderingContext2D, r: number, color: string, now: number) {
  // String wobble
  const wobble = Math.sin(now * 0.005) * (r * 0.15);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, r * 1.05);
  ctx.quadraticCurveTo(wobble, r * 1.6, 0, r * 2.1);
  ctx.stroke();

  // Balloon body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.85, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.4, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Knot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 1.05);
  ctx.lineTo(r * 0.15, r * 1.05);
  ctx.lineTo(0, r * 1.18);
  ctx.closePath();
  ctx.fill();
}

function drawBubble(ctx: CanvasRenderingContext2D, r: number, now: number) {
  const wobble = Math.sin(now * 0.006) * (r * 0.05);

  // Iridescent bubble fill
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.4)');
  grad.addColorStop(0.85, 'rgba(244, 114, 182, 0.35)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.6)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r + wobble, 0, Math.PI * 2);
  ctx.fill();

  // Shimmer border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.stroke();

  // Curved top glossy reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlower(ctx: CanvasRenderingContext2D, r: number, color: string, now: number) {
  const petals = 6;
  const rot = (now * 0.0005) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < petals; i++) {
    const angle = (i * Math.PI * 2) / petals;
    const px = Math.cos(angle) * (r * 0.7);
    const py = Math.sin(angle) * (r * 0.7);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Yellow center disk
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  drawEyes(ctx, r * 0.18, -r * 0.06, r * 0.09, false, 0, 0);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.15, 0.1, Math.PI * 0.9);
  ctx.stroke();
}

function drawFish(ctx: CanvasRenderingContext2D, r: number, color: string, now: number) {
  const tailWag = Math.sin(now * 0.01) * 0.25;

  // Tail fin
  ctx.save();
  ctx.translate(-r * 0.7, 0);
  ctx.rotate(tailWag);
  ctx.fillStyle = '#FB923C';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.6, -r * 0.45);
  ctx.lineTo(-r * 0.4, 0);
  ctx.lineTo(-r * 0.6, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Fish body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // White belly stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big friendly eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(r * 0.4, -r * 0.12, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(r * 0.45, -r * 0.12, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.16, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawJellyfish(ctx: CanvasRenderingContext2D, r: number, color: string, now: number) {
  // Bell dome
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, Math.PI, 0);
  ctx.lineTo(r * 0.85, r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.35, -r * 0.85, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Tentacles
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const tx = i * (r * 0.28);
    const wave = Math.sin(now * 0.008 + i) * (r * 0.2);
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.2);
    ctx.quadraticCurveTo(tx + wave, r * 0.7, tx - wave * 0.5, r * 1.3);
    ctx.stroke();
  }

  // Cute face
  drawEyes(ctx, r * 0.28, -r * 0.2, r * 0.12, false, 0, 0);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, -r * 0.05, r * 0.14, 0.1, Math.PI * 0.9);
  ctx.stroke();
}

function drawMoon(ctx: CanvasRenderingContext2D, r: number, now: number) {
  const glow = Math.sin(now * 0.003) * 0.1;
  ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.2 + glow), 0, Math.PI * 2);
  ctx.fill();

  // Crescent moon
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.6);
  ctx.bezierCurveTo(r * 0.4, -r * 0.6, r * 0.5, r * 0.6, Math.cos(Math.PI * 0.2) * r, Math.sin(Math.PI * 0.2) * r);
  ctx.fill();

  // Sleeping peaceful eye
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.1, r * 0.2, 0.2, Math.PI * 0.85);
  ctx.stroke();
}

function drawContrastRing(ctx: CanvasRenderingContext2D, r: number, now: number) {
  // Bold high-contrast concentric rings
  const pulse = Math.sin(now * 0.005) * 0.08;
  const rad = r * (1 + pulse);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#EF4444'; // Bold Red
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawContrastStar(ctx: CanvasRenderingContext2D, r: number, now: number) {
  const rot = (now * 0.001) % (Math.PI * 2);
  ctx.save();
  ctx.rotate(rot);

  // Outer black star
  drawStarPolygon(ctx, r * 1.15, r * 0.55, '#000000');
  // Inner white star
  drawStarPolygon(ctx, r * 0.85, r * 0.4, '#FFFFFF');
  // Center bold red circle
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawStarPolygon(ctx: CanvasRenderingContext2D, outerR: number, innerR: number, color: string) {
  const points = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  spacing: number,
  y: number,
  eyeRadius: number,
  isBlink: boolean,
  lookX = 0,
  lookY = 0
) {
  if (isBlink) {
    // Happy squinting line
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = Math.max(2, eyeRadius * 0.35);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-spacing, y, eyeRadius, 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(spacing, y, eyeRadius, 0.1, Math.PI * 0.9);
    ctx.stroke();
    return;
  }

  // Big shiny cartoon eyes
  [-spacing, spacing].forEach((ex) => {
    // White sclera
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex, y, eyeRadius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    const px = ex + lookX * eyeRadius * 0.3;
    const py = y + lookY * eyeRadius * 0.3;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(px, py, eyeRadius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Specular shine highlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px - eyeRadius * 0.3, py - eyeRadius * 0.3, eyeRadius * 0.35, 0, Math.PI * 2);
    ctx.arc(px + eyeRadius * 0.25, py + eyeRadius * 0.25, eyeRadius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  });
}
