# AGENTS.md

Guidance for AI coding agents (and human contributors) working in this repository.

## Project Overview

**Azure Architecture Builder** is a 100% client-side, zero-dependency static web app for visually
designing Azure architectures (Hub & Spoke, Landing Zones, hybrid topologies) and exporting them
as PNG, JSON, PowerShell deployment scripts, and Bicep templates.

- **Stack:** Vanilla JavaScript (native ES Modules), HTML5 Canvas, CSS3, `localStorage`.
- **No backend, no bundler, no build step, no package.json.** The app runs directly in the browser.
- **No automated test suite or linter is configured** in this repo (see "Technical Debt" in `README.md`).

## Running the App

There is nothing to install or build.

```bash
# Option 1: open directly
xdg-open index.html   # or `open index.html` on macOS

# Option 2: serve locally (needed because the app uses ES modules)
python -m http.server 8000
# then browse to http://localhost:8000
```

## Repository Structure

```text
index.html                  entry HTML, loads js/main.js as a module
js/
  main.js                    app bootstrap, global window.* bindings, event delegation
  state-management.js        barrel file re-exporting from state/
  template-gallery.js        built-in template gallery (Hub & Spoke, Landing Zone, etc.)
  state/
    state-core.js            central state object, undo/redo, localStorage persistence
    state-helpers.js         misc state utilities
    state-cidr.js            CIDR/subnet calculation helpers
    state-cost.js            cost estimation logic
    state-validation.js      REQUIRED_FIELDS / IMPORT_MAPPINGS validation for exports & imports
    resource-types.js        RES_TYPES catalog, pricing calculator slugs, icons, categories
  canvas/
    canvas-layout.js         position/layout calculations (grid, radial)
    canvas-render.js         drawing/rendering of nodes, containers, connections
    canvas-interaction.js    mouse/touch events, drag-drop, pan, zoom, inline rename
    canvas-layers.js         layer/z-order handling
    canvas-minimap.js        minimap rendering & navigation
    canvas-performance.js    perf-related rendering optimizations
    canvas-viewport.js       viewport/camera calculations
  ui/
    ui-topology.js           CRUD for subscriptions, RGs, VNets, subnets, resources
    ui-editor.js             right-hand properties panel (renderConfigFields, etc.)
    ui-sidebar.js            left sidebar controls (theme, layout, on-prem, mgmt groups)
    ui-security.js           security posture analysis panel
    ui-mobile.js             mobile navigation/responsive behavior
    editor/                  per-element-type editor renderers (editor-resource.js, editor-rgresource.js, ...)
  exports/
    export-utils.js          modal helpers, copy/download utilities
    export-png.js            canvas -> PNG export
    export-json.js           JSON export/import (with merge)
    export-powershell.js     Azure PowerShell deployment script generation
    export-bicep.js          Bicep template generation
    export-inventory.js      import from Azure inventory (az resource list / az graph query / Get-AzResource)
styles/main.css               all application styling
Validate-AzureDeployment.ps1  standalone PowerShell pre-deployment validation script
```

Supporting docs: `README.md` (features/usage), `RoadMap.md` (phased roadmap),
`DEPLOYMENT-GUIDE.md` / `DEPLOYMENT-QUICKREF.md` (PowerShell deployment), `IMPLEMENTATION-SUMMARY.md`,
`PERFORMANCE_IMPROVEMENTS.md`.

## Key Conventions

- **Adding a new Azure resource type** requires touching all of the following in tandem:
  - `js/state/resource-types.js`: add to `RES_TYPES` and `PRICING_CALCULATOR_SLUGS`.
  - `js/state/state-validation.js`: add `REQUIRED_FIELDS` / `IMPORT_MAPPINGS` entries.
  - `js/exports/export-bicep.js`, `js/exports/export-powershell.js`, `js/exports/export-json.js`: add the corresponding `case` blocks.
  - `js/exports/export-inventory.js`: update `AZURE_TYPE_MAP` / `SKIP_TYPES`.
  - The properties panel (`js/ui/ui-editor.js`) auto-renders config fields via `renderConfigFields` unless a resource needs a custom editor under `js/ui/editor/`.
- Keep modules focused/single-responsibility, matching the existing split under `canvas/`, `ui/`, and `exports/` (see "Phase 1–3 Complete" refactors described in `README.md`).
- State mutations should go through the undo/redo-aware helpers in `js/state/state-core.js` rather than mutating state directly, to keep history consistent.
- No external runtime dependencies should be added; the project is intentionally zero-dependency and CDN-only for icons/fonts.

## Validation

There is no build, lint, or test tooling in this repository. Before finalizing changes:

1. Syntax-check every modified JS file:
   ```bash
   node --check path/to/file.js
   ```
2. Do a quick ESM import smoke test where feasible (stub `window`/`document` as needed) to catch import/export errors across modules.
3. Manually exercise the affected feature in a browser via the local static server (see "Running the App") — there is no automated test suite to rely on.
4. If you touch PowerShell export logic, consider validating generated scripts with `Validate-AzureDeployment.ps1`.
