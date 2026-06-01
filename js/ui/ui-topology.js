import { state, uid, fullUpdate, saveState, updateCost, RES_TYPES, VNET_COLORS, isValidCidr, checkCidrOverlap, nextAvailableVnetCidr, nextAvailableSubnetCidr, nextAvailableSubnetCidrFromParsed, parseCidr, AZURE_PRIVATE_DNS_ZONES, getRecommendedDnsZones, getVnetsInRg } from '../state-management.js';
import { selectNode } from '../canvas-engine.js';
import { renderEditor } from './ui-editor.js';

// ================================================================
// STATE MUTATIONS
// ================================================================
export function addSub(){ const n=state.subscriptions.length; const id='sub-'+uid(); state.subscriptions.push({id,name:`Subscription ${n+1}`,subscriptionId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tenantId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tags:{},mgId:null}); state.resourceGroups.push({id:'rg-'+uid(),name:'rg-new',location:'eastus',subId:id,tags:{},lock:'None',budgetLimit:'',budgetAlertThreshold:'80'}); fullUpdate(); }
export function deleteSub(id){ if(state.subscriptions.length<=1){alert('Need at least one subscription.');return;} if(!confirm('Delete subscription? VNets will be moved.')) return; const fallbackRg=state.resourceGroups.find(r=>r.subId!==id); if(!fallbackRg){alert('Cannot delete.');return;} const subRgIds=state.resourceGroups.filter(r=>r.subId===id).map(r=>r.id); if(state.hub.rgId&&subRgIds.includes(state.hub.rgId)) state.hub.rgId=fallbackRg.id; state.spokes.forEach(s=>{if(subRgIds.includes(s.rgId))s.rgId=fallbackRg.id;}); state.resourceGroups=state.resourceGroups.filter(r=>r.subId!==id); state.subscriptions=state.subscriptions.filter(s=>s.id!==id); fullUpdate(); }
export function renameSub(id,val){const s=state.subscriptions.find(s=>s.id===id);if(s){s.name=val;saveState();window._draw();}}

export function addRg(subId){ const n=state.resourceGroups.filter(r=>r.subId===subId).length; state.resourceGroups.push({id:'rg-'+uid(),name:`rg-new-${n+1}`,location:'eastus',subId,tags:{},lock:'None',budgetLimit:'',budgetAlertThreshold:'80'}); fullUpdate(); }
export function deleteRg(id){ if(state.resourceGroups.length<=1){alert('Need at least one resource group.');return;} const fallback=state.resourceGroups.find(r=>r.id!==id); if(!fallback){alert('No fallback.');return;} if(!confirm('Delete resource group?')) return; if(state.hub.rgId===id) state.hub.rgId=fallback.id; state.spokes.forEach(s=>{if(s.rgId===id)s.rgId=fallback.id;}); state.rgResources=(state.rgResources||[]).filter(r=>r.rgId!==id); state.resourceGroups=state.resourceGroups.filter(r=>r.id!==id); fullUpdate(); }
export function renameRg(id,val){const rg=state.resourceGroups.find(r=>r.id===id);if(rg){rg.name=val;saveState();window._draw();}}
export function setRgLocation(id,val){const rg=state.resourceGroups.find(r=>r.id===id);if(rg){rg.location=val;saveState();}}

export function updateSubProp(subId,key,val){const s=state.subscriptions.find(s=>s.id===subId);if(s){s[key]=val;saveState();renderEditor();}}
export function updateRgProp(rgId,key,val){const rg=state.resourceGroups.find(r=>r.id===rgId);if(rg){rg[key]=val;saveState();renderEditor();}}
export function addTag(scope,id){
  if(scope==='sub'){const s=state.subscriptions.find(s=>s.id===id);if(s){if(!s.tags)s.tags={};s.tags['newKey']='value';saveState();renderEditor();}}
  else if(scope==='rg'){const rg=state.resourceGroups.find(r=>r.id===id);if(rg){if(!rg.tags)rg.tags={};rg.tags['newKey']='value';saveState();renderEditor();}}
}
export function updateTag(scope,id,key,val){
  if(scope==='sub'){const s=state.subscriptions.find(s=>s.id===id);if(s&&s.tags){s.tags[key]=val;saveState();renderEditor();}}
  else if(scope==='rg'){const rg=state.resourceGroups.find(r=>r.id===id);if(rg&&rg.tags){rg.tags[key]=val;saveState();renderEditor();}}
}
export function renameTag(scope,id,oldKey,newKey){
  if(oldKey===newKey)return;
  if(scope==='sub'){const s=state.subscriptions.find(s=>s.id===id);if(s&&s.tags){const val=s.tags[oldKey];delete s.tags[oldKey];s.tags[newKey]=val;saveState();renderEditor();}}
  else if(scope==='rg'){const rg=state.resourceGroups.find(r=>r.id===id);if(rg&&rg.tags){const val=rg.tags[oldKey];delete rg.tags[oldKey];rg.tags[newKey]=val;saveState();renderEditor();}}
}
export function deleteTag(scope,id,key){
  if(scope==='sub'){const s=state.subscriptions.find(s=>s.id===id);if(s&&s.tags){delete s.tags[key];saveState();renderEditor();}}
  else if(scope==='rg'){const rg=state.resourceGroups.find(r=>r.id===id);if(rg&&rg.tags){delete rg.tags[key];saveState();renderEditor();}}
}

