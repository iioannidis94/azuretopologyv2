// Barrel re-export file — ui-components.js has been split into focused modules.
// This file remains for backward compatibility.
export { renderSecurityPanel, toggleSecurityPanel, toggleCostPanel } from './ui/ui-security.js';
export { toggleTheme, fitToScreen, toggleOnPrem, updateOnPremName, updateOnPremCidr, toggleMgEnabled, addMg, deleteMg, renameMg, assignSubToMg, assignMgParent, addSubToMg, renderSidebar } from './ui/ui-sidebar.js';
export { renderEditor } from './ui/ui-editor.js';
export { addSub, deleteSub, renameSub, addRg, deleteRg, renameRg, setRgLocation, updateSubProp, updateRgProp, addTag, updateTag, renameTag, deleteTag, addSpoke, addVnetToRg, deleteSpoke, updateVnet, updateVnetProp, updateSubnetProp, togglePeering, updatePeeringConfig, selectPeering, addSubnet, deleteSubnet, updateSubnet, toggleDropdown, filterResources, addResource, deleteResource, updateResource, updateResConfig, addRgResource, deleteRgResource, updateRgResource, addDnsRecord, deleteDnsRecord, updateDnsRecord, addVnetLink, deleteVnetLink, toggleVnetLink, selectVnetLink, updateVnetLinkConfig, showDnsZoneDropdown, filterDnsZones, selectDnsZone, addAnotherDnsZone } from './ui/ui-topology.js';
export { toggleMobileMenu, showMobilePanel } from './ui/ui-mobile.js';
