/**
 * 3D WebGL Sensory & Score World Engine (Three.js).
 * Features:
 * - RoomEnvironment PBR reflections + ACESFilmicToneMapping
 * - Warm Directional Key Light + Cool Hemisphere Fill + Horizon-matched FogExp2
 * - Composite 3-12 part 3D Toy Characters with grounded contact shadows
 * - InstancedMesh meadow flowers (>40 instances) + Zero-GC pooled 3D particle ring buffer
 * - Full multi-touch & mouse raycasting + swipe trail impulses + Score Mode star spawning
 * - Toddler-safe Light Challenges (Mode Balita vs Mode Bayi):
 *   1. Stage agility & size scaling (never below 70%)
 *   2. Shy Peek-a-Boo Object behind 3D bushes & clouds (+30 pts)
 *   3. Playful Boing Obstacle from Stage 2 (max 1, soft boing, 1s combo pause, 0 penalty)
 *   4. Visual Mini-Missions (+60 pts & +1 golden star, 45s silent rotation)
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
  build3DHidingCover,
  build3DShyPeekCharacter,
  build3DPlayfulObstacle,
} from './models_3d';
import { babySound } from './sound';
import {
  CHALLENGE_CONFIG,
  GamePlayMode,
  AgeMode,
  ScoreState,
  StageCelebrationMeta,
  createInitialScoreState,
  registerScoreHit,
  registerShyObjectHit,
  registerObstacleBoing,
  setScoreAgeMode,
  tickComboTimer,
  advanceScoreTarget,
  getStageCelebrationMeta,
  getStageSpeedMultiplier,
  getStageScaleMultiplier,
  getShyObjectVisibleDuration,
  shouldHavePlayfulObstacle,
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

interface ShyPeekActor3D {
  group: THREE.Group;
  covers: Array<{ group: THREE.Group; x: number; y: number; z: number; kind: 'bush' | 'cloud' }>;
  activeCoverIndex: number;
  state: 'cooldown' | 'peeking' | 'celebrating';
  timer: number;
  x: number;
  y: number;
  z: number;
  hiddenY: number;
  peekY: number;
  scale: number;
  rotY: number;
}

interface PlayfulObstacleActor3D {
  active: boolean;
  group: THREE.Group;
  shadowMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  bobPhase: number;
  wobbleTimer: number;
  scaleX: number;
  scaleY: number;
  scaleVx: number;
  scaleVy: number;
  lastBoingTime: number;
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

  private shyActor!: ShyPeekActor3D;
  private obstacleActor!: PlayfulObstacleActor3D;

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
    this.scoreState = createInitialScoreState(
      savedBest,
      200,
      CHALLENGE_CONFIG.DEFAULT_AGE_MODE
    );

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

    // 4. Build Lighting, Ground, Landmarks, Challenge Actors & Particle Pool
    this.setupLighting();
    this.setupEnvironmentMesh();
    this.setupChallengeActors();
    this.setupParticlePool();
    this.applyThemeVisuals();
    this.spawnInitialToys();
    this.syncChallengeActorsForState();

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

  /**
   * Initializes the Shy Peek-a-Boo Character + Hiding Bushes/Cloud and the Playful Boing Obstacle.
   */
  private setupChallengeActors() {
    // 1. Hiding spots (2 foreground bushes + 1 sky cloud) for Shy Peek-a-Boo Object
    const coverDefs: Array<{ x: number; y: number; z: number; kind: 'bush' | 'cloud' }> = [
      { x: -3.7, y: 0.0, z: 1.0, kind: 'bush' },
      { x: 3.7, y: 0.0, z: 1.0, kind: 'bush' },
      { x: -2.4, y: 2.35, z: -0.9, kind: 'cloud' },
    ];
    const covers = coverDefs.map((c) => {
      const g = build3DHidingCover(c.kind);
      g.position.set(c.x, c.y, c.z);
      this.scene.add(g);
      return { group: g, ...c };
    });

    const shyGroup = build3DShyPeekCharacter();
    shyGroup.position.set(covers[0].x, covers[0].y + 0.55, covers[0].z - 0.15);
    this.scene.add(shyGroup);

    // Start peeking right away in Mode Balita so children see the friendly peek-a-boo buddy!
    this.shyActor = {
      group: shyGroup,
      covers,
      activeCoverIndex: 0,
      state: 'peeking',
      timer: getShyObjectVisibleDuration(1),
      x: covers[0].x,
      y: covers[0].y + 0.58,
      z: covers[0].z - 0.15,
      hiddenY: covers[0].y - 0.5,
      peekY: covers[0].y + 0.58,
      scale: 0.92,
      rotY: 0.18,
    };

    // 2. Playful Boing Obstacle (Awan Jahil) — max 1 on screen, active from Stage 2 in Mode Balita
    const obsGroup = build3DPlayfulObstacle('cloud');
    obsGroup.position.set(0, 1.65, 0.65);
    obsGroup.visible = false;
    this.scene.add(obsGroup);

    const obsShadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const obsShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    });
    const obsShadow = new THREE.Mesh(obsShadowGeo, obsShadowMat);
    obsShadow.rotation.x = -Math.PI / 2;
    obsShadow.position.set(0, 0.026, 0.65);
    obsShadow.visible = false;
    this.scene.add(obsShadow);

    this.obstacleActor = {
      active: false,
      group: obsGroup,
      shadowMesh: obsShadow,
      x: 0,
      y: 1.65,
      z: 0.65,
      vx: 1.25,
      bobPhase: 0,
      wobbleTimer: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleVx: 0,
      scaleVy: 0,
      lastBoingTime: 0,
    };
  }

  private syncChallengeActorsForState() {
    const isBalita = this.scoreState.ageMode === 'balita';

    // Update target scale of all existing toys based on stage & ageMode
    const targetScale = getStageScaleMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );
    for (const toy of this.toys) {
      toy.targetScale = targetScale;
    }

    // Shy Peek-a-Boo actor & covers visibility
    this.shyActor.covers.forEach((c) => {
      c.group.visible = isBalita;
    });
    if (!isBalita) {
      this.shyActor.group.visible = false;
    } else {
      this.shyActor.group.visible = true;
    }

    // Playful Obstacle visibility (Stage >= 2 in Mode Balita, max 1 on screen)
    const wantObstacle = shouldHavePlayfulObstacle(
      this.scoreState.stage,
      this.scoreState.ageMode,
      0
    );
    this.obstacleActor.active = wantObstacle;
    this.obstacleActor.group.visible = wantObstacle;
    this.obstacleActor.shadowMesh.visible = wantObstacle;
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

  public setAgeMode(ageMode: AgeMode) {
    this.scoreState = setScoreAgeMode(this.scoreState, ageMode);
    this.syncChallengeActorsForState();
    this.emitScoreUpdate();
  }

  public getAgeMode(): AgeMode {
    return this.scoreState.ageMode;
  }

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

  public resetScoreRun(): StageCelebrationMeta {
    this.scoreState = createInitialScoreState(
      this.scoreState.bestScore,
      200,
      this.scoreState.ageMode
    );
    const meta = getStageCelebrationMeta(this.scoreState.stage);
    if (THEMES[meta.themeId]) {
      this.theme = THEMES[meta.themeId];
      this.applyThemeVisuals();
    }
    this.camCurrentPos.set(0, 6.2, 12.2);
    this.clearAllToys(false);
    this.spawnInitialToys();
    this.syncChallengeActorsForState();
    this.emitScoreUpdate();
    return meta;
  }

  public continueNextScoreStage(): StageCelebrationMeta {
    this.scoreState = advanceScoreTarget(this.scoreState);
    const meta = getStageCelebrationMeta(this.scoreState.stage);
    if (THEMES[meta.themeId]) {
      this.theme = THEMES[meta.themeId];
      this.applyThemeVisuals();
    }
    // Gentle celebratory camera swoop in from above as the curtain fades in
    this.camCurrentPos.set(0, 6.4, 12.4);
    this.clearAllToys(false);
    this.spawnInitialToys();
    this.syncChallengeActorsForState();

    // Spawn bonus celebration stars in a cheerful arc
    for (let i = 0; i < 4; i++) {
      const starX = (i - 1.5) * 2.1;
      const starY = 1.2 + (i % 2) * 0.35;
      this.spawnToy3D(starX, starY, 0.2, 'star');
      this.burstParticles3D(starX, starY + 0.5, 0.2, 14, meta.accentHex);
    }
    this.emitScoreUpdate();
    return meta;
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
    // Prioritize spawning the active Mini-Mission target type so toddler can easily complete it
    if (this.playMode === 'score' && this.scoreState.activeMission) {
      const targetType = this.scoreState.activeMission.targetType;
      const existingCount = this.toys.filter((t) => t.type === targetType).length;
      if (existingCount < 2 || Math.random() < 0.45) {
        return targetType;
      }
    }
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
      { x: -2.8, y: 0.2, z: 0.3, type: 'kitten' as CharacterType },
      { x: -1.1, y: 0.8, z: -0.6, type: 'star' as CharacterType },
      { x: 1.1, y: 0.2, z: 0.4, type: 'chick' as CharacterType },
      { x: 2.8, y: 0.2, z: -0.4, type: 'bunny' as CharacterType },
      { x: 0.0, y: 1.5, z: -1.3, type: 'balloon' as CharacterType },
      { x: -1.9, y: 1.1, z: -1.1, type: 'star' as CharacterType },
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

    const stageScale = getStageScaleMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );
    const speedMult = getStageSpeedMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );

    group.position.set(x, spawnY, z);
    group.scale.setScalar(0.25);
    this.scene.add(group);

    // Soft radial contact shadow plane directly beneath the 3D toy
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
      vx: (Math.random() - 0.5) * 1.4 * speedMult,
      vy: (2.0 + Math.random() * 1.1) * speedMult,
      vz: (Math.random() - 0.5) * 0.8 * speedMult,
      rotY: (Math.random() - 0.5) * 0.5,
      vRotY: (Math.random() - 0.5) * 1.5,
      scaleX: 0.3,
      scaleY: 0.3,
      scaleVx: 0,
      scaleVy: 0,
      targetScale: stageScale,
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
   * Checks if pointer hit the Shy Peek-a-Boo Object while it is peeking out.
   */
  private checkHitShyActor(clientX: number, clientY: number, slopPx = 78): boolean {
    if (
      this.scoreState.ageMode !== 'balita' ||
      this.shyActor.state !== 'peeking' ||
      !this.shyActor.group.visible
    ) {
      return false;
    }
    const screenPos = this.projectWorldToScreen(
      this.shyActor.x,
      this.shyActor.y + 0.65,
      this.shyActor.z
    );
    return Math.hypot(clientX - screenPos.x, clientY - screenPos.y) < slopPx;
  }

  /**
   * Checks if pointer hit the Playful Obstacle (Awan Jahil) in Stage 2+.
   */
  private checkHitPlayfulObstacle(clientX: number, clientY: number, slopPx = 76): boolean {
    if (!this.obstacleActor.active || !this.obstacleActor.group.visible) {
      return false;
    }
    const now = performance.now();
    if (now - this.obstacleActor.lastBoingTime < 350) {
      return false;
    }
    const screenPos = this.projectWorldToScreen(
      this.obstacleActor.x,
      this.obstacleActor.y + 0.7,
      this.obstacleActor.z
    );
    return Math.hypot(clientX - screenPos.x, clientY - screenPos.y) < slopPx;
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

    // 1. Check Shy Peek-a-Boo Object (+30 points & happy celebration)
    if (this.checkHitShyActor(clientX, clientY, 84)) {
      this.triggerShyActorCaught();
      return;
    }

    // 2. Check Playful Boing Obstacle (Stage 2+, gentle boing, 1s combo pause, 0 penalty)
    if (this.checkHitPlayfulObstacle(clientX, clientY, 80)) {
      this.triggerObstacleBoing();
      return;
    }

    // 3. Check 3D Toys
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

      // Check if swipe caught the Shy Peek-a-Boo Object
      if (this.checkHitShyActor(clientX, clientY, 82)) {
        this.triggerShyActorCaught();
      } else if (this.checkHitPlayfulObstacle(clientX, clientY, 74)) {
        // Check if swipe brushed the Playful Boing Obstacle
        this.triggerObstacleBoing();
      } else {
        // Check if swipe brushed across any 3D toy
        const brushedToy = this.findHitToyAtScreen(clientX, clientY, 72);
        if (brushedToy && now - brushedToy.lastHitTime > 260) {
          brushedToy.vx += THREE.MathUtils.clamp(dx * 0.04, -5, 5);
          brushedToy.vy = Math.max(brushedToy.vy, 3.2);
          this.interactWithToy(brushedToy, true);
        }
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

  /**
   * Triggered when the toddler swipes/taps the Shy Peek-a-Boo Object while visible:
   * Awards +30 points, happy jump & spin animation, and cheerful giggle chime.
   */
  public triggerShyActorCaught() {
    if (this.shyActor.state !== 'peeking') return;

    this.shyActor.state = 'celebrating';
    this.shyActor.timer = 0.85;
    this.burstParticles3D(
      this.shyActor.x,
      this.shyActor.y + 0.9,
      this.shyActor.z,
      22,
      '#F472B6'
    );
    babySound.playPeekABooGiggle();

    if (this.playMode === 'score') {
      const res = registerShyObjectHit(this.scoreState);
      this.scoreState = res.nextState;
      this.saveBestScore(this.scoreState.bestScore);

      const screenPos = this.projectWorldToScreen(
        this.shyActor.x,
        this.shyActor.y + 1.2,
        this.shyActor.z
      );
      const popup: FloatingScorePopup = {
        id: this.popupCounter++,
        text: `+${res.pointsAwarded} Cilukba! 🌟`,
        x: screenPos.x,
        y: screenPos.y,
        color: '#F472B6',
      };

      if (res.milestoneReached) {
        this.cameraTrauma = 0.25;
        babySound.playVictoryFanfare();
      }
      this.emitScoreUpdate(popup);
    }
  }

  /**
   * Triggered when the toddler touches/swipes the Playful Obstacle (Awan Jahil):
   * Plays soft "boing!", wobbles elastically, pauses combo for 1s, 0 points lost, combo never drops.
   */
  public triggerObstacleBoing() {
    this.obstacleActor.lastBoingTime = performance.now();
    this.obstacleActor.wobbleTimer = 0.9;
    this.obstacleActor.scaleX = 1.48;
    this.obstacleActor.scaleY = 0.62;
    this.obstacleActor.vx = -this.obstacleActor.vx;

    this.burstParticles3D(
      this.obstacleActor.x,
      this.obstacleActor.y + 0.8,
      this.obstacleActor.z,
      14,
      '#C4B5FD'
    );
    babySound.playGentleBoing();

    if (this.playMode === 'score') {
      this.scoreState = registerObstacleBoing(this.scoreState);
      const screenPos = this.projectWorldToScreen(
        this.obstacleActor.x,
        this.obstacleActor.y + 1.15,
        this.obstacleActor.z
      );
      const popup: FloatingScorePopup = {
        id: this.popupCounter++,
        text: 'Boing! ☁️',
        x: screenPos.x,
        y: screenPos.y,
        color: '#C4B5FD',
      };
      this.emitScoreUpdate(popup);
    }
  }

  private interactWithToy(toy: ToyActor3D, isSwipe: boolean) {
    toy.lastHitTime = performance.now();
    const speedMult = getStageSpeedMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );
    toy.vy = (4.0 + Math.random() * 1.4) * Math.min(1.25, speedMult);
    toy.vx += (Math.random() - 0.5) * 2.5 * speedMult;
    toy.scaleX = toy.targetScale * 1.38;
    toy.scaleY = toy.targetScale * 0.64;
    toy.vRotY = (Math.random() > 0.5 ? 1 : -1) * 7.5;

    this.burstParticles3D(toy.x, toy.y + 0.8, toy.z, 18, toy.colorHex);

    const screenPos = this.projectWorldToScreen(toy.x, toy.y + 1.1, toy.z);

    if (this.playMode === 'score') {
      this.awardPointsForAction(toy.type, screenPos.x, screenPos.y, isSwipe, toy.colorHex);
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

    let popupText =
      this.scoreState.combo > 1
        ? `+${result.pointsAwarded} (x${this.scoreState.combo}!)`
        : `+${result.pointsAwarded}`;

    if (result.missionCompleted) {
      popupText = `+${result.pointsAwarded} 🌟 Misi Selesai!`;
      babySound.playMissionCompleteFanfare();
      // Spawn a celebratory golden star in the center of the playfield
      this.spawnToy3D(0, 1.8, 0.2, 'star');
      this.burstParticles3D(0, 2.0, 0.2, 24, '#FACC15');
    }

    const popup: FloatingScorePopup = {
      id: this.popupCounter++,
      text: popupText,
      x: screenX,
      y: screenY,
      color: colorHex,
    };

    if (result.milestoneReached) {
      this.cameraTrauma = 0.28;
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
    const speedMult = getStageSpeedMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );
    const stageScale = getStageScaleMultiplier(
      this.scoreState.stage,
      this.scoreState.ageMode
    );

    // 1. Tick Score Mode Combo Timer, 1s Obstacle Pause, 45s Mission Rotation & Spawner
    if (this.playMode === 'score') {
      const prevCombo = this.scoreState.combo;
      const prevPause = this.scoreState.comboPauseTimer > 0;
      const prevMissionId = this.scoreState.activeMission?.id;

      this.scoreState = tickComboTimer(this.scoreState, dt);

      const nowPause = this.scoreState.comboPauseTimer > 0;
      const nowMissionId = this.scoreState.activeMission?.id;
      if (
        this.scoreState.combo !== prevCombo ||
        prevPause !== nowPause ||
        prevMissionId !== nowMissionId
      ) {
        this.emitScoreUpdate();
      }

      this.starSpawnTimer += dt;
      if (this.starSpawnTimer > 3.4) {
        this.starSpawnTimer = 0;
        const targetType = this.scoreState.activeMission?.targetType || 'star';
        const matchCount = this.toys.filter((t) => t.type === targetType).length;
        if (matchCount < 2) {
          this.spawnToy3D(
            (Math.random() - 0.5) * 6.0,
            1.2 + Math.random() * 1.1,
            (Math.random() - 0.5) * 1.8,
            targetType
          );
        }
      }
    }

    // 2. Update Shy Peek-a-Boo Actor (Mode Balita only)
    if (this.scoreState.ageMode === 'balita') {
      this.updateShyActor(dt, now);
    }

    // 3. Update Playful Boing Obstacle (Mode Balita, Stage >= 2, max 1)
    if (this.obstacleActor.active) {
      this.updatePlayfulObstacle(dt, speedMult);
    }

    // 4. Smooth Damped Camera Movement
    const dampFactor = 1 - Math.exp(-5.5 * dt);
    this.camCurrentPos.lerp(this.camTargetPos, dampFactor);
    this.camera.position.copy(this.camCurrentPos);

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.2);
      const shake = this.cameraTrauma * this.cameraTrauma * 0.22;
      this.camera.position.x += Math.sin(now * 0.03) * shake;
      this.camera.position.y += Math.cos(now * 0.04) * shake;
    }
    this.camera.lookAt(this.camLookAt);

    // 5. Update 3D Toy Actors (Physics, Stage Speed & Scale Multipliers, Contact Shadow)
    for (const toy of this.toys) {
      toy.targetScale = stageScale;

      const sx = updateSpring(toy.scaleX, toy.scaleVx, toy.targetScale, 180, 13, dt);
      toy.scaleX = sx.value;
      toy.scaleVx = sx.velocity;

      const sy = updateSpring(toy.scaleY, toy.scaleVy, toy.targetScale, 180, 13, dt);
      toy.scaleY = sy.value;
      toy.scaleVy = sy.velocity;

      // Gentle gravity & buoyant bobbing scaled by stage speedMult
      toy.bobPhase += dt * 2.2 * speedMult;
      const isFloater =
        toy.type === 'balloon' || toy.type === 'star' || toy.type === 'contrast_star';

      if (isFloater) {
        const targetHoverY = toy.baseY + Math.sin(toy.bobPhase) * 0.28;
        toy.vy += (targetHoverY - toy.y) * 6.5 * dt;
        toy.vy *= Math.pow(0.92, dt * 60);
      } else {
        toy.vy -= 9.8 * dt;
      }

      // Gentle horizontal agility drift in Mode Balita
      toy.vx += Math.cos(toy.bobPhase * 0.65) * 0.45 * speedMult * dt;

      toy.x += toy.vx * dt;
      toy.y += toy.vy * dt;
      toy.z += toy.vz * dt;

      // Ground bounce with squash
      const floorY = isFloater ? 0.45 : 0.02;
      if (toy.y < floorY) {
        toy.y = floorY;
        if (toy.vy < -1.2) {
          toy.vy = -toy.vy * 0.58;
          toy.scaleX = toy.targetScale * 1.25;
          toy.scaleY = toy.targetScale * 0.76;
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
        toy.scaleX = toy.targetScale * 0.8;
        toy.scaleY = toy.targetScale * 1.2;
      } else if (toy.x > 5.2) {
        toy.x = 5.2;
        toy.vx = -Math.abs(toy.vx) * 0.8;
        toy.scaleX = toy.targetScale * 0.8;
        toy.scaleY = toy.targetScale * 1.2;
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
      const shadowScale =
        THREE.MathUtils.clamp(1.1 - heightAboveGround * 0.22, 0.35, 1.15) * stageScale;
      toy.shadowMesh.position.set(toy.x, 0.025, toy.z);
      toy.shadowMesh.scale.setScalar(shadowScale);
    }

    // 6. Update Pooled 3D Particles in-place
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

  /**
   * Updates the Shy Peek-a-Boo Actor (Objek Malu-Malu) state machine:
   * Peeks from behind a bush or cloud for 3.0s (Stage 1-2) or 2.5s (Stage 3-4),
   * and gently hides back if missed with zero penalty.
   */
  private updateShyActor(dt: number, now: number) {
    const s = this.shyActor;
    s.timer -= dt;

    if (s.state === 'peeking') {
      // Smoothly rise up to peekY and wave gently
      s.y += (s.peekY - s.y) * Math.min(1, dt * 8);
      s.rotY = Math.sin(now * 0.005) * 0.28;
      s.group.visible = true;
      s.group.position.set(s.x, s.y, s.z);
      s.group.rotation.set(0, s.rotY, Math.sin(now * 0.007) * 0.1);
      s.group.scale.setScalar(0.92);

      // If time is up and not swiped, quietly hide back behind the bush/cloud (zero penalty!)
      if (s.timer <= 0) {
        s.state = 'cooldown';
        s.timer = CHALLENGE_CONFIG.SHY_RESPAWN_COOLDOWN_SEC;
      }
    } else if (s.state === 'celebrating') {
      // Joyful jump & spin after being swiped (+30 points!)
      s.y += 2.6 * dt;
      s.rotY += 9.5 * dt;
      s.group.position.set(s.x, s.y, s.z);
      s.group.rotation.set(0, s.rotY, 0);
      s.group.scale.setScalar(1.12);

      if (s.timer <= 0) {
        s.state = 'cooldown';
        s.timer = CHALLENGE_CONFIG.SHY_RESPAWN_COOLDOWN_SEC * 0.75;
      }
    } else {
      // 'cooldown': slide softly behind the bush/cloud
      s.y += (s.hiddenY - s.y) * Math.min(1, dt * 7);
      s.group.position.set(s.x, s.y, s.z);
      s.group.scale.setScalar(0.45);
      if (Math.abs(s.y - s.hiddenY) < 0.08) {
        s.group.visible = false;
      }

      if (s.timer <= 0) {
        // Pick next cover spot to peek out from
        s.activeCoverIndex = (s.activeCoverIndex + 1) % s.covers.length;
        const cov = s.covers[s.activeCoverIndex];
        s.x = cov.x;
        s.z = cov.z - 0.15;
        s.hiddenY = cov.y - 0.35;
        s.peekY = cov.y + 0.58;
        s.y = s.hiddenY;
        s.state = 'peeking';
        s.timer = getShyObjectVisibleDuration(this.scoreState.stage);
        s.group.visible = true;
      }
    }
  }

  /**
   * Updates the Playful Boing Obstacle (Awan Jahil) in Stage 2+ (Mode Balita).
   */
  private updatePlayfulObstacle(dt: number, speedMult: number) {
    const obs = this.obstacleActor;
    obs.bobPhase += dt * 2.2;

    obs.x += obs.vx * speedMult * dt;
    if (obs.x > 3.4) {
      obs.x = 3.4;
      obs.vx = -Math.abs(obs.vx);
    } else if (obs.x < -3.4) {
      obs.x = -3.4;
      obs.vx = Math.abs(obs.vx);
    }

    obs.y = 1.65 + Math.sin(obs.bobPhase) * 0.25;

    // Elastic squash-and-stretch spring for funny wobble when touched
    const sx = updateSpring(obs.scaleX, obs.scaleVx, 1.0, 210, 10, dt);
    obs.scaleX = sx.value;
    obs.scaleVx = sx.velocity;

    const sy = updateSpring(obs.scaleY, obs.scaleVy, 1.0, 210, 10, dt);
    obs.scaleY = sy.value;
    obs.scaleVy = sy.velocity;

    let wobbleRotZ = Math.sin(obs.bobPhase * 0.7) * 0.08;
    if (obs.wobbleTimer > 0) {
      obs.wobbleTimer = Math.max(0, obs.wobbleTimer - dt);
      wobbleRotZ = Math.sin(obs.wobbleTimer * 28) * 0.32;
    }

    obs.group.position.set(obs.x, obs.y, obs.z);
    obs.group.rotation.set(0, 0, wobbleRotZ);
    obs.group.scale.set(obs.scaleX, obs.scaleY, obs.scaleX);

    obs.shadowMesh.position.set(obs.x, 0.026, obs.z);
  }
}
