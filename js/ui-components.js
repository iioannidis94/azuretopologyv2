import { state, esc, uid, fullUpdate, saveState, updateCost, getVnetsInRg, getRgResources, RES_TYPES, RES_CATEGORIES, AZURE_ICON_BASE, VNET_COLORS, SUB_COLORS, isValidCidr, checkCidrOverlap, nextAvailableVnetCidr, nextAvailableSubnetCidr, nextAvailableSubnetCidrFromParsed, parseCidr, AZURE_PRIVATE_DNS_ZONES, getRecommendedDnsZones } from './state-management.js';
import { selectNode } from './canvas-engine.js';

// ================================================================
// SECURITY POSTURE ANALYSIS
// ================================================================
function analyzeSecurityPosture() {
  const findings = [];
  const allVnets = [state.hub, ...state.spokes];

  function vnetResources(vnet) { return vnet.subnets.flatMap(sn => sn.resources); }
  function subnetHasType(sn, type) { return sn.resources.some(r => r.type === type); }
  function vnetHasType(vnet, type) { return vnet.subnets.some(sn => subnetHasType(sn, type)); }

  // 1. SQL without Private Endpoint
  allVnets.forEach(vnet => {
    vnet.subnets.forEach(sn => {
      sn.resources.filter(r => r.type === 'sql' || r.type === 'cosmos').forEach(r => {
        const vnetHasPe = vnetHasType(vnet, 'pe');
        if (!vnetHasPe) {
          findings.push({ severity: 'warning', icon: '⚠️', message: `${r.name} has no Private Endpoint in ${vnet.name}. Data may be exposed over public internet.`, resId: r.id });
        }
      });
    });
  });

  // 2. VM without NSG
  allVnets.forEach(vnet => {
    vnet.subnets.forEach(sn => {
      const vms = sn.resources.filter(r => r.type === 'vm' || r.type === 'vmss');
      const hasNsg = subnetHasType(sn, 'nsg');
      if (vms.length > 0 && !hasNsg) {
        findings.push({ severity: 'warning', icon: '⚠️', message: `Subnet "${sn.name}" has VMs without a Network Security Group. Traffic is unrestricted.`, resId: vms[0].id });
      }
    });
  });

  // 3. Public App without WAF/Front Door
  allVnets.forEach(vnet => {
    const hasApp = vnetHasType(vnet, 'app');
    const hasWaf = vnetHasType(vnet, 'agw') || vnetHasType(vnet, 'afd');
    if (hasApp && !hasWaf) {
      const firstApp = vnetResources(vnet).find(r => r.type === 'app');
      findings.push({ severity: 'suggestion', icon: '💡', message: `App Service in ${vnet.name} has no WAF (App Gateway) or Front Door. Consider adding one for DDoS and OWASP protection.`, resId: firstApp?.id });
    }
  });

  // 4. Key Vault without Private Endpoint
  allVnets.forEach(vnet => {
    const hasKv = vnetHasType(vnet, 'kv');
    const hasPe = vnetHasType(vnet, 'pe');
    if (hasKv && !hasPe) {
      const firstKv = vnetResources(vnet).find(r => r.type === 'kv');
      findings.push({ severity: 'recommendation', icon: '🔐', message: `Key Vault in ${vnet.name} has no Private Endpoint. Restrict access to private network for better security.`, resId: firstKv?.id });
    }
  });

  // 5. Hub without Firewall
  if (!vnetHasType(state.hub, 'fw') && !vnetHasType(state.hub, 'nva')) {
    findings.push({ severity: 'recommendation', icon: '🛡️', message: `Hub VNet "${state.hub.name}" has no Azure Firewall or NVA. All traffic between spokes is unfiltered.`, resId: state.hub.id });
  }

  // 6. Storage Account without Private Endpoint
  allVnets.forEach(vnet => {
    vnetResources(vnet).filter(r => r.type === 'sa' || r.type === 'adls').forEach(r => {
      const vnetHasPe = vnetHasType(vnet, 'pe');
      if (!vnetHasPe) {
        findings.push({ severity: 'suggestion', icon: '💡', message: `Storage Account "${r.name}" has no Private Endpoint in ${vnet.name}. Consider adding private connectivity.`, resId: r.id });
      }
    });
  });

  // 7. AKS without Key Vault
  const allResources = [state.hub, ...state.spokes].flatMap(v => v.subnets.flatMap(sn => sn.resources));
  const aksResource = allResources.find(r => r.type === 'aks');
  const hasKvAnywhere = allResources.some(r => r.type === 'kv');
  if (aksResource && !hasKvAnywhere) {
    findings.push({ severity: 'suggestion', icon: '💡', message: `AKS Cluster "${aksResource.name}" detected without Key Vault in the architecture. Consider adding Key Vault for secrets management.`, resId: aksResource.id });
  }

  // 8. DEPENDENCY / ERROR CHECKS
  // VNet without subnets
  allVnets.forEach(vnet => {
    if (vnet.subnets.length === 0) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has no subnets. A VNet requires at least one subnet to be functional.`, resId: vnet.id });
    }
  });

  // Peering to non-existent VNet (stale peering references)
  allVnets.forEach(vnet => {
    (vnet.peerings || []).forEach(peerId => {
      const target = allVnets.find(v => v.id === peerId);
      if (!target) {
        findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has a peering reference to a non-existent VNet. Remove the stale peering.`, resId: vnet.id });
      }
    });
  });

  // Gateway Transit enabled but no VPN/ER Gateway in VNet
  allVnets.forEach(vnet => {
    const hasGw = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
    if (vnet.peeringConfigs) {
      Object.entries(vnet.peeringConfigs).forEach(([peerId, cfg]) => {
        if (cfg.allowGatewayTransit && !hasGw) {
          const peer = allVnets.find(v => v.id === peerId);
          findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has Gateway Transit enabled toward "${peer?.name || 'unknown'}" but contains no VPN/ExpressRoute Gateway.`, resId: vnet.id });
        }
        if (cfg.useRemoteGateways) {
          const peer = allVnets.find(v => v.id === peerId);
          const peerHasGw = peer?.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
          if (peer && !peerHasGw) {
            findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" uses Remote Gateways from "${peer.name}" but that VNet has no VPN/ExpressRoute Gateway.`, resId: vnet.id });
          }
        }
      });
    }
  });

  // Subnet with resources but no parent VNet CIDR containing it
  allVnets.forEach(vnet => {
    const vnetParsed = parseCidr(vnet.cidr);
    if (!vnetParsed) return;
    vnet.subnets.forEach(sn => {
      const snParsed = parseCidr(sn.cidr);
      if (snParsed && (snParsed.network < vnetParsed.network || snParsed.broadcast > vnetParsed.broadcast)) {
        findings.push({ severity: 'error', icon: '🚫', message: `Subnet "${sn.name}" (${sn.cidr}) is outside VNet "${vnet.name}" address space (${vnet.cidr}).`, resId: sn.id });
      }
    });
  });

  // VPN Gateway without GatewaySubnet
  allVnets.forEach(vnet => {
    const hasVpnGw = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
    const hasGwSubnet = vnet.subnets.some(sn => sn.name.toLowerCase() === 'gatewaysubnet');
    if (hasVpnGw && !hasGwSubnet) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has a VPN/ER Gateway but no subnet named "GatewaySubnet". This is required by Azure.`, resId: vnet.id });
    }
  });

  // Bastion without AzureBastionSubnet
  allVnets.forEach(vnet => {
    const hasBastion = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'bas'));
    const hasBastionSubnet = vnet.subnets.some(sn => sn.name.toLowerCase() === 'azurebastionsubnet');
    if (hasBastion && !hasBastionSubnet) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has Azure Bastion but no subnet named "AzureBastionSubnet". This is required by Azure.`, resId: vnet.id });
    }
  });

  return findings;
}

