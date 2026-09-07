// ================================================================
// EDITOR: SUBNET/VNET RESOURCE (typeObj === 'resource')
// Renders the right-side properties panel for resources placed inside
// a subnet (VMs, NSGs, Route Tables, Private Endpoints, etc.)
// ================================================================
import { esc, RES_TYPES, AZURE_ICON_BASE, getAllDiagramResources } from '../../state-management.js';

function _renderBoolSelect(handler, value) {
  return `<select class="input-field" onchange="${handler}"><option value="true"${value === 'true' ? ' selected' : ''}>Yes</option><option value="false"${value === 'false' ? ' selected' : ''}>No</option></select>`;
}

function _renderRbacSection(obj) {
  const assignments = obj.config.rbacAssignments || [];
  const candidates = getAllDiagramResources().filter(r => r.id !== obj.id);
  let h = `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔐 RBAC Assignments</span></div>`;
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

function _getWafPolicyResources() {
  return getAllDiagramResources().filter(r => r.type === 'wafPolicy');
}

function _renderWafPolicyPicker(obj, key = 'wafPolicy', label = 'WAF Policy') {
  const wafPolicies = _getWafPolicyResources();
  const selected = obj.config?.[key] || '';
  let options = `<option value="">-- None --</option>`;
  options += wafPolicies.map(policy => `<option value="${policy.id}"${selected === policy.id ? ' selected' : ''}>${esc(policy.name)}</option>`).join('');
  if (selected && !wafPolicies.some(policy => policy.id === selected)) {
    options += `<option value="${esc(selected)}" selected>${esc(selected)} (legacy)</option>`;
  }
  return `<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','${key}',this.value)">${options}</select></div>`;
}

function _renderKeyVaultSection(obj) {
  const secrets = obj.config.secrets || [];
  const keys = obj.config.keys || [];
  const certificates = obj.config.certificates || [];
  let h = `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🔑 Key Vault Contents</span></div>`;
  h += `<div style="font-size:10px;color:var(--muted);margin-bottom:6px;">Model metadata only; provide secret values securely during deployment.</div>`;

  h += `<div class="editor-row" style="margin-top:6px;"><span class="editor-label" style="font-weight:bold;">Secrets</span></div>`;
  secrets.forEach((secret, idx) => {
    h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Secret name" value="${esc(secret.name)}" onchange="window._updateKeyVaultSecret('${obj.id}',${idx},'name',this.value)">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Content type" value="${esc(secret.contentType || '')}" onchange="window._updateKeyVaultSecret('${obj.id}',${idx},'contentType',this.value)">
      <input class="input-field" style="flex:1;min-width:130px;" placeholder="Value source / note" value="${esc(secret.valueSource || '')}" onchange="window._updateKeyVaultSecret('${obj.id}',${idx},'valueSource',this.value)">
      ${_renderBoolSelect(`window._updateKeyVaultSecret('${obj.id}',${idx},'enabled',this.value)`, secret.enabled || 'true')}
      <input class="input-field" style="flex:1;min-width:120px;" placeholder="Expires on" value="${esc(secret.expiresOn || '')}" onchange="window._updateKeyVaultSecret('${obj.id}',${idx},'expiresOn',this.value)">
      <button class="icon-btn danger" onclick="window._deleteKeyVaultSecret('${obj.id}',${idx})">🗑</button>
    </div>`;
  });
  h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addKeyVaultSecret('${obj.id}')">➕ Add Secret</button>`;

  h += `<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">Keys</span></div>`;
  keys.forEach((key, idx) => {
    h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Key name" value="${esc(key.name)}" onchange="window._updateKeyVaultKey('${obj.id}',${idx},'name',this.value)">
      <select class="input-field" style="min-width:110px;" onchange="window._updateKeyVaultKey('${obj.id}',${idx},'keyType',this.value)">
        ${['RSA', 'RSA-HSM', 'EC', 'EC-HSM'].map(type => `<option value="${type}"${(key.keyType || 'RSA') === type ? ' selected' : ''}>${type}</option>`).join('')}
      </select>
      <input class="input-field" style="width:90px;" placeholder="Key size" value="${esc(key.keySize || '')}" onchange="window._updateKeyVaultKey('${obj.id}',${idx},'keySize',this.value)">
      <input class="input-field" style="flex:1;min-width:160px;" placeholder="Key ops" value="${esc(key.keyOps || '')}" onchange="window._updateKeyVaultKey('${obj.id}',${idx},'keyOps',this.value)">
      ${_renderBoolSelect(`window._updateKeyVaultKey('${obj.id}',${idx},'enabled',this.value)`, key.enabled || 'true')}
      <button class="icon-btn danger" onclick="window._deleteKeyVaultKey('${obj.id}',${idx})">🗑</button>
    </div>`;
  });
  h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addKeyVaultKey('${obj.id}')">➕ Add Key</button>`;

  h += `<div class="editor-row" style="margin-top:10px;"><span class="editor-label" style="font-weight:bold;">Certificates</span></div>`;
  certificates.forEach((certificate, idx) => {
    h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Certificate name" value="${esc(certificate.name)}" onchange="window._updateKeyVaultCertificate('${obj.id}',${idx},'name',this.value)">
      <input class="input-field" style="flex:1;min-width:150px;" placeholder="Subject" value="${esc(certificate.subject || '')}" onchange="window._updateKeyVaultCertificate('${obj.id}',${idx},'subject',this.value)">
      <input class="input-field" style="flex:1;min-width:110px;" placeholder="Issuer" value="${esc(certificate.issuer || '')}" onchange="window._updateKeyVaultCertificate('${obj.id}',${idx},'issuer',this.value)">
      <input class="input-field" style="width:90px;" placeholder="Months" value="${esc(certificate.validityMonths || '')}" onchange="window._updateKeyVaultCertificate('${obj.id}',${idx},'validityMonths',this.value)">
      ${_renderBoolSelect(`window._updateKeyVaultCertificate('${obj.id}',${idx},'enabled',this.value)`, certificate.enabled || 'true')}
      <button class="icon-btn danger" onclick="window._deleteKeyVaultCertificate('${obj.id}',${idx})">🗑</button>
    </div>`;
  });
  h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addKeyVaultCertificate('${obj.id}')">➕ Add Certificate</button>`;
  return h;
}

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
  } else if (obj.type === 'agw') {
    const cfg = obj.config || {};
    const agwSku = cfg.sku || 'WAF_v2';
    const isWafSku = agwSku.toUpperCase().includes('WAF');
    h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">⚙️ Gateway SKU</span></div>
      <div class="editor-row"><span class="editor-label">SKU</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','sku',this.value);window._updateResConfig('${obj.id}','tier',this.value)">
        ${['Standard_v2', 'WAF_v2'].map(sku => `<option value="${sku}"${agwSku === sku ? ' selected' : ''}>${sku}</option>`).join('')}
      </select></div>
      <div class="editor-row"><span class="editor-label">Capacity</span><input class="input-field" value="${esc(cfg.capacity || '2')}" onchange="window._updateResConfig('${obj.id}','capacity',this.value)"></div>
      <div class="editor-row"><span class="editor-label">SSL Policy</span><input class="input-field" value="${esc(cfg.sslPolicy || 'AppGwSslPolicy20220101')}" onchange="window._updateResConfig('${obj.id}','sslPolicy',this.value)"></div>
      <div class="editor-row"><span class="editor-label">HTTP Listeners</span><input class="input-field" value="${esc(cfg.httpListeners || 'HTTP:80')}" onchange="window._updateResConfig('${obj.id}','httpListeners',this.value)"></div>`;
    if (isWafSku) {
      h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🛡️ WAF Controls</span></div>`;
      h += `<div class="editor-row"><span class="editor-label">WAF Mode</span><select class="input-field" onchange="window._updateResConfig('${obj.id}','wafMode',this.value)"><option value="Detection"${(cfg.wafMode || 'Prevention') === 'Detection' ? ' selected' : ''}>Detection</option><option value="Prevention"${(cfg.wafMode || 'Prevention') === 'Prevention' ? ' selected' : ''}>Prevention</option></select></div>`;
      h += _renderWafPolicyPicker(obj, 'wafPolicy', 'WAF Policy Resource');
    }
    h += `<div style="margin-top:10px;padding:4px 0;border-top:1px solid var(--border);"><span style="font-size:10px;font-weight:bold;color:var(--muted);font-family:JetBrains Mono;">🎯 Backend Pools</span></div>`;
    (cfg.backendPools || []).forEach((pool, idx) => {
      h += `<div class="editor-row" style="gap:4px;flex-wrap:wrap;border:1px solid var(--border);border-radius:4px;padding:6px;margin-bottom:4px;">
        <input class="input-field" style="flex:1;min-width:110px;" placeholder="Pool name" value="${esc(pool.name || '')}" onchange="window._updateAgwBackendPool('${obj.id}',${idx},'name',this.value)">
        <input class="input-field" style="flex:2;min-width:150px;" placeholder="Targets (IPs/FQDN comma-separated)" value="${esc(pool.targets || '')}" onchange="window._updateAgwBackendPool('${obj.id}',${idx},'targets',this.value)">
        <button class="icon-btn danger" onclick="window._deleteAgwBackendPool('${obj.id}',${idx})">🗑</button>
      </div>`;
    });
    h += `<button style="width:100%;padding:6px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--azure-blue);background:transparent;color:var(--azure-blue);font-family:JetBrains Mono;margin-top:4px;" onclick="window._addAgwBackendPool('${obj.id}')">➕ Add Backend Pool</button>`;
    h += _renderRbacSection(obj);
  } else if (obj.type === 'kv') {
    h += renderConfigFields(obj.id, obj.config, k => !['secrets', 'keys', 'certificates', 'rbacAssignments'].includes(k));
    h += _renderKeyVaultSection(obj);
    h += _renderRbacSection(obj);
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
    h += _renderRbacSection(obj);
  } else if (obj.type !== 'pe') {
    h += renderConfigFields(obj.id, obj.config, k => !['rbacAssignments', 'wafPolicy'].includes(k));
    if (['fw', 'lb', 'afd'].includes(obj.type)) {
      h += _renderWafPolicyPicker(obj, 'wafPolicy');
    }
    h += _renderRbacSection(obj);
  } else if (obj.type === 'pe') {
    // For PE, render remaining config fields (target, groupId, etc.) skipping PE-specific fields
    // Note: Special PE UI (target selection, DNS recommendations) already rendered above
    h += renderConfigFields(obj.id, obj.config, k => !['targetResourceId', 'targetResourceName'].includes(k));
    h += _renderRbacSection(obj);
  }
  h += `<button style="width:100%;padding:8px;border-radius:4px;cursor:pointer;font-size:10px;border:1px dashed var(--danger);background:transparent;color:var(--danger);font-family:JetBrains Mono;margin-top:10px;transition:0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='transparent';this.style.color='var(--danger)'" onclick="window._deleteResource('${obj.id}')">🗑 Delete Resource</button>`;
  return h;
}