export function addSpoke(rgId){
  const n=state.spokes.length;
  const cidr = nextAvailableVnetCidr();
  const spokeId = uid();
  const p = parseCidr(cidr);
  const subnetCidr = p ? nextAvailableSubnetCidrFromParsed(p, []) : `10.${n+1}.1.0/24`;
  state.spokes.push({ id:spokeId,name:`spoke-${n+1}-vnet`,cidr, color:VNET_COLORS[n%VNET_COLORS.length],peerings:['hub'], peeringConfigs:{}, rgId:rgId||state.resourceGroups[0]?.id,
    subnets: [{id:uid(), name:'default', cidr:subnetCidr, resources:[]}]
  });
  fullUpdate();
}

export function addVnetToRg(rgId){
  const n=state.spokes.length;
  const cidr = nextAvailableVnetCidr();
  const p = parseCidr(cidr);
  const subnetCidr = p ? nextAvailableSubnetCidrFromParsed(p, []) : `10.${n+1}.1.0/24`;
  state.spokes.push({ id:uid(),name:`vnet-${n+1}`,cidr, color:VNET_COLORS[n%VNET_COLORS.length],peerings:[], peeringConfigs:{}, rgId:rgId||state.resourceGroups[0]?.id,
    subnets: [{id:uid(), name:'default', cidr:subnetCidr, resources:[]}]
  });
  fullUpdate();
}
export function deleteSpoke(id){
  state.spokes=state.spokes.filter(s=>s.id!==id);
  [state.hub, ...state.spokes].forEach(v => { if (v.peerings) v.peerings = v.peerings.filter(pId => pId !== id); });
  state.selectedId=null; fullUpdate();
}
export function updateVnet(id,key,val){
  const v=[state.hub,...state.spokes].find(v=>v.id===id);
  if(!v) return;
  if(key==='cidr'){
    if(!isValidCidr(val)){ alert('Invalid CIDR format. Use format like 10.0.0.0/16'); return; }
    const overlap = checkCidrOverlap(val, id);
    if(overlap){ alert(`CIDR ${val} overlaps with VNet "${overlap.name}" (${overlap.cidr})`); return; }
  }
  v[key]=val; fullUpdate();
}
export function updateVnetProp(id,key,val){
  const v=[state.hub,...state.spokes].find(v=>v.id===id);
  if(!v) return;
  v[key]=val; saveState(); renderEditor();
}
export function updateSubnetProp(vnetId,snId,key,val){
  const v=[state.hub,...state.spokes].find(v=>v.id===vnetId);
  if(!v) return;
  const sn = v.subnets.find(s=>s.id===snId);
  if(!sn) return;
  sn[key]=val; saveState(); renderEditor();
}
export function togglePeering(id1, id2) {
  const v1 = [state.hub,...state.spokes].find(s => s.id === id1);
  const v2 = [state.hub,...state.spokes].find(s => s.id === id2);
  if (!v1 || !v2) return;
  v1.peerings = v1.peerings || []; v2.peerings = v2.peerings || [];
  const hasPeering = v1.peerings.includes(id2) || v2.peerings.includes(id1);
  if (hasPeering) { v1.peerings = v1.peerings.filter(p => p !== id2); v2.peerings = v2.peerings.filter(p => p !== id1); } 
  else { v1.peerings.push(id2); }
  fullUpdate();
}

export function updatePeeringConfig(vnetId, peerId, key, val) {
  const v = [state.hub,...state.spokes].find(s => s.id === vnetId);
  if (!v) return;
  if (!v.peeringConfigs) v.peeringConfigs = {};
  if (!v.peeringConfigs[peerId]) v.peeringConfigs[peerId] = { allowForwardedTraffic: false, allowGatewayTransit: false, useRemoteGateways: false, allowVirtualNetworkAccess: true };
  v.peeringConfigs[peerId][key] = val;
  fullUpdate();
}

