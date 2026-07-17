import { state, saveState, RES_TYPES, fullUpdate, extractConfigFromAzure, normalizeResourceConfig, createResourceMeta, validateResource } from '../state-management.js';
import { closeModal, _uid } from './export-utils.js';

// AZURE RESOURCE INVENTORY IMPORT
// ================================================================
const AZURE_TYPE_MAP = {
  'microsoft.compute/virtualmachines': 'vm',
  'microsoft.compute/virtualmachinescalesets': 'vmss',
  'microsoft.containerservice/managedclusters': 'aks',
  'microsoft.web/sites': 'app', // could also be fa
  'microsoft.app/containerapps': 'aca',
  'microsoft.network/azurefirewalls': 'fw',
  'microsoft.network/applicationgateways': 'agw',
  'microsoft.network/loadbalancers': 'lb',
  'microsoft.network/virtualnetworkgateways': 'gw',
  'microsoft.network/bastionhosts': 'bas',
  'microsoft.cdn/profiles': 'afd',
  'microsoft.network/privateendpoints': 'pe',
  'microsoft.network/privatednszones': 'dns',
  'microsoft.network/dnszones': 'publicDns',
  'microsoft.network/networksecuritygroups': 'nsg',
  'microsoft.sql/servers': 'sql',
  'microsoft.sql/servers/databases': 'sql',
  'microsoft.documentdb/databaseaccounts': 'cosmos',
  'microsoft.storage/storageaccounts': 'sa',
  'microsoft.cache/redis': 'redis',
  'microsoft.keyvault/vaults': 'kv',
  'microsoft.apimanagement/service': 'apim',
  'microsoft.servicebus/namespaces': 'sb',
  'microsoft.eventhub/namespaces': 'evh',
  'microsoft.logic/workflows': 'logic',
  'microsoft.cognitiveservices/accounts': 'openai',
  'microsoft.operationalinsights/workspaces': 'monitor',
};

// Resource types we skip silently (infrastructure/internal resources)
const SKIP_TYPES = new Set([
  'microsoft.network/virtualnetworks',
  'microsoft.network/virtualnetworks/subnets',
  'microsoft.network/publicipaddresses',
  'microsoft.network/networkinterfaces',
  'microsoft.network/routetables',
  'microsoft.resources/deployments',
  'microsoft.network/networkwatchers',
  'microsoft.compute/disks',
  'microsoft.compute/snapshots',
  'microsoft.compute/images',
]);

export function openAzureInventoryModal(){
  document.getElementById('azure-inventory-modal').classList.add('show');
  document.getElementById('inventory-file-input').value = '';
  document.getElementById('inventory-paste-input').value = '';
  document.getElementById('inventory-import-error').textContent = '';
  document.getElementById('inventory-import-preview').textContent = '';
  document.getElementById('inventory-import-preview').style.display = 'none';
  document.getElementById('inventory-import-merge').checked = false;
  setInventoryScope('mg'); // default to MG scope
}

export function setInventoryScope(scope) {
  const scopes = ['mg', 'sub', 'rg'];
  const scopeInfo = {
    mg: 'Exports all subscriptions and resources under a Management Group hierarchy.',
    sub: 'Exports all resource groups and resources within a single subscription.',
    rg: 'Exports all resources within a specific Resource Group.'
  };
  scopes.forEach(s => {
    const btn = document.getElementById(`scope-btn-${s}`);
    const section = document.getElementById(`inventory-scope-${s}`);
    if (btn) btn.classList.toggle('active', s === scope);
    if (section) section.style.display = s === scope ? 'block' : 'none';
  });
  const infoEl = document.getElementById('inventory-scope-info');
  if (infoEl) infoEl.textContent = scopeInfo[scope] || '';
}

export function handleInventoryFile(){
  const fileInput = document.getElementById('inventory-file-input');
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('inventory-paste-input').value = e.target.result;
    _previewInventoryData(e.target.result);
  };
  reader.readAsText(file);
}

export function previewInventory(){
  const raw = document.getElementById('inventory-paste-input').value.trim();
  if (raw) _previewInventoryData(raw);
}

function _previewInventoryData(raw){
  const errEl = document.getElementById('inventory-import-error');
  const previewEl = document.getElementById('inventory-import-preview');
  errEl.textContent = '';
  previewEl.style.display = 'none';
  try {
    const parsed = JSON.parse(raw);
    const resources = _extractResourceArray(parsed);
    const mgData = _extractMgData(parsed);
    const subData = _extractSubscriptionData(parsed);
    const analysis = _analyzeInventory(resources);
    const lines = [];
    if (mgData) {
      const mgCount = Array.isArray(mgData) ? mgData.length : (mgData.children ? mgData.children.length + 1 : 1);
      lines.push(`Management Groups: ${mgCount}`);
    }
    if (subData) {
      lines.push(`Subscriptions found: ${subData.length}`);
    } else {
      lines.push(`Subscriptions detected: ${analysis.subIds.size}`);
    }
    lines.push(`Total resources found: ${resources.length}`);
    lines.push(`Resource Groups: ${analysis.rgNames.size}`);
    lines.push(`VNets detected: ${analysis.vnets.length}`);
    lines.push(`Mappable resources: ${analysis.mapped}`);
    lines.push(`Unsupported (will skip): ${analysis.unsupported}`);
    lines.push(`Skipped (infra): ${analysis.skipped}`);
    if (analysis.warnings.length > 0) {
      lines.push('');
      lines.push('⚠ Unsupported types:');
      analysis.warnings.slice(0, 8).forEach(w => lines.push(`  - ${w}`));
      if (analysis.warnings.length > 8) lines.push(`  ... and ${analysis.warnings.length - 8} more`);
    }
    previewEl.textContent = lines.join('\n');
    previewEl.style.display = 'block';
  } catch(e) {
    errEl.textContent = '⚠ Invalid JSON: ' + e.message;
  }
}

