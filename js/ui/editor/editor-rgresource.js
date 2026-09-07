// ================================================================
// EDITOR: RESOURCE-GROUP-LEVEL RESOURCE (typeObj === 'rgResource')
// Renders the right-side properties panel for resources that live
// directly under a Resource Group (DNS zones, etc.)
// ================================================================
import { state, esc, RES_TYPES, AZURE_ICON_BASE, getRecommendedDnsZones, getAllDiagramResources } from '../../state-management.js';

function renderRbacSection(obj) {
  const assignments = obj.config.rbacAssignments || [];
  const candidates = getAllDiagramResources().filter(r => r.id !== obj.id);
  let h = `<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">RBAC Assignments</span></div>`;
  if (assignments.length === 0) {
    h += `<div style="font-size:10px;color:var(--muted);margin-bottom:6px;">No explicit RBAC assignments modeled for this resource.</div>`;
  }
  assignments.forEach((assignment, idx) => {
    h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
      <select class="input-field" style="min-width:130px;" onchange="window._updateRbacAssignment('${obj.id}',${idx},'principalType',this.value)">
        ${['ManagedIdentity', 'ServicePrincipal', 'Group', 'User'].map(type => `<option value="${type}"${(assignment.principalType || 'ManagedIdentity') === type ? ' selected' : ''}>${type}</option>`).join('')}
      </select>
      <select class="input-field" style="flex:1;min-width:150px;" onchange="window._updateRbacAssignment('${obj.id}',${idx},'principalResourceId',this.value)">
        <option value="">-- Linked resource principal --</option>
        ${candidates.map(r => `<option value="${r.id}"${assignment.principalResourceId === r.id ? ' selected' : ''}>${esc(r.name)} (${RES_TYPES[r.type]?.label || r.type})</option>`).join('')}
      </select>
      <input class="input-field" style="flex:1;min-width:130px;" placeholder="Principal name / alias" value="${esc(assignment.principalName || '')}" onchange="window._updateRbacAssignment('${obj.id}',${idx},'principalName',this.value)">
      <input class="input-field" style="flex:1;min-width:130px;" placeholder="Principal objectId (optional)" value="${esc(assignment.principalObjectId || '')}" onchange="window._updateRbacAssignment('${obj.id}',${idx},'principalObjectId',this.value)">
      <input class="input-field" style="flex:1;min-width:140px;" placeholder="Role definition name" value="${esc(assignment.roleDefinitionName || '')}" onchange="window._updateRbacAssignment('${obj.id}',${idx},'roleDefinitionName',this.value)">
      <button class="icon-btn danger" onclick="window._deleteRbacAssignment('${obj.id}',${idx})">🗑</button>
    </div>`;
  });
  h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addRbacAssignment('${obj.id}')">➕ Add RBAC Assignment</button>`;
  return h;
}

function renderDnsRecordValueFields(resId, rec, idx) {
  const type = rec.type || 'A';
  const targetValue = rec.target || rec.value || '';
  const mxExchange = rec.exchange || rec.value || '';
  const soaHost = rec.host || rec.value || '';

  if (type === 'MX') {
    return `
      <input class="input-field" style="width:70px;" placeholder="Pref" value="${esc(rec.preference || '10')}" onchange="window._updateDnsRecord('${resId}',${idx},'preference',this.value)">
      <input class="input-field" style="flex:2;min-width:120px;" placeholder="Exchange (mail.contoso.com)" value="${esc(mxExchange)}" onchange="window._updateDnsRecord('${resId}',${idx},'exchange',this.value)">`;
  }
  if (type === 'SRV') {
    return `
      <input class="input-field" style="width:64px;" placeholder="Prio" value="${esc(rec.priority || '10')}" onchange="window._updateDnsRecord('${resId}',${idx},'priority',this.value)">
      <input class="input-field" style="width:64px;" placeholder="Weight" value="${esc(rec.weight || '10')}" onchange="window._updateDnsRecord('${resId}',${idx},'weight',this.value)">
      <input class="input-field" style="width:64px;" placeholder="Port" value="${esc(rec.port || '443')}" onchange="window._updateDnsRecord('${resId}',${idx},'port',this.value)">
      <input class="input-field" style="flex:2;min-width:120px;" placeholder="Target (svc.contoso.com)" value="${esc(targetValue)}" onchange="window._updateDnsRecord('${resId}',${idx},'target',this.value)">`;
  }
  if (type === 'SOA') {
    return `
      <input class="input-field" style="flex:1;min-width:100px;" placeholder="Host (ns1)" value="${esc(soaHost)}" onchange="window._updateDnsRecord('${resId}',${idx},'host',this.value)">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Email (hostmaster)" value="${esc(rec.email || '')}" onchange="window._updateDnsRecord('${resId}',${idx},'email',this.value)">
      <input class="input-field" style="width:80px;" placeholder="Serial" value="${esc(rec.serialNumber || '1')}" onchange="window._updateDnsRecord('${resId}',${idx},'serialNumber',this.value)">
      <input class="input-field" style="width:80px;" placeholder="Refresh" value="${esc(rec.refreshTime || '3600')}" onchange="window._updateDnsRecord('${resId}',${idx},'refreshTime',this.value)">
      <input class="input-field" style="width:70px;" placeholder="Retry" value="${esc(rec.retryTime || '300')}" onchange="window._updateDnsRecord('${resId}',${idx},'retryTime',this.value)">
      <input class="input-field" style="width:80px;" placeholder="Expire" value="${esc(rec.expireTime || '2419200')}" onchange="window._updateDnsRecord('${resId}',${idx},'expireTime',this.value)">
      <input class="input-field" style="width:76px;" placeholder="MinTTL" value="${esc(rec.minimumTtl || '300')}" onchange="window._updateDnsRecord('${resId}',${idx},'minimumTtl',this.value)">`;
  }
  if (['CNAME', 'NS', 'PTR'].includes(type)) {
    return `<input class="input-field" style="flex:2;min-width:120px;" placeholder="Target FQDN" value="${esc(targetValue)}" onchange="window._updateDnsRecord('${resId}',${idx},'target',this.value)">`;
  }
  if (type === 'TXT') {
    return `<input class="input-field" style="flex:2;min-width:120px;" placeholder="Text value" value="${esc(rec.value || '')}" onchange="window._updateDnsRecord('${resId}',${idx},'value',this.value)">`;
  }
  if (type === 'AAAA') {
    return `<input class="input-field" style="flex:2;min-width:120px;" placeholder="IPv6 Address" value="${esc(rec.value || '')}" onchange="window._updateDnsRecord('${resId}',${idx},'value',this.value)">`;
  }
  return `<input class="input-field" style="flex:2;min-width:120px;" placeholder="IPv4 Address" value="${esc(rec.value || '')}" onchange="window._updateDnsRecord('${resId}',${idx},'value',this.value)">`;
}

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

  if (obj.type === 'dns' || obj.type === 'publicDns') {
    const recordCount = (obj.config.records || []).length;
    const linkCount = (obj.config.vnetLinks || []).length;
    const recommended = obj.type === 'dns' ? (window._state?.getRecommendedVnetLinksForDnsZone?.(obj.id) || []) : [];
    const missingLinks = recommended.filter(link => !(obj.config.vnetLinks || []).some(existing => existing.vnetId === link.vnetId)).length;
    const status = obj.type === 'dns'
      ? (recordCount > 0 && linkCount > 0 && missingLinks === 0 ? 'Ready' : (recordCount > 0 || linkCount > 0 ? 'Partial' : 'Planned'))
      : (recordCount > 0 ? 'Ready' : 'Planned');
    h += `<div style="margin-top:10px;padding:8px;border:1px solid var(--border);border-radius:4px;background:rgba(0,120,212,0.04);">
      <div style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;margin-bottom:6px;">📡 DNS Status</div>
      <div style="font-size:10px;color:var(--text);">Type: ${obj.type === 'dns' ? 'Private DNS Zone' : 'Public DNS Zone'}</div>
      <div style="font-size:10px;color:var(--text);">State: ${status}</div>
      <div style="font-size:10px;color:var(--text);">Records: ${recordCount}</div>
      ${obj.type === 'dns' ? `<div style="font-size:10px;color:var(--text);">Linked VNets: ${linkCount}</div><div style="font-size:10px;color:var(--text);">Recommended Missing Links: ${missingLinks}</div>` : ''}
    </div>`;
  }

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
    h += `<div class="editor-row"><span class="editor-label">Auto Registration Default</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','autoRegistration',this.value)"><option value="false"${(obj.config.autoRegistration || 'false') === 'false' ? ' selected' : ''}>Disabled</option><option value="true"${obj.config.autoRegistration === 'true' ? ' selected' : ''}>Enabled</option></select></div>`;
  } else if (obj.type === 'publicDns') {
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
        ${renderDnsRecordValueFields(obj.id, rec, idx)}
        <input class="input-field" style="width:50px;" placeholder="TTL" value="${esc(rec.ttl)}" onchange="window._updateDnsRecord('${obj.id}',${idx},'ttl',this.value)">
        <button class="icon-btn danger" onclick="window._deleteDnsRecord('${obj.id}',${idx})">🗑</button>
      </div>`;
    });
    h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addDnsRecord('${obj.id}')">➕ Add Record</button>`;
  }

  if (obj.type === 'wafPolicy') {
    const cfg = obj.config || {};
    h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🛡️ WAF Policy Settings</span></div>
      <div class="editor-row"><span class="editor-label">Mode</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','mode',this.value)"><option value="Detection"${(cfg.mode || 'Prevention') === 'Detection' ? ' selected' : ''}>Detection</option><option value="Prevention"${(cfg.mode || 'Prevention') === 'Prevention' ? ' selected' : ''}>Prevention</option></select></div>
      <div class="editor-row"><span class="editor-label">Rule Set Type</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','ruleSetType',this.value)"><option value="OWASP"${(cfg.ruleSetType || 'OWASP') === 'OWASP' ? ' selected' : ''}>OWASP</option><option value="Microsoft_BotManagerRuleSet"${cfg.ruleSetType === 'Microsoft_BotManagerRuleSet' ? ' selected' : ''}>Microsoft_BotManagerRuleSet</option></select></div>
      <div class="editor-row"><span class="editor-label">Rule Set Version</span><input class="input-field" value="${esc(cfg.ruleSetVersion || '3.2')}" onchange="window._updateResConfig('${obj.id}','ruleSetVersion',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Request Body Check</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','requestBodyCheck',this.value)"><option value="true"${(cfg.requestBodyCheck || 'true') === 'true' ? ' selected' : ''}>Enabled</option><option value="false"${cfg.requestBodyCheck === 'false' ? ' selected' : ''}>Disabled</option></select></div>
      <div class="editor-row"><span class="editor-label">Max Body (KB)</span><input class="input-field" value="${esc(cfg.maxRequestBodySizeInKb || '128')}" onchange="window._updateResConfig('${obj.id}','maxRequestBodySizeInKb',this.value)"></div>
      <div class="editor-row"><span class="editor-label">Upload Limit (MB)</span><input class="input-field" value="${esc(cfg.fileUploadLimitInMb || '100')}" onchange="window._updateResConfig('${obj.id}','fileUploadLimitInMb',this.value)"></div>
      <div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">Custom Rules</span></div>`;
    (cfg.customRules || []).forEach((rule, idx) => {
      h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
        <input class="input-field" style="flex:1;min-width:110px;" placeholder="Rule name" value="${esc(rule.name || '')}" onchange="window._updateWafCustomRule('${obj.id}',${idx},'name',this.value)">
        <input class="input-field" style="width:72px;" placeholder="Priority" value="${esc(rule.priority || '')}" onchange="window._updateWafCustomRule('${obj.id}',${idx},'priority',this.value)">
        <select class="input-field" style="width:90px;" onchange="window._updateWafCustomRule('${obj.id}',${idx},'action',this.value)"><option value="Block"${(rule.action || 'Block') === 'Block' ? ' selected' : ''}>Block</option><option value="Allow"${rule.action === 'Allow' ? ' selected' : ''}>Allow</option><option value="Log"${rule.action === 'Log' ? ' selected' : ''}>Log</option></select>
        <input class="input-field" style="flex:1;min-width:130px;" placeholder="Match variable" value="${esc(rule.matchVariable || '')}" onchange="window._updateWafCustomRule('${obj.id}',${idx},'matchVariable',this.value)">
        <select class="input-field" style="width:92px;" onchange="window._updateWafCustomRule('${obj.id}',${idx},'operator',this.value)"><option value="Contains"${(rule.operator || 'Contains') === 'Contains' ? ' selected' : ''}>Contains</option><option value="Equals"${rule.operator === 'Equals' ? ' selected' : ''}>Equals</option><option value="BeginsWith"${rule.operator === 'BeginsWith' ? ' selected' : ''}>BeginsWith</option><option value="EndsWith"${rule.operator === 'EndsWith' ? ' selected' : ''}>EndsWith</option></select>
        <input class="input-field" style="flex:1;min-width:120px;" placeholder="Match value" value="${esc(rule.matchValue || '')}" onchange="window._updateWafCustomRule('${obj.id}',${idx},'matchValue',this.value)">
        <button class="icon-btn danger" onclick="window._deleteWafCustomRule('${obj.id}',${idx})">🗑</button>
      </div>`;
    });
    h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addWafCustomRule('${obj.id}')">➕ Add WAF Rule</button>`;
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

  h += renderRbacSection(obj);

  h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteRgResource('${obj.id}')">🗑 Delete Resource</button>`;
  return h;
}