export function selectPeering(id1, id2) {
  state.selectedId = `peering:${id1}:${id2}`;
  fullUpdate();
}

export function addSubnet(vnetId){
  const vnet=[state.hub,...state.spokes].find(v=>v.id===vnetId);
  if(vnet) { const cidr = nextAvailableSubnetCidr(vnetId); vnet.subnets.push({id:uid(), name:`subnet-${vnet.subnets.length+1}`, cidr, resources:[]}); fullUpdate(); }
}
export function deleteSubnet(vnetId, snId){
  const vnet=[state.hub,...state.spokes].find(v=>v.id===vnetId);
  if(vnet) { vnet.subnets = vnet.subnets.filter(s => s.id !== snId); state.selectedId=null; fullUpdate(); }
}
export function updateSubnet(vnetId, snId, key, val) {
  const vnet=[state.hub,...state.spokes].find(v=>v.id===vnetId);
  const sn = vnet?.subnets.find(s=>s.id===snId);
  if(!sn) return;
  if(key==='cidr'){
    if(!isValidCidr(val)){ alert('Invalid CIDR format. Use format like 10.0.1.0/24'); return; }
    const vnetParsed = parseCidr(vnet.cidr);
    const snParsed = parseCidr(val);
    if(vnetParsed && snParsed && (snParsed.network < vnetParsed.network || snParsed.broadcast > vnetParsed.broadcast)){
      alert(`Subnet CIDR ${val} is outside VNet address space ${vnet.cidr}`); return;
    }
  }
  sn[key]=val; fullUpdate();
}

