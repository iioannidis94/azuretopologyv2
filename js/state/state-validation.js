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

export { REQUIRED_FIELDS, IMPORT_MAPPINGS };

// ================================================================
// VALIDATION FUNCTIONS
// ================================================================

/**
 * Validates a single resource configuration and returns validation status
 * @param {Object} resource - Resource object with id, type, name, config
 * @returns {Object} - { status: 'complete'|'warnings'|'errors', errors: [], warnings: [] }
 */
export function validateResource(resource) {
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

  // Determine overall status
  if (result.errors.length > 0) {
    result.status = 'errors';
  } else if (result.warnings.length > 0) {
    result.status = 'warnings';
  }

  return result;
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
    const validation = validateResource(resource);
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
