// ================================================================
// STATE VALIDATION MODULE
// Provides validation for Azure resource deployability
// ================================================================

import {
  IMPORT_MAPPINGS,
  REQUIRED_FIELDS,
  RES_TYPES,
  mergeResourceConfigWithDefaults
} from './resources/index.js';
import { state as currentState } from './state-core.js';

export { REQUIRED_FIELDS, IMPORT_MAPPINGS };

// ================================================================
// VALIDATION FUNCTIONS
// ================================================================

/**
 * Validates a single resource configuration and returns validation status
 * @param {Object} resource - Resource object with id, type, name, config
 * @returns {Object} - { status: 'complete'|'warnings'|'errors', errors: [], warnings: [] }
 */
export function validateResource(resource, options = {}) {
  const result = { status: 'complete', errors: [], warnings: [] };
  
  if (!resource || !resource.type) {
    result.status = 'errors';
    result.errors.push('Invalid resource: missing type');
    return result;
  }

  const typeDef = RES_TYPES[resource.type];
  if (!typeDef) {
    result.status = 'warnings';
    result.warnings.push(`Unknown resource type: ${resource.type}`);
    return result;
  }

  const config = resource.config || {};
  const required = REQUIRED_FIELDS[resource.type] || { critical: [], warning: [] };
  const criticalFields = required.critical || [];
  const warningFields = required.warning || [];

  // Check critical fields
  for (const field of criticalFields) {
    const value = config[field];
    if (value === undefined || value === null || value === '' || value === '<REQUIRED>') {
      result.errors.push(`Missing required field: ${field}`);
    }
  }

  // Check warning fields
  for (const field of warningFields) {
    const value = config[field];
    if (value === undefined || value === null || value === '') {
      result.warnings.push(`Optional field not set: ${field}`);
    }
  }

  _applyDependencyValidation(resource, options.state || currentState, result);

  // Determine overall status
  if (result.errors.length > 0) {
    result.status = 'errors';
  } else if (result.warnings.length > 0) {
    result.status = 'warnings';
  }

  return result;
}

function _pushUnique(list, message) {
  if (message && !list.includes(message)) list.push(message);
}

function _getAllResources(diagramState) {
  const vnetResources = [diagramState?.hub, ...(diagramState?.spokes || [])]
    .filter(Boolean)
    .flatMap(vnet => (vnet.subnets || []).flatMap(subnet => subnet.resources || []));
  return [...vnetResources, ...(diagramState?.rgResources || [])];
}

function _findPlacement(resource, diagramState) {
  if (!resource?.id || !diagramState) return {};

  for (const vnet of [diagramState.hub, ...(diagramState.spokes || [])].filter(Boolean)) {
    for (const subnet of (vnet.subnets || [])) {
      const found = (subnet.resources || []).find(r => r.id === resource.id);
      if (found) return { vnet, subnet };
    }
  }

  const rgResource = (diagramState.rgResources || []).find(r => r.id === resource.id);
  if (rgResource) {
    const resourceGroup = (diagramState.resourceGroups || []).find(rg => rg.id === rgResource.rgId);
    return { resourceGroup, isRgLevel: true };
  }

  return {};
}

function _hasSubnet(vnet, subnetName) {
  return (vnet?.subnets || []).some(sn => (sn.name || '').toLowerCase() === subnetName.toLowerCase());
}

function _findResourceById(diagramState, id) {
  return _getAllResources(diagramState).find(r => r.id === id) || null;
}

function _findResourceByName(diagramState, name, allowedTypes = []) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  return _getAllResources(diagramState).find(r => {
    if ((r.name || '').toLowerCase() !== lowerName) return false;
    return allowedTypes.length === 0 || allowedTypes.includes(r.type);
  }) || null;
}

function _validateSubnetAssociation(subnet, assocKey, expectedType, label, diagramState, result) {
  const ref = subnet?.[assocKey];
  if (!ref) return;
  const target = _findResourceById(diagramState, ref);
  if (!target) {
    _pushUnique(result.errors, `Subnet association "${label}" points to a missing resource: ${ref}`);
    return;
  }
  if (target.type !== expectedType) {
    _pushUnique(result.errors, `Subnet association "${label}" must reference a ${expectedType} resource`);
  }
}

