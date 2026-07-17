// ================================================================
// EDITOR: SUBNET/VNET RESOURCE (typeObj === 'resource')
// Renders the right-side properties panel for resources placed inside
// a subnet (VMs, NSGs, Route Tables, Private Endpoints, etc.)
// ================================================================
import { esc, RES_TYPES, AZURE_ICON_BASE } from '../../state-management.js';

export function renderResourceSection(obj, { renderValidationBadge, renderValidationSection, renderConfigFields }) {
  let h = '';
  const rt = RES_TYPES[obj.type] || { color: '#888', label: 'Resource', icon: '❓' };
  const validationBadge = renderValidationBadge(obj);
  h += `<div class="editor-header">
        <img src="${AZURE_ICON_BASE}${rt.img}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
        <span style="display:none">${rt.icon}</span> 
        ${rt.label} ${validationBadge}
      </div>
    <div class="editor-row"><span class="editor-label">Name</span><input class="input-field" value="${esc(obj.name)}" onchange="window._updateResource('${obj.id}','name',this.value)"></div>`;

  // Show validation section at the top
  h += renderValidationSection(obj);

  // Special PE section with target resource selection
  if (obj.type === 'pe') {
    const { getPeTargetableResources, getPeTargetResource, PE_TARGET_DNS_RECOMMENDATIONS } = window._state;
    const targetableResources = getPeTargetableResources();
    const currentTarget = getPeTargetResource(obj.id);

    h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔗 Private Link Target</span></div>`;
    h += `<div class="editor-row"><span class="editor-label">Target Resource</span>
      <select class="input-field" onchange="window._updateResConfig('${obj.id}','targetResourceId',this.value)">
        <option value="">-- Select target resource --</option>
        ${targetableResources.map(r => `<option value="${r.id}"${obj.config.targetResourceId === r.id ? ' selected' : ''}>${esc(r.name)} (${RES_TYPES[r.type]?.label || r.type})</option>`).join('')}
      </select>
    </div>`;

    if (currentTarget) {
      h += `<div class="editor-row"><span class="editor-label">Target Info</span><span style="font-size:11px;color:var(--muted);">🎯 ${esc(currentTarget.name)} in ${RES_TYPES[currentTarget.type]?.label || 'Resource'}</span></div>`;

      // Show recommended DNS zones for this target
      const recommendedZones = PE_TARGET_DNS_RECOMMENDATIONS[obj.config.target] || [];
      if (recommendedZones.length > 0) {
        h += `<div class="editor-row" style="flex-direction:column;align-items:stretch;margin-top:8px;padding:8px;background:rgba(0,176,148,0.05);border-radius:4px;">
          <span style="font-size:10px;font-weight:bold;color:var(--azure-green);margin-bottom:6px;">💡 Required DNS Zones:</span>
          ${recommendedZones.map(z => `<div style="font-size:9px;color:var(--text);margin-bottom:3px;padding:4px;background:rgba(0,120,212,0.1);border-radius:2px;">${esc(z)}</div>`).join('')}
        </div>`;
      }
    }
  }

  if (obj.type === 'vm') {
    // VM: Structured sections for full configuration
    const cfg = obj.config;
    const vmSections = [
      { title: '💻 Compute', keys: ['size', 'os', 'availabilityZone'] },
      { title: '💾 OS Disk', keys: ['osDiskType', 'osDiskSizeGB'] },
      { title: '📀 Data Disks', keys: ['dataDisks', 'dataDiskSizeGB', 'dataDiskType'] },
      { title: '🌐 Networking', keys: ['acceleratedNetworking', 'publicIp'] },
      { title: '🔐 Security', keys: ['authType', 'securityType', 'vTpmEnabled', 'secureBootEnabled', 'managedIdentity'] },
      { title: '⚙️ Management', keys: ['bootDiagnostics', 'backupEnabled', 'patchMode'] },
    ];
    vmSections.forEach(section => {
      const sectionKeys = section.keys.filter(k => k in cfg);
      if (sectionKeys.length === 0) return;
      h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">${section.title}</span></div>`;
      sectionKeys.forEach(k => {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
          .replace(/\bV Tpm\b/, 'vTPM').replace(/\bIp\b/, 'IP').replace(/\bOs\b/, 'OS').replace(/\bVm\b/, 'VM').replace(/\bG B\b/, 'GB');
        if (cfg[k] === 'true' || cfg[k] === 'false') {
          h += `<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"><option value="true"${cfg[k] === 'true' ? ' selected' : ''}>Yes</option><option value="false"${cfg[k] === 'false' ? ' selected' : ''}>No</option></select></div>`;
        } else {
          h += `<div class="editor-row"><span class="editor-label">${label}</span><input class="input-field" value="${esc(cfg[k])}" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"></div>`;
        }
      });
    });
    // Show any remaining keys not in sections
    const allSectionKeys = vmSections.flatMap(s => s.keys);
    Object.keys(cfg).filter(k => !allSectionKeys.includes(k)).forEach(k => {
      h += `<div class="editor-row"><span class="editor-label">${k}</span><input class="input-field" value="${esc(cfg[k])}" onchange="window._updateResConfig('${obj.id}','${k}',this.value)"></div>`;
    });
  } else if (obj.type === 'udr') {
    // Route Table: structured routes editor (add/edit/delete), similar to DNS records
    const cfg = obj.config;
    h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">⚙️ Settings</span></div>
    <div class="editor-row"><span class="editor-label">Disable BGP Propagation</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','disableBgpRoutePropagation',this.value)"><option value="false"${(cfg.disableBgpRoutePropagation || 'false') === 'false' ? ' selected' : ''}>No</option><option value="true"${cfg.disableBgpRoutePropagation === 'true' ? ' selected' : ''}>Yes</option></select></div>
    <div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">Routes</span></div>`;
    const nextHopTypes = ['VirtualAppliance', 'VirtualNetworkGateway', 'VnetLocal', 'Internet', 'None'];
    (cfg.routes || []).forEach((route, idx) => {
      h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
        <input class="input-field" style="flex:1;min-width:80px;" placeholder="Route name" value="${esc(route.name)}" onchange="window._updateRoute('${obj.id}',${idx},'name',this.value)">
        <input class="input-field" style="flex:1;min-width:100px;" placeholder="Address prefix" value="${esc(route.addressPrefix)}" onchange="window._updateRoute('${obj.id}',${idx},'addressPrefix',this.value)">
        <select class="input-field" style="flex:1;min-width:110px;" onchange="window._updateRoute('${obj.id}',${idx},'nextHopType',this.value)">
          ${nextHopTypes.map(t => `<option value="${t}"${(route.nextHopType || 'VirtualAppliance') === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        ${(route.nextHopType || 'VirtualAppliance') === 'VirtualAppliance' ? `<input class="input-field" style="flex:1;min-width:100px;" placeholder="Next hop IP" value="${esc(route.nextHopIpAddress)}" onchange="window._updateRoute('${obj.id}',${idx},'nextHopIpAddress',this.value)">` : ''}
        <button class="icon-btn danger" onclick="window._deleteRoute('${obj.id}',${idx})">🗑</button>
      </div>`;
    });
    h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addRoute('${obj.id}')">➕ Add Route</button>`;
  } else if (obj.type !== 'pe') {
    h += renderConfigFields(obj.id, obj.config);
  } else if (obj.type === 'pe') {
    // For PE, render remaining config fields (target, groupId, etc.) skipping PE-specific fields
    // Note: Special PE UI (target selection, DNS recommendations) already rendered above
    h += renderConfigFields(obj.id, obj.config, k => !['targetResourceId', 'targetResourceName'].includes(k));
  }
  h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteResource('${obj.id}')">🗑 Delete Resource</button>`;
  return h;
}
