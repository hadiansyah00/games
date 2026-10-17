/**
 * Procedural 3D composite models (3-12 part THREE.Group hierarchies) and
 * zero-dependency procedural CanvasTextures for the 3D Sensory & Score World.
 */

import * as THREE from 'three';
import { CharacterType } from './themes';

/**
 * Generates a tileable procedural meadow grass & clover CanvasTexture + bumpMap.
 */
export function createMeadowTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  // Base lush meadow green
  ctx.fillStyle = '#65C466';
  ctx.fillRect(0, 0, size, size);

  // Soft organic grass patches & clover blades
  for (let i = 0; i < 240; i++) {
    const x = (i * 73) % size;
    const y = (i * 139) % size;
    const r = 4 + (i % 7);
    ctx.fillStyle = i % 3 === 0 ? '#76D275' : i % 3 === 1 ? '#57B359' : '#85DF82';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 14);
  map.anisotropy = maxAnisotropy;

  // Grayscale micro-relief bump canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const x = (i * 53) % size;
    const y = (i * 97) % size;
    bCtx.fillStyle = i % 2 === 0 ? '#A8A8A8' : '#585858';
    bCtx.fillRect(x, y, 3, 6);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(14, 14);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Generates a soft radial contact shadow texture so grounded & floating toys have clear depth cues.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Shared geometry cache for performance
let sharedStarExtrudeGeo: THREE.ExtrudeGeometry | null = null;
let sharedBalloonLatheGeo: THREE.LatheGeometry | null = null;

function getStarExtrudeGeometry(): THREE.ExtrudeGeometry {
  if (sharedStarExtrudeGeo) return sharedStarExtrudeGeo;

  const shape = new THREE.Shape();
  const points = 5;
  const outerR = 0.72;
  const innerR = 0.35;

  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = -Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  sharedStarExtrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09,
  });
  sharedStarExtrudeGeo.center();
  return sharedStarExtrudeGeo;
}

function getBalloonLatheGeometry(): THREE.LatheGeometry {
  if (sharedBalloonLatheGeo) return sharedBalloonLatheGeo;

  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const angle = t * Math.PI;
    // Teardrop profile
    const rx = Math.sin(angle) * (0.62 + 0.14 * Math.sin(t * Math.PI * 0.8));
    const ry = -Math.cos(angle) * 0.78;
    pts.push(new THREE.Vector2(Math.max(0.001, rx), ry));
  }
  sharedBalloonLatheGeo = new THREE.LatheGeometry(pts, 24);
  return sharedBalloonLatheGeo;
}

/**
 * Helper to attach expressive 3D glossy cartoon eyes with white specular highlights.
 */
function addExpressive3DEyes(group: THREE.Group, y: number, z: number, spacing = 0.22, scale = 1.0) {
  const scleraMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.05,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.06,
    metalness: 0.25,
  });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const eyeGeo = new THREE.SphereGeometry(0.11 * scale, 16, 16);
  const pupilGeo = new THREE.SphereGeometry(0.075 * scale, 14, 14);
  const shineGeo = new THREE.SphereGeometry(0.03 * scale, 10, 10);

  [-spacing, spacing].forEach((xOffset) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(xOffset, y, z);

    const sclera = new THREE.Mesh(eyeGeo, scleraMat);
    sclera.scale.set(1, 1, 0.65);
    eyeGroup.add(sclera);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, 0.045 * scale);
    pupil.scale.set(1, 1, 0.65);
    eyeGroup.add(pupil);

    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.position.set(-0.025 * scale, 0.03 * scale, 0.09 * scale);
    eyeGroup.add(shine);

    group.add(eyeGroup);
  });
}

/**
 * Builds a composite 3-12 part 3D Toy Character Group pivoted at its base (y = 0).
 */
