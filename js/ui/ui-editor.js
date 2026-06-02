import { state, esc, RES_TYPES, AZURE_ICON_BASE, saveState, fullUpdate, updateCost, getRecommendedDnsZones } from '../state-management.js';

// ================================================================
// HELPER: Render config fields with optional filter
// ================================================================
function renderConfigFields(objId, config, filterFn = null) {
  let html = '';
  Object.keys(config).forEach(k => {
    if (filterFn && !filterFn(k)) return; // Skip filtered keys
    const label = k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
    if(config[k]==='true'||config[k]==='false'){
      html+=`<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${objId}','${k}',this.value)"><option value="true"${config[k]==='true'?' selected':''}>Yes</option><option value="false"${config[k]==='false'?' selected':''}>No</option></select></div>`;
    } else {
      html+=`<div class="editor-row"><span class="editor-label">${label}</span><input class="input-field" value="${esc(config[k])}" onchange="window._updateResConfig('${objId}','${k}',this.value)"></div>`;
    }
  });
  return html;
}

// ================================================================
// RIGHT EDITOR
// ================================================================
export function renderEditor(){
  const el=document.getElementById('editor-container');
  if(!state.selectedId){
    el.innerHTML=`<div style="text-align:center;color:var(--muted);font-size:11px;margin-top:20px;line-height:1.9;">← Click a resource, subnet or VNet<br>to edit its properties</div>`;
    return;
  }
  
  if (state.selectedId === 'onprem') {
    el.innerHTML = `
      <div class="editor-panel" style="border-color:#107C10">
        <div class="editor-header" style="color:#107C10">🏢 ${esc(state.onPrem.name)}</div>
        <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(state.onPrem.name)}" onchange="window._updateOnPremName(this.value)"></div>
        <div class="editor-row"><span class="editor-label">Local CIDR</span><input class="input-field" value="${esc(state.onPrem.cidr)}" onchange="window._updateOnPremCidr(this.value)"></div>
      </div>`;
    return;
  }

  // Management Group editor
  const selectedMg = (state.managementGroups||[]).find(mg => mg.id === state.selectedId);
  if (selectedMg) {
    const mgSubs = state.subscriptions.filter(s => s.mgId === selectedMg.id);
    const availableSubs = state.subscriptions.filter(s => !s.mgId || s.mgId === selectedMg.id);
    let mgHtml = `<div class="editor-panel" style="border-color:#0078D4">
      <div class="editor-header" style="color:#0078D4">🏛️ ${esc(selectedMg.name)}</div>
      <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(selectedMg.name)}" onchange="window._renameMg('${selectedMg.id}',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Parent MG</span>
        <select class="input-field" onchange="window._assignMgParent('${selectedMg.id}',this.value)">
          <option value=""${!selectedMg.parentId?' selected':''}>— Root —</option>
          ${state.managementGroups.filter(mg=>mg.id!==selectedMg.id).map(mg=>`<option value="${mg.id}"${selectedMg.parentId===mg.id?' selected':''}>${esc(mg.name)}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;border-top:1px solid var(--border);padding-top:6px;">Subscriptions in this MG:</div>`;
    mgSubs.forEach(s => {
      mgHtml += `<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--text);padding:3px 0;">
        <span>☁️ ${esc(s.name)}</span>
        <button class="icon-btn danger" style="font-size:9px;padding:1px 4px;" title="Remove from MG" onclick="window._assignSubToMg('${s.id}','')">✕</button>
      </div>`;
    });
    if (mgSubs.length === 0) mgHtml += `<div style="font-size:10px;color:var(--muted);font-style:italic;">No subscriptions assigned</div>`;
    // Show unassigned subs that can be added to this MG
    const unassignedSubs = state.subscriptions.filter(s => !s.mgId);
    if (unassignedSubs.length > 0) {
      mgHtml += `<div style="font-size:10px;color:var(--muted);margin-top:6px;border-top:1px dashed var(--border);padding-top:6px;">Assign existing subscription:</div>`;
      mgHtml += `<select class="input-field" style="font-size:10px;margin-top:4px;" onchange="if(this.value){window._assignSubToMg(this.value,'${selectedMg.id}');}">
        <option value="">— Select subscription —</option>
        ${unassignedSubs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
      </select>`;
    }
    mgHtml += `</div>`;
    el.innerHTML = mgHtml;
    return;
  }

  // Peering editor
  if (state.selectedId && state.selectedId.startsWith('peering:')) {
    const parts = state.selectedId.split(':');
    const id1 = parts[1], id2 = parts[2];
    const allVnetsP = [state.hub, ...state.spokes];
    const v1 = allVnetsP.find(v => v.id === id1);
    const v2 = allVnetsP.find(v => v.id === id2);
    if (!v1 || !v2) { state.selectedId = null; return renderEditor(); }
    const cfg1 = (v1.peeringConfigs || {})[id2] || { allowForwardedTraffic: false, allowGatewayTransit: false, useRemoteGateways: false, allowVirtualNetworkAccess: true };
    const cfg2 = (v2.peeringConfigs || {})[id1] || { allowForwardedTraffic: false, allowGatewayTransit: false, useRemoteGateways: false, allowVirtualNetworkAccess: true };
    const boolSelect = (vnetId, peerId, key, val) => `<select class="input-field" onchange="window._updatePeeringConfig('${vnetId}','${peerId}','${key}',this.value==='true')"><option value="true"${val?' selected':''}>Enabled</option><option value="false"${!val?' selected':''}>Disabled</option></select>`;
    let h = `<div class="editor-panel" style="border-color:var(--azure-blue)">
      <div class="editor-header">🔗 VNet Peering</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:10px;">${esc(v1.name)} ↔ ${esc(v2.name)}</div>
      <div style="font-size:11px;font-weight:bold;color:var(--azure-blue);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">📤 ${esc(v1.name)} → ${esc(v2.name)}</div>
      <div class="editor-row"><span class="editor-label">Allow Virtual Network Access</span>${boolSelect(id1,id2,'allowVirtualNetworkAccess',cfg1.allowVirtualNetworkAccess)}</div>
      <div class="editor-row"><span class="editor-label">Allow Forwarded Traffic</span>${boolSelect(id1,id2,'allowForwardedTraffic',cfg1.allowForwardedTraffic)}</div>
      <div class="editor-row"><span class="editor-label">Allow Gateway Transit</span>${boolSelect(id1,id2,'allowGatewayTransit',cfg1.allowGatewayTransit)}</div>
      <div class="editor-row"><span class="editor-label">Use Remote Gateways</span>${boolSelect(id1,id2,'useRemoteGateways',cfg1.useRemoteGateways)}</div>
      <div style="font-size:11px;font-weight:bold;color:var(--azure-blue);margin:12px 0 6px;border-bottom:1px solid var(--border);padding-bottom:4px;">📥 ${esc(v2.name)} → ${esc(v1.name)}</div>
      <div class="editor-row"><span class="editor-label">Allow Virtual Network Access</span>${boolSelect(id2,id1,'allowVirtualNetworkAccess',cfg2.allowVirtualNetworkAccess)}</div>
      <div class="editor-row"><span class="editor-label">Allow Forwarded Traffic</span>${boolSelect(id2,id1,'allowForwardedTraffic',cfg2.allowForwardedTraffic)}</div>
      <div class="editor-row"><span class="editor-label">Allow Gateway Transit</span>${boolSelect(id2,id1,'allowGatewayTransit',cfg2.allowGatewayTransit)}</div>
      <div class="editor-row"><span class="editor-label">Use Remote Gateways</span>${boolSelect(id2,id1,'useRemoteGateways',cfg2.useRemoteGateways)}</div>
      <button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._togglePeering('${id1}','${id2}')">🗑 Remove Peering</button>
    </div>`;
    el.innerHTML = h;
    return;
  }

  // VNet Link editor
  if (state.selectedId && state.selectedId.startsWith('vnetlink:')) {
    const parts = state.selectedId.split(':');
    const resId = parts[1], vnetId = parts[2];
    const dnsRes = (state.rgResources||[]).find(r => r.id === resId);
    const allVnetsVL = [state.hub, ...state.spokes];
    const vnet = allVnetsVL.find(v => v.id === vnetId);
    if (!dnsRes || !vnet) { state.selectedId = null; return renderEditor(); }
    const link = (dnsRes.config.vnetLinks||[]).find(l => l.vnetId === vnetId);
    if (!link) { state.selectedId = null; return renderEditor(); }
    const linkName = link.linkName || `${vnet.name}-link`;
    const boolSelectVL = (key, val) => `<select class="input-field" onchange="window._updateVnetLinkConfig('${resId}','${vnetId}','${key}',this.value==='true')"><option value="true"${val?' selected':''}>Enabled</option><option value="false"${!val?' selected':''}>Disabled</option></select>`;
    let h = `<div class="editor-panel" style="border-color:#00B294">
      <div class="editor-header" style="color:#00B294">🔗 VNet Link</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:10px;">🌐 ${esc(dnsRes.name)} ↔ 🔗 ${esc(vnet.name)}</div>
      <div class="editor-row"><span class="editor-label">Link Name</span><input class="input-field" value="${esc(linkName)}" onchange="window._updateVnetLinkConfig('${resId}','${vnetId}','linkName',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Auto Registration</span>${boolSelectVL('registrationEnabled', link.registrationEnabled)}</div>
      <button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._toggleVnetLink('${resId}','${vnetId}')">🗑 Remove VNet Link</button>
    </div>`;
    el.innerHTML = h;
    return;
  }

  let obj=null, parent=null, typeObj='none';
  const allVnets = [state.hub, ...state.spokes];
  
  // Check subscription
  const selSub = state.subscriptions.find(s => s.id === state.selectedId);
  if (selSub) { obj = selSub; typeObj = 'subscription'; }
  
  // Check resource group
  if (!obj) {
    const selRg = state.resourceGroups.find(r => r.id === state.selectedId);
    if (selRg) { obj = selRg; typeObj = 'resourceGroup'; }
  }

  // Check RG-level resources
  if (!obj) {
    const rgRes = (state.rgResources||[]).find(r => r.id === state.selectedId);
    if (rgRes) {
      obj = rgRes; typeObj = 'rgResource';
    } else {
      for (let v of allVnets) {
        if (v.id === state.selectedId) { obj=v; typeObj='vnet'; break; }
        for (let sn of v.subnets) {
          if (sn.id === state.selectedId) { obj=sn; parent=v; typeObj='subnet'; break; }
          for (let r of sn.resources) {
            if (r.id === state.selectedId) { obj=r; parent=sn; typeObj='resource'; break; }
          }
          if (obj) break;
        }
        if (obj) break;
      }
    }
  }

  if(!obj){state.selectedId=null;return renderEditor();}

  let h=`<div class="editor-panel">`;

  if(typeObj === 'subscription'){
    if(!obj.tags) obj.tags={};
    h+=`<div class="editor-header">☁️ Subscription</div>
      <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._renameSub('${obj.id}',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Subscription ID</span><input class="input-field" value="${esc(obj.subscriptionId||'')}" onchange="window._updateSubProp('${obj.id}','subscriptionId',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Tenant ID</span><input class="input-field" value="${esc(obj.tenantId||'')}" onchange="window._updateSubProp('${obj.id}','tenantId',this.value)"></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🏷️ Tags</span></div>`;
    Object.keys(obj.tags).forEach(tk => {
      h+=`<div class="editor-row" style="gap:4px;"><input class="input-field" style="flex:1" value="${esc(tk)}" onchange="window._renameTag('sub','${obj.id}','${esc(tk)}',this.value)"><input class="input-field" style="flex:1" value="${esc(obj.tags[tk])}" onchange="window._updateTag('sub','${obj.id}','${esc(tk)}',this.value)"><button class="icon-btn danger" onclick="window._deleteTag('sub','${obj.id}','${esc(tk)}')">✕</button></div>`;
    });
    h+=`<button class="add-btn" onclick="window._addTag('sub','${obj.id}')" style="margin-top:4px;">➕ Add Tag</button>`;

  } else if(typeObj === 'resourceGroup'){
    if(!obj.tags) obj.tags={};
    h+=`<div class="editor-header">📁 Resource Group</div>
      <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._renameRg('${obj.id}',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Location</span><select class="input-field" onchange="window._setRgLocation('${obj.id}',this.value)">
        ${['eastus','westeurope','westus2','northeurope','southeastasia','australiaeast','uksouth'].map(l=>`<option value="${l}"${obj.location===l?' selected':''}>${l}</option>`).join('')}
      </select></div>
      <div class="editor-row"><span class="editor-label">Lock</span><select class="input-field" onchange="window._updateRgProp('${obj.id}','lock',this.value)">
        <option value="None"${(obj.lock||'None')==='None'?' selected':''}>None</option>
        <option value="CanNotDelete"${obj.lock==='CanNotDelete'?' selected':''}>CanNotDelete</option>
        <option value="ReadOnly"${obj.lock==='ReadOnly'?' selected':''}>ReadOnly</option>
      </select></div>
      <div class="editor-row"><span class="editor-label">Budget Limit ($/mo)</span><input class="input-field" value="${esc(obj.budgetLimit||'')}" onchange="window._updateRgProp('${obj.id}','budgetLimit',this.value)" placeholder="e.g. 5000"></div>
      <div class="editor-row"><span class="editor-label">Alert Threshold %</span><input class="input-field" value="${esc(obj.budgetAlertThreshold||'80')}" onchange="window._updateRgProp('${obj.id}','budgetAlertThreshold',this.value)"></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🏷️ Tags</span></div>`;
    Object.keys(obj.tags).forEach(tk => {
      h+=`<div class="editor-row" style="gap:4px;"><input class="input-field" style="flex:1" value="${esc(tk)}" onchange="window._renameTag('rg','${obj.id}','${esc(tk)}',this.value)"><input class="input-field" style="flex:1" value="${esc(obj.tags[tk])}" onchange="window._updateTag('rg','${obj.id}','${esc(tk)}',this.value)"><button class="icon-btn danger" onclick="window._deleteTag('rg','${obj.id}','${esc(tk)}')">✕</button></div>`;
    });
    h+=`<button class="add-btn" onclick="window._addTag('rg','${obj.id}')" style="margin-top:4px;">➕ Add Tag</button>`;

  } else if(typeObj === 'vnet'){
    const allRgOpts=state.resourceGroups.map(rg=>{
      const sub=state.subscriptions.find(s=>s.id===rg.subId);
      return `<option value="${rg.id}" ${obj.rgId===rg.id?'selected':''}>${sub?sub.name+' / ':''} ${rg.name}</option>`;
    }).join('');

    h+=`<div class="editor-header">🌐 ${esc(obj.name)}</div>
      <div class="editor-row"><span class="editor-label">VNet Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateVnet('${obj.id}','name',this.value)"></div>
      <div class="editor-row"><span class="editor-label">CIDR Block</span><input class="input-field" value="${esc(obj.cidr)}" onchange="window._updateVnet('${obj.id}','cidr',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Resource Group</span><select class="input-field" onchange="window._updateVnet('${obj.id}','rgId',this.value)">${allRgOpts}</select></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">⚙️ Advanced</span></div>
      <div class="editor-row"><span class="editor-label">DNS Servers</span><input class="input-field" value="${esc(obj.dnsServers||'')}" onchange="window._updateVnetProp('${obj.id}','dnsServers',this.value)" placeholder="comma-separated IPs"></div>
      <div class="editor-row"><span class="editor-label">DDoS Protection</span><select class="input-field" onchange="window._updateVnetProp('${obj.id}','ddosProtectionPlan',this.value)"><option value="false"${(obj.ddosProtectionPlan||'false')==='false'?' selected':''}>Disabled</option><option value="true"${obj.ddosProtectionPlan==='true'?' selected':''}>Standard</option></select></div>
      <div class="editor-row"><span class="editor-label">Encryption</span><select class="input-field" onchange="window._updateVnetProp('${obj.id}','encryption',this.value)"><option value="false"${(obj.encryption||'false')==='false'?' selected':''}>Disabled</option><option value="true"${obj.encryption==='true'?' selected':''}>Enabled</option></select></div>
      <div class="editor-row"><span class="editor-label">Flow Timeout (min)</span><input class="input-field" value="${esc(obj.flowTimeout||'4')}" onchange="window._updateVnetProp('${obj.id}','flowTimeout',this.value)"></div>`;
    
    let peerHtml = `<div class="editor-row" style="margin-top:10px;"><span class="editor-label">VNet Peerings</span><div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">`;
    allVnets.forEach(v => {
      if (v.id === obj.id) return;
      const actuallyPeered = (obj.peerings || []).includes(v.id) || (v.peerings || []).includes(obj.id);
      if (actuallyPeered) {
        peerHtml += `<div style="display:flex;gap:4px;"><button style="flex:1;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;border:1px solid var(--azure-blue);background:rgba(0,120,212,.1);color:var(--azure-blue);transition:0.2s;" onclick="window._selectPeering('${obj.id}', '${v.id}')">🔗 ${esc(v.name)}</button><button style="padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px solid var(--danger);background:transparent;color:var(--danger);" onclick="window._togglePeering('${obj.id}', '${v.id}')" title="Remove peering">✕</button></div>`;
      } else {
        peerHtml += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;border:1px solid var(--border);background:transparent;color:var(--text);transition:0.2s;" onclick="window._togglePeering('${obj.id}', '${v.id}')">🔌 ${esc(v.name)}</button>`;
      }
    });
    peerHtml += `</div></div>`;
    h += peerHtml;

    if(obj.id!=='hub'){
      h+=`<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteSpoke('${obj.id}')">🗑 Delete Spoke</button>`;
    }

  } else if (typeObj === 'subnet') {
    const serviceEndpointOptions = ['Microsoft.Storage','Microsoft.Sql','Microsoft.KeyVault','Microsoft.AzureActiveDirectory','Microsoft.EventHub','Microsoft.ServiceBus','Microsoft.Web','Microsoft.ContainerRegistry'];
    const delegationOptions = ['None','Microsoft.Web/serverFarms','Microsoft.ContainerInstance/containerGroups','Microsoft.Databricks/workspaces','Microsoft.DBforMySQL/flexibleServers','Microsoft.DBforPostgreSQL/flexibleServers'];
    h+=`<div class="editor-header">⬚ Subnet</div>
      <div class="editor-row"><span class="editor-label">Subnet Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateSubnet('${parent.id}','${obj.id}','name',this.value)"></div>
      <div class="editor-row"><span class="editor-label">CIDR Block</span><input class="input-field" value="${esc(obj.cidr)}" onchange="window._updateSubnet('${parent.id}','${obj.id}','cidr',this.value)"></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔒 Security & Routing</span></div>
      <div class="editor-row"><span class="editor-label">NSG</span><input class="input-field" value="${esc(obj.nsgId||'')}" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','nsgId',this.value)" placeholder="NSG resource name"></div>
      <div class="editor-row"><span class="editor-label">Route Table</span><input class="input-field" value="${esc(obj.routeTableId||'')}" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','routeTableId',this.value)" placeholder="Route table name"></div>
      <div class="editor-row"><span class="editor-label">NAT Gateway</span><input class="input-field" value="${esc(obj.natGatewayId||'')}" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','natGatewayId',this.value)" placeholder="NAT Gateway name"></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🌐 Service Endpoints</span></div>
      <div class="editor-row"><span class="editor-label">Endpoints</span><input class="input-field" value="${esc(obj.serviceEndpoints||'')}" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','serviceEndpoints',this.value)" placeholder="${serviceEndpointOptions.slice(0,3).join(', ')}"></div>
      <div class="editor-row"><span class="editor-label">Delegation</span><select class="input-field" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','delegation',this.value)">
        ${delegationOptions.map(d => `<option value="${d}"${(obj.delegation||'None')===d?' selected':''}>${d}</option>`).join('')}
      </select></div>
      <div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔐 Private Link</span></div>
      <div class="editor-row"><span class="editor-label">PE Network Policies</span><select class="input-field" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','privateEndpointNetworkPolicies',this.value)"><option value="Disabled"${(obj.privateEndpointNetworkPolicies||'Disabled')==='Disabled'?' selected':''}>Disabled</option><option value="Enabled"${obj.privateEndpointNetworkPolicies==='Enabled'?' selected':''}>Enabled</option></select></div>
      <div class="editor-row"><span class="editor-label">PLS Network Policies</span><select class="input-field" onchange="window._updateSubnetProp('${parent.id}','${obj.id}','privateLinkServiceNetworkPolicies',this.value)"><option value="Disabled"${(obj.privateLinkServiceNetworkPolicies||'Disabled')==='Disabled'?' selected':''}>Disabled</option><option value="Enabled"${obj.privateLinkServiceNetworkPolicies==='Enabled'?' selected':''}>Enabled</option></select></div>
      <button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteSubnet('${parent.id}','${obj.id}')">🗑 Delete Subnet</button>`;
  } else if (typeObj === 'resource') {
    const rt=RES_TYPES[obj.type]||{color:'#888',label:'Resource', icon:'❓'};
    h+=`<div class="editor-header">
          <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
          <span style="display:none">${rt.icon}</span> 
          ${rt.label}
        </div>
      <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateResource('${obj.id}','name',this.value)"></div>`;
     
    // Special PE section with target resource selection
    if(obj.type === 'pe'){
      const { getPeTargetableResources, getPeTargetResource, PE_TARGET_DNS_RECOMMENDATIONS, getAllPrivateEndpoints } = window._state;
      const targetableResources = getPeTargetableResources();
      const currentTarget = getPeTargetResource(obj.id);
       
      h+=`<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔗 Private Link Target</span></div>`;
      h+=`<div class="editor-row"><span class="editor-label">Target Resource</span>
        <select class="input-field" onchange="window._updateResConfig('${obj.id}','targetResourceId',this.value)">
          <option value="">-- Select target resource --</option>
          ${targetableResources.map(r => `<option value="${r.id}"${obj.config.targetResourceId === r.id ? ' selected' : ''}>${esc(r.name)} (${RES_TYPES[r.type]?.label || r.type})</option>`).join('')}
        </select>
      </div>`;
       
      if(currentTarget) {
        h+=`<div class="editor-row"><span class="editor-label">Target Info</span><span style="font-size:11px;color:var(--muted);">🎯 ${esc(currentTarget.name)} in ${RES_TYPES[currentTarget.type]?.label || 'Resource'}</span></div>`;
         
        // Show recommended DNS zones for this target
        const recommendedZones = PE_TARGET_DNS_RECOMMENDATIONS[obj.config.target] || [];
        if(recommendedZones.length > 0) {
          h+=`<div class="editor-row" style="flex-direction:column;align-items:stretch;margin-top:8px;padding:8px;background:rgba(0,176,148,0.05);border-radius:4px;">
            <span style="font-size:10px;font-weight:bold;color:var(--azure-green);margin-bottom:6px;">💡 Required DNS Zones:</span>
            ${recommendedZones.map(z => `<div style="font-size:9px;color:var(--text);margin-bottom:3px;padding:4px;background:rgba(0,120,212,0.1);border-radius:2px;">${esc(z)}</div>`).join('')}
          </div>`;
        }
      }
    }
     
    if(obj.type === 'vm'){
      // VM: Structured sections for full configuration
      const cfg = obj.config;
      const vmSections = [
        { title:'💻 Compute', keys:['size','os','availabilityZone'] },
        { title:'💾 OS Disk', keys:['osDiskType','osDiskSizeGB'] },
        { title:'📀 Data Disks', keys:['dataDisks','dataDiskSizeGB','dataDiskType'] },
        { title:'🌐 Networking', keys:['acceleratedNetworking','publicIp'] },
        { title:'🔐 Security', keys:['authType','securityType','vTpmEnabled','secureBootEnabled','managedIdentity'] },
        { title:'⚙️ Management', keys:['bootDiagnostics','backupEnabled','patchMode'] },
      ];
      vmSections.forEach(section => {
        const sectionKeys = section.keys.filter(k => k in cfg);
        if(sectionKeys.length === 0) return;
        h+=`<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">${section.title}</span></div>`;
        sectionKeys.forEach(k => {
          const label = k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())
            .replace(/\bV Tpm\b/,'vTPM').replace(/\bIp\b/,'IP').replace(/\bOs\b/,'OS').replace(/\bVm\b/,'VM').replace(/\bG B\b/,'GB');
          if(cfg[k]==='true'||cfg[k]==='false'){
            h+=`<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"><option value="true"${cfg[k]==='true'?' selected':''}>Yes</option><option value="false"${cfg[k]==='false'?' selected':''}>No</option></select></div>`;
          } else {
            h+=`<div class="editor-row"><span class="editor-label">${label}</span><input class="input-field" value="${esc(cfg[k])}" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"></div>`;
          }
        });
      });
      // Show any remaining keys not in sections
      const allSectionKeys = vmSections.flatMap(s=>s.keys);
      Object.keys(cfg).filter(k=>!allSectionKeys.includes(k)).forEach(k=>{
        h+=`<div class="editor-row"><span class="editor-label">${k}</span><input class="input-field" value="${esc(cfg[k])}" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"></div>`;
      });
    } else if(obj.type !== 'pe') {
      h += renderConfigFields(obj.id, obj.config);
    } else if(obj.type === 'pe') {
      // For PE, render remaining config fields (target, groupId, etc.) skipping PE-specific fields
      // Note: Special PE UI (target selection, DNS recommendations) already rendered above
      h += renderConfigFields(obj.id, obj.config, k => !['targetResourceId', 'targetResourceName'].includes(k));
    }
    h+=`<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteResource('${obj.id}')">🗑 Delete Resource</button>`;
  } else if (typeObj === 'rgResource') {
    const rt = RES_TYPES[obj.type]||{color:'#888',label:'Resource', icon:'❓', img:''};
    h+=`<div class="editor-header">
          <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
          <span style="display:none">${rt.icon}</span> 
          ${rt.label}
        </div>
      <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateRgResource('${obj.id}','name',this.value)"></div>`;
    
    // Zone selection - searchable dropdown for Private DNS zones
    if(obj.type === 'dns') {
      const recommended = getRecommendedDnsZones();
      const existingZones = (state.rgResources||[]).filter(r=>r.type==='dns' && r.config.zone).map(r=>r.config.zone);
      const unresolvedRecs = recommended.filter(z => !existingZones.includes(z));
      h+=`<div class="editor-row" style="flex-direction:column;align-items:stretch;">
        <span class="editor-label" style="margin-bottom:4px;">Zone</span>
        <div class="dns-zone-picker" style="position:relative;">
          <input class="input-field dns-zone-search" id="dns-zone-search-${obj.id}" value="${esc(obj.config.zone||'')}" 
            placeholder="Search or type zone..." 
            onfocus="window._showDnsZoneDropdown('${obj.id}')"
            oninput="window._filterDnsZones('${obj.id}', this.value)"
            onchange="window._updateResConfig('${obj.id}','zone',this.value)">
          <div class="dns-zone-dropdown" id="dns-zone-dd-${obj.id}" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:4px;z-index:1000;margin-top:2px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          </div>
        </div>
      </div>`;
      // Show recommendations
      if(unresolvedRecs.length > 0) {
        h+=`<div class="editor-row" style="flex-direction:column;align-items:stretch;margin-top:6px;">
          <span class="editor-label" style="font-size:9px;color:var(--azure-blue);margin-bottom:4px;">💡 Recommended (based on Private Endpoints)</span>`;
        unresolvedRecs.slice(0,3).forEach(zone => {
          h+=`<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
            <button style="flex:1;text-align:left;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:9px;border:1px solid var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" 
              title="${esc(zone)}"
              onclick="window._selectDnsZone('${obj.id}','${zone}')">${zone}</button>
          </div>`;
        });
        h+=`</div>`;
      }
    } else {
      h+=`<div class="editor-row"><span class="editor-label">Zone</span><input class="input-field" value="${esc(obj.config.zone||'')}" onchange="window._updateResConfig('${obj.id}','zone',this.value)"></div>`;
    }
    
    // DNS Records
    if(obj.type === 'publicDns' && !obj.config.records) obj.config.records = [];
    if(obj.config.records) {
      h+=`<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">DNS Records</span></div>`;
      obj.config.records.forEach((rec, idx) => {
        h+=`<div class="editor-row dns-record-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
          <input class="input-field" style="flex:1;min-width:60px;" placeholder="Name" value="${esc(rec.name)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'name',this.value)">
          <select class="input-field" style="width:60px;" onchange="window._updateDnsRecord('${obj.id}',${idx},'type',this.value)">
            ${['A','AAAA','CNAME','MX','TXT','NS','SOA','SRV','PTR'].map(t=>`<option${rec.type===t?' selected':''}>${t}</option>`).join('')}
          </select>
          <input class="input-field" style="flex:2;min-width:80px;" placeholder="Value" value="${esc(rec.value)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'value',this.value)">
          <input class="input-field" style="width:50px;" placeholder="TTL" value="${esc(rec.ttl)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'ttl',this.value)">
          <button class="icon-btn danger" onclick="window._deleteDnsRecord('${obj.id}',${idx})">🗑</button>
        </div>`;
      });
      h+=`<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addDnsRecord('${obj.id}')">➕ Add Record</button>`;
    }
    
    // VNet Links (for Private DNS) - shown like peerings
    if(obj.type === 'dns' && obj.config.vnetLinks !== undefined) {
      const allVnetsForLink = [state.hub, ...state.spokes];
      const linkedIds = (obj.config.vnetLinks||[]).map(l => l.vnetId);
      const { getRecommendedVnetLinksForDnsZone } = window._state;
      const recommendedLinks = getRecommendedVnetLinksForDnsZone(obj.id);
      
      h+=`<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">VNet Links</span></div>`;
      if(recommendedLinks.length > 0) {
        h+=`<div style="padding:8px;background:rgba(0,120,212,0.05);border-radius:4px;margin-bottom:8px;border-left:3px solid var(--azure-blue);">
          <span style="font-size:9px;font-weight:bold;color:var(--azure-blue);display:block;margin-bottom:4px;">💡 Recommended based on Private Endpoints:</span>
          ${recommendedLinks.map(r => `<div style="font-size:9px;color:var(--text);margin-bottom:2px;">✓ ${esc(r.vnetName)} (${r.peCount} PE${r.peCount !== 1 ? 's' : ''})</div>`).join('')}
        </div>`;
      }
      
      h+=`<div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">`;
      allVnetsForLink.forEach(v => {
        const isLinked = linkedIds.includes(v.id);
        const isRecommended = recommendedLinks.some(r => r.vnetId === v.id);
        const linkStyle = isLinked 
          ? "border:1px solid #00B294;background:rgba(0,178,148,.1);color:#00B294;"
          : isRecommended 
          ? "border:1px solid #FF8C00;background:rgba(255,140,0,.1);color:#FF8C00;"
          : "border:1px solid var(--border);background:transparent;color:var(--text);";
        
        if (isLinked) {
          h+=`<div style="display:flex;gap:4px;"><button style="flex:1;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;${linkStyle}transition:0.2s;" onclick="window._selectVnetLink('${obj.id}','${v.id}')">🔗 ${esc(v.name)}</button><button style="padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px solid var(--danger);background:transparent;color:var(--danger);" onclick="window._toggleVnetLink('${obj.id}','${v.id}')" title="Remove link">✕</button></div>`;
        } else {
          h+=`<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;${linkStyle}transition:0.2s;" onclick="window._toggleVnetLink('${obj.id}','${v.id}')">${isRecommended ? '⚡' : '🔌'} ${esc(v.name)}</button>`;
        }
      });
      h+=`</div>`;
    }
    
    // Add Another DNS Zone button (for Private DNS zones)
    if(obj.type === 'dns') {
      h+=`<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--azure-blue)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--azure-blue)'" onclick="window._addAnotherDnsZone('${obj.rgId}')">🌐 Add Another DNS Zone</button>`;
    }
    
    h+=`<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteRgResource('${obj.id}')">🗑 Delete Resource</button>`;
  }
  h+=`</div>`;
  el.innerHTML=h;
}
