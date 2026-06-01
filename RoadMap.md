
# 🚀 Next Steps - Azure Architecture Builder

Unified roadmap of next steps, organized by priority phases.

---

## ✅ Completed

- Undo/Redo (command pattern, history stack, Ctrl+Z/Ctrl+Y, visual buttons)
- JSON Import/Export (architecture export, import with schema validation, file picker/download)
- Azure Resource Inventory Import (az resource list / az graph query, auto-detect hierarchy, preview panel, mapping resource types, graceful handling of unknown types)
- Core Azure hierarchy (Subscription → RG → VNet → Subnet → Resources)
- Hub & Spoke topology visualization
- Dual themes (Light/Dark)
- Grid & Radial layouts
- Freeform Drag & Drop + Group Drag
- Any-to-Any VNet Peering
- On-Premises / Hybrid connectivity
- 35+ Azure resource types
- Live Cost Estimator
- Auto-Save (localStorage)
- Properties Editor (live editing)
- PNG Export (2x resolution)
- PowerShell script generation
- Bicep template generation
- Security Posture Panel
- DNS Zones (Private & Public)
- Responsive layout (basic mobile)
- Official Azure SVG icons
- Inline canvas rename (double-click)
- Pan & Zoom navigation

---

## 🔴 Phase 1 — Critical (Must-Have / Immediate Priority)

### 1. Mobile Experience Fix
- [ ] Touch events (pinch-to-zoom, single-finger pan)
- [ ] Long-press + drag to move element
- [ ] Fix dropdowns on mobile (close on tap outside)
- [ ] Touch targets minimum 44x44px
- [ ] Smooth panel transitions

### 2. Terraform Export
- [ ] Terraform HCL code generation
- [ ] Resource Group, VNet, Subnet resources
- [ ] Peering connections + Gateways
- [ ] Modal preview (like PowerShell/Bicep)
- [ ] Download .tf file

### 3. Merge with Existing Diagram on Import
- [x] Merge capability (instead of clean import only) in Azure Resource Import
- [x] Merge option in JSON Import as well

---

## 🟡 Phase 2 — Important (Should-Have)

### 4. Template Gallery
- [x] Template picker modal
- [x] Hub-and-Spoke basic template
- [x] Multi-region DR template
- [x] Web App + Database template
- [x] AKS networking template
- [x] Landing Zone (CAF) template
- [x] Preview thumbnails

### 5. Keyboard Shortcuts
- [x] Delete/Backspace → delete element
- [x] Escape → deselect / close modal
- [x] Arrow keys → nudge element
- [x] +/- → zoom in/out
- [x] Ctrl+0 → fit to screen
- [x] ? → help panel with shortcuts

### 6. Minimap / Overview Panel
- [ ] Minimap component in the canvas corner
- [ ] Real-time preview of the entire diagram
- [ ] Viewport indicator rectangle
- [ ] Click-to-navigate
- [ ] Toggle show/hide

### 7. ARM Template Import
- [ ] Parse ARM template JSON (resources[], type, properties, dependsOn)
- [ ] Automatic node creation in the diagram
- [ ] Reverse-engineering existing infrastructures into a diagram

### 8. Terraform State Import
- [ ] Import `terraform show -json` output
- [ ] Mapping `azurerm_*` resources to internal types
- [ ] Hierarchy reconstruction

---

## 🟢 Phase 3 — Nice-to-Have

### 9. Collaboration - Shareable URLs
- [ ] Encode state into compressed URL (LZ-string)
- [ ] "Share" button → copy URL
- [ ] Decode state from URL on page load
- [ ] Fallback: JSON copy-paste for large diagrams

### 10. Connection Labels & Annotations
- [ ] Labels on peering connections
- [ ] Double-click on connection to edit
- [ ] Bandwidth / Latency annotations
- [ ] Visible labels in PNG export

### 11. ARM Template Export
- [ ] Azure Resource Manager JSON generation
- [ ] Full resource definitions
- [ ] Parameters & variables support
- [ ] Download .json file

### 12. Sharing Configurations between Users
- [ ] Ability to share JSON configurations

### 13. Bicep File Import
- [ ] Parse resource blocks and param/var declarations
- [ ] Support for modules (reference to other .bicep files)

### 14. CSV / Excel Import
- [ ] CSV format: ResourceGroup, VNet, Subnet, ResourceType, Name, Config...
- [ ] Drag-and-drop or file upload
- [ ] Automatic placement

### 15. Clipboard Smart Paste
- [ ] Ctrl+V on canvas → auto-detect format
- [ ] Parsing ARM JSON, Terraform JSON, Bicep snippet, Azure CLI output

### 16. Draw.io XML Import
- [ ] Parse draw.io XML format
- [ ] Recognition of Azure shapes/stencils
- [ ] Conversion to internal resources

### 17. Pulumi State Import
- [ ] Parse `pulumi stack export` JSON output
- [ ] Map `azure-native:*` resources to internal types

---

## 🏗️ Phase 4 — Technical Debt & Infrastructure (Ongoing)

### 18. Automated Testing
- [ ] Test framework setup (Vitest or Node test runner)
- [ ] Unit tests: IaC generation (PowerShell, Bicep)
- [ ] Unit tests: Cost calculator
- [ ] Unit tests: State management
- [ ] E2E tests: Critical user flows (Playwright)
- [ ] CI pipeline (GitHub Actions)

### 19. Performance Optimization
- [ ] Canvas: dirty region redrawing
- [ ] Off-screen element culling
- [ ] Throttle/debounce resize & scroll
- [ ] Web Workers for layout calculations
- [ ] Lazy icon loading
- [ ] Benchmarks for 50+ resources

### 20. Code Quality
- [ ] ESLint configuration
- [ ] Code formatting (Prettier)
- [ ] JSDoc documentation
- [ ] Type annotations (JSDoc types or TypeScript migration)

### 21. Documentation
- [ ] CONTRIBUTING.md
- [ ] Architecture Decision Records (ADRs)
- [ ] Canvas rendering pipeline docs
- [ ] "How to add a new resource type" guide
- [ ] "How to add a new export format" guide

---

## 📋 General Principles

- **Zero-dependency:** Every new feature in vanilla JS unless there is a very good reason
- **Modular architecture:** New features follow the existing module pattern (5 JS modules)
- **Backward compatibility:** Compatibility with existing localStorage data is critical
- **Desktop-first:** The majority of users are architects on desktop
- **Drag & Drop imports:** All imports must support drag-and-drop
- **Preview before import:** Display what will be imported before execution
- **Auto-detect format:** Automatic format recognition without user selection
