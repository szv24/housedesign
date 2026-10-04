import type { ViewMode } from "../navigation/CameraModes";
import { icons } from "./icons";

const HINTS: Record<ViewMode, string> = {
  walk: "<kbd>W A S D</kbd> move · <b>drag</b> to look · <kbd>Shift</kbd> run · <kbd>E</kbd> open/close door · <b>double-click</b> to capture the mouse",
  orbit: "<b>Drag</b> to orbit · <b>right-drag</b> to pan · <b>scroll</b> to zoom · <b>double-click</b> a floor to walk there",
  plan: "<b>Drag</b> to pan · <b>scroll</b> to zoom · <b>right-drag</b> to rotate · <b>double-click</b> to walk there",
  dollhouse: "<b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>double-click</b> a room to walk into it"
};

/** Title card, location chip, contextual control hints, crosshair and toasts. */
export class HUD {
  private readonly place: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private toastTimer = 0;

  constructor(container: HTMLElement, meta: { gross: number; net: number }) {
    const brand = document.createElement("div");
    brand.className = "panel brand";
    brand.innerHTML = `
      <div class="brand-title">Nordic Dream House</div>
      <div class="brand-sub">Contemporary Norwegian home · Hungary</div>
      <div class="brand-stats"><span><b class="stat-net">${meta.net.toFixed(0)}</b> m² net</span><span><b class="stat-gross">${meta.gross.toFixed(0)}</b> m² gross</span></div>
      <div class="place-chip">${icons.pin}<span class="place"></span></div>`;
    container.appendChild(brand);
    this.place = brand.querySelector(".place")!;

    this.hint = document.createElement("div");
    this.hint.className = "panel hintbar";
    container.appendChild(this.hint);

    this.crosshair = document.createElement("div");
    this.crosshair.className = "crosshair hidden";
    container.appendChild(this.crosshair);

    this.toastEl = document.createElement("div");
    this.toastEl.className = "panel toast hidden";
    container.appendChild(this.toastEl);
  }

  setIdentity(name: string, tagline: string): void {
    const title = document.querySelector(".brand-title");
    const sub = document.querySelector(".brand-sub");
    if (title) title.textContent = name;
    if (sub) sub.textContent = tagline;
  }

  setStats(net: number, gross: number): void {
    (document.querySelector(".stat-net") as HTMLElement).textContent = net.toFixed(0);
    (document.querySelector(".stat-gross") as HTMLElement).textContent = gross.toFixed(0);
  }

  setMode(mode: ViewMode): void {
    this.hint.innerHTML = HINTS[mode];
  }

  setPlace(text: string): void {
    if (this.place.textContent !== text) this.place.textContent = text;
  }

  setCrosshair(on: boolean): void {
    this.crosshair.classList.toggle("hidden", !on);
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add("hidden"), 1800);
  }
}
