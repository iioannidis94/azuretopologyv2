import { state, saveState, updateCost, loadAzureIcons, setFullUpdate, setRenderAll, resetDiagram, resetPositions, undo, redo } from './state-management.js';
import { draw, resize, selectNode, getRenderNodes } from './canvas-engine.js';
import { renderSecurityPanel, renderSidebar, renderEditor, toggleTheme, toggleLayout, fitToScreen, toggleOnPrem, updateOnPremName, updateOnPremCidr, toggleMobileMenu, showMobilePanel, addSub, deleteSub, renameSub, addRg, deleteRg, renameRg, setRgLocation, updateSubProp, updateRgProp, addTag, updateTag, renameTag, deleteTag, addSpoke, addVnetToRg, deleteSpoke, updateVnet, togglePeering, updatePeeringConfig, selectPeering, addSubnet, deleteSubnet, updateSubnet, updateVnetProp, updateSubnetProp, toggleDropdown, filterResources, addResource, deleteResource, updateResource, updateResConfig, toggleSecurityPanel, toggleCostPanel, addRgResource, deleteRgResource, updateRgResource, addDnsRecord, deleteDnsRecord, updateDnsRecord, addVnetLink, deleteVnetLink, showDnsZoneDropdown, filterDnsZones, selectDnsZone, addAnotherDnsZone } from './ui-components.js';
import { exportPng, openPsModal, openBicepModal, closeModal, copyText, downloadText, exportJson, openJsonImportModal, handleJsonFile, confirmJsonImport, previewPastedJson, openAzureInventoryModal, handleInventoryFile, previewInventory, confirmInventoryImport, toggleExportPanel } from './export-logic.js';
import { openTemplateGallery, closeTemplateGallery, applyTemplate } from './template-gallery.js';

// ================================================================
// WIRE UP fullUpdate
// ================================================================
function fullUpdateImpl(){ 
  saveState(); updateCost(); renderSecurityPanel(); renderSidebar(); renderEditor(); draw(); 
}
setFullUpdate(fullUpdateImpl);

// Render-only (no saveState) - used by undo/redo to re-render without creating history entries
function renderAllImpl(){
  updateCost(); renderSecurityPanel(); renderSidebar(); renderEditor(); draw();
}
setRenderAll(renderAllImpl);

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================
function deleteSelectedElement() {
  if (!state.selectedId) return;
  const id = state.selectedId;
  
  // Check if it's a peering
  if (id.startsWith('peering:')) {
    const parts = id.split(':');
    togglePeering(parts[1], parts[2]);
    return;
  }
  // Check if it's on-prem
  if (id === 'onprem') { state.onPrem.enabled = false; state.selectedId = null; fullUpdateImpl(); return; }
  // Check if it's a subscription
  if (state.subscriptions.find(s => s.id === id)) { deleteSub(id); return; }
  // Check if it's a resource group
  if (state.resourceGroups.find(r => r.id === id)) { deleteRg(id); return; }
  // Check if it's a VNet (spoke)
  if (state.spokes.find(s => s.id === id)) { deleteSpoke(id); return; }
  // Check if it's a subnet
  for (const v of [state.hub, ...state.spokes]) {
    const sn = v.subnets.find(s => s.id === id);
    if (sn) { deleteSubnet(v.id, sn.id); return; }
  }
  // Check if it's an RG-level resource
  if ((state.rgResources || []).find(r => r.id === id)) { deleteRgResource(id); return; }
  // Check if it's a regular resource
  deleteResource(id);
}

function nudgeSelected(dx, dy) {
  if (!state.selectedId) return;
  const id = state.selectedId;
  if (!state.customPos) state.customPos = {};
  if (!state.customPos[id]) {
    const nodes = getRenderNodes();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    state.customPos[id] = { x: node.x, y: node.y };
  }
  state.customPos[id].x += dx;
  state.customPos[id].y += dy;
  saveState();
  draw();
}

function openShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  
  const key = e.key;
  const keyLower = key.toLowerCase();
  
  // Ctrl+Z / Cmd+Z = Undo
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && keyLower === 'z') {
    e.preventDefault();
    undo();
  }
  // Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z = Redo
  else if ((e.ctrlKey || e.metaKey) && (keyLower === 'y' || (e.shiftKey && keyLower === 'z'))) {
    e.preventDefault();
    redo();
  }
  // Ctrl+0 / Cmd+0 = Fit to screen
  else if ((e.ctrlKey || e.metaKey) && key === '0') {
    e.preventDefault();
    fitToScreen();
  }
  // Delete / Backspace = delete selected element
  else if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault();
    deleteSelectedElement();
  }
  // Escape = deselect / close modal
  else if (key === 'Escape') {
    const openModal = document.querySelector('.modal-overlay.show');
    if (openModal) { closeAllModals(); }
    else if (state.selectedId) { state.selectedId = null; fullUpdateImpl(); }
  }
  // Arrow keys = nudge element
  else if (key === 'ArrowUp') { e.preventDefault(); nudgeSelected(0, -10); }
  else if (key === 'ArrowDown') { e.preventDefault(); nudgeSelected(0, 10); }
  else if (key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(-10, 0); }
  else if (key === 'ArrowRight') { e.preventDefault(); nudgeSelected(10, 0); }
  // + / = → zoom in
  else if ((key === '+' || key === '=') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    state.scale = Math.min(3, state.scale * 1.1);
    saveState(); draw();
  }
  // - / _ → zoom out
  else if ((key === '-' || key === '_') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    state.scale = Math.max(0.2, state.scale * 0.9);
    saveState(); draw();
  }
  // ? → help panel
  else if (key === '?') {
    e.preventDefault();
    openShortcutsModal();
  }
});

// ================================================================
// EXPOSE TO GLOBAL SCOPE (for inline onclick handlers)
// ================================================================
window._fullUpdate = fullUpdateImpl;
window._undo = undo;
window._redo = redo;
window._draw = draw;
window._resize = resize;
window._selectNode = selectNode;
window._toggleTheme = toggleTheme;
window._toggleLayout = toggleLayout;
window._fitToScreen = fitToScreen;
window._toggleOnPrem = toggleOnPrem;
window._updateOnPremName = updateOnPremName;
window._updateOnPremCidr = updateOnPremCidr;
window._toggleMobileMenu = toggleMobileMenu;
window._showMobilePanel = showMobilePanel;
window._addSub = addSub;
window._deleteSub = deleteSub;
window._renameSub = renameSub;
window._addRg = addRg;
window._deleteRg = deleteRg;
window._renameRg = renameRg;
window._setRgLocation = setRgLocation;
window._updateSubProp = updateSubProp;
window._updateRgProp = updateRgProp;
window._addTag = addTag;
window._updateTag = updateTag;
window._renameTag = renameTag;
window._deleteTag = deleteTag;
window._addSpoke = addSpoke;
window._addVnetToRg = addVnetToRg;
window._deleteSpoke = deleteSpoke;
window._updateVnet = updateVnet;
window._togglePeering = togglePeering;
window._updatePeeringConfig = updatePeeringConfig;
window._selectPeering = selectPeering;
window._addSubnet = addSubnet;
window._deleteSubnet = deleteSubnet;
window._updateSubnet = updateSubnet;
window._updateVnetProp = updateVnetProp;
window._updateSubnetProp = updateSubnetProp;
window._toggleDropdown = toggleDropdown;
window._filterResources = filterResources;
window._addResource = addResource;
window._deleteResource = deleteResource;
window._updateResource = updateResource;
window._updateResConfig = updateResConfig;
window._addRgResource = addRgResource;
window._deleteRgResource = deleteRgResource;
window._updateRgResource = updateRgResource;
window._addDnsRecord = addDnsRecord;
window._deleteDnsRecord = deleteDnsRecord;
window._updateDnsRecord = updateDnsRecord;
window._addVnetLink = addVnetLink;
window._deleteVnetLink = deleteVnetLink;
window._showDnsZoneDropdown = showDnsZoneDropdown;
window._filterDnsZones = filterDnsZones;
window._selectDnsZone = selectDnsZone;
window._addAnotherDnsZone = addAnotherDnsZone;
window._exportPng = exportPng;
window._exportJson = exportJson;
window._openJsonImportModal = openJsonImportModal;
window._handleJsonFile = handleJsonFile;
window._confirmJsonImport = confirmJsonImport;
window._previewPastedJson = previewPastedJson;
window._openAzureInventoryModal = openAzureInventoryModal;
window._handleInventoryFile = handleInventoryFile;
window._previewInventory = previewInventory;
window._confirmInventoryImport = confirmInventoryImport;
window._toggleExportPanel = toggleExportPanel;
window._openPsModal = openPsModal;
window._openBicepModal = openBicepModal;
window._closeModal = closeModal;
window._copyText = copyText;
window._downloadText = downloadText;
window._resetDiagram = resetDiagram;
window._resetPositions = resetPositions;
window._toggleSecurityPanel = toggleSecurityPanel;
window._toggleCostPanel = toggleCostPanel;
window._openTemplateGallery = openTemplateGallery;
window._closeTemplateGallery = closeTemplateGallery;
window._applyTemplate = applyTemplate;
window._openShortcutsModal = openShortcutsModal;

// ================================================================
// INIT & LOAD REAL ICONS
// ================================================================
loadAzureIcons(() => {
  setTimeout(resize, 100);
  fullUpdateImpl();
});
