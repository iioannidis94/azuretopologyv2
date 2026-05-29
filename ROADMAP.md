# 🗺️ Development Roadmap - Azure Architecture Builder

Αυτό το αρχείο περιέχει το πλάνο εξέλιξης του project, οργανωμένο σε κατηγορίες.  
Κάθε item μπορεί να μετατραπεί σε GitHub Issue για tracking.

---

## 🐛 Bug Fixes

### Issue 1: Mobile Experience - Βελτίωση touch interactions στον canvas

**Priority:** High

Η mobile εμπειρία χρειάζεται σημαντική βελτίωση. Αν και υπάρχει βασικό responsive layout και tab bar, τα interactions δεν δουλεύουν σωστά.

**Προβλήματα:**
- [ ] Τα touch events (pinch-to-zoom, drag) δεν δουλεύουν σωστά στον canvas
- [ ] Η navigation μεταξύ panels (Resources/Canvas/Properties) χρειάζεται polish
- [ ] Τα dropdowns (resource picker) δεν κλείνουν σωστά σε mobile
- [ ] Touch targets πολύ μικρά για finger interaction
- [ ] Canvas pan/zoom δεν αποκρίνεται σε touch gestures

**Acceptance Criteria:**
- Pinch-to-zoom λειτουργεί ομαλά στον canvas
- Single-finger drag κάνει pan, long-press + drag κάνει move element
- Τα dropdowns κλείνουν σωστά με tap outside
- Τα panels εναλλάσσονται ομαλά χωρίς glitches
- Minimum touch target size: 44x44px

---

## 🚀 Νέα Features

### Issue 2: Import/Export JSON Configuration

**Priority:** High

- [ ] Δυνατότητα export σε JSON αρχείο της τρέχουσας αρχιτεκτονικής
- [ ] Import από JSON για να μοιράζονται αρχιτεκτονικές μεταξύ χρηστών
- [ ] File picker dialog για import
- [ ] Download trigger για export
- [ ] Validation κατά το import (schema check)

**Σκοπός:** Αντί να βασίζεται μόνο σε localStorage, οι χρήστες να μπορούν να αποθηκεύουν και να μοιράζονται configurations.

---

### Issue 3: Terraform Export (εκτός από PowerShell & Bicep)

**Priority:** Medium

- [ ] Προσθήκη Terraform HCL generation
- [ ] Resource Group resources
- [ ] VNet & Subnet resources
- [ ] Peering connections
- [ ] Gateway resources
- [ ] Modal preview (όπως PowerShell/Bicep)

**Σκοπός:** Το Terraform είναι ένα από τα πιο δημοφιλή IaC εργαλεία και πολλοί χρήστες το προτιμούν.

---

### Issue 4: Undo/Redo Functionality

**Priority:** High

- [ ] Command pattern implementation
- [ ] History stack με configurable depth (π.χ. 50 actions)
- [ ] Undo: Ctrl+Z / Cmd+Z
- [ ] Redo: Ctrl+Y / Cmd+Shift+Z
- [ ] Visual indicator (undo/redo buttons στο header)
- [ ] Υποστήριξη για: add/remove resource, move element, rename, peering changes

**Σκοπός:** Κρίσιμο feature για οποιοδήποτε εργαλείο σχεδίασης. Χωρίς αυτό, ένα λάθος μπορεί να κοστίσει πολλή δουλειά.

---

### Issue 5: Template Gallery - Προ-κατασκευασμένα αρχιτεκτονικά patterns

**Priority:** Medium

- [ ] Template picker modal/panel
- [ ] Hub-and-Spoke basic template
- [ ] Multi-region DR setup template
- [ ] Web App + Database baseline template
- [ ] AKS with networking template
- [ ] Landing Zone (CAF) template
- [ ] Preview thumbnail για κάθε template
- [ ] "Start from template" button

**Σκοπός:** Ο χρήστης να μπορεί να ξεκινήσει από ένα proven pattern αντί από μηδέν.

---

### Issue 6: Collaboration - Shareable URLs

**Priority:** Low

- [ ] Encode state σε URL (compressed base64 / LZ-string)
- [ ] "Share" button που αντιγράφει URL στο clipboard
- [ ] Decode state από URL κατά το page load
- [ ] URL length validation (max ~2000 chars)
- [ ] Fallback: για μεγάλα diagrams, copy-paste JSON

**Σκοπός:** Χρήσιμο για code reviews, discussions, και sharing μεταξύ team members.

---

## 🎨 UI/UX Improvements

### Issue 7: Minimap / Overview Panel

**Priority:** Medium