function _extractResourceArray(parsed) {
  // Handle various Azure output formats
  if (Array.isArray(parsed)) return parsed;
  if (parsed.data && Array.isArray(parsed.data)) return parsed.data; // az graph query format
  if (parsed.value && Array.isArray(parsed.value)) return parsed.value; // ARM API response
  // MG-scope export format: { managementGroups, subscriptions, resources }
  if (parsed.resources && Array.isArray(parsed.resources)) return parsed.resources;
  return [];
}

function _extractMgData(parsed) {
  // Extract management group hierarchy from MG-scope exports
  if (parsed.managementGroups) return parsed.managementGroups;
  return null;
}

function _extractSubscriptionData(parsed) {
  // Extract subscription info from MG-scope exports
  if (parsed.subscriptions && Array.isArray(parsed.subscriptions)) return parsed.subscriptions;
  return null;
}

function _analyzeInventory(resources) {
  const rgNames = new Set();
  const subIds = new Set();
  const vnets = [];
  let mapped = 0;
  let unsupported = 0;
  let skipped = 0;
  const warnings = [];
  const seenUnsupported = new Set();

  resources.forEach(r => {
   const type = (r.type || r.ResourceType || '').toLowerCase();
    const rId = r.id || r.Id || r.ResourceId || '';
    
    const rg = _extractRgFromId(rId) || r.resourceGroup || r.ResourceGroupName || '';
    if (rg) rgNames.add(rg);
    const subId = _extractSubFromId(rId) || r.subscriptionId || r.SubscriptionId || '';
    if (subId) subIds.add(subId);

    if (type === 'microsoft.network/virtualnetworks') {
      vnets.push(r);
    } else if (SKIP_TYPES.has(type)) {
      skipped++;
    } else if (AZURE_TYPE_MAP[type]) {
      mapped++;
    } else {
      unsupported++;
      if (!seenUnsupported.has(type)) {
        seenUnsupported.add(type);
        warnings.push(type);
      }
    }
  });

  return { rgNames, subIds, vnets, mapped, unsupported, skipped, warnings };
}

function _extractRgFromId(id) {
  if (!id) return null;
  const match = id.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : null;
}

function _extractSubFromId(id) {
  if (!id) return null;
  const match = id.match(/\/subscriptions\/([^/]+)/i);
  return match ? match[1] : null;
}

function _extractVnetSubnetFromId(id) {
  if (!id) return { vnet: null, subnet: null };
  const vnetMatch = id.match(/Microsoft\.Network\/virtualNetworks\/([^/]+)/i);
  const subnetMatch = id.match(/\/subnets\/([^/]+)/i);
  return { vnet: vnetMatch ? vnetMatch[1] : null, subnet: subnetMatch ? subnetMatch[1] : null };
}

function _extractPeeringsFromVnet(props, vnetMap) {
  // Extract peerings from VNet properties and build peering configs
  const peerings = [];
  const peeringConfigs = {};
  
  if (props.virtualNetworkPeerings && Array.isArray(props.virtualNetworkPeerings)) {
    props.virtualNetworkPeerings.forEach(peering => {
      const peeringProps = peering.properties || peering.Properties || {};
      const remoteVnetId = peeringProps.remoteVirtualNetwork?.id || peeringProps.RemoteVirtualNetwork?.id || '';
      const remoteVnetName = remoteVnetId.split('/').pop();
      
      if (remoteVnetName && vnetMap.has(remoteVnetName)) {
       const peeringId = _uid();
       peerings.push(peeringId);
        
       peeringConfigs[peeringId] = {
         remoteVnetId: vnetMap.get(remoteVnetName).id,
         remoteVnetName: remoteVnetName,
         allowForwardedTraffic: (peeringProps.allowForwardedTraffic === true) || (peeringProps.AllowForwardedTraffic === true),
         allowGatewayTransit: (peeringProps.allowGatewayTransit === true) || (peeringProps.AllowGatewayTransit === true),
         allowVirtualNetworkAccess: (peeringProps.allowVirtualNetworkAccess === true) || (peeringProps.AllowVirtualNetworkAccess === true),
         useRemoteGateways: (peeringProps.useRemoteGateways === true) || (peeringProps.UseRemoteGateways === true)
       };
      }
    });
  }
  
  return { peerings, peeringConfigs };
}


