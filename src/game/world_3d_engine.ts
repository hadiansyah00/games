/**
 * 3D WebGL Sensory & Score World Engine (Three.js).
 * Features:
 * - RoomEnvironment PBR reflections + ACESFilmicToneMapping
 * - Warm Directional Key Light + Cool Hemisphere Fill + Horizon-matched FogExp2
 * - Composite 3-12 part 3D Toy Characters with grounded contact shadows
 * - InstancedMesh meadow flowers (>40 instances) + Zero-GC pooled 3D particle ring buffer
 * - Full multi-touch & mouse raycasting + swipe trail impulses + Score Mode star spawning
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clampDeltaTime, updateSpring } from './physics';
import { THEMES, ThemeConfig, CharacterType } from './themes';
import {
  createMeadowTextures,
  createContactShadowTexture,
  build3DToyCharacter,
  build3DTree,
  build3DRainbowLandmark,
} from './models_3d';
import { babySound } from './sound';
import {
  GamePlayMode,
  ScoreState,
  createInitialScoreState,
  registerScoreHit,
  tickComboTimer,
  advanceScoreTarget,
} from './score_rules';

// Pre-allocated scratch math objects (Zero GC inside requestAnimationFrame)
const _dummy = new THREE.Object3D();
const _vec3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _planeIntersect = new THREE.Vector3();
const _color = new THREE.Color();

export type CameraPreset = 'overview' | 'closeup' | 'aerial';

export interface FloatingScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

interface ToyActor3D {
  id: number;
  type: CharacterType;
  group: THREE.Group;
  shadowMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  baseY: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  vRotY: number;
  scaleX: number;
  scaleY: number;
  scaleVx: number;
  scaleVy: number;
  targetScale: number;
  bobPhase: number;
  colorHex: string;
  lastHitTime: number;
}

interface PooledParticle3D {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class ToddlerWorld3DEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isHeadless: boolean;

  private theme: ThemeConfig;
  private playMode: GamePlayMode = 'score';
  private scoreState: ScoreState;
  private onScoreChange?: (state: ScoreState, popup?: FloatingScorePopup) => void;

  // Lighting & Environment refs for theme switching
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private groundMat!: THREE.MeshStandardMaterial;
  private contactShadowTex!: THREE.CanvasTexture;

  // Actors & Instanced Pools
  private toys: ToyActor3D[] = [];
  private nextToyId = 1;
  private maxToys = 12;

  private particleCapacity = 120;
  private particleMesh!: THREE.InstancedMesh;
  private particlePool: PooledParticle3D[] = [];
  private particleCursor = 0;

  private flowerInstancedMesh!: THREE.InstancedMesh;

  // Camera state & presets
  private cameraPreset: CameraPreset = 'overview';
  private camCurrentPos = new THREE.Vector3(0, 4.6, 10.5);
  private camTargetPos = new THREE.Vector3(0, 4.6, 10.5);
  private camLookAt = new THREE.Vector3(0, 1.3, 0);
  private cameraTrauma = 0;

  // Interaction & Swipe tracking
  private playPlane = new THREE.Plane(new THREE.Vector3(0, 0.15, 1).normalize(), 0);
  private activePointers = new Map<
    number,
    { lastX: number; lastY: number; lastWorld: THREE.Vector3; lastTime: number }
  >();

  // Animation loop state
  private isRunning = false;
  private animFrameId = 0;
  private lastTime = 0;
  private starSpawnTimer = 0;
  private popupCounter = 1;

  constructor(
    container: HTMLElement,
    initialThemeId: string = 'meadow',
    initialMode: GamePlayMode = 'score',
    onScoreChange?: (state: ScoreState, popup?: FloatingScorePopup) => void
  ) {
    this.container = container;
    this.theme = THEMES[initialThemeId] || THEMES.meadow;
    this.playMode = initialMode;
    this.onScoreChange = onScoreChange;

    const savedBest = this.loadBestScore();
    this.scoreState = createInitialScoreState(savedBest, 200);

    this.isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // 1. Initialize WebGLRenderer with ACESFilmicToneMapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isHeadless,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.dataset.testid = 'sensory-canvas';
    this.renderer.domElement.className = 'block w-full h-full touch-none select-none cursor-pointer';
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 2. Initialize Scene & Studio RoomEnvironment
    this.scene = new THREE.Scene();
    if (!this.isHeadless) {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    // 3. Initialize Camera
    this.camera = new THREE.PerspectiveCamera(46, width / Math.max(1, height), 0.1, 120);
    this.camera.position.copy(this.camCurrentPos);
    this.camera.lookAt(this.camLookAt);

    // 4. Build Lighting, Ground, Landmarks, Instanced Flowers & Particle Pool
    this.setupLighting();
    this.setupEnvironmentMesh();
    this.setupParticlePool();
    this.applyThemeVisuals();
    this.spawnInitialToys();

    // Pre-warm shaders once
    if (!this.isHeadless) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private loadBestScore(): number {
    try {
      const raw = localStorage.getItem('balita_ceria_best_score');
      return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore(best: number) {
    try {
      localStorage.setItem('balita_ceria_best_score', String(Math.round(best)));
    } catch {
      // Ignore storage errors
    }
  }

  private setupLighting() {
    // Cool sky / warm ground HemisphereLight fill
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x86efac, 0.95);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    // Warm Golden Directional Key Light with tight shadow frustum
    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
    this.dirLight.position.set(7, 14, 9);
    this.dirLight.castShadow = !this.isHeadless;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 35;
    const d = 10;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    // Soft Rim Backlight for 3D toy separation
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.75);
    rimLight.position.set(-8, 6, -10);
    this.scene.add(rimLight);
  }

  private setupEnvironmentMesh() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const { map, bumpMap } = createMeadowTextures(maxAniso);
    this.contactShadowTex = createContactShadowTexture();

    // Extended natural outdoor terrain disc (radius 48m, never boxed inside indoor walls)
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.04,
      roughness: 0.82,
      metalness: 0.02,
    });
    const groundGeo = new THREE.CircleGeometry(48, 48);
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Gentle rolling background hills around outdoor perimeter
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.78,
      metalness: 0.02,
    });
    const hillPositions = [
      { x: -11, z: -12, rx: 7, ry: 2.6, rz: 5 },
      { x: 0, z: -15, rx: 10, ry: 3.2, rz: 6 },
      { x: 12, z: -11, rx: 7.5, ry: 2.8, rz: 5 },
    ];
    hillPositions.forEach((h) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hillMat);
      hill.position.set(h.x, -0.3, h.z);
      hill.scale.set(h.rx, h.ry, h.rz);
      hill.receiveShadow = true;
      this.scene.add(hill);
    });

    // Landmark Vista: 7-part 3D Rainbow Arch in the background
    const rainbow = build3DRainbowLandmark();
    rainbow.position.set(0, 0.2, -13.5);
    this.scene.add(rainbow);

    // Composite 5-part 3D Meadow Trees framing left & right outdoor horizon
    const treeCoords = [
      { x: -8.2, z: -6.5, s: 1.1 },
      { x: -6.0, z: -8.5, s: 0.9 },
      { x: 6.4, z: -8.2, s: 0.95 },
      { x: 8.5, z: -6.2, s: 1.15 },
      { x: -9.8, z: -2.8, s: 0.85 },
      { x: 9.8, z: -2.8, s: 0.85 },
    ];
    treeCoords.forEach((tc) => {
      const tree = build3DTree(tc.s);
      tree.position.set(tc.x, 0, tc.z);
      this.scene.add(tree);
    });

    // InstancedMesh (>40 instances) for colorful meadow flowers scattered on ground
    const flowerCount = 48;
    const flowerGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.08, 12);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.05,
    });
    this.flowerInstancedMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    this.flowerInstancedMesh.position.y = 0.04; // disjoint depth >= 0.02 above floor

    const palette = [0xf43f5e, 0xfacc15, 0x38bdf8, 0xc084fc, 0xfb923c, 0xffffff];
    for (let i = 0; i < flowerCount; i++) {
      const angle = (i / flowerCount) * Math.PI * 2 + (i % 5) * 0.3;
      const dist = 3.5 + (i % 9) * 1.15;
      const fx = Math.cos(angle) * dist;
      const fz = Math.sin(angle) * dist - 2.0;
      const scale = 0.85 + (i % 4) * 0.12;

      _dummy.position.set(fx, 0, fz);
      _dummy.rotation.set(0, angle, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      this.flowerInstancedMesh.setMatrixAt(i, _dummy.matrix);

      _color.setHex(palette[i % palette.length]);
      this.flowerInstancedMesh.setColorAt(i, _color);
    }
    this.flowerInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.flowerInstancedMesh.instanceColor) {
      this.flowerInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.flowerInstancedMesh.computeBoundingSphere();
    this.scene.add(this.flowerInstancedMesh);
  }

  private setupParticlePool() {
    const pGeo = new THREE.OctahedronGeometry(0.16, 1);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.4,
      emissive: 0x333333,
      emissiveIntensity: 0.3,
    });

    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.particleCapacity);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.particleCapacity; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 1,
        life: 0,
        maxLife: 0.6,
        color: new THREE.Color(0xfacc15),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xfacc15));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  private applyThemeVisuals() {
    let skyHex = 0xbae6fd;
    let groundTint = 0xffffff;

    if (this.theme.id === 'meadow') {
      skyHex = 0xfef08a;
      groundTint = 0xffffff;
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0x86efac);
      this.dirLight.intensity = 1.9;
    } else if (this.theme.id === 'ocean') {
      skyHex = 0x7dd3fc;
      groundTint = 0xbae6fd;
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x38bdf8);
      this.dirLight.intensity = 1.75;
    } else if (this.theme.id === 'night') {
      skyHex = 0x1e1b4b;
      groundTint = 0x4338ca;
      this.hemiLight.color.setHex(0x818cf8);
      this.hemiLight.groundColor.setHex(0x1e1b4b);
      this.dirLight.intensity = 1.25;
    } else if (this.theme.id === 'contrast') {
      skyHex = 0x09090b;
      groundTint = 0xfacc15;
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0xef4444);
      this.dirLight.intensity = 2.1;
    }

    this.scene.background = new THREE.Color(skyHex);
    this.scene.fog = new THREE.FogExp2(skyHex, 0.022);
    this.groundMat.color.setHex(groundTint);
  }

  /* ---------------- Public Controls & State Sync ---------------- */

  public setTheme(themeId: string) {
    if (THEMES[themeId]) {
      this.theme = THEMES[themeId];
      this.applyThemeVisuals();
      this.clearAllToys(false);
      this.spawnInitialToys();
    }
  }

  public setPlayMode(mode: GamePlayMode) {
    this.playMode = mode;
    if (mode === 'score') {
      // Ensure at least 2 golden stars are present in Score Mode
      this.spawnToy3D((Math.random() - 0.5) * 4, 1.2, (Math.random() - 0.5) * 2, 'star');
      this.spawnToy3D((Math.random() - 0.5) * 4, 1.5, (Math.random() - 0.5) * 2, 'star');
      this.emitScoreUpdate();
    }
  }

  public getPlayMode(): GamePlayMode {
    return this.playMode;
  }

  public getScoreState(): ScoreState {
    return this.scoreState;
  }

  public resetScoreRun() {
    this.scoreState = createInitialScoreState(this.scoreState.bestScore, 200);
    this.emitScoreUpdate();
    this.clearAllToys(false);
    this.spawnInitialToys();
  }

  public continueNextScoreStage() {
    this.scoreState = advanceScoreTarget(this.scoreState);
    this.emitScoreUpdate();
    // Spawn bonus celebration stars
    for (let i = 0; i < 4; i++) {
      this.spawnToy3D((i - 1.5) * 2.1, 1.2 + i * 0.2, 0, 'star');
    }
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraPreset = preset;
    if (preset === 'overview') {
      this.camTargetPos.set(0, 4.6, 10.5);
    } else if (preset === 'closeup') {
      this.camTargetPos.set(0, 2.5, 7.6);
    } else if (preset === 'aerial') {
      this.camTargetPos.set(0, 8.8, 7.2);
    }
  }

  public getCameraPreset(): CameraPreset {
    return this.cameraPreset;
  }

  public clearAllToys(playAudio = true) {
    for (const toy of this.toys) {
      this.burstParticles3D(toy.x, toy.y + 0.6, toy.z, 10, toy.colorHex);
      this.scene.remove(toy.group);
      this.scene.remove(toy.shadowMesh);
    }
    this.toys = [];
    if (playAudio) {
      babySound.playBubblePop(520);
    }
  }

  public handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
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

  public dispose() {
    this.stop();
    this.renderer.dispose();
  }

  /* ---------------- Spawning & 3D Toy Management ---------------- */

  private pickRandomCharacterType(): CharacterType {
    const pool = this.theme.entityTypes;
    if (this.playMode === 'score' && Math.random() < 0.42) {
      return 'star';
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickRandomColor(): string {
    const colors = this.theme.trailColors;
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private spawnInitialToys() {
    const positions = [
      { x: -3.2, y: 0.2, z: 0.4, type: 'kitten' as CharacterType },
      { x: -1.1, y: 0.3, z: -0.8, type: 'star' as CharacterType },
      { x: 1.2, y: 0.2, z: 0.5, type: 'chick' as CharacterType },
      { x: 3.1, y: 0.2, z: -0.5, type: 'bunny' as CharacterType },
      { x: 0.0, y: 1.5, z: -1.6, type: 'balloon' as CharacterType },
      { x: -2.2, y: 1.2, z: -1.4, type: 'bear' as CharacterType },
    ];

    positions.forEach((p) => {
      this.spawnToy3D(p.x, p.y, p.z, p.type);
    });
  }

  public spawnToy3D(
    x: number,
    y: number,
    z: number,
    forcedType?: CharacterType
  ): ToyActor3D {
    if (this.toys.length >= this.maxToys) {
      const oldest = this.toys.shift();
      if (oldest) {
        this.burstParticles3D(oldest.x, oldest.y + 0.6, oldest.z, 8, oldest.colorHex);
        this.scene.remove(oldest.group);
        this.scene.remove(oldest.shadowMesh);
      }
    }

    const type = forcedType || this.pickRandomCharacterType();
    const colorHex = this.pickRandomColor();
    const group = build3DToyCharacter(type, colorHex);

    const baseY = type === 'balloon' || type === 'star' ? 0.55 + Math.random() * 0.9 : 0.02;
    const spawnY = Math.max(baseY, y);

    group.position.set(x, spawnY, z);
    group.scale.setScalar(0.25);
    this.scene.add(group);

    // Soft radial contact shadow plane directly beneath the 3D toy (y = 0.025 prevents Z-fighting)
    const shadowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(x, 0.025, z);
    this.scene.add(shadowMesh);

    const actor: ToyActor3D = {
      id: this.nextToyId++,
      type,
      group,
      shadowMesh,
      x,
      y: spawnY,
      z,
      baseY,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 2.2 + Math.random() * 1.2,
      vz: (Math.random() - 0.5) * 0.8,
      rotY: (Math.random() - 0.5) * 0.5,
      vRotY: (Math.random() - 0.5) * 1.5,
      scaleX: 0.3,
      scaleY: 0.3,
      scaleVx: 0,
      scaleVy: 0,
      targetScale: 1.0,
      bobPhase: Math.random() * Math.PI * 2,
      colorHex,
      lastHitTime: 0,
    };

    this.toys.push(actor);
    return actor;
  }

  /* ---------------- Pointer, Touch & Raycasting ---------------- */

  private screenToWorldOnPlane(clientX: number, clientY: number, out: THREE.Vector3): THREE.Vector3 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    _ndc.x = ((clientX - rect.left) / w) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / h) * 2 + 1;

    _rayOrigin.setFromMatrixPosition(this.camera.matrixWorld);
    _rayDir.set(_ndc.x, _ndc.y, 0.5).unproject(this.camera).sub(_rayOrigin).normalize();

    const ray = new THREE.Ray(_rayOrigin, _rayDir);
    const hit = ray.intersectPlane(this.playPlane, _planeIntersect);
    if (hit) {
      out.copy(hit);
    } else {
      out.set(_ndc.x * 4.5, Math.max(0.2, (_ndc.y + 0.5) * 2.5), 0);
    }
    // Clamp into visible 3D play arena
    out.x = THREE.MathUtils.clamp(out.x, -5.2, 5.2);
    out.y = THREE.MathUtils.clamp(out.y, 0.1, 3.6);
    out.z = THREE.MathUtils.clamp(out.z, -2.5, 2.2);
    return out;
  }

  private projectWorldToScreen(x: number, y: number, z: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _vec3.set(x, y, z).project(this.camera);
    return {
      x: ((_vec3.x + 1) * 0.5) * rect.width,
      y: ((-_vec3.y + 1) * 0.5) * rect.height,
    };
  }

  /**
   * Finds the closest 3D toy under the user's finger/cursor with generous toddler hit slop.
   */
  private findHitToyAtScreen(clientX: number, clientY: number, slopPx = 74): ToyActor3D | null {
    let bestToy: ToyActor3D | null = null;
    let bestDist = slopPx;

    for (const toy of this.toys) {
      const screenPos = this.projectWorldToScreen(toy.x, toy.y + 0.75, toy.z);
      const dist = Math.hypot(clientX - screenPos.x, clientY - screenPos.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestToy = toy;
      }
    }
    return bestToy;
  }

  public onPointerDown(id: number, clientX: number, clientY: number) {
    babySound.ensureRunning();
    const worldPt = new THREE.Vector3();
    this.screenToWorldOnPlane(clientX, clientY, worldPt);

    this.activePointers.set(id, {
      lastX: clientX,
      lastY: clientY,
      lastWorld: worldPt.clone(),
      lastTime: performance.now(),
    });

    const hitToy = this.findHitToyAtScreen(clientX, clientY, 82);
    if (hitToy) {
      this.interactWithToy(hitToy, false);
    } else {
      // Spawn a joyful new 3D toy at the tapped world coordinate!
      const newToy = this.spawnToy3D(worldPt.x, worldPt.y, worldPt.z);
      this.burstParticles3D(worldPt.x, worldPt.y + 0.5, worldPt.z, 12, newToy.colorHex);
      babySound.playChime(
        clientX,
        clientY,
        window.innerWidth,
        window.innerHeight,
        this.theme.soundMode
      );

      // Even tapping empty space gives +10 positive sensory score feedback in Score Mode!
      if (this.playMode === 'score') {
        this.awardPointsForAction(newToy.type, clientX, clientY, false, newToy.colorHex);
      }
    }
  }

  public onPointerMove(id: number, clientX: number, clientY: number) {
    const ptr = this.activePointers.get(id);
    if (!ptr) return;

    const now = performance.now();
    const dtMs = Math.max(1, now - ptr.lastTime);
    const dx = clientX - ptr.lastX;
    const dy = clientY - ptr.lastY;
    const distPx = Math.hypot(dx, dy);

    if (distPx > 8) {
      const worldPt = new THREE.Vector3();
      this.screenToWorldOnPlane(clientX, clientY, worldPt);

      // Emit 3D sparkling trail particles along swipe path
      this.burstParticles3D(worldPt.x, worldPt.y + 0.4, worldPt.z + 0.4, 3, this.pickRandomColor());

      // Check if swipe brushed across any 3D toy
      const brushedToy = this.findHitToyAtScreen(clientX, clientY, 72);
      if (brushedToy && now - brushedToy.lastHitTime > 260) {
        brushedToy.vx += THREE.MathUtils.clamp(dx * 0.04, -5, 5);
        brushedToy.vy = Math.max(brushedToy.vy, 3.2);
        this.interactWithToy(brushedToy, true);
      }

      const speedPx = (distPx / dtMs) * 1000;
      if (speedPx > 280) {
        babySound.playSwipeArpeggio(
          clientX,
          clientY,
          speedPx,
          window.innerWidth,
          window.innerHeight,
          this.theme.soundMode
        );
      }

      ptr.lastX = clientX;
      ptr.lastY = clientY;
      ptr.lastWorld.copy(worldPt);
      ptr.lastTime = now;
    }
  }

  public onPointerUp(id: number) {
    this.activePointers.delete(id);
  }

  private interactWithToy(toy: ToyActor3D, isSwipe: boolean) {
    toy.lastHitTime = performance.now();
    // Joyful jump + squash-and-stretch + spin
    toy.vy = 4.2 + Math.random() * 1.5;
    toy.vx += (Math.random() - 0.5) * 2.5;
    toy.scaleX = 1.42;
    toy.scaleY = 0.62;
    toy.vRotY = (Math.random() > 0.5 ? 1 : -1) * 7.5;

    this.burstParticles3D(toy.x, toy.y + 0.8, toy.z, 18, toy.colorHex);

    const screenPos = this.projectWorldToScreen(toy.x, toy.y + 1.1, toy.z);

    if (this.playMode === 'score') {
      this.awardPointsForAction(toy.type, screenPos.x, screenPos.y, isSwipe, toy.colorHex);
      // If it was a golden star, morph it to a fresh color/position after a happy bounce
      if (toy.type === 'star') {
        babySound.playStarCollect(this.scoreState.combo);
      } else {
        babySound.playCuteSqueak(640 + Math.random() * 220);
      }
    } else {
      babySound.playCuteSqueak(640 + Math.random() * 220);
    }
  }

  private awardPointsForAction(
    type: CharacterType,
    screenX: number,
    screenY: number,
    isSwipe: boolean,
    colorHex: string
  ) {
    const result = registerScoreHit(this.scoreState, type, isSwipe);
    this.scoreState = result.nextState;
    this.saveBestScore(this.scoreState.bestScore);

    const popup: FloatingScorePopup = {
      id: this.popupCounter++,
      text:
        this.scoreState.combo > 1
          ? `+${result.pointsAwarded} (x${this.scoreState.combo}!)`
          : `+${result.pointsAwarded}`,
      x: screenX,
      y: screenY,
      color: colorHex,
    };

    if (result.milestoneReached) {
      this.cameraTrauma = 0.35;
      babySound.playVictoryFanfare();
    }

    this.emitScoreUpdate(popup);
  }

  private emitScoreUpdate(popup?: FloatingScorePopup) {
    if (this.onScoreChange) {
      this.onScoreChange({ ...this.scoreState }, popup);
    }
  }

  /* ---------------- Zero-GC Pooled 3D Particles ---------------- */

  public burstParticles3D(x: number, y: number, z: number, count: number, hexColor: string) {
    _color.set(hexColor);
    for (let i = 0; i < count; i++) {
      const p = this.particlePool[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particleCapacity;

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const elevation = (Math.random() - 0.2) * Math.PI * 0.6;
      const speed = 2.2 + Math.random() * 3.8;

      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(angle) * Math.cos(elevation) * speed;
      p.vy = Math.sin(elevation) * speed + 2.0;
      p.vz = Math.sin(angle) * Math.cos(elevation) * speed;
      p.size = 0.7 + Math.random() * 0.7;
      p.life = 0;
      p.maxLife = 0.55 + Math.random() * 0.35;
      p.color.copy(_color);

      this.particleMesh.setColorAt(this.particleCursor, p.color);
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  /* ---------------- Main 60 FPS Simulation & Render Loop ---------------- */

  private loop = (now: number) => {
    if (!this.isRunning) return;

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = clampDeltaTime(rawDt, 0.05);

    const bodyState = typeof document !== 'undefined' ? document.body.dataset.state : 'playing';
    if (!this.isHeadless || bodyState === 'playing' || bodyState === 'title') {
      this.update(dt, now);
      this.renderer.render(this.scene, this.camera);
    }

    // Throttle to ~12fps in headless software rendering so screenshots & clicks never stall
    if (this.isHeadless) {
      setTimeout(() => {
        if (this.isRunning) {
          this.animFrameId = requestAnimationFrame(this.loop);
        }
      }, 85);
    } else {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  };

  private update(dt: number, now: number) {
    // 1. Tick Score Mode Combo Timer & Periodic Star Spawner
    if (this.playMode === 'score') {
      const prevCombo = this.scoreState.combo;
      this.scoreState = tickComboTimer(this.scoreState, dt);
      if (this.scoreState.combo !== prevCombo) {
        this.emitScoreUpdate();
      }

      this.starSpawnTimer += dt;
      if (this.starSpawnTimer > 3.8) {
        this.starSpawnTimer = 0;
        const starCount = this.toys.filter((t) => t.type === 'star').length;
        if (starCount < 3) {
          this.spawnToy3D((Math.random() - 0.5) * 6.5, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 2, 'star');
        }
      }
    }

    // 2. Smooth Damped Camera Movement
    const dampFactor = 1 - Math.exp(-5.5 * dt);
    this.camCurrentPos.lerp(this.camTargetPos, dampFactor);
    this.camera.position.copy(this.camCurrentPos);

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.2);
      const shake = this.cameraTrauma * this.cameraTrauma * 0.25;
      this.camera.position.x += Math.sin(now * 0.04) * shake;
      this.camera.position.y += Math.cos(now * 0.05) * shake;
    }
    this.camera.lookAt(this.camLookAt);

    // 3. Update 3D Toy Actors (Physics, Springs, Ground Bounce, Contact Shadow)
    for (const toy of this.toys) {
      // Spring squash-and-stretch
      const sx = updateSpring(toy.scaleX, toy.scaleVx, toy.targetScale, 180, 13, dt);
      toy.scaleX = sx.value;
      toy.scaleVx = sx.velocity;

      const sy = updateSpring(toy.scaleY, toy.scaleVy, toy.targetScale, 180, 13, dt);
      toy.scaleY = sy.value;
      toy.scaleVy = sy.velocity;

      // Gentle gravity & buoyant bobbing
      toy.bobPhase += dt * 2.4;
      const isFloater = toy.type === 'balloon' || toy.type === 'star' || toy.type === 'contrast_star';

      if (isFloater) {
        const targetHoverY = toy.baseY + Math.sin(toy.bobPhase) * 0.28;
        toy.vy += (targetHoverY - toy.y) * 6.5 * dt;
        toy.vy *= Math.pow(0.92, dt * 60);
      } else {
        // Gravity towards meadow ground
        toy.vy -= 9.8 * dt;
      }

      // Integrate 3D position
      toy.x += toy.vx * dt;
      toy.y += toy.vy * dt;
      toy.z += toy.vz * dt;

      // Ground bounce with squash
      const floorY = isFloater ? 0.45 : 0.02;
      if (toy.y < floorY) {
        toy.y = floorY;
        if (toy.vy < -1.2) {
          toy.vy = -toy.vy * 0.58;
          toy.scaleX = 1.28;
          toy.scaleY = 0.74;
        } else {
          toy.vy = 0;
        }
      }

      // Ceiling clamp
      if (toy.y > 3.6) {
        toy.y = 3.6;
        toy.vy = -Math.abs(toy.vy) * 0.5;
      }

      // Arena X/Z soft boundary bounce
      if (toy.x < -5.2) {
        toy.x = -5.2;
        toy.vx = Math.abs(toy.vx) * 0.8;
        toy.scaleX = 0.78;
        toy.scaleY = 1.22;
      } else if (toy.x > 5.2) {
        toy.x = 5.2;
        toy.vx = -Math.abs(toy.vx) * 0.8;
        toy.scaleX = 0.78;
        toy.scaleY = 1.22;
      }

      if (toy.z < -2.4) {
        toy.z = -2.4;
        toy.vz = Math.abs(toy.vz) * 0.8;
      } else if (toy.z > 2.2) {
        toy.z = 2.2;
        toy.vz = -Math.abs(toy.vz) * 0.8;
      }

      // Horizontal drag
      toy.vx *= Math.pow(0.96, dt * 60);
      toy.vz *= Math.pow(0.96, dt * 60);

      // Gentle idle rotation + spin damping
      toy.rotY += toy.vRotY * dt;
      toy.vRotY *= Math.pow(0.9, dt * 60);
      const idleSway = Math.sin(toy.bobPhase * 0.8) * 0.12;

      toy.group.position.set(toy.x, toy.y, toy.z);
      toy.group.rotation.set(0, toy.rotY + idleSway, Math.sin(toy.bobPhase) * 0.06);
      toy.group.scale.set(toy.scaleX, toy.scaleY, toy.scaleX);

      // Update grounded contact shadow directly beneath actor
      const heightAboveGround = Math.max(0, toy.y);
      const shadowScale = THREE.MathUtils.clamp(1.1 - heightAboveGround * 0.22, 0.35, 1.15);
      toy.shadowMesh.position.set(toy.x, 0.025, toy.z);
      toy.shadowMesh.scale.setScalar(shadowScale);
    }

    // 4. Update Pooled 3D Particles in-place
    let anyParticleUpdated = false;
    for (let i = 0; i < this.particleCapacity; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      anyParticleUpdated = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 6.5 * dt;

      const progress = p.life / p.maxLife;
      const scale = p.size * (1 - progress);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(Math.max(0.01, scale));
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
    }

    if (anyParticleUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
