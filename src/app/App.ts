import * as THREE from "three";
import { cloneSpec, type HouseSpec } from "../data/houseSpec";
import { presetById, type HousePreset } from "../data/houses";
import { buildHouseModel } from "../model/HouseModel";
import type { HouseModel, Room } from "../model/types";
import type { ValidationIssue } from "../model/validate";
import { pointInPolygon, rectContains } from "../model/geometry2d";
import { pointAlongWall } from "../model/WallResolver";
import { InteriorDesignEngine } from "../interiors/InteriorDesignEngine";
import type { DesignReport } from "../interiors/DesignReport";
import { catalogById } from "../interiors/FurnitureLibrary";
import { disposeObject, generateHouse, type GeneratedHouse } from "../architecture/HouseGenerator";
import { wallPieces } from "../architecture/WallGenerator";
import { applyEnvelope, createMaterialRegistry, type MatKey, type MaterialRegistry } from "../scene/Materials";
import { LightingController } from "../scene/Lighting";
import { InteriorLights } from "../scene/InteriorLights";
import { PostProcessing } from "../scene/PostProcessing";
import { createEnvironment, type EnvironmentResult } from "../scene/Environment";
import { AssetLoader } from "../scene/AssetLoader";
import { PRESET_HOURS } from "../scene/TimeOfDay";
import { CameraModes, type ViewMode } from "../navigation/CameraModes";
import { CollisionSystem } from "../navigation/CollisionSystem";
import { FirstPersonController } from "../navigation/FirstPersonController";
import { WalkableSurfaces } from "../navigation/WalkableSurfaces";
import { Minimap } from "../ui/Minimap";
import { HUD } from "../ui/HUD";
import { ViewModeControls, type ViewOptions } from "../ui/ViewModeControls";
import { DesignControls } from "../ui/DesignControls";
import { HouseMenu } from "../ui/HouseMenu";
import { RoomLabels } from "../ui/RoomLabels";
import "../ui/styles.css";

/** Materials that belong to the landscape and are never cut or faded. */
const LANDSCAPE: MatKey[] = ["grass", "gravel", "paver", "asphalt", "soil", "hedge", "birchBark", "bark", "birchLeaf", "spruce", "appleLeaf", "boulder", "concrete"];
/** Exterior wall materials faded by the see-through option. */
const XRAY: MatKey[] = ["cladding", "cornerBoard", "plaster", "trim", "tileWall"];

