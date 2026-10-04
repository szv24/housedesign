/** Inline SVG icons (Lucide-style, 24px viewBox, stroke = currentColor). */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4"/><path d="M8 12l2-4 4 1 3 3"/><path d="m11 14-1 6"/>'),
  orbit: svg('<path d="M12 3a9 4 0 1 0 9 4"/><path d="M21 3v4h-4"/><path d="M3 12v5c0 1.7 4 3 9 3s9-1.3 9-3v-5"/>'),
  plan: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h8v11"/><path d="M14 3v7h7"/>'),
  dollhouse: svg('<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M5 14h14"/><path d="M12 14v6"/>'),
  sunrise: svg('<path d="M12 2v6"/><path d="m4.9 10.9 1.4 1.4"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.1 10.9-1.4 1.4"/><path d="M22 22H2"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  layers: svg('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
  sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  map: svg('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  pin: svg('<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  houses: svg('<path d="m3 10 9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>')
};