export function confirmInventoryImport(){
  const errEl = document.getElementById('inventory-import-error');
  const raw = document.getElementById('inventory-paste-input').value.trim();
  if (!raw) { errEl.textContent = '⚠ Please select a file or paste JSON content.'; return; }

  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { errEl.textContent = '⚠ Invalid JSON: ' + e.message; return; }

  const resources = _extractResourceArray(parsed);
  if (resources.length === 0) {
    errEl.textContent = '⚠ No resources found in the JSON. Expected an array of Azure resources.';
    return;
  }

  const isMerge = document.getElementById('inventory-import-merge').checked;

  if (isMerge) {
    if (!confirm('This will merge imported inventory into your current diagram. Continue?')) return;
  } else {
    if (!confirm('This will replace your current diagram with the imported inventory. Continue?')) return;
  }

  // Extract MG/Sub data if available (MG-scope exports)
  const mgData = _extractMgData(parsed);
  const subData = _extractSubscriptionData(parsed);

  // Build the state from Azure inventory
  const subMap = new Map(); // subId -> { name, id }
  const rgMap = new Map();  // rgName -> { rg object }
  const vnetMap = new Map(); // vnetName -> vnet data
  const subnetResourceMap = new Map(); // "vnet/subnet" -> [resources]
  const rgResourceList = []; // RG-level resources (DNS zones)
  const unmappedResources = []; // resources without subnet info go to a default subnet

  // First pass: identify subscriptions, RGs, VNets, subnets
 // First pass: identify subscriptions, RGs, VNets, subnets
  resources.forEach(r => {
    const rId = r.id || r.Id || r.ResourceId || '';
    const subId = _extractSubFromId(rId) || r.subscriptionId || r.SubscriptionId || 'default-subscription';
    const rgName = _extractRgFromId(rId) || r.resourceGroup || r.ResourceGroupName || 'default-rg';
    const location = r.location || r.Location || 'eastus';
    const type = (r.type || r.ResourceType || '').toLowerCase();

    if (!subMap.has(subId)) {
      subMap.set(subId, { name: r.subscriptionDisplayName || `Subscription-${subId.slice(0,8)}`, id: _uid() });
    }
    if (!rgMap.has(rgName)) {
      rgMap.set(rgName, { name: rgName, id: _uid(), subId: subMap.get(subId).id, location: location, tags: {} });
    }

    if (type === 'microsoft.network/virtualnetworks') {
      const props = r.properties || r.Properties || {};
      const addressSpace = props.addressSpace || props.AddressSpace || {};
      const cidr = (addressSpace.addressPrefixes || addressSpace.AddressPrefixes || ['10.0.0.0/16'])[0];
      
      const rawSubnets = props.subnets || props.Subnets || [];
      const subnets = rawSubnets.map(sn => ({
        id: _uid(),
        name: sn.name || sn.Name || sn.properties?.name || sn.Properties?.Name || 'default',
        cidr: (sn.properties?.addressPrefix) || (sn.Properties?.AddressPrefix) || (sn.addressPrefix) || (sn.AddressPrefix) || '10.0.1.0/24',
        resources: []
      }));
      if (subnets.length === 0) {
        subnets.push({ id: _uid(), name: 'default', cidr: '10.0.0.0/24', resources: [] });
      }
      vnetMap.set(r.name || r.Name, {
        id: _uid(),
        name: r.name || r.Name,
        cidr: cidr,
        rgId: rgMap.get(rgName).id,
        subnets: subnets,
        peerings: [],
        peeringConfigs: {}
      });
    }
  });

  // Second pass: map resources to types and assign to subnets
  // Second pass: map resources to types and assign to subnets
  resources.forEach(r => {
    const rId = r.id || r.Id || r.ResourceId || '';
    const type = (r.type || r.ResourceType || '').toLowerCase();
    
    if (type === 'microsoft.network/virtualnetworks') return;
    if (SKIP_TYPES.has(type)) return;

    const internalType = AZURE_TYPE_MAP[type];
    if (!internalType) return;

    // Check if it's a Function App
    let resolvedType = internalType;
    if (type === 'microsoft.web/sites') {
      const kind = (r.kind || r.Kind || '').toLowerCase();
      if (kind.includes('functionapp')) resolvedType = 'fa';
    }

    const rgName = _extractRgFromId(rId) || r.resourceGroup || r.ResourceGroupName || 'default-rg';
    const rgObj = rgMap.get(rgName);

    // RG-level resources
    const rtDef = RES_TYPES[resolvedType];
    if (rtDef && rtDef.rgLevel) {
      const resObj = _createResourceWithMeta(resolvedType, r.name || r.Name, _buildConfig(r, resolvedType), r);
      resObj.rgId = rgObj ? rgObj.id : null;
      rgResourceList.push(resObj);
      return;
    }

    const resObj = _createResourceWithMeta(resolvedType, r.name || r.Name, _buildConfig(r, resolvedType), r);

    // Try to find subnet from resource properties
    let assignedSubnet = false;
    const props = r.properties || r.Properties || {};
    const subnetId = _findSubnetRef(props);
    if (subnetId) {
      const { vnet, subnet } = _extractVnetSubnetFromId(subnetId);
      if (vnet && subnet && vnetMap.has(vnet)) {
        const vnetData = vnetMap.get(vnet);
        const snObj = vnetData.subnets.find(s => s.name.toLowerCase() === subnet.toLowerCase());
        if (snObj) {
          snObj.resources.push(resObj);
          assignedSubnet = true;
        }
      }
    }

    if (!assignedSubnet) {
      unmappedResources.push({ res: resObj, rgName });
    }
  });

  // Third pass: extract peerings from VNet properties now that all vnets are identified
  resources.forEach(r => {
    const type = (r.type || r.ResourceType || '').toLowerCase();
    if (type !== 'microsoft.network/virtualnetworks') return;
     
    const vnetName = r.name || r.Name;
    const vnetData = vnetMap.get(vnetName);
    if (!vnetData) return;
     
    const props = r.properties || r.Properties || {};
    const { peerings, peeringConfigs } = _extractPeeringsFromVnet(props, vnetMap);
     
    if (peerings.length > 0) {
      vnetData.peerings = peerings;
      vnetData.peeringConfigs = peeringConfigs;
    }
  });

  // Assign unmapped resources: find/create a default vnet in the same RG
  unmappedResources.forEach(({ res, rgName }) => {
    const rgObj = rgMap.get(rgName);
    // Find an existing vnet in this RG
    let targetVnet = null;
    for (const [, vnet] of vnetMap) {
      if (vnet.rgId === rgObj.id) { targetVnet = vnet; break; }
    }
    if (!targetVnet) {
      // Create a default vnet for this RG
      targetVnet = {
        id: _uid(),
        name: `${rgName}-vnet`,
        cidr: '10.0.0.0/16',
        rgId: rgObj.id,
        subnets: [{ id: _uid(), name: 'default', cidr: '10.0.0.0/24', resources: [] }],
        peerings: [],
        peeringConfigs: {}
      };
      vnetMap.set(targetVnet.name, targetVnet);
    }
    targetVnet.subnets[0].resources.push(res);
  });

  // Resolve vnet links in DNS zones: map vnet names to vnet IDs
  rgResourceList.forEach(res => {
    if ((res.type === 'dns' || res.type === 'publicDns') && res.config && res.config.vnetLinks) {
      res.config.vnetLinks = res.config.vnetLinks.map(link => ({
        ...link,
        vnetId: vnetMap.has(link.vnetName) ? vnetMap.get(link.vnetName).id : link.vnetId
      })).filter(link => link.vnetId); // Remove unresolved links
    }
  });

  // Build final state
  const subscriptions = [...subMap.values()].map(s => ({ id: s.id, name: s.name, subscriptionId: '', tenantId: '', tags: {}, mgId: null }));
  const resourceGroups = [...rgMap.values()];
  const allVnets = [...vnetMap.values()];

  // First vnet is the hub, rest are spokes
  const hub = allVnets.length > 0 ? allVnets[0] : { id: _uid(), name: 'Hub-VNet', cidr: '10.0.0.0/16', subnets: [{ id: _uid(), name: 'default', cidr: '10.0.0.0/24', resources: [] }], peerings: [], peeringConfigs: {} };
  const spokes = allVnets.slice(1);

  // Ensure hub has rgId linked
  if (!hub.rgId && resourceGroups.length > 0) hub.rgId = resourceGroups[0].id;
  spokes.forEach(s => { if (!s.rgId && resourceGroups.length > 0) s.rgId = resourceGroups[0].id; });

  // Build Management Group hierarchy if MG data is available
  let managementGroups = [];
  let mgEnabled = false;
  if (mgData) {
    mgEnabled = true;
    managementGroups = _buildMgHierarchy(mgData, subscriptions);
  }

  // If subData available, enrich subscription info
  if (subData) {
    subData.forEach(sd => {
      const subId = sd.subscriptionId || sd.Id?.split('/')?.pop() || '';
      // Match by subscription ID first, then by name
      const existing = subscriptions.find(s => s.subscriptionId === subId) ||
                       subscriptions.find(s => s.name === (sd.displayName || sd.Name)) ||
                       subscriptions.find(s => subId && s.name.includes(subId.slice(0,8)));
      if (existing) {
        existing.name = sd.displayName || sd.Name || existing.name;
        existing.subscriptionId = subId;
      }
    });
  }

  // Apply to state
  if (isMerge) {
    // Merge subscriptions
    subscriptions.forEach(sub => {
      const existing = state.subscriptions.find(s => s.name === sub.name);
      if (!existing) state.subscriptions.push(sub);
    });
    // Merge resource groups
    resourceGroups.forEach(rg => {
      const existing = state.resourceGroups.find(r => r.name === rg.name);
      if (!existing) state.resourceGroups.push(rg);
    });
    // Merge hub subnets and resources
    if (hub && hub.subnets) {
      hub.subnets.forEach(importedSn => {
        const existingSn = state.hub.subnets.find(s => s.name === importedSn.name);
        if (existingSn) {
          (importedSn.resources || []).forEach(res => {
            const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
            if (!dup) existingSn.resources.push(res);
          });
        } else {
          state.hub.subnets.push(importedSn);
        }
      });
    }
    // Merge spokes
    spokes.forEach(spoke => {
      const existingSpoke = state.spokes.find(s => s.name === spoke.name);
      if (existingSpoke) {
        (spoke.subnets || []).forEach(importedSn => {
          const existingSn = existingSpoke.subnets.find(s => s.name === importedSn.name);
          if (existingSn) {
            (importedSn.resources || []).forEach(res => {
              const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
              if (!dup) existingSn.resources.push(res);
            });
          } else {
            existingSpoke.subnets.push(importedSn);
          }
        });
      } else {
        state.spokes.push(spoke);
      }
    });
    // Merge RG-level resources
    rgResourceList.forEach(res => {
      const dup = (state.rgResources || []).find(r => r.name === res.name && r.type === res.type);
      if (!dup) {
        if (!state.rgResources) state.rgResources = [];
        state.rgResources.push(res);
      }
    });
    // Merge management groups
    if (mgEnabled && managementGroups.length > 0) {
      if (!state.managementGroups) state.managementGroups = [];
      managementGroups.forEach(mg => {
        const existing = state.managementGroups.find(m => m.name === mg.name);
        if (!existing) state.managementGroups.push(mg);
      });
      state.mgEnabled = true;
    }
  } else {
    state.mgEnabled = mgEnabled;
    state.managementGroups = managementGroups;
    state.subscriptions = subscriptions;
    state.resourceGroups = resourceGroups;
    state.hub = hub;
    state.spokes = spokes;
    state.rgResources = rgResourceList;
  }
  state.onPrem = state.onPrem || { enabled: false, name: 'On-Premises', cidr: '192.168.0.0/16' };

  saveState();
  closeModal('azure-inventory-modal');
  
  // Clear render caches after major state changes
  try {
    import('../canvas/canvas-render.js').then(m => m.clearPeeringCache?.());
  } catch (e) {
    // Canvas render not yet loaded or import failed - safe to continue
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('Performance note: Canvas render module not loaded for cache clearing');
    }
  }
  
  fullUpdate();
}