export function build3DToyCharacter(type: CharacterType, hexColor: string): THREE.Group {
  const root = new THREE.Group();
  const mainColor = new THREE.Color(hexColor);

  // Distinct PBR materials with >= 0.25 roughness differentiation
  const satinBodyMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    roughness: 0.52,
    metalness: 0.06,
  });
  const creamBellyMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    roughness: 0.78,
    metalness: 0.02,
  });
  const pinkAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    roughness: 0.35,
    metalness: 0.1,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.18,
    metalness: 0.85,
  });

  switch (type) {
    case 'star':
    case 'contrast_star': {
      // 6-part Beveled 3D Star with Halo, Expressive Eyes, Rosy Cheeks, and Crown Gem
      const starMat = new THREE.MeshStandardMaterial({
        color: type === 'contrast_star' ? 0xef4444 : 0xfacc15,
        roughness: 0.2,
        metalness: 0.72,
        emissive: type === 'contrast_star' ? 0x450a0a : 0x78350f,
        emissiveIntensity: 0.22,
      });

      const starMesh = new THREE.Mesh(getStarExtrudeGeometry(), starMat);
      starMesh.position.y = 0.82;
      starMesh.castShadow = true;
      root.add(starMesh);

      // Decorative orbiting gold ring (secondary silhouette)
      const haloGeo = new THREE.TorusGeometry(0.86, 0.035, 12, 36);
      const halo = new THREE.Mesh(haloGeo, creamBellyMat);
      halo.position.y = 0.82;
      halo.rotation.x = Math.PI * 0.35;
      root.add(halo);

      // Expressive 3D eyes & cheeks on the star face
      addExpressive3DEyes(root, 0.88, 0.18, 0.19, 0.9);

      const cheekGeo = new THREE.SphereGeometry(0.075, 12, 12);
      [-0.3, 0.3].forEach((cx) => {
        const cheek = new THREE.Mesh(cheekGeo, pinkAccentMat);
        cheek.position.set(cx, 0.75, 0.18);
        cheek.scale.set(1.2, 0.8, 0.5);
        root.add(cheek);
      });

      // Smiling mouth arc (Torus segment)
      const smileGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 16, Math.PI);
      const smileMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 });
      const smile = new THREE.Mesh(smileGeo, smileMat);
      smile.position.set(0, 0.75, 0.2);
      smile.rotation.z = Math.PI;
      root.add(smile);
      break;
    }

    case 'balloon': {
      // 6-part Glossy Clearcoat Balloon with Knot, Specular Patch, Gold Collar, and Swaying String
      const balloonMat = new THREE.MeshPhysicalMaterial({
        color: mainColor,
        roughness: 0.12,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
      const hull = new THREE.Mesh(getBalloonLatheGeometry(), balloonMat);
      hull.position.y = 1.05;
      hull.castShadow = true;
      root.add(hull);

      // Tie knot at bottom of balloon
      const knotGeo = new THREE.ConeGeometry(0.14, 0.18, 16);
      const knot = new THREE.Mesh(knotGeo, balloonMat);
      knot.position.y = 0.24;
      root.add(knot);

      // Gold collar ring around knot
      const ringGeo = new THREE.TorusGeometry(0.09, 0.03, 10, 20);
      const ring = new THREE.Mesh(ringGeo, goldTrimMat);
      ring.position.y = 0.28;
      ring.rotation.x = Math.PI / 2;
      root.add(ring);

      // Curved string (TubeGeometry)
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.22, 0),
        new THREE.Vector3(0.06, 0.12, 0.02),
        new THREE.Vector3(-0.04, 0.04, -0.02),
        new THREE.Vector3(0, 0, 0),
      ]);
      const stringGeo = new THREE.TubeGeometry(curve, 12, 0.018, 8, false);
      const stringMesh = new THREE.Mesh(stringGeo, creamBellyMat);
      root.add(stringMesh);

      addExpressive3DEyes(root, 1.12, 0.56, 0.2, 0.9);
      break;
    }

    case 'chick': {
      // 9-part Chubby 3D Baby Chick
      const chickMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.5,
        metalness: 0.05,
      });
      const beakMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.22,
        metalness: 0.15,
      });

      // Plump egg body
      const bodyGeo = new THREE.SphereGeometry(0.58, 24, 24);
      const body = new THREE.Mesh(bodyGeo, chickMat);
      body.scale.set(1, 1.08, 0.95);
      body.position.y = 0.62;
      body.castShadow = true;
      root.add(body);

      // Belly patch
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), creamBellyMat);
      belly.position.set(0, 0.52, 0.24);
      belly.scale.set(0.95, 0.9, 0.5);
      root.add(belly);

      // Head tuft feathers (2 cones)
      [-0.08, 0.08].forEach((tx, idx) => {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 12), chickMat);
        tuft.position.set(tx, 1.26, 0);
        tuft.rotation.z = idx === 0 ? 0.25 : -0.25;
        root.add(tuft);
      });

      // Flapping side wings
      const wingGeo = new THREE.SphereGeometry(0.24, 16, 16);
      [-0.58, 0.58].forEach((wx, idx) => {
        const wing = new THREE.Mesh(wingGeo, chickMat);
        wing.scale.set(0.45, 0.9, 0.7);
        wing.position.set(wx, 0.64, 0.05);
        wing.rotation.z = idx === 0 ? 0.35 : -0.35;
        root.add(wing);
      });

      // Orange conical beak
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.25, 16), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.68, 0.62);
      root.add(beak);

      // Little orange feet
      [-0.22, 0.22].forEach((fx) => {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.14, 12), beakMat);
        foot.position.set(fx, 0.07, 0.08);
        root.add(foot);
      });

      addExpressive3DEyes(root, 0.8, 0.5, 0.22, 0.95);
      break;
    }

    case 'bunny': {
      // 9-part 3D Plush Bunny with Tall Ears, Inner Ear Recesses, Cotton Tail, and Whiskers
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 22), satinBodyMat);
      body.position.y = 0.48;
      body.scale.set(1, 0.95, 0.9);
      body.castShadow = true;
      root.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 22), satinBodyMat);
      head.position.y = 1.05;
      head.castShadow = true;
      root.add(head);

      // Tall bunny ears + pink inner recesses
      const earGeo = new THREE.CapsuleGeometry(0.11, 0.46, 8, 16);
      const innerEarGeo = new THREE.CapsuleGeometry(0.065, 0.36, 8, 12);
      [-0.2, 0.2].forEach((ex, i) => {
        const ear = new THREE.Mesh(earGeo, satinBodyMat);
        ear.position.set(ex, 1.62, -0.02);
        ear.rotation.z = i === 0 ? 0.15 : -0.15;
        ear.castShadow = true;
        root.add(ear);

        const inner = new THREE.Mesh(innerEarGeo, pinkAccentMat);
        inner.position.set(ex, 1.62, 0.06);
        inner.rotation.z = i === 0 ? 0.15 : -0.15;
        root.add(inner);
      });

      // Fluffy white cotton tail
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), creamBellyMat);
      tail.position.set(0, 0.38, -0.45);
      root.add(tail);

      // Cute pink nose
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), pinkAccentMat);
      nose.position.set(0, 1.02, 0.45);
      root.add(nose);

      addExpressive3DEyes(root, 1.12, 0.4, 0.19, 0.9);
      break;
    }

    case 'bear': {
      // 10-part 3D Teddy Bear with Round Ears, Cream Snout, Gold Bowtie, Arms & Paws
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 22), satinBodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      root.add(body);

      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 18), creamBellyMat);
      belly.position.set(0, 0.48, 0.22);
      belly.scale.set(1, 1, 0.5);
      root.add(belly);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 22), satinBodyMat);
      head.position.y = 1.08;
      head.castShadow = true;
      root.add(head);

      // Round bear ears + cream centers
      [-0.35, 0.35].forEach((ex) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), satinBodyMat);
        ear.position.set(ex, 1.42, -0.04);
        root.add(ear);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), creamBellyMat);
        inner.position.set(ex, 1.42, 0.08);
        root.add(inner);
      });

      // Cream snout + dark glossy button nose
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), creamBellyMat);
      snout.position.set(0, 1.0, 0.38);
      snout.scale.set(1.2, 0.9, 0.75);
      root.add(snout);

      const noseMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.1, metalness: 0.2 });
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), noseMat);
      nose.position.set(0, 1.05, 0.51);
      root.add(nose);

      // Metallic gold collar/bowtie accent
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 24), goldTrimMat);
      bow.position.y = 0.78;
      bow.rotation.x = Math.PI / 2;
      root.add(bow);

      addExpressive3DEyes(root, 1.16, 0.4, 0.2, 0.9);
      break;
    }

    default: {
      // 10-part 3D Kitten with Pointed Ears, Gold Bell Collar, Curved Tail, and Rosy Cheeks
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 22), satinBodyMat);
      body.position.y = 0.48;
      body.castShadow = true;
      root.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 24), satinBodyMat);
      head.position.y = 1.06;
      head.scale.set(1.06, 0.96, 0.96);
      head.castShadow = true;
      root.add(head);

      // Pointed ears
      const earGeo = new THREE.ConeGeometry(0.19, 0.36, 16);
      [-0.32, 0.32].forEach((ex, i) => {
        const ear = new THREE.Mesh(earGeo, satinBodyMat);
        ear.position.set(ex, 1.46, 0);
        ear.rotation.z = i === 0 ? 0.32 : -0.32;
        ear.castShadow = true;
        root.add(ear);
      });

      // Gold collar + shiny bell
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 10, 24), goldTrimMat);
      collar.position.y = 0.74;
      collar.rotation.x = Math.PI / 2;
      root.add(collar);

      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 14), goldTrimMat);
      bell.position.set(0, 0.72, 0.34);
      root.add(bell);

      // Curved kitty tail (TubeGeometry)
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.35, -0.4),
        new THREE.Vector3(0.22, 0.55, -0.58),
        new THREE.Vector3(0.32, 0.85, -0.52),
      ]);
      const tailGeo = new THREE.TubeGeometry(tailCurve, 12, 0.075, 10, false);
      const tail = new THREE.Mesh(tailGeo, satinBodyMat);
      root.add(tail);

      // Pink nose & cheeks
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), pinkAccentMat);
      nose.position.set(0, 1.02, 0.46);
      root.add(nose);

      addExpressive3DEyes(root, 1.12, 0.42, 0.21, 0.92);
      break;
    }
  }

  return root;
}

