import { esc, RES_TYPES } from '../../state-management.js';

const FIELD_LABEL_OVERRIDES = {
  os: 'OS',
  osType: 'OS Type',
  appServicePlanSku: 'App Service Plan SKU',
  minTlsVersion: 'Min TLS Version',
  dnsServiceIp: 'DNS Service IP',
  vTpmEnabled: 'vTPM Enabled',
  sku: 'SKU',
  vnetType: 'VNet Type'
};

const COMMON_FIELD_OPTIONS = {
  minTlsVersion: ['1.0', '1.1', '1.2', '1.3'],
  publicNetworkAccess: ['Enabled', 'Disabled', 'enabled', 'disabled'],
  networkPlugin: ['azure', 'kubenet'],
  replication: ['LRS', 'ZRS', 'GRS', 'RAGRS', 'GZRS', 'RAGZRS']
};

function toLabel(key) {
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/\bIp\b/g, 'IP')
    .replace(/\bSku\b/g, 'SKU')
    .replace(/\bTls\b/g, 'TLS')
    .replace(/\bDns\b/g, 'DNS')
    .replace(/\bVnet\b/g, 'VNet')
    .replace(/\bOs\b/g, 'OS')
    .replace(/\bGb\b/g, 'GB');
}

function renderSelect(objId, key, value, options) {
  const rendered = (options || []).map(opt => {
    const optVal = typeof opt === 'string' ? opt : opt.value;
    const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
    return `<option value="${esc(optVal)}"${String(value) === String(optVal) ? ' selected' : ''}>${esc(optLabel)}</option>`;
  }).join('');
  return `<select class="input-field" onchange="window._updateResConfig('${objId}','${key}',this.value)">${rendered}</select>`;
}

export function renderConfigFields(resource, filterFn = null) {
  const objId = resource?.id;
  const config = resource?.config || {};
  if (!objId) return '';
  const typeOptions = RES_TYPES[resource.type]?.fieldOptions || {};
  let html = '';

  Object.keys(config).forEach(k => {
    if (filterFn && !filterFn(k)) return;
    if (Array.isArray(config[k]) || (config[k] && typeof config[k] === 'object')) return;
    const label = toLabel(k);
    const value = config[k] ?? '';
    const schema = typeOptions[k];
    const options = schema?.options || COMMON_FIELD_OPTIONS[k];

    if (Array.isArray(options) && options.length > 0) {
      html += `<div class="editor-row"><span class="editor-label">${label}</span>${renderSelect(objId, k, value, options)}</div>`;
      return;
    }
    if (value === 'true' || value === 'false') {
      html += `<div class="editor-row"><span class="editor-label">${label}</span><select class="input-field" onchange="window._updateResConfig('${objId}','${k}',this.value)"><option value="true"${value === 'true' ? ' selected' : ''}>Yes</option><option value="false"${value === 'false' ? ' selected' : ''}>No</option></select></div>`;
      return;
    }
    const inputType = schema?.type === 'number' ? 'number' : 'text';
    html += `<div class="editor-row"><span class="editor-label">${label}</span><input type="${inputType}" class="input-field" value="${esc(value)}" onchange="window._updateResConfig('${objId}','${k}',this.value)"></div>`;
  });

  return html;
}
