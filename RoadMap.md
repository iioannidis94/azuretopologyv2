# 🗺️ Azure Architecture Builder — Development Roadmap

**High-level phases and timeline for feature completion and technical enhancements.**

---

## 📊 Project Status

| Aspect | Status | Completion |
|--------|--------|------------|
| **Core Features** | ✅ Complete | 100% |
| **Modular Architecture** | ✅ In Progress | 75% (Phase 4 pending) |
| **Export/Import** | ✅ Mostly Complete | 85% (ARM/TF import pending) |
| **UI/UX** | ✅ Complete | 90% (Mobile touch improvements pending) |
| **Testing & QA** | 🟡 Pending | 0% |

---

## 🔴 Phase 1 — Critical (Next 2–3 weeks)

**Focus:** Mobile-first fixes and infrastructure export.

### Deliverables

- [ ] **Mobile Experience** — Touch gestures, pinch-to-zoom, long-press drag, 44×44px targets, smooth transitions
- [ ] **Terraform Export** — HCL code generation with `.tf` file download
- [ ] **State-Management Split** — Complete modularization of `state-management.js` into 4 focused modules
  - [ ] `resource-types.js` (definitions, icons, pricing)
  - [ ] `state-cidr.js` (networking utilities)
  - [ ] `state-cost.js` (cost calculations)
  - [ ] `state-helpers.js` (query helpers)

### Success Criteria

- App works smoothly on mobile devices (touch, tablets)
- Users can export infrastructure as Terraform
- State-management layer is fully modularized and tested

### Effort

- 🚀 **2–3 weeks** with focused effort
- Team: 1–2 developers
- Tokens: ~36,000–40,000 (mix of Haiku and Sonnet)

---

## 🟡 Phase 2 — Important (Weeks 4–6)

**Focus:** Reverse-engineering existing infrastructure and template improvements.

### Deliverables

- [ ] **ARM Template Import** — Parse and reverse-engineer Azure Resource Manager templates
- [ ] **Terraform State Import** — Import `terraform show -json` output
- [ ] **Template Gallery Split** — Separate template data from UI logic
- [ ] **Enhanced Preview UI** — Show diff/delta view of what will be imported

### Success Criteria

- Users can drag-drop existing ARM templates into the diagram
- Terraform state from any Azure project can be visualized
- Template gallery is cleaner and more maintainable

### Effort

- 📅 **2–3 weeks**
- Team: 1–2 developers
- Tokens: ~18,000–22,000 (Sonnet + Haiku)

---

## 🟢 Phase 3 — Collaboration & Sharing (Weeks 7–9)

**Focus:** Enable teams to share and collaborate on diagrams.

### Deliverables

- [ ] **Shareable URLs** — Compress state into URL for instant sharing
- [ ] **Progressive Web App (PWA)** — Offline support, installability
- [ ] **In-Canvas Search** — Ctrl+F to find resources
- [ ] **Export to draw.io** — Generate `.drawio` files for enterprise teams

### Success Criteria

- Users can generate a URL and share diagrams without backend
- App works offline (cached)
- Architects can quickly navigate large diagrams
- Integration with existing diagramming tools

### Effort

- 📅 **2–3 weeks**
- Team: 1 developer
- Tokens: ~12,000–15,000 (Haiku)

---

## 🏗️ Phase 4 — Technical Debt & Scalability (Weeks 10–12)

**Focus:** Preparation for scale and future development.

### Deliverables

- [ ] **Automated Testing** — Unit tests (state, exports) + E2E tests (critical flows)
- [ ] **Linting & Formatting** — ESLint, Prettier, JSDoc
- [ ] **Performance Optimization** — Dirty region rendering, canvas culling, large diagram support (100+ resources)
- [ ] **TypeScript Migration** (Optional) — Incremental JSDoc → TypeScript

### Success Criteria

- Test coverage for critical paths (>80%)
- CI pipeline running on PRs
- Diagram performance smooth with 100+ resources
- Code is self-documenting and maintainable

### Effort

- 📅 **3–4 weeks**
- Team: 1–2 developers + QA
- Tokens: ~20,000–25,000

---

## ⭐ Phase 5 — Advanced Features (Ongoing)

**Focus:** Premium features for power users.

### High-Priority Features

- [ ] **Custom Resource Types** — Users can define their own resources
- [ ] **Connection Labels & Annotations** — Name peerings, bandwidth hints
- [ ] **Diagram Versioning** — Save/load multiple versions
- [ ] **CSV / Excel Import** — Tabular infrastructure definition

### Medium-Priority Features

