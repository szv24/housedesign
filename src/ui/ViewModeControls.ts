import type { ViewMode } from "../navigation/CameraModes";
import { PRESET_HOURS, formatHour, type TimePreset } from "../scene/TimeOfDay";
import { icons } from "./icons";

export interface ViewOptions {
  roof: boolean;
  cutaway: boolean;
  xray: boolean;
  labels: boolean;
  bloom: boolean;
  highQuality: boolean;
}

const MODES: Array<{ id: ViewMode; label: string; icon: string; key: string }> = [
  { id: "walk", label: "Walk", icon: icons.walk, key: "1" },
  { id: "orbit", label: "Orbit", icon: icons.orbit, key: "2" },
  { id: "plan", label: "Plan", icon: icons.plan, key: "3" },
  { id: "dollhouse", label: "Dollhouse", icon: icons.dollhouse, key: "4" }
];

const PRESETS: Array<{ id: TimePreset; label: string; icon: string }> = [
  { id: "morning", label: "Morning", icon: icons.sunrise },
  { id: "daytime", label: "Day", icon: icons.sun },
  { id: "evening", label: "Evening", icon: icons.moon }
];

const OPTION_LABELS: Array<{ key: keyof ViewOptions; label: string; hint: string }> = [
  { key: "roof", label: "Roof", hint: "Show the roof (auto-hidden in plan and dollhouse)" },
  { key: "cutaway", label: "Section cut", hint: "Cut walls to reveal rooms from above" },
  { key: "xray", label: "See-through walls", hint: "Make exterior walls translucent" },
  { key: "labels", label: "Room labels", hint: "Names and areas in 3D" },
  { key: "bloom", label: "Light glow", hint: "Bloom on lamps and string lights" },
  { key: "highQuality", label: "High quality", hint: "Ambient occlusion, sharper shadows, more lights" }
];

export class ViewModeControls {
  private readonly modeButtons = new Map<ViewMode, HTMLButtonElement>();
  private readonly presetButtons = new Map<TimePreset, HTMLButtonElement>();
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly optionInputs = new Map<keyof ViewOptions, HTMLInputElement>();
  private readonly popover: HTMLDivElement;

  constructor(
    container: HTMLElement,
    private readonly options: ViewOptions,
    handlers: { onMode: (m: ViewMode) => void; onTime: (hour: number) => void; onOptions: (o: ViewOptions) => void }
  ) {
    // Mode switcher
    const bar = document.createElement("div");
    bar.className = "panel modebar";
    const seg = document.createElement("div");
    seg.className = "segmented";
    for (const m of MODES) {
      const b = document.createElement("button");
      b.className = "seg-btn";
      b.innerHTML = `${m.icon}<span>${m.label}</span><kbd>${m.key}</kbd>`;
      b.title = `${m.label} (${m.key})`;
      b.addEventListener("click", () => handlers.onMode(m.id));
      seg.appendChild(b);
      this.modeButtons.set(m.id, b);
    }
    bar.appendChild(seg);
    const optBtn = document.createElement("button");
    optBtn.className = "icon-btn tall";
    optBtn.title = "View options";
    optBtn.innerHTML = icons.layers;
    bar.appendChild(optBtn);
    container.appendChild(bar);

    this.popover = document.createElement("div");
    this.popover.className = "panel popover hidden";
    this.popover.innerHTML = `<div class="popover-title">View options</div>`;
    for (const o of OPTION_LABELS) {
      const row = document.createElement("label");
      row.className = "toggle-row";
      row.title = o.hint;
      row.innerHTML = `<span>${o.label}</span><input type="checkbox" class="switch">`;
      const input = row.querySelector("input")!;
      input.checked = options[o.key];
      input.addEventListener("change", () => {
        this.options[o.key] = input.checked;
        handlers.onOptions(this.options);
      });
      this.optionInputs.set(o.key, input);
      this.popover.appendChild(row);
    }
    container.appendChild(this.popover);
    optBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.popover.classList.toggle("hidden");
    });
    document.addEventListener("pointerdown", (e) => {
      if (!this.popover.contains(e.target as Node) && e.target !== optBtn && !optBtn.contains(e.target as Node)) this.popover.classList.add("hidden");
    });

    // Time of day
    const time = document.createElement("div");
    time.className = "panel timecard";
    time.innerHTML = `
      <div class="timecard-head"><span class="eyebrow">Time of day</span><span class="time-label"></span></div>
      <div class="segmented small"></div>
      <input type="range" class="slider" min="5" max="22" step="0.05">`;
    const pseg = time.querySelector(".segmented")!;
    for (const p of PRESETS) {
      const b = document.createElement("button");
      b.className = "seg-btn";
      b.innerHTML = `${p.icon}<span>${p.label}</span>`;
      b.addEventListener("click", () => handlers.onTime(PRESET_HOURS[p.id]));
      pseg.appendChild(b);
      this.presetButtons.set(p.id, b);
    }
    this.slider = time.querySelector(".slider")!;
    this.timeLabel = time.querySelector(".time-label")!;
    this.slider.addEventListener("input", () => handlers.onTime(Number(this.slider.value)));
    container.appendChild(time);
  }

  setMode(mode: ViewMode): void {
    for (const [id, b] of this.modeButtons) b.classList.toggle("active", id === mode);
  }

  setTime(hour: number): void {
    this.slider.value = String(hour);
    this.timeLabel.textContent = formatHour(hour);
    for (const [id, b] of this.presetButtons) b.classList.toggle("active", Math.abs(PRESET_HOURS[id] - hour) < 0.01);
  }

  setOption(key: keyof ViewOptions, value: boolean): void {
    this.options[key] = value;
    const input = this.optionInputs.get(key);
    if (input) input.checked = value;
  }
}
