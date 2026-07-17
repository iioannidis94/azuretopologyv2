// ================================================================
// STATE VALIDATION MODULE
// Provides validation for Azure resource deployability
// ================================================================

import { RES_TYPES } from './resource-types.js';

// ================================================================
// REQUIRED FIELDS FOR AZURE DEPLOYMENT
// Fields marked as 'critical' will cause deployment failures
// Fields marked as 'warning' should be reviewed but may work with defaults
// ================================================================
export const REQUIRED_FIELDS = {
  vm: {
    critical: ['size', 'os'],
    warning: ['osDiskType', 'osDiskSizeGB']
  },
  vmss: {
    critical: ['size', 'instances'],
    warning: ['minInstances', 'maxInstances', 'zones']
  },
  aks: {
    critical: ['nodes', 'version', 'nodeSize'],
    warning: ['networkPlugin', 'podCidr', 'serviceCidr']
  },
  fa: {
    critical: ['runtime', 'runtimeVersion', 'storageAccountName'],
    warning: ['plan', 'osType']
  },
  aca: {
    critical: ['image', 'environmentName'],
    warning: ['cpu', 'memory', 'targetPort']
  },
  fw: {
    critical: ['sku'],
    warning: ['threatIntelMode', 'availabilityZones']
  },
  nva: {
    critical: ['vendor', 'size'],
    warning: ['mode', 'version', 'licenseType']
  },
  agw: {
    critical: ['sku', 'capacity'],
    warning: ['tier', 'sslPolicy']
  },
  lb: {
    critical: ['sku', 'type'],
    warning: ['healthProbe']
  },
  gw: {
    critical: ['sku', 'vpnType'],
    warning: ['generation', 'bgpAsn']
  },
  ergw: {
    critical: ['sku'],
    warning: ['expressRouteCircuitId']
  },
  bas: {
    critical: ['sku'],
    warning: ['scaleUnits']
  },
  afd: {
    critical: ['sku'],
    warning: ['endpoints', 'originGroups']
  },
  pe: {
    critical: ['target', 'groupId'],
    warning: ['targetResourceId', 'privateDnsZoneId']
  },
  dns: {
    critical: ['zone'],
    warning: ['vnetLinks']
  },
  publicDns: {
    critical: ['zone'],
    warning: []
  },
  nsg: {
    critical: [],
    warning: ['rules']
  },
  udr: {
    critical: [],
    warning: ['routes']
  },
  natgw: {
    critical: ['sku'],
    warning: ['publicIpName', 'idleTimeoutMinutes']
  },
  asg: {
    critical: [],
    warning: ['description']
  },
  pip: {
    critical: ['sku', 'allocationMethod'],
    warning: ['tier', 'domainNameLabel']
  },
  sql: {
    critical: ['serverName', 'tier'],
    warning: ['vcores', 'maxSizeGB', 'collation']
  },
  cosmos: {
    critical: ['api'],
    warning: ['consistencyLevel', 'maxRU']
  },
  sa: {
    critical: ['replication', 'kind'],
    warning: ['tier', 'accessTier']
  },
  redis: {
    critical: ['sku'],
    warning: ['capacity', 'zones']
  },
  adls: {
    critical: ['tier', 'replication'],
    warning: ['hierarchicalNamespace']
  },
  kv: {
    critical: ['sku'],
    warning: ['softDeleteDays', 'purgeProtection']
  },
  app: {
    critical: ['appServicePlanSku', 'runtime'],
    warning: ['appServicePlanName', 'runtimeVersion']
  },
  apim: {
    critical: ['tier', 'publisherName', 'publisherEmail'],
    warning: ['capacity']
  },
  sb: {
    critical: ['tier'],
    warning: ['messagingUnits', 'zoneRedundant']
  },
  evh: {
    critical: ['plan'],
    warning: ['throughputUnits', 'partitions']
  },
  logic: {
    critical: ['plan'],
    warning: ['triggerType', 'storageAccountName']
  },
  foundry: {
    critical: ['sku', 'kind'],
    warning: ['customSubdomain']
  },
  openai: {
    critical: ['model', 'deploymentName'],
    warning: ['capacity', 'modelVersion']
  },
  monitor: {
    critical: ['workspaceSku'],
    warning: ['retentionDays']
  }
};

