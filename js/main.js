import { state, saveState, updateCost, loadAzureIcons, setFullUpdate, resetDiagram, resetPositions } from './state-management.js';
import { draw, resize, selectNode } from './canvas-engine.js';
import { renderSecurityPanel, renderSidebar, renderEditor, toggleTheme, toggleLayout, fitToScreen, toggleOnPrem, updateOnPremName, updateOnPremCidr, toggleMobileMenu, showMobilePanel, addSub, deleteSub, renameSub, addRg, deleteRg, renameRg, setRgLocation, updateSubProp, updateRgProp, addTag, updateTag, renameTag, deleteTag, addSpoke, addVnetToRg, deleteSpoke, updateVnet, togglePeering, updatePeeringConfig, selectPeering, addSubnet, deleteSubnet, updateSubnet, updateVnetProp, updateSubnetProp, toggleDropdown, filterResources, addResource, deleteResource, updateResource, updateResConfig, toggleSecurityPanel, toggleCostPanel, addRgResource, deleteRgResource, updateRgResource, addDnsRecord, deleteDnsRecord, updateDnsRecord, addVnetLink, deleteVnetLink, showDnsZoneDropdown, filterDnsZones, selectDnsZone, addAnotherDnsZone } from './ui-components.js';
import { exportPng, openPsModal, openBicepModal, closeModal, copyText, downloadText } from './export-logic.js';

// ================================================================
// WIRE UP fullUpdate
// ================================================================
function fullUpdateImpl(){ saveState(); updateCost(); renderSecurityPanel(); renderSidebar(); renderEditor(); draw(); }
setFullUpdate(fullUpdateImpl);

// ================================================================
// EXPOSE TO GLOBAL SCOPE (for inline onclick handlers)
// ================================================================
window._fullUpdate = fullUpdateImpl;
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
window._openPsModal = openPsModal;
window._openBicepModal = openBicepModal;
window._closeModal = closeModal;
window._copyText = copyText;
window._downloadText = downloadText;
window._resetDiagram = resetDiagram;
window._resetPositions = resetPositions;
window._toggleSecurityPanel = toggleSecurityPanel;
window._toggleCostPanel = toggleCostPanel;

// ================================================================
// INIT & LOAD REAL ICONS
// ================================================================
loadAzureIcons(() => {
  setTimeout(resize, 100);
  fullUpdateImpl();
});