- [ ] Minimap component στη γωνία του canvas
- [ ] Real-time preview ολόκληρου του diagram
- [ ] Viewport indicator (rectangle που δείχνει τι βλέπεις)
- [ ] Click-to-navigate στο minimap
- [ ] Toggle visibility (show/hide)

**Σκοπός:** Σε μεγάλα diagrams, ο χρήστης χάνει τον προσανατολισμό. Το minimap βοηθάει στην πλοήγηση.

---

### Issue 8: Keyboard Shortcuts

**Priority:** Medium

- [ ] `Delete` / `Backspace` - Διαγραφή επιλεγμένου element
- [ ] `Ctrl+Z` / `Ctrl+Y` - Undo/Redo (δεμένο με Issue 4)
- [ ] `Ctrl+S` - Export/Save
- [ ] `Escape` - Deselect / Close modal
- [ ] `Arrow keys` - Nudge selected element
- [ ] `+` / `-` - Zoom in/out
- [ ] `Ctrl+0` - Fit to screen
- [ ] Keyboard shortcut help panel (`?` key)
- [ ] Accessibility: focus management

**Σκοπός:** Power users χρειάζονται keyboard shortcuts. Επίσης, βελτιώνει accessibility.

---

### Issue 9: Connection Labels & Annotations

**Priority:** Low

- [ ] Δυνατότητα labels στα peering connections
- [ ] Double-click σε connection line για edit
- [ ] Bandwidth annotation (π.χ. "10 Gbps")
- [ ] Latency annotation (π.χ. "< 2ms")
- [ ] Custom notes πάνω σε connections
- [ ] Label positioning (μέσο γραμμής)
- [ ] Export: labels να φαίνονται στο PNG

**Σκοπός:** Κρίσιμο για documentation - οι αρχιτεκτονικές χρειάζονται context πέρα από τα icons.

---

## 🏗️ Technical Improvements

### Issue 11: Automated Testing

**Priority:** Medium

- [ ] Test framework setup (π.χ. Vitest ή plain Node.js test runner)
- [ ] Unit tests για IaC generation (PowerShell output validation)
- [ ] Unit tests για Bicep generation
- [ ] Unit tests για cost calculator logic
- [ ] Unit tests για state management (add/remove/peering)
- [ ] E2E tests για critical user flows (Playwright)
- [ ] CI pipeline (GitHub Actions)

**Σκοπός:** Confidence σε refactoring, regression prevention, quality assurance.

---

### Issue 12: Performance Optimization για μεγάλα diagrams

**Priority:** Low

- [ ] Canvas rendering: only redraw dirty regions
- [ ] Virtualization/culling για off-screen elements
- [ ] Throttle/debounce σε resize & scroll events
- [ ] Web Workers για layout calculations (radial/grid)
- [ ] Lazy icon loading
- [ ] Performance profiling & benchmarks

**Σκοπός:** Με 50+ resources, ο canvas μπορεί να αρχίσει να "κολλάει". Proactive optimization.

---

## 📚 Documentation

### Issue 13: Contributing Guide & Architecture Docs

**Priority:** Medium

- [ ] `CONTRIBUTING.md` - How to contribute, code style, PR process
- [ ] Architecture Decision Records (ADRs)
- [ ] Εξήγηση του canvas rendering pipeline
- [ ] State management documentation
- [ ] How to add a new resource type (developer guide)
- [ ] How to add a new export format

**Σκοπός:** Onboarding νέων contributors, knowledge preservation.

---

## 📋 Priority Matrix

| Priority | Issues |
|----------|--------|
| 🔴 High | #1 Mobile, #2 JSON Export, #4 Undo/Redo |
| 🟡 Medium | #3 Terraform, #5 Templates, #7 Minimap, #8 Shortcuts, #11 Testing, #13 Docs |
| 🟢 Low | #6 Shareable URLs, #9 Connection Labels, #12 Performance |

## 🎯 Suggested Implementation Order

1. **Phase 1 - Foundation:** Issue 4 (Undo/Redo) → Issue 8 (Keyboard Shortcuts)
2. **Phase 2 - Core Features:** Issue 2 (JSON Export) → Issue 3 (Terraform) → Issue 5 (Templates)
3. **Phase 3 - Polish:** Issue 1 (Mobile) → Issue 7 (Minimap) → Issue 9 (Labels)
4. **Phase 4 - Scale:** Issue 11 (Testing) → Issue 12 (Performance) → Issue 6 (Sharing)
5. **Ongoing:** Issue 13 (Documentation) - παράλληλα με κάθε phase