function _applyDependencyValidation(resource, diagramState, result) {
  if (!diagramState || !resource?.type) return;

  const placement = _findPlacement(resource, diagramState);
  const config = resource.config || {};
  const rbacAssignments = Array.isArray(config.rbacAssignments) ? config.rbacAssignments : [];

  rbacAssignments.forEach((assignment, idx) => {
    const principalLabel = assignment.principalName || assignment.principalObjectId || assignment.principalResourceId || `assignment #${idx + 1}`;
    if (!assignment.roleDefinitionName) {
      _pushUnique(result.warnings, `RBAC ${principalLabel} is missing roleDefinitionName`);
    }
    if (!assignment.principalResourceId && !assignment.principalName && !assignment.principalObjectId) {
      _pushUnique(result.warnings, `RBAC ${principalLabel} is missing a linked resource or principal reference`);
    }
    if (assignment.principalResourceId) {
      const principalResource = _findResourceById(diagramState, assignment.principalResourceId);
      if (!principalResource) {
        _pushUnique(result.warnings, `RBAC principalResourceId does not match a resource in the diagram: ${assignment.principalResourceId}`);
      }
    }
  });

  if (placement.subnet) {
    _validateSubnetAssociation(placement.subnet, 'nsgId', 'nsg', 'nsgId', diagramState, result);
    _validateSubnetAssociation(placement.subnet, 'routeTableId', 'udr', 'routeTableId', diagramState, result);
    _validateSubnetAssociation(placement.subnet, 'natGatewayId', 'natgw', 'natGatewayId', diagramState, result);
  }

  switch (resource.type) {
    case 'fw':
      if (placement.vnet && !_hasSubnet(placement.vnet, 'AzureFirewallSubnet')) {
        _pushUnique(result.errors, 'Azure Firewall requires a subnet named AzureFirewallSubnet in the same VNet');
      }
      break;
    case 'bas':
      if (placement.vnet && !_hasSubnet(placement.vnet, 'AzureBastionSubnet')) {
        _pushUnique(result.errors, 'Azure Bastion requires a subnet named AzureBastionSubnet in the same VNet');
      }
      break;
    case 'gw':
    case 'ergw':
      if (placement.vnet && !_hasSubnet(placement.vnet, 'GatewaySubnet')) {
        _pushUnique(result.errors, `${RES_TYPES[resource.type]?.label || resource.type} requires a subnet named GatewaySubnet in the same VNet`);
      }
      break;
    case 'pe': {
      if (!config.targetResourceId) {
        _pushUnique(result.errors, 'Private Endpoint requires targetResourceId for export');
      } else {
        const targetResource = _findResourceById(diagramState, config.targetResourceId);
        if (!targetResource && !config.targetResourceId.startsWith('/subscriptions/')) {
          _pushUnique(result.warnings, `Private Endpoint targetResourceId does not match a resource in the diagram: ${config.targetResourceId}`);
        }
      }
      break;
    }
    case 'fa':
      if (config.storageAccountName && !_findResourceByName(diagramState, config.storageAccountName, ['sa', 'adls'])) {
        _pushUnique(result.warnings, `Function App storageAccountName "${config.storageAccountName}" is external or missing from the diagram`);
      }
      break;
    case 'natgw':
      if (config.publicIpName && !_findResourceByName(diagramState, config.publicIpName, ['pip'])) {
        _pushUnique(result.warnings, `NAT Gateway publicIpName "${config.publicIpName}" is external or missing from the diagram`);
      }
      break;
    case 'kv':
      if (Array.isArray(config.secrets)) {
        config.secrets.forEach((secret, idx) => {
          if (!secret.name) _pushUnique(result.warnings, `Key Vault secret #${idx + 1} is missing name`);
        });
      }
      if (Array.isArray(config.keys)) {
        config.keys.forEach((key, idx) => {
          if (!key.name) _pushUnique(result.warnings, `Key Vault key #${idx + 1} is missing name`);
        });
      }
      if (Array.isArray(config.certificates)) {
        config.certificates.forEach((certificate, idx) => {
          if (!certificate.name) _pushUnique(result.warnings, `Key Vault certificate #${idx + 1} is missing name`);
          if (certificate.name && !certificate.subject) _pushUnique(result.warnings, `Key Vault certificate "${certificate.name}" is missing subject`);
        });
      }
      break;
    case 'appi':
      if (config.workspaceResourceId) {
        const workspaceResource = _findResourceById(diagramState, config.workspaceResourceId);
        if (!workspaceResource && !config.workspaceResourceId.startsWith('/subscriptions/')) {
          _pushUnique(result.warnings, `Application Insights workspaceResourceId does not match a resource in the diagram: ${config.workspaceResourceId}`);
        } else if (workspaceResource && workspaceResource.type !== 'monitor') {
          _pushUnique(result.warnings, 'Application Insights workspaceResourceId should reference an Azure Monitor workspace resource');
        }
      }
      break;
    case 'dns':
    case 'publicDns':
      if (Array.isArray(config.records)) {
        config.records.forEach((record, idx) => {
          if (!record.name) _pushUnique(result.warnings, `${RES_TYPES[resource.type]?.label || resource.type} record #${idx + 1} is missing name`);
          if (!record.type) _pushUnique(result.warnings, `${RES_TYPES[resource.type]?.label || resource.type} record #${idx + 1} is missing type`);
          if (!record.value) _pushUnique(result.warnings, `${RES_TYPES[resource.type]?.label || resource.type} record #${idx + 1} is missing value`);
        });
      }
      if (resource.type !== 'dns') break;
      if (Array.isArray(config.vnetLinks)) {
        config.vnetLinks.forEach(link => {
          const linkedVnet = [diagramState.hub, ...(diagramState.spokes || [])]
            .filter(Boolean)
            .find(vnet => vnet.id === link.vnetId);
          if (!linkedVnet) {
            _pushUnique(result.errors, `Private DNS Zone has a VNet link to a missing VNet: ${link.vnetName || link.vnetId}`);
          }
        });
      }
      break;
    default:
      break;
  }
}