- [ ] **Bicep File Import** — Parse `.bicep` files
- [ ] **Pulumi State Import** — `pulumi stack export` support
- [ ] **Clipboard Smart Paste** — Auto-detect format from clipboard
- [ ] **IndexedDB Migration** — Support diagrams >5 MB (beyond localStorage)

### Effort

- 📅 **Ongoing (pick features as needed)**
- Team: 1 developer per feature
- Tokens: ~5,000–10,000 per feature

---

## 📈 Effort & Timeline Summary

| Phase | Duration | Key Features | Tokens | Status |
|-------|----------|--------------|--------|--------|
| **Phase 1** | 2–3 weeks | Mobile, Terraform, State split | 36–40K | 🔴 Next |
| **Phase 2** | 2–3 weeks | ARM/TF import, Templates | 18–22K | 🟡 Planned |
| **Phase 3** | 2–3 weeks | Sharing, PWA, Search | 12–15K | 🟢 Planned |
| **Phase 4** | 3–4 weeks | Testing, Performance, TypeScript | 20–25K | 🟢 Planned |
| **Phase 5** | Ongoing | Advanced features (pick-and-choose) | 5–10K each | 🟢 Backlog |
| **TOTAL** | ~12–16 weeks | Full product | ~100K | — |

---

## 🎯 Quick Start for Contributors

To get started with Phase 1:

1. **Pick a task** from `planning.md`
2. **Copy the suggested prompt** for your chosen AI model
3. **Review and integrate** the generated code
4. **Test in the browser**
5. **Move to the next task**

### Recommended First Task

Start with **Task 1a** (resource-types.js split) — it's the simplest and gives you confidence for larger refactors.

---

## 🔄 Release Strategy

### Minor Releases (v1.1, v1.2, etc.)

- **Every 2–3 weeks** after completing a Phase
- Example: v1.1 = Phase 1 complete (mobile + Terraform)
- Example: v1.2 = Phase 2 complete (imports + templates)

### Patch Releases (v1.0.1, v1.0.2)

- Bug fixes and small improvements between phases
- Released as needed

### Major Release (v2.0)

- After Phase 4 complete: major architectural stability + testing
- Consider at that time: package distribution (npm), TypeScript, new architecture patterns

---

## 🤝 Team & Collaboration

### Recommended Team Structure

- **1 Full-stack Developer** — Phases 1–3 (8–10 weeks)
- **Optional: 1 QA/Testing Specialist** — Phase 4 onward
- **Optional: 1 Architect Review** — Major decisions (PWA, TypeScript, database)

### Communication Cadence

- **Weekly standups** — Progress review, blockers
- **Bi-weekly demos** — Show completed features to stakeholders
- **Code reviews** — Peer review before merge

---

## 💡 Success Metrics

### Phase 1

- ✅ Mobile usability testing passes (touch, tablets)
- ✅ Terraform exports valid and deployable
- ✅ Zero regressions from previous features

### Phase 2

- ✅ ARM/Terraform import accuracy >90%
- ✅ Users report: "I can visualize my entire infrastructure"

### Phase 3

- ✅ URL sharing adoption >50% of users
- ✅ PWA installation >30% of users
- ✅ Diagram search adoption >40% of users

### Phase 4

- ✅ Test coverage >80%
- ✅ CI/CD pipeline green
- ✅ Diagram performance smooth with 100+ resources

### Phase 5 (Ongoing)

- ✅ User feature requests addressed
- ✅ Performance remains strong as complexity increases
- ✅ Community contributions (if open-sourced)

---

## 🚀 Launch Readiness

### Pre-v1.0 (Current)

- ✅ Core features complete and stable
- ✅ Basic user testing completed
- ✅ Documentation comprehensive
- ✅ Zero-dependency approach validated

### Pre-v2.0 (After Phase 4)

- ✅ Automated tests passing
- ✅ Performance optimized for large diagrams
- ✅ PWA and offline support ready
- ✅ Collaboration features working
- ✅ Open-source ready (if applicable)

---

## 📞 Questions?

- For **implementation details**, see `planning.md`
- For **completed features**, see `README.md`
- For **architecture decisions**, see `nextsteps.md` (legacy) and `distributions.md` (legacy)

---

## 🎉 Final Notes

The Azure Architecture Builder is already **production-ready** for single-user diagram creation. Phases 1–3 focus on expanding it to **teams**, **reverse-engineering**, and **sharing**. Phase 4 ensures it **scales** smoothly as projects grow.

**The roadmap is flexible** — prioritize based on user feedback, business goals, and team capacity. Pick features that deliver the most value to your users. 🚀