// ================================================================
// AZURE PROPERTY → CONFIG MAPPINGS
// Maps Azure API response properties to internal config keys
// ================================================================
export const IMPORT_MAPPINGS = {
  vm: {
    'properties.hardwareProfile.vmSize': 'size',
    'properties.storageProfile.osDisk.diskSizeGB': 'osDiskSizeGB',
    'properties.storageProfile.osDisk.managedDisk.storageAccountType': 'osDiskType',
    'properties.storageProfile.dataDisks.length': 'dataDisks',
    'properties.osProfile.linuxConfiguration': { key: 'os', value: 'Ubuntu 22.04' },
    'properties.osProfile.windowsConfiguration': { key: 'os', value: 'Windows Server 2022' },
    'zones[0]': 'availabilityZone',
    'properties.networkProfile.networkInterfaceConfigurations[0].properties.enableAcceleratedNetworking': 'acceleratedNetworking',
    'identity.type': 'managedIdentity'
  },
  vmss: {
    'sku.name': 'size',
    'sku.capacity': 'instances',
    'properties.upgradePolicy.mode': 'upgradePolicy',
    'zones': 'zones',
    'properties.virtualMachineProfile.osProfile.linuxConfiguration': { key: 'os', value: 'Ubuntu 22.04' },
    'properties.virtualMachineProfile.osProfile.windowsConfiguration': { key: 'os', value: 'Windows Server 2022' }
  },
  aks: {
    'properties.kubernetesVersion': 'version',
    'properties.agentPoolProfiles[0].count': 'nodes',
    'properties.agentPoolProfiles[0].vmSize': 'nodeSize',
    'properties.networkProfile.networkPlugin': 'networkPlugin',
    'properties.networkProfile.podCidr': 'podCidr',
    'properties.networkProfile.serviceCidr': 'serviceCidr',
    'properties.networkProfile.dnsServiceIP': 'dnsServiceIp',
    'properties.apiServerAccessProfile.enablePrivateCluster': 'privateCluster',
    'sku.tier': 'tier'
  },
  fa: {
    'properties.siteConfig.linuxFxVersion': 'runtime',
    'properties.siteConfig.windowsFxVersion': 'runtime',
    'kind': { transform: (v) => v?.includes('functionapp') ? 'fa' : 'app' },
    'properties.siteConfig.alwaysOn': 'alwaysOn'
  },
  aca: {
    'properties.template.containers[0].image': 'image',
    'properties.template.containers[0].resources.cpu': 'cpu',
    'properties.template.containers[0].resources.memory': 'memory',
    'properties.template.scale.minReplicas': 'minReplicas',
    'properties.template.scale.maxReplicas': 'replicas',
    'properties.configuration.ingress.targetPort': 'targetPort',
    'properties.configuration.ingress.external': { key: 'ingress', transform: (v) => v ? 'external' : 'internal' },
    'properties.managedEnvironmentId': { key: 'environmentName', transform: (v) => v?.split('/').pop() || '' }
  },
  fw: {
    'sku.tier': 'sku',
    'properties.threatIntelMode': 'threatIntelMode',
    'properties.additionalProperties.Network.DNS.EnableProxy': 'dnsProxy',
    'zones': { key: 'availabilityZones', transform: (v) => Array.isArray(v) ? v.join(',') : v }
  },
  agw: {
    'sku.name': 'sku',
    'sku.tier': 'tier',
    'sku.capacity': 'capacity',
    'properties.sslPolicy.policyName': 'sslPolicy'
  },
  lb: {
    'sku.name': 'sku',
    'properties.frontendIPConfigurations[0].properties.privateIPAllocationMethod': 'frontendIp',
    'properties.frontendIPConfigurations[0].properties.publicIPAddress': { key: 'type', value: 'Public' }
  },
  gw: {
    'sku.name': 'sku',
    'properties.vpnType': 'vpnType',
    'properties.vpnGatewayGeneration': 'generation',
    'properties.activeActive': 'activeActive',
    'properties.bgpSettings.asn': 'bgpAsn'
  },
  ergw: {
    'sku.name': 'sku',
    'properties.gatewayType': 'gatewayType'
  },
  bas: {
    'sku.name': 'sku',
    'properties.scaleUnits': 'scaleUnits',
    'properties.enableShareableLink': 'shareableLink',
    'properties.enableIpConnect': 'ipConnect',
    'properties.enableTunneling': 'tunneling'
  },
  afd: {
    'sku.name': { key: 'sku', transform: (v) => v?.replace('_AzureFrontDoor', '') || 'Premium' }
  },
  pe: {
    'properties.privateLinkServiceConnections[0].properties.groupIds[0]': 'groupId',
    'properties.privateLinkServiceConnections[0].properties.privateLinkServiceId': 'targetResourceId'
  },
  dns: {
    'name': 'zone',
    'properties.registrationEnabled': 'autoRegistration'
  },
  publicDns: {
    'name': 'zone'
  },
  nsg: {
    'properties.securityRules': { key: 'rules', transform: (rules) => JSON.stringify(rules?.map(r => ({
      name: r.name,
      priority: String(r.properties?.priority || 100),
      direction: r.properties?.direction || 'Inbound',
      access: r.properties?.access || 'Allow',
      protocol: r.properties?.protocol || 'Tcp',
      srcPort: r.properties?.sourcePortRange || '*',
      dstPort: r.properties?.destinationPortRange || '*',
      srcAddr: r.properties?.sourceAddressPrefix || '*',
      dstAddr: r.properties?.destinationAddressPrefix || '*'
    })) || []) }
  },
  udr: {
    'properties.disableBgpRoutePropagation': { key: 'disableBgpRoutePropagation', transform: (v) => v ? 'true' : 'false' },
    'properties.routes': { key: 'routes', transform: (routes) => (routes || []).map(r => ({
      name: r.name,
      addressPrefix: r.properties?.addressPrefix || '',
      nextHopType: r.properties?.nextHopType || 'VirtualAppliance',
      nextHopIpAddress: r.properties?.nextHopIpAddress || ''
    })) }
  },
  natgw: {
    'sku.name': 'sku',
    'properties.idleTimeoutInMinutes': { key: 'idleTimeoutMinutes', transform: (v) => String(v || 4) },
    'zones': { key: 'zones', transform: (z) => (z || []).join(',') }
  },
  asg: {
    'properties.description': 'description'
  },
  pip: {
    'sku.name': 'sku',
    'sku.tier': 'tier',
    'properties.publicIPAllocationMethod': 'allocationMethod',
    'zones': { key: 'zones', transform: (z) => (z || []).join(',') },
    'properties.dnsSettings.domainNameLabel': 'domainNameLabel'
  },
  sql: {
    'sku.tier': 'tier',
    'sku.capacity': 'vcores',
    'properties.maxSizeBytes': { key: 'maxSizeGB', transform: (v) => String(Math.round((v || 0) / 1073741824)) },
    'properties.collation': 'collation',
    'properties.zoneRedundant': 'zoneRedundant'
  },
  cosmos: {
    'kind': { key: 'api', transform: (v) => v === 'MongoDB' ? 'MongoDB' : 'NoSQL' },
    'properties.consistencyPolicy.defaultConsistencyLevel': 'consistencyLevel',
    'properties.enableFreeTier': 'enableFreeTier',
    'properties.capabilities': { key: 'serverless', transform: (v) => v?.some(c => c.name === 'EnableServerless') ? 'true' : 'false' }
  },
  sa: {
    'sku.name': { key: 'replication', transform: (v) => v?.split('_')[1] || 'ZRS' },
    'sku.tier': 'tier',
    'kind': 'kind',
    'properties.accessTier': 'accessTier',
    'properties.supportsHttpsTrafficOnly': 'httpsOnly',
    'properties.minimumTlsVersion': 'minTlsVersion'
  },
  redis: {
    'sku.name': { key: 'sku', transform: (v, resource) => `${v || 'Premium'} ${resource?.sku?.family || 'P'}1` },
    'sku.capacity': 'capacity',
    'properties.enableNonSslPort': 'enableNonSslPort',
    'properties.minimumTlsVersion': 'minTlsVersion',
    'zones': { key: 'zones', transform: (v) => Array.isArray(v) ? v.join(',') : '' },
    'properties.replicasPerPrimary': 'replicasPerPrimary'
  },
  adls: {
    'sku.tier': 'tier',
    'sku.name': { key: 'replication', transform: (v) => v?.split('_')[1] || 'LRS' },
    'properties.isHnsEnabled': 'hierarchicalNamespace',
    'properties.blobServiceProperties.deleteRetentionPolicy.enabled': 'enableSoftDelete'
  },
  kv: {
    'properties.sku.name': 'sku',
    'properties.softDeleteRetentionInDays': 'softDeleteDays',
    'properties.enablePurgeProtection': 'purgeProtection',
    'properties.enableRbacAuthorization': 'enableRbacAuth',
    'properties.networkAcls.defaultAction': 'networkAcls'
  },
  app: {
    'properties.serverFarmId': { key: 'appServicePlanName', transform: (v) => v?.split('/').pop() || '' },
    'properties.siteConfig.linuxFxVersion': 'runtime',
    'properties.siteConfig.windowsFxVersion': 'runtime',
    'properties.siteConfig.alwaysOn': 'alwaysOn',
    'properties.httpsOnly': 'httpsOnly',
    'properties.siteConfig.minTlsVersion': 'minTlsVersion',
    'identity.type': 'managedIdentity'
  },
  apim: {
    'sku.name': 'tier',
    'sku.capacity': 'capacity',
    'properties.publisherName': 'publisherName',
    'properties.publisherEmail': 'publisherEmail',
    'properties.virtualNetworkType': 'vnetType'
  },
  sb: {
    'sku.name': 'tier',
    'sku.capacity': 'messagingUnits',
    'properties.zoneRedundant': 'zoneRedundant'
  },
  evh: {
    'sku.name': 'plan',
    'sku.capacity': 'throughputUnits',
    'properties.kafkaEnabled': 'kafkaEnabled'
  },
  logic: {
    'sku.name': 'plan',
    'properties.state': 'state'
  },
  foundry: {
    'sku.name': 'sku',
    'kind': 'kind',
    'properties.customSubDomainName': 'customSubdomain',
    'properties.networkAcls.defaultAction': 'networkRules'
  },
  openai: {
    'properties.deployments[0].properties.model.name': 'model',
    'properties.deployments[0].name': 'deploymentName',
    'properties.deployments[0].sku.capacity': 'capacity',
    'properties.deployments[0].properties.model.version': 'modelVersion'
  },
  monitor: {
    'properties.sku.name': 'workspaceSku',
    'properties.retentionInDays': 'retentionDays',
    'properties.workspaceCapping.dailyQuotaGb': 'dailyCapGB'
  }
};

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

  const defaultConfig = JSON.parse(JSON.stringify(typeDef.config));
  const existingConfig = resource.config || {};

  // Merge: existing values override defaults
  resource.config = { ...defaultConfig, ...existingConfig };
  
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