/**
 * Validates all resources in the diagram
 * @param {Object} state - The diagram state object
 * @returns {Object} - { totalResources, complete, warnings, errors, details: [{resource, validation}] }
 */
export function validateAllResources(state) {
  const result = {
    totalResources: 0,
    complete: 0,
    warnings: 0,
    errors: 0,
    details: []
  };

  // Helper to process resources
  const processResource = (resource, location) => {
    result.totalResources++;
    const validation = validateResource(resource, { state });
    result.details.push({
      resource: { ...resource, _location: location },
      validation
    });
    if (validation.status === 'complete') result.complete++;
    else if (validation.status === 'warnings') result.warnings++;
    else if (validation.status === 'errors') result.errors++;
  };

  // Process hub resources
  if (state.hub && state.hub.subnets) {
    state.hub.subnets.forEach(subnet => {
      (subnet.resources || []).forEach(res => {
        processResource(res, `Hub VNet / ${subnet.name}`);
      });
    });
  }

  // Process spoke resources
  (state.spokes || []).forEach(spoke => {
    (spoke.subnets || []).forEach(subnet => {
      (subnet.resources || []).forEach(res => {
        processResource(res, `${spoke.name} / ${subnet.name}`);
      });
    });
  });

  // Process RG-level resources
  (state.rgResources || []).forEach(res => {
    const rg = (state.resourceGroups || []).find(r => r.id === res.rgId);
    processResource(res, `RG: ${rg?.name || 'Unknown'}`);
  });

  return result;
}

/**
 * Normalizes a resource config by ensuring all fields from RES_TYPES are present
 * @param {Object} resource - Resource object
 * @returns {Object} - Resource with normalized config
 */
