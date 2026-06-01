import { state, esc, uid, fullUpdate, saveState, getVnetsInRg, getRgResources, RES_TYPES, RES_CATEGORIES, AZURE_ICON_BASE, SUB_COLORS } from '../state-management.js';

// ================================================================
// TOGGLES & ON PREM
// ================================================================
export function toggleTheme(){ state.theme=state.theme==='drawio'?'dark':'drawio'; document.body.classList.toggle('theme-drawio',state.theme==='drawio'); fullUpdate(); }
export function fitToScreen(){state.offset={x:0,y:0};state.scale=1;saveState();window._draw();}
export function toggleOnPrem() { state.onPrem.enabled = !state.onPrem.enabled; fullUpdate(); }
export function updateOnPremName(val) { state.onPrem.name = val; fullUpdate(); }
export function updateOnPremCidr(val) { state.onPrem.cidr = val; fullUpdate(); }

// ================================================================
// MANAGEMENT GROUPS
// ================================================================
export function toggleMgEnabled() {
  state.mgEnabled = !state.mgEnabled;
  if(!state.mgEnabled){
    state.subscriptions.forEach(s=>s.mgId=null);
  } else {
    // Auto-create first MG and assign all existing subs to it
    if(state.managementGroups.length===0 && state.subscriptions.length>0){
      const id='mg-'+uid();
      state.managementGroups.push({id, name:'Management Group 1', parentId:null});
      state.subscriptions.forEach(s=>{ s.mgId=id; });
    }
  }
  fullUpdate();
}
export function addMg(parentId) { const id='mg-'+uid(); state.managementGroups.push({id, name:'Management Group '+(state.managementGroups.length+1), parentId: parentId||null}); fullUpdate(); }
export function deleteMg(id) { if(!confirm('Delete this Management Group? Subscriptions will be unassigned.')) return; state.subscriptions.forEach(s=>{if(s.mgId===id)s.mgId=null;}); const children=state.managementGroups.filter(mg=>mg.parentId===id); children.forEach(c=>{c.parentId=state.managementGroups.find(mg=>mg.id===id)?.parentId||null;}); state.managementGroups=state.managementGroups.filter(mg=>mg.id!==id); fullUpdate(); }
export function renameMg(id,val) { const mg=state.managementGroups.find(m=>m.id===id); if(mg){mg.name=val;saveState();window._draw();} }
export function assignSubToMg(subId,mgId) { const sub=state.subscriptions.find(s=>s.id===subId); if(sub){sub.mgId=mgId||null;} fullUpdate(); }
export function assignMgParent(mgId,parentId) { const mg=state.managementGroups.find(m=>m.id===mgId); if(mg){mg.parentId=parentId||null;} fullUpdate(); }
export function addSubToMg(mgId) { const n=state.subscriptions.length; const id='sub-'+uid(); state.subscriptions.push({id,name:`Subscription ${n+1}`,subscriptionId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tenantId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tags:{},mgId:mgId}); state.resourceGroups.push({id:'rg-'+uid(),name:'rg-new',location:'eastus',subId:id,tags:{},lock:'None',budgetLimit:'',budgetAlertThreshold:'80'}); fullUpdate(); }

// ================================================================
// LEFT SIDEBAR (Nested Subnets)
// ================================================================