/**
 * Builds a composite 5-part 3D stylized Meadow Tree for the natural outdoor perimeter.
 */
export function build3DTree(scale = 1.0): THREE.Group {
  const tree = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.85,
    metalness: 0.02,
  });
  const crownMat1 = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.55,
    metalness: 0.05,
  });
  const crownMat2 = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    roughness: 0.48,
    metalness: 0.05,
  });

  // Trunk pivoted at base
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.4, 14), trunkMat);
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // 3 layered foliage crowns
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 18), crownMat1);
  c1.position.set(0, 1.75, 0);
  c1.scale.set(1, 0.85, 1);
  c1.castShadow = true;
  tree.add(c1);

  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), crownMat2);
  c2.position.set(0.32, 2.25, 0.15);
  c2.castShadow = true;
  tree.add(c2);

  const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 16), crownMat2);
  c3.position.set(-0.28, 2.35, -0.1);
  c3.castShadow = true;
  tree.add(c3);

  tree.scale.setScalar(scale);
  return tree;
}

/**
 * Builds a cheerful 7-part 3D Rainbow & Cloud Arch Landmark for the background vista.
 */
export function build3DRainbowLandmark(): THREE.Group {
  const group = new THREE.Group();
  const colors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];

  colors.forEach((hex, idx) => {
    const radius = 6.8 - idx * 0.34;
    const geo = new THREE.TorusGeometry(radius, 0.18, 14, 48, Math.PI);
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.3,
      metalness: 0.15,
    });
    const arc = new THREE.Mesh(geo, mat);
    group.add(arc);
  });

  // Fluffy cloud bases at both ends of the rainbow
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.02,
  });

  [-5.8, 5.8].forEach((cx) => {
    const cloudCluster = new THREE.Group();
    cloudCluster.position.set(cx, 0.4, 0.3);
    [-0.7, 0, 0.7].forEach((ox, j) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(j === 1 ? 0.95 : 0.72, 16, 16),
        cloudMat
      );
      puff.position.set(ox, j === 1 ? 0.25 : 0, 0);
      cloudCluster.add(puff);
    });
    group.add(cloudCluster);
  });

  return group;
}