function _buildMgHierarchy(mgData, subscriptions) {
  const mgs = [];
  // Handle array of MGs (from az account management-group list)
  const mgArray = Array.isArray(mgData) ? mgData : [mgData];

  function _findSub(childName, childDisplayName) {
    // Match by subscriptionId first, then exact name, then displayName
    return subscriptions.find(s => s.subscriptionId === childName) ||
           subscriptions.find(s => s.name === childDisplayName) ||
           subscriptions.find(s => s.name === childName);
  }

  mgArray.forEach(mg => {
    const mgId = _uid();
    const mgObj = {
      id: mgId,
      name: mg.displayName || mg.name || mg.Name || 'Management Group',
      parentId: null
    };
    mgs.push(mgObj);
    // Assign subscriptions under this MG
    const mgChildren = mg.children || [];
    mgChildren.forEach(child => {
      if (child.type === '/subscriptions' || child.type === 'Microsoft.Management/managementGroups/subscriptions') {
        const sub = _findSub(child.name, child.displayName);
        if (sub) sub.mgId = mgId;
      } else if (child.type === 'Microsoft.Management/managementGroups') {
        // Nested MG
        const childMgId = _uid();
        mgs.push({ id: childMgId, name: child.displayName || child.name, parentId: mgId });
        (child.children || []).forEach(grandChild => {
          if (grandChild.type === '/subscriptions' || grandChild.type === 'Microsoft.Management/managementGroups/subscriptions') {
            const sub = _findSub(grandChild.name, grandChild.displayName);
            if (sub) sub.mgId = childMgId;
          }
        });
      }
    });
  });
  // If no subs were assigned to MGs, assign all subs to first MG
  if (mgs.length > 0 && subscriptions.every(s => !s.mgId)) {
    subscriptions.forEach(s => { s.mgId = mgs[0].id; });
  }
  return mgs;
}

