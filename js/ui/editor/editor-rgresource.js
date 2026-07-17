// ================================================================
// EDITOR: RESOURCE-GROUP-LEVEL RESOURCE (typeObj === 'rgResource')
// Renders the right-side properties panel for resources that live
// directly under a Resource Group (DNS zones, etc.)
// ================================================================
import { state, esc, RES_TYPES, AZURE_ICON_BASE, getRecommendedDnsZones } from '../../state-management.js';

export function renderRgResourceSection(obj, { renderValidationBadge, renderValidationSection }) {
  let h = '';
  const rt = RES_TYPES[obj.type] || { color: '#888', label: 'Resource', icon: '❓', img: '' };
  const validationBadge = renderValidationBadge(obj);
  h += `<div class="editor-header">
        <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
        <span style="display:none">${rt.icon}</span> 
        ${rt.label} ${validationBadge}
      </div>
    <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateRgResource('${obj.id}','name',this.value)"></div>`;

  // Show validation section at the top
  h += renderValidationSection(obj);

  // Zone selection - searchable dropdown for Private DNS zones
  if (obj.type === 'dns') {
    const recommended = getRecommendedDnsZones();
    const existingZones = (state.rgResources || []).filter(r => r.type === 'dns' && r.config.zone).map(r => r.config.zone);
    const unresolvedRecs = recommended.filter(z => !existingZones.includes(z));
    h += `<div class="editor-row" style="flex-direction:column;align-items:stretch;">
      <span class="editor-label" style="margin-bottom:4px;">Zone</span>
      <div class="dns-zone-picker" style="position:relative;">
        <input class="input-field dns-zone-search" id="dns-zone-search-${obj.id}" value="${esc(obj.config.zone || '')}" 
          placeholder="Search or type zone..." 
          onfocus="window._showDnsZoneDropdown('${obj.id}')"
          oninput="window._filterDnsZones('${obj.id}', this.value)"
          onchange="window._updateResConfig('${obj.id}','zone',this.value)">
        <div class="dns-zone-dropdown" id="dns-zone-dd-${obj.id}" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:4px;z-index:1000;margin-top:2px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
        </div>
      </div>
    </div>`;
    // Show recommendations
    if (unresolvedRecs.length > 0) {
      h += `<div class="editor-row" style="flex-direction:column;align-items:stretch;margin-top:6px;">
        <span class="editor-label" style="font-size:9px;color:var(--azure-blue);margin-bottom:4px;">💡 Recommended (based on Private Endpoints)</span>`;
      unresolvedRecs.slice(0, 3).forEach(zone => {
        h += `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
          <button style="flex:1;text-align:left;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:9px;border:1px solid var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" 
            title="${esc(zone)}"
            onclick="window._selectDnsZone('${obj.id}','${zone}')">${zone}</button>
        </div>`;
      });
      h += `</div>`;
    }
  } else {
    h += `<div class="editor-row"><span class="editor-label">Zone</span><input class="input-field" value="${esc(obj.config.zone || '')}" onchange="window._updateResConfig('${obj.id}','zone',this.value)"></div>`;
  }

  // DNS Records
  if (obj.type === 'publicDns' && !obj.config.records) obj.config.records = [];
  if (obj.config.records) {
    h += `<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">DNS Records</span></div>`;
    obj.config.records.forEach((rec, idx) => {
      h += `<div class="editor-row dns-record-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
        <input class="input-field" style="flex:1;min-width:60px;" placeholder="Name" value="${esc(rec.name)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'name',this.value)">
        <select class="input-field" style="width:60px;" onchange="window._updateDnsRecord('${obj.id}',${idx},'type',this.value)">
          ${['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'PTR'].map(t => `<option${rec.type === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        <input class="input-field" style="flex:2;min-width:80px;" placeholder="Value" value="${esc(rec.value)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'value',this.value)">
        <input class="input-field" style="width:50px;" placeholder="TTL" value="${esc(rec.ttl)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'ttl',this.value)">
        <button class="icon-btn danger" onclick="window._deleteDnsRecord('${obj.id}',${idx})">🗑</button>
      </div>`;
    });
    h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addDnsRecord('${obj.id}')">➕ Add Record</button>`;
  }

  // VNet Links (for Private DNS) - shown like peerings
  if (obj.type === 'dns' && obj.config.vnetLinks !== undefined) {
    const allVnetsForLink = [state.hub, ...state.spokes];
    const linkedIds = (obj.config.vnetLinks || []).map(l => l.vnetId);
    const { getRecommendedVnetLinksForDnsZone } = window._state;
    const recommendedLinks = getRecommendedVnetLinksForDnsZone(obj.id);

    h += `<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">VNet Links</span></div>`;
    if (recommendedLinks.length > 0) {
      h += `<div style="padding:8px;background:rgba(0,120,212,0.05);border-radius:4px;margin-bottom:8px;border-left:3px solid var(--azure-blue);">
        <span style="font-size:9px;font-weight:bold;color:var(--azure-blue);display:block;margin-bottom:4px;">💡 Recommended based on Private Endpoints:</span>
        ${recommendedLinks.map(r => `<div style="font-size:9px;color:var(--text);margin-bottom:2px;">✓ ${esc(r.vnetName)} (${r.peCount} PE${r.peCount !== 1 ? 's' : ''})</div>`).join('')}
      </div>`;
    }

    h += `<div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">`;
    allVnetsForLink.forEach(v => {
      const isLinked = linkedIds.includes(v.id);
      const isRecommended = recommendedLinks.some(r => r.vnetId === v.id);
      const linkStyle = isLinked
        ? "border:1px solid #00B294;background:rgba(0,178,148,.1);color:#00B294;"
        : isRecommended
        ? "border:1px solid #FF8C00;background:rgba(255,140,0,.1);color:#FF8C00;"
        : "border:1px solid var(--border);background:transparent;color:var(--text);";

      if (isLinked) {
        h += `<div style="display:flex;gap:4px;"><button style="flex:1;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;${linkStyle}transition:0.2s;" onclick="window._selectVnetLink('${obj.id}','${v.id}')">🔗 ${esc(v.name)}</button><button style="padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px solid var(--danger);background:transparent;color:var(--danger);" onclick="window._toggleVnetLink('${obj.id}','${v.id}')" title="Remove link">✕</button></div>`;
      } else {
        h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-family:JetBrains Mono;font-size:10px;font-weight:bold;${linkStyle}transition:0.2s;" onclick="window._toggleVnetLink('${obj.id}','${v.id}')">${isRecommended ? '⚡' : '🔌'} ${esc(v.name)}</button>`;
      }
    });
    h += `</div>`;
  }

  // Add Another DNS Zone button (for Private DNS zones)
  if (obj.type === 'dns') {
    h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--azure-blue)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--azure-blue)'" onclick="window._addAnotherDnsZone('${obj.rgId}')">🌐 Add Another DNS Zone</button>`;
  }

  h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteRgResource('${obj.id}')">🗑 Delete Resource</button>`;
  return h;
}