export function toggleDropdown(id){ 
  document.querySelectorAll('.res-dropdown').forEach(d => {
    if(d.id !== `dropdown-${id}`) d.classList.remove('show');
  }); 
  const dd=document.getElementById(`dropdown-${id}`);
  if(dd){
    dd.classList.toggle('show');
    if(dd.classList.contains('show')){
      const searchInput = dd.querySelector('.res-search-input');
      if(searchInput) {
        searchInput.value = '';
        filterResources({target: searchInput}, id);
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  } 
}

export function filterResources(event, snId) {
  const searchTerm = event.target.value.toLowerCase();
  const dropdown = document.getElementById(`dropdown-${snId}`);
  if (!dropdown) return;

  const options = dropdown.querySelectorAll('.res-option');
  const sections = dropdown.querySelectorAll('.res-dd-section');

  options.forEach(opt => {
    const label = opt.textContent.toLowerCase();
    if (label.includes(searchTerm)) {
      opt.style.display = 'flex';
    } else {
      opt.style.display = 'none';
    }
  });

  sections.forEach(sec => {
    let hasVisibleOptions = false;
    let next = sec.nextElementSibling;
    while (next && next.classList.contains('res-option')) {
      if (next.style.display !== 'none') {
        hasVisibleOptions = true;
        break;
      }
      next = next.nextElementSibling;
    }
    sec.style.display = hasVisibleOptions ? 'block' : 'none';
  });
}

export function addResource(vnetId, snId, resType){
  const vnet=[state.hub,...state.spokes].find(v=>v.id===vnetId);
  const sn = vnet?.subnets.find(s=>s.id===snId);
  const rT=RES_TYPES[resType];
  if(!sn || !rT) return;
  // Redirect RG-level resources (DNS zones etc) to addRgResource so they get full capabilities
  if(rT.rgLevel) {
    const rgId = vnet.rgId || (state.resourceGroups.length > 0 ? state.resourceGroups[0].id : null);
    if(rgId) { addRgResource(rgId, resType); return; }
  }
  // Clear custom positions for existing resources in this subnet so they re-layout together
  if(state.customPos){
    sn.resources.forEach(r => { delete state.customPos[r.id]; });
  }
  const nr={id:uid(),type:resType,name:`${sn.name.split('-')[0]}-${resType}`,config:{...rT.config}};
  sn.resources.push(nr); document.querySelectorAll('.res-dropdown').forEach(d=>d.classList.remove('show')); selectNode(nr.id);
}
export function deleteResource(resId){
  [state.hub,...state.spokes].forEach(v => v.subnets.forEach(sn => {
    if(sn.resources.some(r => r.id === resId)){
      // Clear custom positions for sibling resources so they re-layout properly
      if(state.customPos) sn.resources.forEach(r => { delete state.customPos[r.id]; });
    }
    sn.resources = sn.resources.filter(r => r.id !== resId);
  }));
  if(state.rgResources) state.rgResources = state.rgResources.filter(r => r.id !== resId);
  if(state.customPos) delete state.customPos[resId];
  state.selectedId=null; fullUpdate();
}
export function updateResource(resId,key,val){
  [state.hub,...state.spokes].forEach(v => v.subnets.forEach(sn => { const r=sn.resources.find(r=>r.id===resId); if(r)r[key]=val; }));
  const rgR = (state.rgResources||[]).find(r => r.id === resId); if(rgR) rgR[key] = val;
  fullUpdate();
}
export function updateResConfig(resId,configKey,val){
  [state.hub,...state.spokes].forEach(v => v.subnets.forEach(sn => { const r=sn.resources.find(r=>r.id===resId); if(r)r.config[configKey]=val; }));
  // Also check RG-level resources
  const rgRes = (state.rgResources||[]).find(r => r.id === resId);
  if(rgRes) rgRes.config[configKey] = val;
  saveState(); updateCost(); renderEditor(); 
}

// ================================================================
// RG-LEVEL RESOURCE MUTATIONS
// ================================================================
export function addRgResource(rgId, resType) {
  if(!state.rgResources) state.rgResources = [];
  const rT = RES_TYPES[resType];
  if(!rT) return;
  const rg = state.resourceGroups.find(r => r.id === rgId);
  const baseName = rg ? rg.name.replace('rg-','') : 'res';
  const config = {...rT.config};
  // Add default records for DNS zones
  if(resType === 'dns') {
    config.records = [{name:'vm1', type:'A', value:'10.0.1.4', ttl:'3600'}];
    config.vnetLinks = [];
    // Auto-link VNets in same RG
    const rgVnets = getVnetsInRg(rgId);
    rgVnets.forEach(v => config.vnetLinks.push({vnetId: v.id, vnetName: v.name, registrationEnabled: false}));
  } else if(resType === 'publicDns') {
    config.records = [{name:'www', type:'A', value:'20.0.0.1', ttl:'3600'}, {name:'@', type:'MX', value:'mail.example.com', ttl:'3600'}];
  }
  const nr = {id:uid(), type:resType, name:`${baseName}-${rT.label.toLowerCase().replace(/\s+/g,'-')}`, config, rgId};
  state.rgResources.push(nr);
  document.querySelectorAll('.res-dropdown').forEach(d=>d.classList.remove('show'));
  selectNode(nr.id);
}

export function deleteRgResource(resId) {
  if(!state.rgResources) return;
  state.rgResources = state.rgResources.filter(r => r.id !== resId);
  state.selectedId = null; fullUpdate();
}

export function updateRgResource(resId, key, val) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(r) { r[key] = val; fullUpdate(); }
}

export function addDnsRecord(resId) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config) return;
  if(!r.config.records) r.config.records = [];
  r.config.records.push({name:'new-record', type:'A', value:'10.0.0.1', ttl:'3600'});
  saveState(); renderEditor();
}

export function deleteDnsRecord(resId, idx) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config || !r.config.records) return;
  r.config.records.splice(idx, 1);
  saveState(); renderEditor();
}

export function updateDnsRecord(resId, idx, key, val) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config || !r.config.records || !r.config.records[idx]) return;
  r.config.records[idx][key] = val;
  saveState();
}

export function addVnetLink(resId) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config) return;
  if(!r.config.vnetLinks) r.config.vnetLinks = [];
  // Find a VNet not already linked
  const allVnets = [state.hub, ...state.spokes];
  const linkedIds = r.config.vnetLinks.map(l => l.vnetId);
  const available = allVnets.find(v => !linkedIds.includes(v.id));
  if(available) {
    r.config.vnetLinks.push({vnetId: available.id, vnetName: available.name, registrationEnabled: false});
    saveState(); renderEditor();
  } else {
    alert('All VNets are already linked.');
  }
}

export function deleteVnetLink(resId, idx) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config || !r.config.vnetLinks) return;
  r.config.vnetLinks.splice(idx, 1);
  saveState(); renderEditor();
}

export function toggleVnetLink(resId, vnetId) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config) return;
  if(!r.config.vnetLinks) r.config.vnetLinks = [];
  const idx = r.config.vnetLinks.findIndex(l => l.vnetId === vnetId);
  if(idx >= 0) {
    r.config.vnetLinks.splice(idx, 1);
  } else {
    const vnet = [state.hub, ...state.spokes].find(v => v.id === vnetId);
    if(vnet) {
      const linkName = `${vnet.name}-link`;
      r.config.vnetLinks.push({vnetId: vnet.id, vnetName: vnet.name, linkName: linkName, registrationEnabled: false});
    }
  }
  fullUpdate();
}