/**
 * Helper: Get a copy of the default config for a resource type.
 * Ensures all imported resources have the full default configuration structure.
 */
function _getDefaultConfig(type) {
  if (RES_TYPES[type] && RES_TYPES[type].config) {
    return JSON.parse(JSON.stringify(RES_TYPES[type].config));
  }
  return {};
}

/**
 * Build config for imported resource by merging Azure properties with defaults.
 * This ensures imported resources have identical configuration structure to manually created ones.
 * Uses the centralized extractConfigFromAzure for consistent mapping.
 */
function _buildConfig(resource, type) {
  // Start with FULL default configuration
  const config = _getDefaultConfig(type);
  const props = resource.properties || resource.Properties || {};
  const sku = resource.sku || resource.Sku || {};

  // Use centralized extraction for common mappings
  const extracted = extractConfigFromAzure(resource, type);
  Object.assign(config, extracted);

  // Type-specific extraction for complex cases not handled by generic mappings
  switch(type) {
    case 'vm':
      // Additional VM-specific extraction
      if (props.hardwareProfile?.vmSize && !config.size) config.size = props.hardwareProfile.vmSize;
      if (props.storageProfile?.osDisk) {
        if (props.storageProfile.osDisk.diskSizeGB && !config.osDiskSizeGB) config.osDiskSizeGB = String(props.storageProfile.osDisk.diskSizeGB);
        if (props.storageProfile.osDisk.managedDisk?.storageAccountType && !config.osDiskType) config.osDiskType = props.storageProfile.osDisk.managedDisk.storageAccountType;
        // Extract data disks count
        if (props.storageProfile?.dataDisks) config.dataDisks = String(props.storageProfile.dataDisks.length || 0);
      }
      if (props.osProfile && !config.os) {
        config.os = props.osProfile.windowsConfiguration ? 'Windows Server 2022' : 'Ubuntu 22.04';
      }
      // Extract zone if available
      if (resource.zones && resource.zones[0]) config.availabilityZone = resource.zones[0];
      // Extract managed identity
      if (resource.identity?.type) config.managedIdentity = resource.identity.type;
      break;

    case 'vmss':
      // VMSS-specific extraction
      if (sku.name && !config.size) config.size = sku.name;
      if (sku.capacity && !config.instances) config.instances = String(sku.capacity);
      if (props.upgradePolicy?.mode && !config.upgradePolicy) config.upgradePolicy = props.upgradePolicy.mode;
      if (resource.zones) config.zones = Array.isArray(resource.zones) ? resource.zones.join(',') : resource.zones;
      if (props.virtualMachineProfile?.osProfile) {
        config.os = props.virtualMachineProfile.osProfile.windowsConfiguration ? 'Windows Server 2022' : 'Ubuntu 22.04';
      }
      break;

    case 'aks':
      // AKS-specific extraction
      if (props.kubernetesVersion && !config.version) config.version = props.kubernetesVersion;
      if (props.agentPoolProfiles && props.agentPoolProfiles[0]) {
        if (props.agentPoolProfiles[0].count && !config.nodes) config.nodes = String(props.agentPoolProfiles[0].count);
        if (props.agentPoolProfiles[0].vmSize && !config.nodeSize) config.nodeSize = props.agentPoolProfiles[0].vmSize;
      }
      if (props.networkProfile) {
        if (props.networkProfile.networkPlugin && !config.networkPlugin) config.networkPlugin = props.networkProfile.networkPlugin;
        if (props.networkProfile.podCidr) config.podCidr = props.networkProfile.podCidr;
        if (props.networkProfile.serviceCidr) config.serviceCidr = props.networkProfile.serviceCidr;
        if (props.networkProfile.dnsServiceIP) config.dnsServiceIp = props.networkProfile.dnsServiceIP;
      }
      if (props.apiServerAccessProfile?.enablePrivateCluster !== undefined) {
        config.privateCluster = String(props.apiServerAccessProfile.enablePrivateCluster);
      }
      if (sku?.tier) config.tier = sku.tier;
      break;

    case 'fa':
      // Function App specific
      if (props.siteConfig) {
        const runtime = props.siteConfig.linuxFxVersion || props.siteConfig.windowsFxVersion || '';
        if (runtime && !config.runtime) {
          // Parse runtime like "NODE|20" or "DOTNET|8.0"
          const parts = runtime.split('|');
          config.runtime = parts[0]?.toLowerCase() || 'node';
          if (parts[1]) config.runtimeVersion = parts[1];
        }
        if (props.siteConfig.alwaysOn !== undefined) config.alwaysOn = String(props.siteConfig.alwaysOn);
      }
      config.osType = props.siteConfig?.linuxFxVersion ? 'Linux' : 'Windows';
      break;

    case 'aca':
      // Container Apps specific
      if (props.template?.containers?.[0]) {
        const container = props.template.containers[0];
        if (container.image) config.image = container.image;
        if (container.resources?.cpu) config.cpu = String(container.resources.cpu);
        if (container.resources?.memory) config.memory = container.resources.memory;
      }
      if (props.template?.scale) {
        if (props.template.scale.minReplicas !== undefined) config.minReplicas = String(props.template.scale.minReplicas);
        if (props.template.scale.maxReplicas !== undefined) config.replicas = String(props.template.scale.maxReplicas);
      }
      if (props.configuration?.ingress) {
        if (props.configuration.ingress.targetPort) config.targetPort = String(props.configuration.ingress.targetPort);
        config.ingress = props.configuration.ingress.external ? 'external' : 'internal';
      }
      if (props.managedEnvironmentId) {
        config.environmentName = props.managedEnvironmentId.split('/').pop() || '';
      }
      break;

    case 'fw':
      // Azure Firewall specific
      if (sku.tier && !config.sku) config.sku = sku.tier;
      if (props.threatIntelMode) config.threatIntelMode = props.threatIntelMode;
      if (props.additionalProperties?.['Network.DNS.EnableProxy'] !== undefined) {
        config.dnsProxy = String(props.additionalProperties['Network.DNS.EnableProxy']);
      }
      if (resource.zones) config.availabilityZones = Array.isArray(resource.zones) ? resource.zones.join(',') : resource.zones;
      break;

    case 'agw':
      // Application Gateway specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (sku.tier && !config.tier) config.tier = sku.tier;
      if (sku.capacity && !config.capacity) config.capacity = String(sku.capacity);
      if (props.sslPolicy?.policyName) config.sslPolicy = props.sslPolicy.policyName;
      break;

    case 'lb':
      // Load Balancer specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (props.frontendIPConfigurations?.[0]) {
        const feIp = props.frontendIPConfigurations[0];
        if (feIp.properties?.publicIPAddress) {
          config.type = 'Public';
        } else {
          config.type = 'Internal';
        }
        if (feIp.properties?.privateIPAllocationMethod) {
          config.frontendIp = feIp.properties.privateIPAllocationMethod;
        }
      }
      break;

    case 'gw':
      // VPN Gateway specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (props.vpnType) config.vpnType = props.vpnType;
      if (props.vpnGatewayGeneration) config.generation = props.vpnGatewayGeneration;
      if (props.activeActive !== undefined) config.activeActive = String(props.activeActive);
      if (props.bgpSettings?.asn) config.bgpAsn = String(props.bgpSettings.asn);
      break;

    case 'ergw':
      // ExpressRoute Gateway specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (props.gatewayType) config.gatewayType = props.gatewayType;
      break;

    case 'bas':
      // Bastion specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (props.scaleUnits !== undefined) config.scaleUnits = String(props.scaleUnits);
      if (props.enableShareableLink !== undefined) config.shareableLink = String(props.enableShareableLink);
      if (props.enableIpConnect !== undefined) config.ipConnect = String(props.enableIpConnect);
      if (props.enableTunneling !== undefined) config.tunneling = String(props.enableTunneling);
      break;

    case 'afd':
      // Front Door specific
      if (sku.name) {
        config.sku = sku.name.replace('_AzureFrontDoor', '');
      }
      break;

    case 'pe':
      // Private Endpoint specific
      if (props.privateLinkServiceConnections?.[0]) {
        const conn = props.privateLinkServiceConnections[0];
        if (conn.properties?.groupIds?.[0]) config.groupId = conn.properties.groupIds[0];
        if (conn.properties?.privateLinkServiceId) {
          config.targetResourceId = conn.properties.privateLinkServiceId;
          config.targetResourceName = conn.properties.privateLinkServiceId.split('/').pop() || '';
        }
        if (conn.name) config.connectionName = conn.name;
      }
      break;

    case 'nsg':
      // NSG specific - extract security rules
      if (props.securityRules && Array.isArray(props.securityRules)) {
        config.rules = JSON.stringify(props.securityRules.map(r => ({
          name: r.name,
          priority: String(r.properties?.priority || 100),
          direction: r.properties?.direction || 'Inbound',
          access: r.properties?.access || 'Allow',
          protocol: r.properties?.protocol || 'Tcp',
          srcPort: r.properties?.sourcePortRange || '*',
          dstPort: r.properties?.destinationPortRange || '*',
          srcAddr: r.properties?.sourceAddressPrefix || '*',
          dstAddr: r.properties?.destinationAddressPrefix || '*'
        })));
      }
      break;

    case 'sql':
      // SQL specific
      if (sku.tier && !config.tier) config.tier = sku.tier;
      if (sku.capacity && !config.vcores) config.vcores = String(sku.capacity);
      if (props.maxSizeBytes) config.maxSizeGB = String(Math.round(props.maxSizeBytes / 1073741824));
      if (props.collation) config.collation = props.collation;
      if (props.zoneRedundant !== undefined) config.zoneRedundant = String(props.zoneRedundant);
      break;

    case 'cosmos':
      // Cosmos DB specific
      if (resource.kind) {
        config.api = resource.kind === 'MongoDB' ? 'MongoDB' : 'NoSQL';
      }
      if (props.consistencyPolicy?.defaultConsistencyLevel) {
        config.consistencyLevel = props.consistencyPolicy.defaultConsistencyLevel;
      }
      if (props.enableFreeTier !== undefined) config.enableFreeTier = String(props.enableFreeTier);
      if (props.capabilities?.some(c => c.name === 'EnableServerless')) config.serverless = 'true';
      break;

    case 'sa':
      // Storage Account specific
      if (sku.name) {
        const parts = sku.name.split('_');
        if (parts[0] && !config.tier) config.tier = parts[0];
        if (parts[1] && !config.replication) config.replication = parts[1];
      }
      if (resource.kind && !config.kind) config.kind = resource.kind;
      if (props.accessTier) config.accessTier = props.accessTier;
      if (props.supportsHttpsTrafficOnly !== undefined) config.httpsOnly = String(props.supportsHttpsTrafficOnly);
      if (props.minimumTlsVersion) config.minTlsVersion = props.minimumTlsVersion;
      break;

    case 'redis':
      // Redis specific
      if (sku.name && sku.family) {
        config.sku = `${sku.name} ${sku.family}${sku.capacity || 1}`;
      }
      if (sku.capacity && !config.capacity) config.capacity = String(sku.capacity);
      if (props.enableNonSslPort !== undefined) config.enableNonSslPort = String(props.enableNonSslPort);
      if (props.minimumTlsVersion) config.minTlsVersion = props.minimumTlsVersion;
      if (resource.zones) config.zones = Array.isArray(resource.zones) ? resource.zones.join(',') : '';
      if (props.replicasPerPrimary !== undefined) config.replicasPerPrimary = String(props.replicasPerPrimary);
      break;

    case 'adls':
      // Data Lake specific
      if (sku.tier && !config.tier) config.tier = sku.tier;
      if (sku.name) {
        const parts = sku.name.split('_');
        if (parts[1]) config.replication = parts[1];
      }
      if (props.isHnsEnabled !== undefined) config.hierarchicalNamespace = String(props.isHnsEnabled);
      break;

    case 'kv':
      // Key Vault specific
      if (props.sku?.name && !config.sku) config.sku = props.sku.name;
      if (props.softDeleteRetentionInDays) config.softDeleteDays = String(props.softDeleteRetentionInDays);
      if (props.enablePurgeProtection !== undefined) config.purgeProtection = String(props.enablePurgeProtection);
      if (props.enableRbacAuthorization !== undefined) config.enableRbacAuth = String(props.enableRbacAuthorization);
      if (props.networkAcls?.defaultAction) config.networkAcls = props.networkAcls.defaultAction;
      break;

    case 'app':
      // App Service specific
      if (props.serverFarmId) {
        config.appServicePlanName = props.serverFarmId.split('/').pop() || '';
      }
      if (props.siteConfig) {
        const runtime = props.siteConfig.linuxFxVersion || props.siteConfig.windowsFxVersion || '';
        if (runtime && !config.runtime) {
          const parts = runtime.split('|');
          config.runtime = parts[0]?.toLowerCase() || 'dotnet';
          if (parts[1]) config.runtimeVersion = parts[1];
        }
        if (props.siteConfig.alwaysOn !== undefined) config.alwaysOn = String(props.siteConfig.alwaysOn);
        if (props.siteConfig.minTlsVersion) config.minTlsVersion = props.siteConfig.minTlsVersion;
      }
      if (props.httpsOnly !== undefined) config.httpsOnly = String(props.httpsOnly);
      if (resource.identity?.type) config.managedIdentity = resource.identity.type;
      break;

    case 'apim':
      // API Management specific
      if (sku.name && !config.tier) config.tier = sku.name;
      if (sku.capacity && !config.capacity) config.capacity = String(sku.capacity);
      if (props.publisherName) config.publisherName = props.publisherName;
      if (props.publisherEmail) config.publisherEmail = props.publisherEmail;
      if (props.virtualNetworkType) config.vnetType = props.virtualNetworkType;
      break;

    case 'sb':
      // Service Bus specific
      if (sku.name && !config.tier) config.tier = sku.name;
      if (sku.capacity) config.messagingUnits = String(sku.capacity);
      if (props.zoneRedundant !== undefined) config.zoneRedundant = String(props.zoneRedundant);
      break;

    case 'evh':
      // Event Hub specific
      if (sku.name && !config.plan) config.plan = sku.name;
      if (sku.capacity) config.throughputUnits = String(sku.capacity);
      break;

    case 'logic':
      // Logic App specific
      if (sku?.name) config.plan = sku.name;
      if (props.state) config.state = props.state;
      break;

    case 'foundry':
      // AI Foundry specific
      if (sku.name && !config.sku) config.sku = sku.name;
      if (resource.kind) config.kind = resource.kind;
      if (props.customSubDomainName) config.customSubdomain = props.customSubDomainName;
      if (props.networkAcls?.defaultAction) config.networkRules = props.networkAcls.defaultAction;
      break;

    case 'openai':
      // OpenAI specific
      if (props.deployments?.[0]) {
        const deployment = props.deployments[0];
        if (deployment.properties?.model?.name) config.model = deployment.properties.model.name;
        if (deployment.name) config.deploymentName = deployment.name;
        if (deployment.sku?.capacity) config.capacity = String(deployment.sku.capacity);
        if (deployment.properties?.model?.version) config.modelVersion = deployment.properties.model.version;
      }
      break;

    case 'monitor':
      // Monitor specific
      if (props.sku?.name) config.workspaceSku = props.sku.name;
      if (props.retentionInDays) config.retentionDays = String(props.retentionInDays);
      if (props.workspaceCapping?.dailyQuotaGb) config.dailyCapGB = String(props.workspaceCapping.dailyQuotaGb);
      break;

    case 'dns':
    case 'publicDns':
      // DNS zone specific
      const zoneName = resource.name || resource.Name || '';
      if (zoneName) {
        config.zone = zoneName;
        config.fullZoneName = zoneName;
      }
      if (props.registrationEnabled !== undefined) {
        config.autoRegistration = String(props.registrationEnabled === true).toLowerCase();
      }
      // Extract vnet links from Azure DNS zone properties
      if (props.virtualNetworkLinks && Array.isArray(props.virtualNetworkLinks)) {
        config.vnetLinks = props.virtualNetworkLinks.map(link => {
          const linkProps = link.properties || link.Properties || {};
          const vnetId = linkProps.virtualNetwork?.id || linkProps.VirtualNetwork?.id || '';
          const vnetName = vnetId.split('/').pop();
          return {
            vnetId: null,
            vnetName: vnetName || '',
            registrationEnabled: (linkProps.registrationEnabled || linkProps.RegistrationEnabled || false) === true,
            linkName: link.name || link.Name || ''
          };
        });
      }
      break;

    default:
      // Already have full default config from extractConfigFromAzure
      break;
  }

  return config;
}