// Helper: renders all RG blocks for a given set of RGs (returns HTML string)
function renderRgBlocksHtml(rgs) {
  let h = '';
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
          <span>${res.name}</span>
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
  return h;
}

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

  // Management Groups toggle
  h += `<div class="onprem-block">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:16px;">🏛️</span>
            <div><div style="font-size:11px; font-weight:bold; color:var(--azure-blue)">Management Groups</div><div style="font-size:9px; color:var(--muted)">Hierarchical governance layer</div></div>
          </div>
          <button style="border:none; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:10px; cursor:pointer; background:${state.mgEnabled?'var(--success)':'rgba(123,163,192,0.2)'}; color:${state.mgEnabled?'#000':'var(--text)'}" onclick="window._toggleMgEnabled()">
            ${state.mgEnabled?'ON':'OFF'}
          </button>
        </div>`;

  if (state.mgEnabled) {
    // Render MG hierarchy
    const renderSubBlock = (sub, si) => {
      const rgs=state.resourceGroups.filter(rg=>rg.subId===sub.id);
      const subColor=SUB_COLORS[si%SUB_COLORS.length];
      let sh='';
      sh+=`<div class="sub-block">
        <div class="sub-header" style="border-left-color:${subColor}">
          <span class="sub-icon" style="cursor:pointer;" onclick="window._selectNode('${sub.id}')">☁️</span>
          <input class="sub-name-input" value="${esc(sub.name)}" onchange="window._renameSub('${sub.id}',this.value)" onclick="window._selectNode('${sub.id}')">
          <button class="icon-btn" title="Add Resource Group" onclick="window._addRg('${sub.id}')">📁+</button>
          <button class="icon-btn danger" title="Delete Subscription" onclick="window._deleteSub('${sub.id}')">🗑</button>
        </div>
        <div class="sub-body">`;
      sh += renderRgBlocksHtml(rgs);
      sh+=`<button class="add-btn rg-level" onclick="window._addRg('${sub.id}')">📁 Add Resource Group</button>`;
      sh+=`</div></div>`;
      return sh;
    };

    const renderMgBlock = (mg) => {
      let mh = '';
      const childMgs = state.managementGroups.filter(m => m.parentId === mg.id);
      const mgSubs = state.subscriptions.filter(s => s.mgId === mg.id);
      mh += `<div class="mg-block">
        <div class="mg-header">
          <span style="font-size:12px;cursor:pointer;" onclick="window._selectNode('${mg.id}')">🏛️</span>
          <input class="mg-name-input" value="${esc(mg.name)}" onchange="window._renameMg('${mg.id}',this.value)" onclick="window._selectNode('${mg.id}')">
          <button class="icon-btn" title="Add Child MG" onclick="window._addMg('${mg.id}')">🏛️+</button>
          <button class="icon-btn" title="Add Subscription" onclick="window._addSubToMg('${mg.id}')">☁️+</button>
          <button class="icon-btn danger" title="Delete MG" onclick="window._deleteMg('${mg.id}')">🗑</button>
        </div>
        <div class="mg-body">`;
      childMgs.forEach(child => { mh += renderMgBlock(child); });
      mgSubs.forEach((sub, si) => { mh += renderSubBlock(sub, si); });
      mh += `</div></div>`;
      return mh;
    };

    // Render root-level MGs (parentId === null)
    const rootMgs = state.managementGroups.filter(mg => mg.parentId === null);
    rootMgs.forEach(mg => { h += renderMgBlock(mg); });

    // Render subscriptions not assigned to any MG
    const unassignedSubs = state.subscriptions.filter(s => !s.mgId);
    if (unassignedSubs.length > 0) {
      h += `<div style="font-size:9px; color:var(--muted); padding:4px 12px; text-transform:uppercase; letter-spacing:0.5px;">Unassigned Subscriptions</div>`;
      unassignedSubs.forEach((sub, si) => { h += renderSubBlock(sub, si); });
    }

    h += `<button class="add-btn mg-level" onclick="window._addMg()">🏛️ Add Management Group</button>`;
    h += `<button class="add-btn sub-level" onclick="window._addSub()">☁️ Add Subscription</button>`;
  } else {
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
      h += renderRgBlocksHtml(rgs);
      h+=`<button class="add-btn rg-level" onclick="window._addRg('${sub.id}')">📁 Add Resource Group</button>`;
      h+=`</div></div>`;
    });

    h+=`<button class="add-btn sub-level" onclick="window._addSub()">☁️ Add Subscription</button>`;
  }
  el.innerHTML=h;
}
