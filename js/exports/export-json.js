import { state, saveState, fullUpdate } from '../state-management.js';
import { closeModal } from './export-utils.js';

const JSON_EXPORT_VERSION = 1;
const TRANSIENT_KEYS = ['dragging','dragStart','offsetStart','dragNodeId','dragGroup','selectedId','offset','scale','mouseStart','dragNodeStart'];


export function exportJson(){
  const exportData = {};
  for (const key of Object.keys(state)) {
    if (!TRANSIENT_KEYS.includes(key)) {
      exportData[key] = JSON.parse(JSON.stringify(state[key]));
    }
  }
  const wrapper = {
    _format: 'AzureArchitectureBuilder',
    _version: JSON_EXPORT_VERSION,
    _exportedAt: new Date().toISOString(),
    state: exportData
  };
  const blob = new Blob([JSON.stringify(wrapper, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `azure-architecture-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 200);
}

export function openJsonImportModal(){
  document.getElementById('json-import-modal').classList.add('show');
  document.getElementById('json-file-input').value = '';
  document.getElementById('json-paste-input').value = '';
  document.getElementById('json-import-error').textContent = '';
  document.getElementById('json-import-preview').textContent = '';
  document.getElementById('json-import-preview').style.display = 'none';
  document.getElementById('json-import-merge').checked = false;
}

export function handleJsonFile(){
  const fileInput = document.getElementById('json-file-input');
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('json-paste-input').value = e.target.result;
    _previewJson(e.target.result);
  };
  reader.readAsText(file);
}

function _previewJson(raw){
  const errEl = document.getElementById('json-import-error');
  const previewEl = document.getElementById('json-import-preview');
  errEl.textContent = '';
  previewEl.style.display = 'none';
  try {
    const parsed = JSON.parse(raw);
    const data = parsed._format === 'AzureArchitectureBuilder' ? parsed.state : parsed;
    const subs = (data.subscriptions || []).length;
    const rgs = (data.resourceGroups || []).length;
    const spokes = (data.spokes || []).length;
    const hubSubnets = data.hub ? (data.hub.subnets || []).length : 0;
    const totalRes = _countResources(data);
    const lines = [
      `Subscriptions: ${subs}`,
      `Resource Groups: ${rgs}`,
      `Hub VNet subnets: ${hubSubnets}`,
      `Spoke VNets: ${spokes}`,
      `Total resources: ${totalRes}`
    ];
    if (parsed._exportedAt) lines.push(`Exported: ${parsed._exportedAt}`);
    previewEl.textContent = lines.join('\n');
    previewEl.style.display = 'block';
  } catch(e) {
    errEl.textContent = '⚠ Invalid JSON: ' + e.message;
  }
}

function _countResources(data){
  let count = 0;
  if (data.hub && data.hub.subnets) {
    data.hub.subnets.forEach(sn => { count += (sn.resources || []).length; });
  }
  (data.spokes || []).forEach(spoke => {
    (spoke.subnets || []).forEach(sn => { count += (sn.resources || []).length; });
  });
  count += (data.rgResources || []).length;
  return count;
}

export function confirmJsonImport(){
  const errEl = document.getElementById('json-import-error');
  const raw = document.getElementById('json-paste-input').value.trim();
  if (!raw) { errEl.textContent = '⚠ Please select a file or paste JSON content.'; return; }
  
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { errEl.textContent = '⚠ Invalid JSON: ' + e.message; return; }

  const data = parsed._format === 'AzureArchitectureBuilder' ? parsed.state : parsed;

  // Validate minimum structure
  if (!data.subscriptions || !data.resourceGroups || !data.hub) {
    errEl.textContent = '⚠ Invalid diagram format: missing required fields (subscriptions, resourceGroups, hub).';
    return;
  }

  const isMerge = document.getElementById('json-import-merge').checked;

  if (isMerge) {
    if (!confirm('This will merge imported resources into your current diagram. Continue?')) return;
    _mergeJsonData(data);
  } else {
    if (!confirm('This will replace your current diagram. Continue?')) return;
    // Apply imported data onto state
    for (const key of Object.keys(state)) {
      if (!TRANSIENT_KEYS.includes(key) && data[key] !== undefined) {
        state[key] = JSON.parse(JSON.stringify(data[key]));
      }
    }
  }

  // Ensure required arrays exist
  if (!state.rgResources) state.rgResources = [];
  if (!state.spokes) state.spokes = [];
  if (!state.hub.subnets) state.hub.subnets = [];
  if (!state.hub.peerings) state.hub.peerings = [];
  if (!state.hub.peeringConfigs) state.hub.peeringConfigs = {};
  state.hub.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
  state.spokes.forEach(s => {
    if (!s.subnets) s.subnets = [];
    if (!s.peerings) s.peerings = [];
    if (!s.peeringConfigs) s.peeringConfigs = {};
    s.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
  });

  // Apply theme
  if (state.theme === 'dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');

  saveState();
  closeModal('json-import-modal');
  fullUpdate();
}

function _mergeJsonData(data) {
  // Merge subscriptions (avoid duplicates by name)
  const importedSubs = JSON.parse(JSON.stringify(data.subscriptions || []));
  importedSubs.forEach(sub => {
    const existing = state.subscriptions.find(s => s.name === sub.name);
    if (!existing) {
      state.subscriptions.push(sub);
    }
  });

  // Merge resource groups (avoid duplicates by name)
  const importedRgs = JSON.parse(JSON.stringify(data.resourceGroups || []));
  importedRgs.forEach(rg => {
    const existing = state.resourceGroups.find(r => r.name === rg.name);
    if (!existing) {
      state.resourceGroups.push(rg);
    }
  });

  // Merge hub subnets and their resources
  if (data.hub && data.hub.subnets) {
    const importedHub = JSON.parse(JSON.stringify(data.hub));
    if (!state.hub.subnets) state.hub.subnets = [];
    importedHub.subnets.forEach(importedSn => {
      const existingSn = state.hub.subnets.find(s => s.name === importedSn.name);
      if (existingSn) {
        // Merge resources into existing subnet (avoid duplicates by name+type)
        if (!existingSn.resources) existingSn.resources = [];
        (importedSn.resources || []).forEach(res => {
          const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
          if (!dup) existingSn.resources.push(res);
        });
      } else {
        if (!importedSn.resources) importedSn.resources = [];
        state.hub.subnets.push(importedSn);
      }
    });
    // Merge hub peerings
    if (importedHub.peerings) {
      if (!state.hub.peerings) state.hub.peerings = [];
      importedHub.peerings.forEach(p => {
        const isDup = state.hub.peerings.some(ep => 
          (typeof ep === 'string' && ep === p) || 
          (typeof ep === 'object' && typeof p === 'object' && ep.id === p.id)
        );
        if (!isDup) {
          state.hub.peerings.push(p);
        }
      });
    }
  }

  // Merge spokes
  const importedSpokes = JSON.parse(JSON.stringify(data.spokes || []));
  importedSpokes.forEach(spoke => {
    const existingSpoke = state.spokes.find(s => s.name === spoke.name);
    if (existingSpoke) {
      // Merge subnets within the existing spoke
      if (!existingSpoke.subnets) existingSpoke.subnets = [];
      (spoke.subnets || []).forEach(importedSn => {
        const existingSn = existingSpoke.subnets.find(s => s.name === importedSn.name);
        if (existingSn) {
          if (!existingSn.resources) existingSn.resources = [];
          (importedSn.resources || []).forEach(res => {
            const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
            if (!dup) existingSn.resources.push(res);
          });
        } else {
          if (!importedSn.resources) importedSn.resources = [];
          existingSpoke.subnets.push(importedSn);
        }
      });
    } else {
      // Ensure the new spoke has required arrays before pushing
      if (!spoke.subnets) spoke.subnets = [];
      if (!spoke.peerings) spoke.peerings = [];
      if (!spoke.peeringConfigs) spoke.peeringConfigs = {};
      spoke.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
      state.spokes.push(spoke);
    }
  });

  // Merge RG-level resources
  const importedRgRes = JSON.parse(JSON.stringify(data.rgResources || []));
  importedRgRes.forEach(res => {
    const dup = (state.rgResources || []).find(r => r.name === res.name && r.type === res.type);
    if (!dup) {
      if (!state.rgResources) state.rgResources = [];
      state.rgResources.push(res);
    }
  });

  // Merge management groups if present
  if (data.managementGroups && data.managementGroups.length > 0) {
    const importedMgs = JSON.parse(JSON.stringify(data.managementGroups));
    if (!state.managementGroups) state.managementGroups = [];
    importedMgs.forEach(mg => {
      const existing = state.managementGroups.find(m => m.name === mg.name);
      if (!existing) state.managementGroups.push(mg);
    });
    if (data.mgEnabled) state.mgEnabled = true;
  }
}

export function previewPastedJson(){
  const raw = document.getElementById('json-paste-input').value.trim();
  if (raw) _previewJson(raw);
}

