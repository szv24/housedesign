import { designParameters } from "../data/designParameters";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel } from "../model/types";
import type { ValidationIssue } from "../model/validate";
import type { DesignReport } from "../interiors/DesignReport";
import { icons } from "./icons";

/**
 * Left drawer: live design parameters (writing into the house spec) and the design report
 * (room areas, validation issues, interior-rule checks).
 */
export class DesignControls {
  private readonly drawer: HTMLDivElement;
  private readonly report: HTMLDivElement;
  private readonly inputs = new Map<string, { row: HTMLDivElement; label: HTMLSpanElement; input: HTMLInputElement; value: HTMLSpanElement }>();
  private debounce = 0;

  constructor(container: HTMLElement, private readonly getSpec: () => HouseSpec, onChange: () => void, onReset: () => void) {
    const toggle = document.createElement("button");
    toggle.className = "panel pill design-toggle";
    toggle.innerHTML = `${icons.sliders}<span>Design</span>`;
    container.appendChild(toggle);

    this.drawer = document.createElement("div");
    this.drawer.className = "panel drawer hidden";
    this.drawer.innerHTML = `
      <div class="drawer-head">
        <div class="tabs"><button class="tab active" data-tab="params">Parameters</button><button class="tab" data-tab="report">Design report</button></div>
        <button class="icon-btn" data-act="close" title="Close">${icons.close}</button>
      </div>
      <div class="drawer-body" data-pane="params"></div>
      <div class="drawer-body hidden" data-pane="report"></div>`;
    container.appendChild(this.drawer);
    toggle.addEventListener("click", () => this.drawer.classList.toggle("hidden"));
    this.drawer.querySelector('[data-act="close"]')!.addEventListener("click", () => this.drawer.classList.add("hidden"));
    for (const tab of this.drawer.querySelectorAll<HTMLButtonElement>(".tab")) {
      tab.addEventListener("click", () => {
        for (const t of this.drawer.querySelectorAll(".tab")) t.classList.toggle("active", t === tab);
        for (const pane of this.drawer.querySelectorAll<HTMLElement>("[data-pane]")) pane.classList.toggle("hidden", pane.dataset.pane !== tab.dataset.tab);
      });
    }

    const params = this.drawer.querySelector('[data-pane="params"]')!;
    let group = "";
    for (const p of designParameters) {
      if (p.group !== group) {
        group = p.group;
        const h = document.createElement("div");
        h.className = "eyebrow section";
        h.textContent = group;
        params.appendChild(h);
      }
      const row = document.createElement("div");
      row.className = "param";
      row.innerHTML = `<div class="param-head"><span class="param-label">${p.label}</span><span class="param-value"></span></div><input type="range" class="slider" min="${p.min}" max="${p.max}" step="${p.step}">`;
      const input = row.querySelector("input")!;
      const value = row.querySelector(".param-value") as HTMLSpanElement;
      const label = row.querySelector(".param-label") as HTMLSpanElement;
      input.addEventListener("input", () => {
        p.set(this.getSpec(), Number(input.value));
        value.textContent = `${Number(input.value).toFixed(p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0)} ${p.unit}`;
        window.clearTimeout(this.debounce);
        this.debounce = window.setTimeout(onChange, 180);
      });
      this.inputs.set(p.id, { row, label, input, value });
      params.appendChild(row);
    }
    const reset = document.createElement("button");
    reset.className = "btn";
    reset.innerHTML = `${icons.reset}<span>Reset to the default design</span>`;
    reset.addEventListener("click", onReset);
    params.appendChild(reset);
    this.report = this.drawer.querySelector('[data-pane="report"]')!;
    this.sync();
  }

  /** Pull current values from the spec into the sliders. */
  sync(): void {
    const spec = this.getSpec();
    for (const p of designParameters) {
      const ui = this.inputs.get(p.id);
      if (!ui) continue;
      ui.row.classList.toggle("hidden", p.applies ? !p.applies(spec) : false);
      if (p.labelFor) ui.label.textContent = p.labelFor(spec);
      const v = p.get(spec);
      ui.input.value = String(v);
      ui.value.textContent = `${v.toFixed(p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0)} ${p.unit}`;
    }
  }

  setReport(model: HouseModel, issues: ValidationIssue[], report: DesignReport): void {
    const rooms = [...model.rooms].sort((a, b) => b.area - a.area);
    const roomRows = rooms.map((r) => `<tr><td>${r.name}</td><td>${r.area.toFixed(1)} m²</td></tr>`).join("");
    const terraceRows = model.terraces.map((t) => `<tr><td>${t.name}</td><td>${t.area.toFixed(1)} m²</td></tr>`).join("");
    const issueRows = issues.length
      ? issues.map((i) => `<li class="issue ${i.severity}">${i.severity === "error" ? icons.alert : icons.alert}<span>${i.message}</span></li>`).join("")
      : `<li class="issue ok">${icons.check}<span>Model is valid: every room reachable, openings bound to walls</span></li>`;
    const byRoom = new Map<string, typeof report.checks>();
    for (const c of report.checks) byRoom.set(c.room, [...(byRoom.get(c.room) ?? []), c]);
    const checks = [...byRoom.entries()]
      .map(
        ([room, list]) =>
          `<div class="check-room">${room.replace(/_/g, " ")}</div>` +
          list.map((c) => `<div class="check ${c.ok ? "ok" : "fail"}">${c.ok ? icons.check : icons.alert}<div><b>${c.rule}</b><span>${c.detail}</span></div></div>`).join("")
      )
      .join("");
    this.report.innerHTML = `
      <div class="report-summary">
        <div><b>${model.meta.interiorArea.toFixed(1)}</b><span>m² net interior</span></div>
        <div><b>${model.meta.grossArea.toFixed(1)}</b><span>m² gross</span></div>
        <div><b>${report.passed}/${report.checks.length}</b><span>rules passed</span></div>
      </div>
      <div class="eyebrow section">Rooms</div>
      <table class="area-table">${roomRows}${terraceRows}</table>
      <div class="eyebrow section">Model validation</div>
      <ul class="issues">${issueRows}</ul>
      <div class="eyebrow section">Interior design rules</div>
      <div class="checks">${checks}</div>`;
  }
}