export function renderSecurityPanel() {
  const panel = document.getElementById('security-panel');
  const findings = analyzeSecurityPosture();

  if (findings.length === 0) {
    panel.innerHTML = `<div class="security-score"><div class="security-score-badge good">A+</div><div class="security-score-label">Security Score<br><span style="font-size:9px;font-weight:normal;">No issues detected</span></div></div><div class="security-empty">✅ Architecture follows best practices</div>`;
    return;
  }

  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const suggestions = findings.filter(f => f.severity === 'suggestion').length;
  const recommendations = findings.filter(f => f.severity === 'recommendation').length;

  let grade, gradeClass;
  if (errors >= 1) { grade = 'F'; gradeClass = 'danger'; }
  else if (warnings >= 3) { grade = 'D'; gradeClass = 'danger'; }
  else if (warnings >= 2) { grade = 'C'; gradeClass = 'danger'; }
  else if (warnings >= 1) { grade = 'B'; gradeClass = 'warning'; }
  else if (suggestions + recommendations > 0) { grade = 'B+'; gradeClass = 'warning'; }
  else { grade = 'A+'; gradeClass = 'good'; }

  const summaryParts = [];
  if (errors > 0) summaryParts.push(`${errors} error${errors!==1?'s':''}`);
  if (warnings > 0) summaryParts.push(`${warnings} warning${warnings!==1?'s':''}`);
  if (suggestions > 0) summaryParts.push(`${suggestions} suggestion${suggestions!==1?'s':''}`);
  if (recommendations > 0) summaryParts.push(`${recommendations} recommendation${recommendations!==1?'s':''}`);

  let h = `<div class="security-score"><div class="security-score-badge ${gradeClass}">${grade}</div><div class="security-score-label">Security Score<br><span style="font-size:9px;font-weight:normal;">${summaryParts.join(', ')}</span></div></div>`;

  // Show errors first
  const sortedFindings = [...findings].sort((a, b) => {
    const order = { error: 0, warning: 1, recommendation: 2, suggestion: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  sortedFindings.forEach(f => {
    const classes = `security-item ${f.severity}${f.resId ? ' clickable' : ''}`;
    const extraAttrs = f.resId ? ` onclick="window._selectNode('${f.resId}')" title="Click to select resource"` : '';
    h += `<div class="${classes}"${extraAttrs}><span class="sev-icon">${f.icon}</span><div class="sev-text"><span class="sev-label ${f.severity}">${f.severity}</span><br>${esc(f.message)}</div></div>`;
  });

  panel.innerHTML = h;
}

export function toggleSecurityPanel() {
  const panel = document.getElementById('security-panel');
  const toggle = document.getElementById('security-panel-toggle');
  const collapsed = panel.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '▶' : '▼';
}

export function toggleCostPanel() {
  const panel = document.getElementById('cost-panel');
  const toggle = document.getElementById('cost-panel-toggle');
  const collapsed = panel.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '▶' : '▼';
}

// ================================================================
// TOGGLES & ON PREM
// ================================================================
export function toggleTheme(){ state.theme=state.theme==='drawio'?'dark':'drawio'; document.body.classList.toggle('theme-drawio',state.theme==='drawio'); fullUpdate(); }
export function toggleLayout(){ state.layout=state.layout==='grid'?'radial':'grid'; state.offset={x:0,y:0}; state.scale=1; fullUpdate(); }
export function fitToScreen(){state.offset={x:0,y:0};state.scale=1;saveState();window._draw();}
export function toggleOnPrem() { state.onPrem.enabled = !state.onPrem.enabled; fullUpdate(); }
export function updateOnPremName(val) { state.onPrem.name = val; fullUpdate(); }
export function updateOnPremCidr(val) { state.onPrem.cidr = val; fullUpdate(); }

// ================================================================
// LEFT SIDEBAR (Nested Subnets)
// ================================================================
export function renderSidebar(){
  const el=document.getElementById('sidebar-left');
  
  let h = `<div style="padding:8px 10px 4px;">
    <button class="export-btn secondary" onclick="window._openTemplateGallery()" style="width:100%;">📋 Template Gallery</button>
  </div>`;
  h += `<div class="tree-section-title">// Hybrid Connectivity</div>`;
  h += `<div class="onprem-block">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:16px;">🏢</span>
            <div><div style="font-size:11px; font-weight:bold; color:var(--azure-blue)">On-Premises Datacenter</div><div style="font-size:9px; color:var(--muted)">S2S VPN / ExpressRoute</div></div>
          </div>
          <button style="border:none; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:10px; cursor:pointer; background:${state.onPrem.enabled?'var(--success)':'rgba(123,163,192,0.2)'}; color:${state.onPrem.enabled?'#000':'var(--text)'}" onclick="window._toggleOnPrem()">
            ${state.onPrem.enabled?'ON':'OFF'}
          </button>
        </div>`;

  h += `<div class="tree-section-title">// Azure Hierarchy</div>`;

  state.subscriptions.forEach((sub,si)=>{
    const rgs=state.resourceGroups.filter(rg=>rg.subId===sub.id);
    const subColor=SUB_COLORS[si%SUB_COLORS.length];
    h+=`<div class="sub-block">
      <div class="sub-header" style="border-left-color:${subColor}">
        <span class="sub-icon" style="cursor:pointer;" onclick="window._selectNode('${sub.id}')">☁️</span>
        <input class="sub-name-input" value="${esc(sub.name)}" onchange="window._renameSub('${sub.id}',this.value)" onclick="window._selectNode('${sub.id}')">
        <button class="icon-btn" title="Add Resource Group" onclick="window._addRg('${sub.id}')">📁+</button>
        <button class="icon-btn danger" title="Delete Subscription" onclick="window._deleteSub('${sub.id}')">🗑</button>
      </div>
      <div class="sub-body">`;

    rgs.forEach((rg,ri)=>{
      const rgVnets=getVnetsInRg(rg.id);
      h+=`<div class="rg-block" id="rgblock-${rg.id}">
        <div class="rg-header">
          <span style="font-size:12px;cursor:pointer;" onclick="window._selectNode('${rg.id}')">📁</span>
          <input class="rg-name-input" value="${esc(rg.name)}" onchange="window._renameRg('${rg.id}',this.value)" onclick="window._selectNode('${rg.id}')">
          <select class="rg-loc-select" onchange="window._setRgLocation('${rg.id}',this.value)" onclick="event.stopPropagation()">
            ${['eastus','westeurope','westus2','northeurope','southeastasia','australiaeast','uksouth'].map(l=>`<option value="${l}"${rg.location===l?' selected':''}>${l}</option>`).join('')}
          </select>
          <button class="icon-btn danger" title="Delete RG" onclick="event.stopPropagation();window._deleteRg('${rg.id}')">🗑</button>
        </div>
        <div class="rg-body">`;

      rgVnets.forEach(vnet=>{
        const isHub=vnet.id==='hub';
        const isSelVnet=state.selectedId===vnet.id;
        h+=`<div class="vnet-card" style="border-left:3px solid ${vnet.color};${isSelVnet?'border-color:var(--azure-blue);box-shadow:0 0 5px rgba(0,120,212,0.3)':''}">
          <div class="vnet-card-header">
            <div class="vnet-dot" style="background:${vnet.color}"></div>
            <input class="vnet-name-input" value="${esc(vnet.name)}" onchange="window._updateVnet('${vnet.id}','name',this.value)" onclick="window._selectNode('${vnet.id}')">
            <input class="vnet-cidr-input" value="${esc(vnet.cidr)}" onchange="window._updateVnet('${vnet.id}','cidr',this.value)" onclick="window._selectNode('${vnet.id}')">
            ${!isHub?`<button class="icon-btn danger" title="Delete Spoke" onclick="window._deleteSpoke('${vnet.id}')">🗑</button>`:''}
          </div>`;

        vnet.subnets.forEach(sn => {
          const isSelSn = state.selectedId === sn.id;
          h += `<div class="subnet-card" style="${isSelSn?'border-color:var(--azure-blue);':''}">
                  <div class="subnet-header">
                    <span style="font-size:10px;color:var(--muted)">⬚</span>
                    <input class="subnet-name-input" value="${esc(sn.name)}" onchange="window._updateSubnet('${vnet.id}','${sn.id}','name',this.value)" onclick="window._selectNode('${sn.id}')">
                    <input class="subnet-cidr-input" value="${esc(sn.cidr)}" onchange="window._updateSubnet('${vnet.id}','${sn.id}','cidr',this.value)" onclick="window._selectNode('${sn.id}')">
                  </div>
                  <div class="resource-chips">`;
          sn.resources.forEach(res=>{
            const rt=RES_TYPES[res.type] || RES_TYPES.vm;
            const isSelRes=state.selectedId===res.id;
            h+=`<div class="chip${isHub?' hub-chip':''}" style="${isSelRes?'background:var(--azure-blue);color:white;border-color:var(--azure-blue);':''}" onclick="window._selectNode('${res.id}')">
              <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
              <span style="display:none; font-size:10px;">${rt.icon}</span>
              <span>${esc(res.name)}</span>
            </div>`;
          });
          h+=`</div>
              <div class="add-res-container">
                <button class="add-btn subnet-level" onclick="window._toggleDropdown('${sn.id}')">➕ Add Resource to Subnet</button>
                <div class="res-dropdown" id="dropdown-${sn.id}">
                  <div class="res-search-container">
                    <input type="text" class="res-search-input" placeholder="Search resources..." onkeyup="window._filterResources(event, '${sn.id}')" onclick="event.stopPropagation()">
                  </div>`;
          const cats={};
          Object.keys(RES_TYPES).forEach(k=>{const t=RES_TYPES[k];if(!cats[t.cat])cats[t.cat]=[];cats[t.cat].push({key:k,...t});});
          Object.keys(cats).forEach(cat=>{
            h+=`<div class="res-dd-section">${RES_CATEGORIES[cat]||cat}</div>`;
            cats[cat].forEach(t=>{
                h+=`<div class="res-option" onclick="window._addResource('${vnet.id}','${sn.id}','${t.key}')">
                  <img src="${AZURE_ICON_BASE}${t.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
                  <span style="display:none">${t.icon}</span> <span class="res-label">${t.label}</span>
                </div>`;
            });
          });
          h+=`</div></div></div>`;
        });

        h+=`<button class="add-btn vnet-level" onclick="window._addSubnet('${vnet.id}')">➕ Add Subnet</button>`;
        h+=`</div>`;
      });

      h+=`<button class="add-btn vnet-level" onclick="window._addSpoke('${rg.id}')">➕ Add Spoke VNet</button>`;
      h+=`<button class="add-btn vnet-level" onclick="window._addVnetToRg('${rg.id}')" style="margin-top:2px;">🌐+ Add VNet</button>`;

      // RG-level resources (DNS zones etc)
      const rgRes = getRgResources(rg.id);
      if (rgRes.length > 0) {
        h+=`<div class="rg-resources-section"><div class="rg-res-title">RG-Level Resources</div>`;
        rgRes.forEach(res => {
          const rt = RES_TYPES[res.type] || RES_TYPES.dns;
          const isSelRes = state.selectedId === res.id;
          h+=`<div class="chip rg-chip" style="${isSelRes?'background:var(--azure-blue);color:white;border-color:var(--azure-blue);':''}" onclick="window._selectNode('${res.id}')">
            <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
            <span style="display:none; font-size:10px;">${rt.icon}</span>
            <span>${esc(res.name)}</span>
          </div>`;
        });
        h+=`</div>`;
      }
      h+=`<div class="add-res-container">
        <button class="add-btn rg-level" onclick="window._toggleDropdown('rg-${rg.id}')">➕ Add DNS / RG Resource</button>
        <div class="res-dropdown" id="dropdown-rg-${rg.id}">
          <div class="res-search-container">
            <input type="text" class="res-search-input" placeholder="Search..." onkeyup="window._filterResources(event, 'rg-${rg.id}')" onclick="event.stopPropagation()">
          </div>
          <div class="res-dd-section">DNS & RG-Level Resources</div>`;
      Object.keys(RES_TYPES).filter(k => RES_TYPES[k].rgLevel).forEach(k => {
        const t = RES_TYPES[k];
        h+=`<div class="res-option" onclick="window._addRgResource('${rg.id}','${k}')">
          <img src="${AZURE_ICON_BASE}${t.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
          <span style="display:none">${t.icon}</span> <span class="res-label">${t.label}</span>
        </div>`;
      });
      h+=`</div></div>`;

      h+=`</div></div>`;
    });

    h+=`<button class="add-btn rg-level" onclick="window._addRg('${sub.id}')">📁 Add Resource Group</button>`;
    h+=`</div></div>`;
  });

  h+=`<button class="add-btn sub-level" onclick="window._addSub()">☁️ Add Subscription</button>`;
  el.innerHTML=h;
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
    } else {
      Object.keys(obj.config).forEach(k=>{
        const label = k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
        if(obj.config[k]==='true'||obj.config[k]==='false'){
          h+=`<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"><option value="true"${obj.config[k]==='true'?' selected':''}>Yes</option><option value="false"${obj.config[k]==='false'?' selected':''}>No</option></select></div>`;
        } else {
          h+=`<div class="editor-row"><span class="editor-label">${label}</span><input class="input-field" value="${esc(obj.config[k])}" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"></div>`;
        }
      });
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
    
    // VNet Links (for Private DNS)
    if(obj.type === 'dns' && obj.config.vnetLinks !== undefined) {
      h+=`<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">VNet Links</span></div>`;
      (obj.config.vnetLinks||[]).forEach((link, idx) => {
        h+=`<div class="editor-row" style="gap:4px;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
          <span style="flex:1;font-size:10px;">🔗 ${esc(link.vnetName)}</span>
          <button class="icon-btn danger" onclick="window._deleteVnetLink('${obj.id}',${idx})">🗑</button>
        </div>`;
      });
      h+=`<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addVnetLink('${obj.id}')">🔗 Link VNet</button>`;
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

// ================================================================
// STATE MUTATIONS
// ================================================================
export function addSub(){ const n=state.subscriptions.length; const id='sub-'+uid(); state.subscriptions.push({id,name:`Subscription ${n+1}`,subscriptionId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tenantId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tags:{}}); state.resourceGroups.push({id:'rg-'+uid(),name:'rg-new',location:'eastus',subId:id,tags:{},lock:'None',budgetLimit:'',budgetAlertThreshold:'80'}); fullUpdate(); }
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
  if(sn && rT) {
    // Clear custom positions for existing resources in this subnet so they re-layout together
    if(state.customPos){
      sn.resources.forEach(r => { delete state.customPos[r.id]; });
    }
    const nr={id:uid(),type:resType,name:`${sn.name.split('-')[0]}-${resType}`,config:{...rT.config}};
    sn.resources.push(nr); document.querySelectorAll('.res-dropdown').forEach(d=>d.classList.remove('show')); selectNode(nr.id);
  }
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

// ================================================================
// MOBILE NAVIGATION
// ================================================================
function isMobile() { return window.innerWidth <= 768; }

export function toggleMobileMenu() {
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  if (left.classList.contains('mobile-visible') || right.classList.contains('mobile-visible')) {
    left.classList.remove('mobile-visible');
    right.classList.remove('mobile-visible');
    setActiveTab('canvas');
  } else {
    showMobilePanel('left');
  }
}

export function showMobilePanel(panel) {
  if (!isMobile()) return;
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  left.classList.remove('mobile-visible');
  right.classList.remove('mobile-visible');
  if (panel === 'left') left.classList.add('mobile-visible');
  else if (panel === 'right') right.classList.add('mobile-visible');
  setActiveTab(panel);
  setTimeout(window._resize, 50);
}

function setActiveTab(panel) {
  document.querySelectorAll('.mobile-tab-bar button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('mob-tab-' + panel);
  if (tab) tab.classList.add('active');
}

// Close dropdowns on outside click
document.addEventListener('click',e=>{if(!e.target.closest('.add-res-container'))document.querySelectorAll('.res-dropdown').forEach(d=>d.classList.remove('show'));});

// Close mobile panels on window resize to desktop
window.addEventListener('resize', function() {
  if (!isMobile()) {
    document.getElementById('sidebar-left').classList.remove('mobile-visible');
    document.getElementById('sidebar-right').classList.remove('mobile-visible');
  }
});
