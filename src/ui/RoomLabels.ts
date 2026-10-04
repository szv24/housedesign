import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { HouseModel } from "../model/types";

/** Room names and areas floating in 3D (presentation modes). */
export class RoomLabels {
  readonly renderer = new CSS2DRenderer();
  readonly group = new THREE.Group();

  constructor(container: HTMLElement) {
    this.renderer.domElement.className = "labels-layer";
    container.appendChild(this.renderer.domElement);
    this.group.name = "roomLabels";
  }

  build(model: HouseModel): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as CSS2DObject).element.remove();
    }
    const add = (text: string, sub: string, x: number, y: number, h: number) => {
      const el = document.createElement("div");
      el.className = "room-label";
      el.innerHTML = `<b>${text}</b><span>${sub}</span>`;
      const obj = new CSS2DObject(el);
      obj.position.set(x, h, -y);
      this.group.add(obj);
    };
    for (const r of model.rooms) {
      const p = [...r.parts].sort((a, b) => b.w * b.h - a.w * a.h)[0];
      add(r.name, `${r.area.toFixed(1)} m²`, p.x + p.w / 2, p.y + p.h / 2, model.floorLevel + 1.2);
    }
    for (const t of model.terraces) add(t.name, `${t.area.toFixed(1)} m²`, t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, t.deckHeight + 1.2);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
    this.renderer.domElement.style.display = v ? "" : "none";
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.group.visible) this.renderer.render(scene, camera);
  }
}
