# Parametric Norwegian Dream House (Three.js)

Interactive, walkable, browser-based architectural prototype built with Three.js + TypeScript + Vite. The 3D house, floor plan, interiors, lighting and collision all come from one `houseSpec`.

## Run

```bash
npm install
npm run dev
```

Tests: `npm test`.

## Design assumptions

- Single-storey L-shaped house on a Budapest-like site (47.5°N). Street is north; garden and courtyard open south and east.
- Social wing 17.4 × 7.2 m (entrance, service core, vaulted LDK). Private wing 6.0 × 11.4 m (bedrooms facing the courtyard).
- Net interior about 166 m², gross about 194 m². Main terrace ~42 m² inside the L; master private terrace ~7.8 m² on the west facade.
- Exterior walls 0.40 m, partitions 0.12 m, wall height 2.8 m, roof pitch 32°, finished floor +0.45 m.
- Room geometry is a split tree in `src/data/houseSpec.ts`, never absolute coordinates. Change a size and the flex neighbour absorbs it.

## Controls

- `1` Walk · `2` Orbit · `3` Plan · `4` Dollhouse
- Walk: WASD / arrows, Shift to run, drag to look, double-click to capture the mouse, `E` to open or close a nearby door
- `M` toggle the floor-plan minimap (click it to walk there)
- `T` cycle Morning / Day / Evening
- Double-click a floor in Orbit / Plan / Dollhouse to walk to that point
- **Houses** menu: Courtyard L is the original design; Garden gable is the long cottage; Family plan is the 14.2 × 8.4 m drawing with the 15 m² terrace
- **Design** drawer: live sliders for wing sizes, room depths, terrace depth; design report with areas and rule checks
- View options: roof, section cut, see-through walls, room labels, light glow, high quality (GTAO + sharper shadows)

The app launches in Orbit from the south-east so the courtyard, terrace and both wings are visible.

## How to modify the spec

Edit `src/data/houseSpec.ts` (or the Design sliders):

- `building` — wing lengths, wall height, roof pitch, terrace depth
- `layout` — split-tree room sizes (`size` or `'flex'`)
- `openings` / `connections` — windows, sliding doors, interior doors
- `terraces` — deck, pergola, planted buffer, privacy screens
- `style` — exterior and interior palettes

Regeneration updates geometry, furniture, collision, lights and the minimap from the same `HouseModel`.

## Furniture overrides

Procedural Scandinavian pieces are the default. Drop a file at `public/assets/furniture/<catalogId>.glb` and it is auto-fitted to the catalog footprint.

## Architecture

- `src/data/` — house spec, design rules, room programs
- `src/model/` — layout solver, walls, terraces, validation
- `src/architecture/` — 3D generators (walls, roof valley, rooms, openings, terrace)
- `src/interiors/` — rules engine, occupancy grid, furniture library
- `src/navigation/` — first-person walking, collision, camera modes
- `src/scene/` — materials, time of day, interior lights, landscape
- `src/ui/` — glass UI, floor plan, design drawer, HUD