export function normalizeResourceConfig(resource) {
  if (!resource || !resource.type) return resource;
  
  const typeDef = RES_TYPES[resource.type];
  if (!typeDef || !typeDef.config) return resource;

  resource.config = mergeResourceConfigWithDefaults(resource.type, resource.config);
  
  return resource;
}

/**
 * Extracts config values from Azure resource properties using import mappings
 * @param {Object} azureResource - Raw Azure resource object
 * @param {string} type - Internal resource type key
 * @returns {Object} - Extracted config values
 */
export function extractConfigFromAzure(azureResource, type) {
  const mappings = IMPORT_MAPPINGS[type];
  if (!mappings) return {};

  const extracted = {};
  const props = azureResource.properties || azureResource.Properties || {};
  const sku = azureResource.sku || azureResource.Sku || {};

  for (const [path, mapping] of Object.entries(mappings)) {
    const value = getNestedValue(azureResource, path);
    
    if (value !== undefined && value !== null) {
      if (typeof mapping === 'string') {
        // Simple mapping: path → config key
        extracted[mapping] = String(value);
      } else if (typeof mapping === 'object') {
        if (mapping.transform) {
          // Transform function
          const transformed = mapping.transform(value, azureResource);
          if (mapping.key) {
            // Preserve arrays/objects as-is (e.g. route lists); only stringify scalars
            extracted[mapping.key] = (transformed !== null && typeof transformed === 'object') ? transformed : String(transformed);
          }
        } else if (mapping.value !== undefined) {
          // Static value when path exists
          extracted[mapping.key] = mapping.value;
        } else if (mapping.key) {
          extracted[mapping.key] = String(value);
        }
      }
    }
  }

  return extracted;
}

/**
 * Gets a nested value from an object using dot notation path
 * Supports array indexing like 'properties.items[0].name'
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Generates a validation summary string for export operations
 * @param {Object} validationResult - Result from validateAllResources
 * @returns {string} - Summary text
 */
export function generateValidationSummary(validationResult) {
  const lines = [];
  lines.push(`# Validation Summary`);
  lines.push(`# Total Resources: ${validationResult.totalResources}`);
  lines.push(`# Complete: ${validationResult.complete}`);
  lines.push(`# With Warnings: ${validationResult.warnings}`);
  lines.push(`# With Errors: ${validationResult.errors}`);
  
  if (validationResult.errors > 0) {
    lines.push(`#`);
    lines.push(`# ⚠ RESOURCES WITH ERRORS (may fail deployment):`);
    validationResult.details
      .filter(d => d.validation.status === 'errors')
      .forEach(d => {
        lines.push(`#   - ${d.resource.name} (${d.resource.type}): ${d.validation.errors.join(', ')}`);
      });
  }

  if (validationResult.warnings > 0) {
    lines.push(`#`);
    lines.push(`# ⚡ RESOURCES WITH WARNINGS (review before deployment):`);
    validationResult.details
      .filter(d => d.validation.warnings?.length > 0)
      .forEach(d => {
        lines.push(`#   - ${d.resource.name} (${d.resource.type}): ${d.validation.warnings.join(', ')}`);
      });
  }
  
  return lines.join('\n');
}

/**
 * Creates resource metadata object for tracking import source
 * @param {string} source - 'manual' | 'json-import' | 'inventory-import'
 * @param {Object} options - Additional metadata options
 * @returns {Object} - Metadata object
 */
export function createResourceMeta(source, options = {}) {
  return {
    source,
    importedAt: options.importedAt || new Date().toISOString(),
    originalId: options.originalId || null,
    warnings: options.warnings || [],
    validationStatus: options.validationStatus || 'pending'
  };
}

/**
 * Updates resource metadata with validation status
 * @param {Object} resource - Resource object
 * @returns {Object} - Resource with updated _meta
 */
export function updateResourceValidationMeta(resource) {
  const validation = validateResource(resource);
  if (!resource._meta) {
    resource._meta = createResourceMeta('manual');
  }
  resource._meta.validationStatus = validation.status;
  resource._meta.warnings = [...(resource._meta.warnings || []), ...validation.warnings];
  return resource;
}