export function selectVnetLink(resId, vnetId) {
  state.selectedId = `vnetlink:${resId}:${vnetId}`;
  fullUpdate();
}

export function updateVnetLinkConfig(resId, vnetId, key, val) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(!r || !r.config || !r.config.vnetLinks) return;
  const link = r.config.vnetLinks.find(l => l.vnetId === vnetId);
  if(link) { link[key] = val; }
  fullUpdate();
}

// ================================================================
// DNS ZONE PICKER FUNCTIONS
// ================================================================
let _dnsDropdownCloseHandler = null;

export function showDnsZoneDropdown(resId) {
  const dd = document.getElementById(`dns-zone-dd-${resId}`);
  if(!dd) return;
  dd.style.display = 'block';
  const input = document.getElementById(`dns-zone-search-${resId}`);
  const filterVal = input ? input.value : '';
  populateDnsZoneDropdown(resId, filterVal);
  // Close on outside click - remove previous handler first
  if(_dnsDropdownCloseHandler) {
    document.removeEventListener('click', _dnsDropdownCloseHandler);
  }
  _dnsDropdownCloseHandler = function(e) {
    if(!e.target.closest('.dns-zone-picker')) {
      dd.style.display = 'none';
      document.removeEventListener('click', _dnsDropdownCloseHandler);
      _dnsDropdownCloseHandler = null;
    }
  };
  setTimeout(() => {
    document.addEventListener('click', _dnsDropdownCloseHandler);
  }, 0);
}

export function filterDnsZones(resId, query) {
  const dd = document.getElementById(`dns-zone-dd-${resId}`);
  if(!dd) return;
  dd.style.display = 'block';
  populateDnsZoneDropdown(resId, query);
}

function populateDnsZoneDropdown(resId, query) {
  const dd = document.getElementById(`dns-zone-dd-${resId}`);
  if(!dd) return;
  const q = (query||'').toLowerCase();
  const recommended = getRecommendedDnsZones();
  const filteredRec = recommended.filter(z => z.toLowerCase().includes(q));
  const filteredAll = AZURE_PRIVATE_DNS_ZONES.filter(z => z.toLowerCase().includes(q) && !recommended.includes(z));
  
  let html = '';
  if(filteredRec.length > 0) {
    html += `<div style="padding:4px 8px;font-size:9px;color:var(--azure-blue);font-weight:bold;border-bottom:1px solid var(--border);">💡 Recommended</div>`;
    filteredRec.forEach(zone => {
      html += `<div class="dns-zone-option" style="padding:5px 8px;font-size:10px;cursor:pointer;font-family:JetBrains Mono;border-bottom:1px solid var(--border);transition:background 0.1s;" 
        onmouseover="this.style.background='var(--bg3)'" 
        onmouseout="this.style.background=''" 
        onclick="window._selectDnsZone('${resId}','${zone}')">${zone}</div>`;
    });
  }
  if(filteredAll.length > 0) {
    html += `<div style="padding:4px 8px;font-size:9px;color:var(--muted);font-weight:bold;border-bottom:1px solid var(--border);">All Zones</div>`;
    filteredAll.slice(0, 20).forEach(zone => {
      html += `<div class="dns-zone-option" style="padding:5px 8px;font-size:10px;cursor:pointer;font-family:JetBrains Mono;border-bottom:1px solid var(--border);transition:background 0.1s;" 
        onmouseover="this.style.background='var(--bg3)'" 
        onmouseout="this.style.background=''" 
        onclick="window._selectDnsZone('${resId}','${zone}')">${zone}</div>`;
    });
    if(filteredAll.length > 20) {
      html += `<div style="padding:4px 8px;font-size:9px;color:var(--muted);text-align:center;">...type to filter more</div>`;
    }
  }
  if(!html) {
    html = `<div style="padding:8px;font-size:10px;color:var(--muted);text-align:center;">No matching zones</div>`;
  }
  dd.innerHTML = html;
}

export function selectDnsZone(resId, zone) {
  const r = (state.rgResources||[]).find(r => r.id === resId);
  if(r && r.config) {
    r.config.zone = zone;
    saveState(); renderEditor();
  }
}

export function addAnotherDnsZone(rgId) {
  addRgResource(rgId, 'dns');
}