export class App {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly mats: MaterialRegistry;
  private readonly lighting: LightingController;
  private readonly lights: InteriorLights;
  private readonly post: PostProcessing;
  private readonly labels: RoomLabels;
  private readonly fp: FirstPersonController;
  private readonly cameras: CameraModes;
  private readonly minimap: Minimap;
  private readonly hud: HUD;
  private readonly controls: ViewModeControls;
  private readonly design: DesignControls;
  private readonly engine = new InteriorDesignEngine();
  private readonly assets = new AssetLoader();
  private readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
  private readonly capMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2c2f });

  private presetId = "courtyard";
  private spec: HouseSpec = cloneSpec();
  private model!: HouseModel;
  private issues: ValidationIssue[] = [];
  private report!: DesignReport;
  private house: GeneratedHouse | null = null;
  private env: EnvironmentResult | null = null;
  private caps: THREE.Group | null = null;
  private collision!: CollisionSystem;
  private surfaces!: WalkableSurfaces;
  private version = 0;
  private overrideIds = new Set<string>();
  private hour = 15.5;
  private mode: ViewMode = "orbit";
  private walkInitialized = false;
  private cut: number | null = null;
  private options: ViewOptions = { roof: true, cutaway: true, xray: false, labels: true, bloom: true, highQuality: false };

  constructor(private readonly root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.className = "webgl";
    this.renderer.domElement.tabIndex = 0;
    root.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 2000);
    this.mats = createMaterialRegistry(this.spec);
    this.lighting = new LightingController(this.renderer, this.scene, this.mats);
    this.lights = new InteriorLights(this.mats, 12);
    this.scene.add(this.lights.group);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.labels = new RoomLabels(root);
    this.scene.add(this.labels.group);

    this.fp = new FirstPersonController(this.camera, this.renderer.domElement);
    this.fp.onLockChange = (locked) => this.hud.setCrosshair(locked);
    this.cameras = new CameraModes(this.camera, this.renderer.domElement, this.fp);
    this.cameras.onModeApplied = () => this.applyPresentation();

    this.hud = new HUD(root, { gross: 0, net: 0 });
    this.controls = new ViewModeControls(root, this.options, {
      onMode: (m) => this.setMode(m),
      onTime: (h) => this.setTime(h),
      onOptions: () => this.applyOptions()
    });
    this.minimap = new Minimap(root);
    this.minimap.onTeleport = (x, y) => this.walkTo(x, y);
    this.hud.setIdentity(presetById(this.presetId).name, presetById(this.presetId).tagline);
    new HouseMenu(root, this.presetId, (preset) => this.switchPreset(preset));
    this.design = new DesignControls(
      root,
      () => this.spec,
      () => this.rebuild(),
      () => {
        this.spec = cloneSpec();
        this.design.sync();
        this.rebuild();
      }
    );

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey);
    this.renderer.domElement.addEventListener("dblclick", this.onDoubleClick);
  }

  start(): void {
    this.rebuild();
    this.setTime(this.hour);
    this.cameras.jumpTo("orbit");
    this.setModeUi("orbit");
    this.applyOptions();
    this.renderer.setAnimationLoop(this.frame);
    requestAnimationFrame(() => this.root.querySelector(".loading")?.classList.add("done"));
  }

  // ------------------------------------------------------------------ model -> scene

  private switchPreset(preset: HousePreset): void {
    this.presetId = preset.id;
    this.spec = cloneSpec(preset.spec);
    this.design.sync();
    this.hud.setIdentity(preset.name, preset.tagline);
    this.rebuild();
    if (this.mode === "walk") {
      const t = this.model.terraces.find((x) => x.id === "main_terrace") ?? this.model.terraces[0];
      const east = t && t.rect.x >= this.spec.building.overallWidth - 0.2;
      const spawn = t ? { x: t.rect.x + t.rect.w / 2, y: east ? t.rect.y + t.rect.h / 2 : t.rect.y + 1.2 } : { x: 8, y: 2 };
      const free = this.collision.nearestFree(spawn);
      this.fp.setPose(free.x, free.y, 0, -0.05);
    } else this.cameras.jumpTo(this.mode);
    this.hud.toast(preset.name);
  }

  private rebuild(): void {
    applyEnvelope(this.mats, this.spec);
    const { model, issues } = buildHouseModel(this.spec);
    const { report } = this.engine.apply(model, this.spec);
    this.model = model;
    this.issues = issues;
    this.report = report;
    this.version += 1;
    if (issues.some((i) => i.severity === "error")) console.warn("House model issues", issues);

    if (this.house) {
      this.scene.remove(this.house.root);
      disposeObject(this.house.root);
    }
    if (this.env) {
      this.scene.remove(this.env.group);
      disposeObject(this.env.group);
    }
    this.house = generateHouse(model, this.spec, this.mats, this.overrideIds);
    this.scene.add(this.house.root);
    this.env = createEnvironment(model, this.spec, this.mats);
    this.scene.add(this.env.group);
    this.applyFurnitureOverrides();

    this.collision = new CollisionSystem(model, this.env, this.house.doors);
    this.surfaces = new WalkableSurfaces(model, this.env);
    this.fp.collision = this.collision;
    this.fp.surfaces = this.surfaces;
    if (this.walkInitialized) {
      const free = this.collision.nearestFree(this.fp.position);
      this.fp.setPose(free.x, free.y, this.fp.yaw, this.fp.pitch);
    }

    const b = model.bounds;
    const center = new THREE.Vector3(b.x + b.w / 2, 0, -(b.y + b.h / 2));
    const radius = Math.max(b.w, b.h) / 2 + 2;
    this.cameras.setHouse(center, radius);
    this.lighting.fitShadow(center, radius + 6);
    this.lights.setFixtures(model);
    this.labels.build(model);
    this.minimap.invalidate();
    this.design.setReport(model, issues, report);
    this.hud.setStats(model.meta.interiorArea, model.meta.grossArea);
    this.cut = null;
    this.applyPresentation();
    this.renderer.shadowMap.needsUpdate = true;
  }

  private async applyFurnitureOverrides(): Promise<void> {
    const available = await this.assets.available();
    if (available.size > 0 && [...available].some((id) => !this.overrideIds.has(id))) {
      // First time we learn about overrides: rebuild so those items are separate objects.
      this.overrideIds = available;
      this.rebuild();
      return;
    }
    const group = this.house?.parts.furniture;
    if (!group) return;
    for (const obj of [...group.children]) {
      if (!obj.userData.separate) continue;
      const id = obj.userData.catalogId as string;
      const override = await this.assets.loadFurnitureOverride(id);
      const item = catalogById(id);
      if (!override || !obj.parent || !item) continue;
      // Fit the model's bounding box to the catalog footprint (local axes), base on the floor.
      const inner = override.clone(true);
      const bbox = new THREE.Box3().setFromObject(inner);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());
      inner.position.set(-center.x, -bbox.min.y, -center.z);
      const clone = new THREE.Group();
      clone.add(inner);
      clone.scale.set(item.width / Math.max(size.x, 1e-3), item.height / Math.max(size.y, 1e-3), item.depth / Math.max(size.z, 1e-3));
      clone.position.copy(obj.position);
      clone.quaternion.copy(obj.quaternion);
      clone.userData = obj.userData;
      obj.parent.add(clone);
      obj.parent.remove(obj);
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ modes & presentation

  private setModeUi(mode: ViewMode): void {
    this.mode = mode;
    this.controls.setMode(mode);
    this.hud.setMode(mode);
    this.root.classList.toggle("mode-walk", mode === "walk");
  }

  private setMode(mode: ViewMode): void {
    if (mode === this.mode && !this.cameras.transitioning) return;
    if (mode === "walk" && !this.walkInitialized) {
      this.walkInitialized = true;
      // Start on the main terrace, facing the open half of the dining room's sliding door.
      const t = this.model.terraces.find((x) => x.id === "main_terrace") ?? this.model.terraces[0];
      const east = t && t.rect.x >= this.spec.building.overallWidth - 0.2;
      const slide = this.model.walls.flatMap((w) => w.openings.filter((o) => o.kind === "sliding_door").map((o) => ({ w, o })))[0];
      const doorX = slide ? pointAlongWall(slide.w, slide.o.center + slide.o.width / 4).x : undefined;
      const spawn = t
        ? { x: east ? t.rect.x + t.rect.w / 2 : (doorX ?? t.rect.x + t.rect.w / 2), y: east ? t.rect.y + t.rect.h / 2 : t.rect.y + 1.0, yaw: east ? Math.PI / 2 : 0 }
        : { x: 6, y: 21, yaw: Math.PI };
      const free = this.collision.nearestFree(spawn);
      this.cameras.setMode("walk", { ...spawn, ...free });
    } else this.cameras.setMode(mode);
    this.setModeUi(mode);
    // Presentation changes that should be visible during the transition (e.g. roof fading away).
    if (mode !== "walk") this.applyPresentation();
  }

  /** Walk to a plan point (minimap click, double-click on a floor). */
  private walkTo(x: number, y: number): void {
    const p = this.collision.nearestFree({ x, y });
    this.walkInitialized = true;
    if (this.mode === "walk" && !this.cameras.transitioning) {
      this.fp.setPose(p.x, p.y, this.fp.yaw, this.fp.pitch);
      this.hud.toast(`Moved to ${this.placeName(p.x, p.y)}`);
      return;
    }
    const yaw = this.mode === "walk" ? this.fp.yaw : -Math.atan2(this.camera.getWorldDirection(new THREE.Vector3()).x, -this.camera.getWorldDirection(new THREE.Vector3()).z);
    this.cameras.setMode("walk", { x: p.x, y: p.y, yaw });
    this.setModeUi("walk");
  }

  private applyOptions(): void {
    this.post.setBloom(this.options.bloom ? this.bloomStrength() : 0);
    this.post.setAmbientOcclusion(this.options.highQuality);
    this.lighting.setShadowQuality(this.options.highQuality ? 4096 : 2048);
    this.lights.setPoolSize(this.options.highQuality ? 18 : 12);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.options.highQuality ? 2 : 1.75));
    this.onResize();
    this.applyPresentation();
  }

  private bloomStrength(): number {
    const level = this.lighting.state?.interiorLevel ?? 0.5;
    return 0.08 + 0.32 * Math.max(0, (level - 0.25) / 0.75);
  }

  private applyPresentation(): void {
    if (!this.house) return;
    const aerial = this.mode === "plan" || this.mode === "dollhouse";
    const { roof, ceilings } = this.house.parts;
    roof.visible = this.options.roof && !aerial;
    ceilings.visible = !aerial && (this.mode === "walk" || this.options.roof);

    const cut = this.mode === "plan" ? 1.3 : this.mode === "dollhouse" && this.options.cutaway ? 2.1 : null;
    this.setCut(cut);
    const xray = this.options.xray && this.mode !== "walk";
    for (const key of XRAY) {
      const m = this.mats[key];
      const want = xray ? 0.22 : 1;
      if (m.opacity !== want) {
        m.transparent = xray;
        m.opacity = want;
        m.depthWrite = !xray;
        m.needsUpdate = true;
      }
    }
    this.labels.setVisible(this.options.labels && aerial);
    // Trees would cover the drawing in the top-down plan.
    const trees = this.env?.group.getObjectByName("trees");
    if (trees) trees.visible = this.mode !== "plan";
    this.renderer.shadowMap.needsUpdate = true;
  }

  private setCut(cutHeight: number | null): void {
    if (cutHeight === this.cut) return;
    this.cut = cutHeight;
    const planes = cutHeight === null ? null : [this.clipPlane];
    if (cutHeight !== null) this.clipPlane.constant = this.model.floorLevel + cutHeight;
    for (const [key, m] of Object.entries(this.mats) as Array<[MatKey, THREE.Material]>) {
      if (LANDSCAPE.includes(key)) continue;
      m.clippingPlanes = planes;
      m.needsUpdate = true;
    }
    if (this.caps) {
      this.scene.remove(this.caps);
      disposeObject(this.caps);
      this.caps = null;
    }
    if (cutHeight !== null) {
      this.caps = this.buildCaps(cutHeight);
      this.scene.add(this.caps);
    }
  }

  /** Solid dark caps where the section plane cuts through walls (architectural poché). */
  private buildCaps(cutRel: number): THREE.Group {
    const g = new THREE.Group();
    const geos: THREE.BufferGeometry[] = [];
    for (const wall of this.model.walls) {
      for (const [s0, s1, z0, z1] of wallPieces(wall)) {
        if (z0 > cutRel || z1 < cutRel) continue;
        const a = pointAlongWall(wall, s0);
        const b = pointAlongWall(wall, s1);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const geo = new THREE.BoxGeometry(len, 0.02, wall.thickness);
        geo.rotateY(Math.atan2(b.y - a.y, b.x - a.x));
        geo.translate((a.x + b.x) / 2, this.model.floorLevel + cutRel - 0.01, -(a.y + b.y) / 2);
        geos.push(geo);
      }
    }
    for (const geo of geos) g.add(new THREE.Mesh(geo, this.capMaterial));
    g.name = "sectionCaps";
    return g;
  }

  private setTime(hour: number): void {
    this.hour = hour;
    const s = this.lighting.setTime(this.spec, hour);
    this.lights.setLevels(s.interiorLevel, s.exteriorLevel);
    this.controls.setTime(hour);
    if (this.options.bloom) this.post.setBloom(this.bloomStrength());
    this.renderer.shadowMap.needsUpdate = true;
  }

  // ------------------------------------------------------------------ interaction

  private toggleNearestDoor(): void {
    if (!this.house || this.mode !== "walk") return;
    let best: (typeof this.house.doors)[number] | null = null;
    let bestD = 1.8;
    for (const d of this.house.doors) {
      const mid = { x: d.hinge.x + d.closedDir.x * d.width * 0.5, y: d.hinge.y + d.closedDir.y * d.width * 0.5 };
      const dist = Math.hypot(mid.x - this.fp.position.x, mid.y - this.fp.position.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (!best) {
      this.hud.toast("No door within reach");
      return;
    }
    best.open = !best.open;
    this.collision.updateDoors();
    const p = this.collision.nearestFree(this.fp.position);
    this.fp.setPose(p.x, p.y, this.fp.yaw, this.fp.pitch);
    this.hud.toast(best.open ? "Door opened" : "Door closed");
  }

  private onDoubleClick = (e: MouseEvent): void => {
    if (this.mode === "walk" || !this.house) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const floorLevel = this.model.floorLevel;
    // Intersect the floor plane at house level, and fall back to the ground.
    for (const h of [floorLevel, 0]) {
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), new THREE.Vector3());
      if (!hit) continue;
      const p = { x: hit.x, y: -hit.z };
      const inside = pointInPolygon(p, this.model.footprint) || this.model.terraces.some((t) => rectContains(t.rect, p));
      if (h === floorLevel && !inside) continue;
      this.walkTo(p.x, p.y);
      return;
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.code === "Digit1") this.setMode("walk");
    if (e.code === "Digit2") this.setMode("orbit");
    if (e.code === "Digit3") this.setMode("plan");
    if (e.code === "Digit4") this.setMode("dollhouse");
    if (e.code === "KeyM") this.minimap.toggle();
    if (e.code === "KeyE") this.toggleNearestDoor();
    if (e.code === "KeyT") {
      const order = [PRESET_HOURS.morning, PRESET_HOURS.daytime, PRESET_HOURS.evening];
      const i = order.findIndex((h) => Math.abs(h - this.hour) < 0.01);
      this.setTime(order[(i + 1) % order.length]);
    }
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.labels.setSize(w, h);
  };

  // ------------------------------------------------------------------ loop

  private roomAt(x: number, y: number): Room | undefined {
    return this.model.rooms.find((r) => r.parts.some((p) => rectContains(p, { x, y })));
  }

  private placeName(x: number, y: number): string {
    const room = this.roomAt(x, y);
    if (room) return room.name;
    const t = this.model.terraces.find((tt) => rectContains(tt.rect, { x, y }, 0.1));
    if (t) return t.name;
    return "Garden";
  }

  private frame = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.cameras.update(dt);
    this.fp.update(dt);
    this.lights.update(dt, this.camera);
    this.animateDoors(dt);
    this.lighting.sky.mesh.position.copy(this.camera.position);

    const p = this.fp.position;
    const room = this.roomAt(p.x, p.y);
    const place = this.mode === "walk" || this.walkInitialized ? this.placeName(p.x, p.y) : "Exterior view";
    this.hud.setPlace(this.mode === "walk" ? place : `${this.modeLabel()} · ${place}`);
    this.minimap.render(this.model, this.version, { x: p.x, y: p.y, yaw: this.fp.yaw }, room ? { id: room.id, name: room.name } : null, this.walkInitialized ? place : "");

    this.post.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  private modeLabel(): string {
    return { walk: "Walking", orbit: "Orbit", plan: "Plan", dollhouse: "Dollhouse" }[this.mode];
  }

  private animateDoors(dt: number): void {
    if (!this.house) return;
    let moving = false;
    for (const d of this.house.doors) {
      const target = d.open ? d.openAngle : 0;
      if (Math.abs(d.angle - target) < 1e-3) continue;
      d.angle += (target - d.angle) * (1 - Math.exp(-dt * 9));
      if (Math.abs(d.angle - target) < 1e-3) d.angle = target;
      d.pivot.rotation.y = d.angle;
      moving = true;
    }
    if (moving) this.renderer.shadowMap.needsUpdate = true;
  }
}
