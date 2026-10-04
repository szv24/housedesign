import type { HouseModel, RoomId } from "../model/types";
import { FloorPlanRenderer } from "./FloorPlan";
import { icons } from "./icons";

const STORAGE_KEY = "houseviewer.minimap.width";
const MIN_W = 220;
const MAX_W = 640;
const ASPECT = 0.82;

/** Always-visible floor plan in the bottom-right corner, drawn from the HouseModel. */
export class Minimap {
  readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly roomLabel: HTMLSpanElement;
  private readonly restore: HTMLButtonElement;
  private readonly renderer = new FloorPlanRenderer();
  private width: number;
  private visible = true;
  onTeleport: (x: number, y: number) => void = () => {};

  constructor(container: HTMLElement) {
    this.width = Number(localStorage.getItem(STORAGE_KEY)) || 340;
    this.root = document.createElement("div");
    this.root.className = "panel minimap";
    this.root.innerHTML = `
      <div class="minimap-resize" title="Drag to resize"></div>
      <div class="minimap-head">
        <span class="minimap-title">${icons.map}<b>Floor plan</b></span>
        <span class="minimap-room"></span>
        <span class="minimap-actions">
          <button class="icon-btn" data-act="smaller" title="Smaller">${icons.minus}</button>
          <button class="icon-btn" data-act="larger" title="Larger">${icons.plus}</button>
          <button class="icon-btn" data-act="hide" title="Hide (M)">${icons.close}</button>
        </span>
      </div>
      <div class="minimap-canvas-wrap"><canvas></canvas></div>
      <div class="minimap-foot">Click the plan to walk there</div>`;
    container.appendChild(this.root);
    this.canvas = this.root.querySelector("canvas")!;
    this.roomLabel = this.root.querySelector(".minimap-room")!;

    this.restore = document.createElement("button");
    this.restore.className = "panel pill minimap-restore";
    this.restore.innerHTML = `${icons.map}<span>Floor plan</span><kbd>M</kbd>`;
    this.restore.addEventListener("click", () => this.toggle());
    container.appendChild(this.restore);

    this.root.querySelector('[data-act="smaller"]')!.addEventListener("click", () => this.setWidth(this.width - 60));
    this.root.querySelector('[data-act="larger"]')!.addEventListener("click", () => this.setWidth(this.width + 60));
    this.root.querySelector('[data-act="hide"]')!.addEventListener("click", () => this.toggle());
    this.canvas.addEventListener("click", (e) => {
      const r = this.canvas.getBoundingClientRect();
      const k = this.canvas.width / r.width;
      const p = this.renderer.toPlan((e.clientX - r.left) * k, (e.clientY - r.top) * k);
      this.onTeleport(p.x, p.y);
    });
    this.bindResize(this.root.querySelector(".minimap-resize")!);
    this.setWidth(this.width);
    this.setVisible(true);
  }

  private bindResize(handle: HTMLElement): void {
    let start: { x: number; w: number } | null = null;
    handle.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, w: this.width };
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (start) this.setWidth(start.w + (start.x - e.clientX));
    });
    handle.addEventListener("pointerup", () => (start = null));
  }

  setWidth(w: number): void {
    this.width = Math.round(Math.min(Math.max(w, MIN_W), Math.min(MAX_W, window.innerWidth - 40)));
    localStorage.setItem(STORAGE_KEY, String(this.width));
    const h = Math.round(this.width * ASPECT);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.renderer.invalidate();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.root.classList.toggle("hidden", !v);
    this.restore.classList.toggle("hidden", v);
  }

  invalidate(): void {
    this.renderer.invalidate();
  }

  render(model: HouseModel, version: number, player: { x: number; y: number; yaw: number }, room: { id: RoomId; name: string } | null, place: string): void {
    if (!this.visible) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    this.renderer.draw(ctx, model, version, player, room?.id ?? null);
    if (this.roomLabel.textContent !== place) this.roomLabel.textContent = place;
  }
}