/**
 * Creates a resource object with metadata tracking
 * @param {string} type - Resource type
 * @param {string} name - Resource name  
 * @param {Object} config - Resource configuration
 * @param {Object} azureResource - Original Azure resource (for tracking)
 * @returns {Object} - Resource object with _meta
 */
function _createResourceWithMeta(type, name, config, azureResource) {
  const resource = {
    id: _uid(),
    type,
    name,
    config,
    _meta: createResourceMeta('inventory-import', {
      originalId: azureResource?.id || azureResource?.Id || null,
      importedAt: new Date().toISOString()
    })
  };
  
  // Run validation and update meta
  const validation = validateResource(resource);
  resource._meta.validationStatus = validation.status;
  resource._meta.warnings = validation.warnings;
  
  return resource;
}

function _findSubnetRef(props) {
  // Look for subnet references in resource properties (common patterns)
  if (props.subnet && props.subnet.id) return props.subnet.id;
  if (props.ipConfigurations) {
    for (const ip of props.ipConfigurations) {
      if (ip.properties?.subnet?.id) return ip.properties.subnet.id;
      if (ip.subnet?.id) return ip.subnet.id;
    }
  }
  if (props.networkProfile?.networkInterfaces) {
    // Can't resolve NIC to subnet without more data, skip
  }
  if (props.virtualNetworkSubnetId) return props.virtualNetworkSubnetId;
  if (props.subnetId) return props.subnetId;
  return null;
}
