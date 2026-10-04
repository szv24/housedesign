import { housePresets, type HousePreset } from "../data/houses";
import { icons } from "./icons";

/** Picker for saved house designs. The first entry is the original courtyard house. */
export class HouseMenu {
  private readonly menu: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(container: HTMLElement, private current: string, private readonly onPick: (preset: HousePreset) => void) {
    const toggle = document.createElement("button");
    toggle.className = "panel pill house-toggle";
    toggle.innerHTML = `${icons.houses}<span>Houses</span>`;
    container.appendChild(toggle);

    this.menu = document.createElement("div");
    this.menu.className = "panel house-menu hidden";
    for (const preset of housePresets) {
      const b = document.createElement("button");
      b.className = "house-option";
      b.innerHTML = `<span class="swatch">${preset.swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span><b>${preset.name}</b><span>${preset.blurb}</span></span>`;
      b.addEventListener("click", () => {
        this.menu.classList.add("hidden");
        if (preset.id === this.current) return;
        this.setCurrent(preset.id);
        this.onPick(preset);
      });
      this.buttons.set(preset.id, b);
      this.menu.appendChild(b);
    }
    container.appendChild(this.menu);
    toggle.addEventListener("click", () => this.menu.classList.toggle("hidden"));
    this.setCurrent(current);
  }

  setCurrent(id: string): void {
    this.current = id;
    for (const [key, button] of this.buttons) button.classList.toggle("active", key === id);
  }
}
