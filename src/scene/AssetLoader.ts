import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BASE = "/assets/furniture/";

/**
 * Optional GLB furniture overrides. List catalog ids in public/assets/furniture/manifest.json
 * (e.g. ["sofa_3s"]) and drop <id>.glb next to it; the model is scaled to the catalog footprint.
 */
export class AssetLoader {
  private readonly loader = new GLTFLoader();
  private manifest: Promise<Set<string>> | null = null;
  private readonly cache = new Map<string, Promise<THREE.Object3D | null>>();

  /** Catalog ids that have a GLB override. */
  available(): Promise<Set<string>> {
    this.manifest ??= fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: unknown) => new Set(Array.isArray(ids) ? ids.map(String) : []))
      .catch(() => new Set<string>());
    return this.manifest;
  }

  async loadFurnitureOverride(catalogId: string): Promise<THREE.Object3D | null> {
    if (!(await this.available()).has(catalogId)) return null;
    let p = this.cache.get(catalogId);
    if (!p) {
      p = new Promise((resolve) => {
        this.loader.load(
          `${BASE}${catalogId}.glb`,
          (gltf) => {
            gltf.scene.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                m.castShadow = true;
                m.receiveShadow = true;
              }
            });
            resolve(gltf.scene);
          },
          undefined,
          () => resolve(null)
        );
      });
      this.cache.set(catalogId, p);
    }
    return p;
  }
}
