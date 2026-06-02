import { state, uid, fullUpdate } from './state-management.js';
import { RES_TYPES } from './state-management.js';

// ================================================================
// TEMPLATE CONFIG HELPER - Ensures all template resources have full configs
// ================================================================
/**
 * Merges partial config with full default config to ensure consistency.
 * This ensures template resources have the same config structure as manually created ones.
 */
function _mergeWithDefaults(type, partialConfig) {
  if (RES_TYPES[type] && RES_TYPES[type].config) {
    return { ...RES_TYPES[type].config, ...partialConfig };
  }
  return partialConfig || {};
}

// ================================================================
// TEMPLATE GALLERY - Architecture Templates
// ================================================================

const TEMPLATES = [
  {
    id: 'hub-spoke-basic',
    name: 'Hub & Spoke Basic',
    description: 'Classic hub-and-spoke network topology with Azure Firewall, VPN Gateway, and shared services in the hub. Two spoke VNets for workloads.',
    icon: '🌐',
    category: 'Networking',
    tags: ['networking', 'firewall', 'vpn'],
    thumbnail: 'hub-spoke'
  },
  {
    id: 'multi-region-dr',
    name: 'Multi-Region DR',
    description: 'Disaster recovery architecture with primary and secondary regions, Traffic Manager for failover, and geo-replicated databases.',
    icon: '🌍',
    category: 'High Availability',
    tags: ['dr', 'multi-region', 'failover'],
    thumbnail: 'multi-region'
  },
  {
    id: 'webapp-database',
    name: 'Web App + Database',
    description: 'Three-tier web application with App Service, Azure SQL, Redis Cache, Key Vault, and Application Gateway with WAF.',
    icon: '🖥️',
    category: 'Web Applications',
    tags: ['webapp', 'sql', 'redis', 'app-service'],
    thumbnail: 'webapp-db'
  },
  {
    id: 'aks-networking',
    name: 'AKS Networking',
    description: 'Production AKS cluster with Azure CNI networking, Application Gateway Ingress, Container Registry, Key Vault, and monitoring.',
    icon: '☸️',
    category: 'Containers',
    tags: ['kubernetes', 'aks', 'containers', 'microservices'],
    thumbnail: 'aks'
  },
  {
    id: 'landing-zone-caf',
    name: 'Landing Zone (CAF)',
    description: 'Cloud Adoption Framework landing zone with management, connectivity, and workload subscriptions following Microsoft best practices.',
    icon: '🏗️',
    category: 'Enterprise',
    tags: ['caf', 'landing-zone', 'enterprise', 'governance'],
    thumbnail: 'landing-zone'
  }
];

// ================================================================
// TEMPLATE DEFINITIONS
// ================================================================

function generateHubSpokeTemplate() {
  const hubId = uid();
  const spoke1Id = uid();
  const spoke2Id = uid();
  
  return {
    hub: {
      id: hubId, name: 'hub-vnet', cidr: '10.0.0.0/16', color: '#0078D4', rgId: 'rg-1',
      peerings: [spoke1Id, spoke2Id], peeringConfigs: {},
      subnets: [
        { id: uid(), name: 'AzureFirewallSubnet', cidr: '10.0.1.0/26', resources: [
          { id: uid(), name: 'hub-firewall', type: 'fw', config: { sku: 'Premium', threatIntelMode: 'Alert', dnsProxy: 'true', availabilityZones: '1,2,3' } }
        ]},
        { id: uid(), name: 'GatewaySubnet', cidr: '10.0.2.0/27', resources: [
          { id: uid(), name: 'hub-vpn-gw', type: 'gw', config: { sku: 'VpnGw2AZ', generation: 'Generation2', vpnType: 'RouteBased', activeActive: 'false', bgpAsn: '65515' } }
        ]},
        { id: uid(), name: 'AzureBastionSubnet', cidr: '10.0.3.0/26', resources: [
          { id: uid(), name: 'hub-bastion', type: 'bas', config: { sku: 'Standard', scaleUnits: '2', shareableLink: 'false', ipConnect: 'true', tunneling: 'true' } }
        ]},
        { id: uid(), name: 'SharedServicesSubnet', cidr: '10.0.4.0/24', resources: [
          { id: uid(), name: 'hub-keyvault', type: 'kv', config: { sku: 'Premium', softDeleteDays: '90', purgeProtection: 'true', enableRbacAuth: 'true', networkAcls: 'Deny' } },
          { id: uid(), name: 'hub-monitor', type: 'monitor', config: { retentionDays: '90', workspaceSku: 'PerGB2018' } }
        ]}
      ]
    },
    spokes: [
      {
        id: spoke1Id, name: 'spoke-workload-1', cidr: '10.1.0.0/16', color: '#00B294', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'app-subnet', cidr: '10.1.1.0/24', resources: [
            { id: uid(), name: 'web-app-01', type: 'app', config: { sku: 'P1v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'app-nsg', type: 'nsg', config: { rules: '[]' } }
          ]},
          { id: uid(), name: 'data-subnet', cidr: '10.1.2.0/24', resources: [
            { id: uid(), name: 'workload1-sql', type: 'sql', config: { vcores: '4', tier: 'GeneralPurpose', maxSizeGB: '32', zoneRedundant: 'false' } },
            { id: uid(), name: 'sql-pe', type: 'pe', config: { target: 'SQL', groupId: 'sqlServer' } }
          ]}
        ]
      },
      {
        id: spoke2Id, name: 'spoke-workload-2', cidr: '10.2.0.0/16', color: '#FF8C00', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'compute-subnet', cidr: '10.2.1.0/24', resources: [
            { id: uid(), name: 'vm-pool-01', type: 'vmss', config: { size: 'Standard_D2s_v3', instances: '3', minInstances: '2', maxInstances: '10', upgradePolicy: 'Rolling' } },
            { id: uid(), name: 'compute-nsg', type: 'nsg', config: { rules: '[]' } }
          ]},
          { id: uid(), name: 'storage-subnet', cidr: '10.2.2.0/24', resources: [
            { id: uid(), name: 'workload2-storage', type: 'sa', config: { replication: 'ZRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot' } }
          ]}
        ]
      }
    ]
  };
}

function generateMultiRegionDRTemplate() {
  const primaryId = uid();
  const secondaryId = uid();
  const hubId = uid();
  
  return {
    hub: {
      id: hubId, name: 'connectivity-hub', cidr: '10.0.0.0/16', color: '#0078D4', rgId: 'rg-1',
      peerings: [primaryId, secondaryId], peeringConfigs: {},
      subnets: [
        { id: uid(), name: 'AzureFirewallSubnet', cidr: '10.0.1.0/26', resources: [
          { id: uid(), name: 'central-firewall', type: 'fw', config: { sku: 'Premium', threatIntelMode: 'Alert', dnsProxy: 'true' } }
        ]},
        { id: uid(), name: 'traffic-mgmt', cidr: '10.0.2.0/24', resources: [
          { id: uid(), name: 'front-door-global', type: 'afd', config: { sku: 'Premium', endpoints: 'global-endpoint', wafPolicy: 'global-waf-policy' } }
        ]}
      ]
    },
    spokes: [
      {
        id: primaryId, name: 'primary-eastus', cidr: '10.1.0.0/16', color: '#00B294', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'app-tier', cidr: '10.1.1.0/24', resources: [
            { id: uid(), name: 'primary-app', type: 'app', config: { sku: 'P2v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'primary-func', type: 'fa', config: { plan: 'Premium', runtime: 'dotnet', runtimeVersion: '8.0' } }
          ]},
          { id: uid(), name: 'data-tier', cidr: '10.1.2.0/24', resources: [
            { id: uid(), name: 'primary-sql', type: 'sql', config: { vcores: '8', tier: 'BusinessCritical', maxSizeGB: '256', zoneRedundant: 'true', backupRetentionDays: '35' } },
            { id: uid(), name: 'primary-redis', type: 'redis', config: { sku: 'Premium P1', capacity: '2', replicasPerPrimary: '1' } },
            { id: uid(), name: 'primary-cosmos', type: 'cosmos', config: { api: 'NoSQL', consistencyLevel: 'Strong', geoReplication: 'true', maxRU: '10000' } }
          ]},
          { id: uid(), name: 'storage-tier', cidr: '10.1.3.0/24', resources: [
            { id: uid(), name: 'primary-storage', type: 'sa', config: { replication: 'GRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot' } }
          ]}
        ]
      },
      {
        id: secondaryId, name: 'secondary-westus', cidr: '10.2.0.0/16', color: '#FF8C00', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'app-tier', cidr: '10.2.1.0/24', resources: [
            { id: uid(), name: 'secondary-app', type: 'app', config: { sku: 'P2v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'secondary-func', type: 'fa', config: { plan: 'Premium', runtime: 'dotnet', runtimeVersion: '8.0' } }
          ]},
          { id: uid(), name: 'data-tier', cidr: '10.2.2.0/24', resources: [
            { id: uid(), name: 'secondary-sql', type: 'sql', config: { vcores: '8', tier: 'BusinessCritical', maxSizeGB: '256', zoneRedundant: 'true' } },
            { id: uid(), name: 'secondary-redis', type: 'redis', config: { sku: 'Premium P1', capacity: '1' } }
          ]},
          { id: uid(), name: 'storage-tier', cidr: '10.2.3.0/24', resources: [
            { id: uid(), name: 'secondary-storage', type: 'sa', config: { replication: 'LRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot' } }
          ]}
        ]
      }
    ]
  };
}

function generateWebAppDatabaseTemplate() {
  const hubId = uid();
  const appSpokeId = uid();
  
  return {
    hub: {
      id: hubId, name: 'shared-services', cidr: '10.0.0.0/16', color: '#0078D4', rgId: 'rg-1',
      peerings: [appSpokeId], peeringConfigs: {},
      subnets: [
        { id: uid(), name: 'waf-subnet', cidr: '10.0.1.0/24', resources: [
          { id: uid(), name: 'app-gateway-waf', type: 'agw', config: { sku: 'WAF_v2', capacity: '2', tier: 'WAF_v2', sslPolicy: 'AppGwSslPolicy20220101' } }
        ]},
        { id: uid(), name: 'security-subnet', cidr: '10.0.2.0/24', resources: [
          { id: uid(), name: 'app-keyvault', type: 'kv', config: { sku: 'Premium', softDeleteDays: '90', purgeProtection: 'true', enableRbacAuth: 'true', networkAcls: 'Deny' } },
          { id: uid(), name: 'kv-pe', type: 'pe', config: { target: 'KeyVault', groupId: 'vault' } }
        ]}
      ]
    },
    spokes: [
      {
        id: appSpokeId, name: 'webapp-vnet', cidr: '10.1.0.0/16', color: '#00BCF2', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'app-subnet', cidr: '10.1.1.0/24', resources: [
            { id: uid(), name: 'frontend-app', type: 'app', config: { sku: 'P2v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true', minTlsVersion: '1.2', managedIdentity: 'SystemAssigned' } },
            { id: uid(), name: 'api-app', type: 'app', config: { sku: 'P1v3', runtime: 'node', runtimeVersion: '20', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'app-nsg', type: 'nsg', config: { rules: '[]' } }
          ]},
          { id: uid(), name: 'data-subnet', cidr: '10.1.2.0/24', resources: [
            { id: uid(), name: 'app-sql-server', type: 'sql', config: { vcores: '4', tier: 'GeneralPurpose', maxSizeGB: '64', zoneRedundant: 'true', backupRetentionDays: '14' } },
            { id: uid(), name: 'sql-pe', type: 'pe', config: { target: 'SQL', groupId: 'sqlServer' } }
          ]},
          { id: uid(), name: 'cache-subnet', cidr: '10.1.3.0/24', resources: [
            { id: uid(), name: 'app-redis', type: 'redis', config: { sku: 'Premium P1', capacity: '1', enableNonSslPort: 'false', minTlsVersion: '1.2' } },
            { id: uid(), name: 'redis-pe', type: 'pe', config: { target: 'Redis', groupId: 'redisCache' } }
          ]},
          { id: uid(), name: 'storage-subnet', cidr: '10.1.4.0/24', resources: [
            { id: uid(), name: 'app-storage', type: 'sa', config: { replication: 'ZRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot', httpsOnly: 'true' } },
            { id: uid(), name: 'storage-pe', type: 'pe', config: { target: 'Storage', groupId: 'blob' } }
          ]}
        ]
      }
    ]
  };
}

function generateAKSNetworkingTemplate() {
  const hubId = uid();
  const aksSpokeId = uid();
  
  return {
    hub: {
      id: hubId, name: 'aks-hub', cidr: '10.0.0.0/16', color: '#0078D4', rgId: 'rg-1',
      peerings: [aksSpokeId], peeringConfigs: {},
      subnets: [
        { id: uid(), name: 'AzureFirewallSubnet', cidr: '10.0.1.0/26', resources: [
          { id: uid(), name: 'aks-firewall', type: 'fw', config: { sku: 'Premium', threatIntelMode: 'Alert', dnsProxy: 'true' } }
        ]},
        { id: uid(), name: 'ingress-subnet', cidr: '10.0.2.0/24', resources: [
          { id: uid(), name: 'aks-agw-ingress', type: 'agw', config: { sku: 'WAF_v2', capacity: '2', tier: 'WAF_v2' } }
        ]}
      ]
    },
    spokes: [
      {
        id: aksSpokeId, name: 'aks-vnet', cidr: '10.1.0.0/16', color: '#00BCF2', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'aks-nodes-subnet', cidr: '10.1.0.0/22', resources: [
            { id: uid(), name: 'production-aks', type: 'aks', config: { nodes: '5', version: '1.29', nodeSize: 'Standard_D4s_v3', networkPlugin: 'azure', podCidr: '10.244.0.0/16', serviceCidr: '10.100.0.0/16', dnsServiceIp: '10.100.0.10', privateCluster: 'true', tier: 'Standard' } }
          ]},
          { id: uid(), name: 'aks-internal-lb', cidr: '10.1.4.0/24', resources: [
            { id: uid(), name: 'internal-lb', type: 'lb', config: { sku: 'Standard', type: 'Internal', frontendIp: 'Dynamic' } },
            { id: uid(), name: 'aks-nsg', type: 'nsg', config: { rules: '[]' } }
          ]},
          { id: uid(), name: 'data-subnet', cidr: '10.1.5.0/24', resources: [
            { id: uid(), name: 'aks-keyvault', type: 'kv', config: { sku: 'Premium', softDeleteDays: '90', purgeProtection: 'true', enableRbacAuth: 'true', networkAcls: 'Deny' } },
            { id: uid(), name: 'kv-pe', type: 'pe', config: { target: 'KeyVault', groupId: 'vault' } },
            { id: uid(), name: 'aks-cosmos', type: 'cosmos', config: { api: 'NoSQL', consistencyLevel: 'Session', geoReplication: 'false', maxRU: '4000' } },
            { id: uid(), name: 'cosmos-pe', type: 'pe', config: { target: 'CosmosDB', groupId: 'Sql' } }
          ]},
          { id: uid(), name: 'monitoring-subnet', cidr: '10.1.6.0/24', resources: [
            { id: uid(), name: 'aks-monitor', type: 'monitor', config: { retentionDays: '90', workspaceSku: 'PerGB2018' } },
            { id: uid(), name: 'aks-storage', type: 'sa', config: { replication: 'ZRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot' } }
          ]}
        ]
      }
    ]
  };
}

function generateLandingZoneCAFTemplate() {
  const hubId = uid();
  const mgmtSpokeId = uid();
  const workload1Id = uid();
  const workload2Id = uid();
  
  return {
    hub: {
      id: hubId, name: 'connectivity-hub', cidr: '10.0.0.0/16', color: '#0078D4', rgId: 'rg-1',
      peerings: [mgmtSpokeId, workload1Id, workload2Id], peeringConfigs: {},
      subnets: [
        { id: uid(), name: 'AzureFirewallSubnet', cidr: '10.0.1.0/26', resources: [
          { id: uid(), name: 'caf-firewall', type: 'fw', config: { sku: 'Premium', threatIntelMode: 'Deny', dnsProxy: 'true', availabilityZones: '1,2,3' } }
        ]},
        { id: uid(), name: 'GatewaySubnet', cidr: '10.0.2.0/27', resources: [
          { id: uid(), name: 'expressroute-gw', type: 'ergw', config: { sku: 'ErGw2AZ', gatewayType: 'ExpressRoute' } }
        ]},
        { id: uid(), name: 'AzureBastionSubnet', cidr: '10.0.3.0/26', resources: [
          { id: uid(), name: 'caf-bastion', type: 'bas', config: { sku: 'Standard', scaleUnits: '2' } }
        ]},
        { id: uid(), name: 'dns-subnet', cidr: '10.0.4.0/24', resources: [
          { id: uid(), name: 'private-dns-resolver', type: 'dns', config: { zone: 'privatelink.blob.core.windows.net', fullZoneName: 'privatelink.blob.core.windows.net' }, rgLevel: true, dnsType: 'private' }
        ]}
      ]
    },
    spokes: [
      {
        id: mgmtSpokeId, name: 'management-vnet', cidr: '10.1.0.0/16', color: '#8764B8', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'monitoring-subnet', cidr: '10.1.1.0/24', resources: [
            { id: uid(), name: 'log-analytics', type: 'monitor', config: { retentionDays: '365', workspaceSku: 'PerGB2018', dailyCapGB: '10' } }
          ]},
          { id: uid(), name: 'security-subnet', cidr: '10.1.2.0/24', resources: [
            { id: uid(), name: 'mgmt-keyvault', type: 'kv', config: { sku: 'Premium', softDeleteDays: '90', purgeProtection: 'true', enableRbacAuth: 'true', networkAcls: 'Deny' } },
            { id: uid(), name: 'automation-storage', type: 'sa', config: { replication: 'GRS', kind: 'StorageV2', tier: 'Standard' } }
          ]}
        ]
      },
      {
        id: workload1Id, name: 'corp-workload-1', cidr: '10.2.0.0/16', color: '#00B294', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'app-subnet', cidr: '10.2.1.0/24', resources: [
            { id: uid(), name: 'corp-app-01', type: 'app', config: { sku: 'P2v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'corp-apim', type: 'apim', config: { tier: 'Premium', capacity: '1', vnetType: 'Internal' } }
          ]},
          { id: uid(), name: 'data-subnet', cidr: '10.2.2.0/24', resources: [
            { id: uid(), name: 'corp-sql', type: 'sql', config: { vcores: '8', tier: 'BusinessCritical', maxSizeGB: '128', zoneRedundant: 'true' } },
            { id: uid(), name: 'corp-sql-pe', type: 'pe', config: { target: 'SQL', groupId: 'sqlServer' } }
          ]}
        ]
      },
      {
        id: workload2Id, name: 'online-workload', cidr: '10.3.0.0/16', color: '#FF8C00', rgId: 'rg-1',
        peerings: [hubId], peeringConfigs: {},
        subnets: [
          { id: uid(), name: 'web-subnet', cidr: '10.3.1.0/24', resources: [
            { id: uid(), name: 'online-app', type: 'app', config: { sku: 'P1v3', runtime: 'node', runtimeVersion: '20', alwaysOn: 'true', httpsOnly: 'true' } },
            { id: uid(), name: 'online-func', type: 'fa', config: { plan: 'Premium', runtime: 'node', runtimeVersion: '20' } }
          ]},
          { id: uid(), name: 'integration-subnet', cidr: '10.3.2.0/24', resources: [
            { id: uid(), name: 'online-servicebus', type: 'sb', config: { tier: 'Premium', messagingUnits: '1', zoneRedundant: 'true' } },
            { id: uid(), name: 'online-eventhub', type: 'evh', config: { tier: 'Standard', throughputUnits: '2', partitions: '4' } }
          ]},
          { id: uid(), name: 'data-subnet', cidr: '10.3.3.0/24', resources: [
            { id: uid(), name: 'online-cosmos', type: 'cosmos', config: { api: 'NoSQL', consistencyLevel: 'Session', geoReplication: 'true', maxRU: '8000' } },
            { id: uid(), name: 'cosmos-pe', type: 'pe', config: { target: 'CosmosDB', groupId: 'Sql' } }
          ]}
        ]
      }
    ]
  };
}

// ================================================================
// TEMPLATE APPLICATION
// ================================================================

/**
 * Post-process template to ensure all resources have full default configs.
 * This ensures templates follow the same config consistency principle as manual creation and imports.
 */
function _ensureFullConfigsInTemplate(templateData) {
  const processVnet = (vnet) => {
    if (vnet.subnets) {
      vnet.subnets.forEach(subnet => {
        if (subnet.resources) {
          subnet.resources.forEach(res => {
            res.config = _mergeWithDefaults(res.type, res.config);
          });
        }
      });
    }
  };
  
  if (templateData.hub) processVnet(templateData.hub);
  if (templateData.spokes) {
    templateData.spokes.forEach(spoke => processVnet(spoke));
  }
  if (templateData.rgResources && Array.isArray(templateData.rgResources)) {
    templateData.rgResources.forEach(res => {
      res.config = _mergeWithDefaults(res.type, res.config);
    });
  }
  
  return templateData;
}

function applyTemplate(templateId) {
  let templateData;
  
  switch (templateId) {
    case 'hub-spoke-basic': templateData = generateHubSpokeTemplate(); break;
    case 'multi-region-dr': templateData = generateMultiRegionDRTemplate(); break;
    case 'webapp-database': templateData = generateWebAppDatabaseTemplate(); break;
    case 'aks-networking': templateData = generateAKSNetworkingTemplate(); break;
    case 'landing-zone-caf': templateData = generateLandingZoneCAFTemplate(); break;
    default: return;
  }
  
  // Ensure all template resources have full default configs
  templateData = _ensureFullConfigsInTemplate(templateData);
  
  // Apply template to state
  state.hub = templateData.hub;
  state.spokes = templateData.spokes;
  state.customPos = {};
  
  fullUpdate();
  closeTemplateGallery();
}

// ================================================================
// TEMPLATE GALLERY UI
// ================================================================

function renderTemplateThumbnail(template) {
  const colors = {
    'hub-spoke': ['#0078D4', '#00B294', '#FF8C00'],
    'multi-region': ['#0078D4', '#00B294', '#FF8C00'],
    'webapp-db': ['#0078D4', '#00BCF2'],
    'aks': ['#0078D4', '#00BCF2'],
    'landing-zone': ['#0078D4', '#8764B8', '#00B294', '#FF8C00']
  };
  
  const thumbColors = colors[template.thumbnail] || ['#0078D4'];
  
  let svg = `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="200" height="120" fill="var(--bg3)" rx="4"/>`;
  
  switch (template.thumbnail) {
    case 'hub-spoke':
      svg += `<circle cx="100" cy="60" r="20" fill="${thumbColors[0]}" opacity="0.8"/>`;
      svg += `<circle cx="50" cy="90" r="14" fill="${thumbColors[1]}" opacity="0.7"/>`;
      svg += `<circle cx="150" cy="90" r="14" fill="${thumbColors[2]}" opacity="0.7"/>`;
      svg += `<line x1="100" y1="60" x2="50" y2="90" stroke="${thumbColors[0]}" stroke-width="2" opacity="0.5"/>`;
      svg += `<line x1="100" y1="60" x2="150" y2="90" stroke="${thumbColors[0]}" stroke-width="2" opacity="0.5"/>`;
      svg += `<text x="100" y="64" text-anchor="middle" fill="white" font-size="10" font-weight="bold">HUB</text>`;
      break;
    case 'multi-region':
      svg += `<rect x="20" y="30" width="70" height="60" rx="6" fill="${thumbColors[1]}" opacity="0.3" stroke="${thumbColors[1]}" stroke-width="1"/>`;
      svg += `<rect x="110" y="30" width="70" height="60" rx="6" fill="${thumbColors[2]}" opacity="0.3" stroke="${thumbColors[2]}" stroke-width="1"/>`;
      svg += `<text x="55" y="55" text-anchor="middle" fill="${thumbColors[1]}" font-size="8" font-weight="bold">PRIMARY</text>`;
      svg += `<text x="145" y="55" text-anchor="middle" fill="${thumbColors[2]}" font-size="8" font-weight="bold">SECONDARY</text>`;
      svg += `<line x1="90" y1="60" x2="110" y2="60" stroke="${thumbColors[0]}" stroke-width="2" stroke-dasharray="4,2"/>`;
      svg += `<circle cx="100" cy="15" r="8" fill="${thumbColors[0]}" opacity="0.8"/>`;
      svg += `<line x1="100" y1="23" x2="55" y2="30" stroke="${thumbColors[0]}" stroke-width="1" opacity="0.5"/>`;
      svg += `<line x1="100" y1="23" x2="145" y2="30" stroke="${thumbColors[0]}" stroke-width="1" opacity="0.5"/>`;
      break;
    case 'webapp-db':
      svg += `<rect x="30" y="20" width="140" height="80" rx="6" fill="${thumbColors[1]}" opacity="0.15" stroke="${thumbColors[1]}" stroke-width="1"/>`;
      svg += `<rect x="45" y="35" width="40" height="25" rx="4" fill="${thumbColors[0]}" opacity="0.7"/>`;
      svg += `<rect x="115" y="35" width="40" height="25" rx="4" fill="#00B294" opacity="0.7"/>`;
      svg += `<rect x="80" y="75" width="40" height="20" rx="4" fill="#FF8C00" opacity="0.7"/>`;
      svg += `<text x="65" y="51" text-anchor="middle" fill="white" font-size="7">APP</text>`;
      svg += `<text x="135" y="51" text-anchor="middle" fill="white" font-size="7">SQL</text>`;
      svg += `<text x="100" y="88" text-anchor="middle" fill="white" font-size="7">CACHE</text>`;
      svg += `<line x1="85" y1="47" x2="115" y2="47" stroke="white" stroke-width="1" opacity="0.4"/>`;
      break;
    case 'aks':
      svg += `<rect x="40" y="25" width="120" height="75" rx="6" fill="${thumbColors[1]}" opacity="0.15" stroke="${thumbColors[1]}" stroke-width="1"/>`;
      svg += `<rect x="55" y="40" width="25" height="20" rx="3" fill="${thumbColors[0]}" opacity="0.7"/>`;
      svg += `<rect x="88" y="40" width="25" height="20" rx="3" fill="${thumbColors[0]}" opacity="0.7"/>`;
      svg += `<rect x="121" y="40" width="25" height="20" rx="3" fill="${thumbColors[0]}" opacity="0.7"/>`;
      svg += `<text x="100" y="85" text-anchor="middle" fill="${thumbColors[0]}" font-size="9" font-weight="bold">☸ AKS</text>`;
      svg += `<text x="67" y="53" text-anchor="middle" fill="white" font-size="6">POD</text>`;
      svg += `<text x="100" y="53" text-anchor="middle" fill="white" font-size="6">POD</text>`;
      svg += `<text x="133" y="53" text-anchor="middle" fill="white" font-size="6">POD</text>`;
      break;
    case 'landing-zone':
      svg += `<rect x="60" y="10" width="80" height="30" rx="4" fill="${thumbColors[0]}" opacity="0.7"/>`;
      svg += `<text x="100" y="29" text-anchor="middle" fill="white" font-size="7" font-weight="bold">CONNECTIVITY</text>`;
      svg += `<rect x="10" y="55" width="50" height="30" rx="4" fill="${thumbColors[1]}" opacity="0.6"/>`;
      svg += `<rect x="75" y="55" width="50" height="30" rx="4" fill="${thumbColors[2]}" opacity="0.6"/>`;
      svg += `<rect x="140" y="55" width="50" height="30" rx="4" fill="${thumbColors[3]}" opacity="0.6"/>`;
      svg += `<text x="35" y="73" text-anchor="middle" fill="white" font-size="6">MGMT</text>`;
      svg += `<text x="100" y="73" text-anchor="middle" fill="white" font-size="6">CORP</text>`;
      svg += `<text x="165" y="73" text-anchor="middle" fill="white" font-size="6">ONLINE</text>`;
      svg += `<line x1="100" y1="40" x2="35" y2="55" stroke="${thumbColors[0]}" stroke-width="1" opacity="0.5"/>`;
      svg += `<line x1="100" y1="40" x2="100" y2="55" stroke="${thumbColors[0]}" stroke-width="1" opacity="0.5"/>`;
      svg += `<line x1="100" y1="40" x2="165" y2="55" stroke="${thumbColors[0]}" stroke-width="1" opacity="0.5"/>`;
      break;
  }
  
  svg += `</svg>`;
  return svg;
}

export function openTemplateGallery() {
  const modal = document.getElementById('template-gallery-modal');
  const grid = document.getElementById('template-gallery-grid');
  
  grid.innerHTML = TEMPLATES.map(t => `
    <div class="template-card" onclick="window._applyTemplate('${t.id}')">
      <div class="template-thumbnail">${renderTemplateThumbnail(t)}</div>
      <div class="template-info">
        <div class="template-name"><span class="template-icon">${t.icon}</span> ${t.name}</div>
        <div class="template-category">${t.category}</div>
        <div class="template-desc">${t.description}</div>
        <div class="template-tags">${t.tags.map(tag => `<span class="template-tag">${tag}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');
  
  modal.classList.add('show');
}

export function closeTemplateGallery() {
  document.getElementById('template-gallery-modal').classList.remove('show');
}

// Setup modal close on backdrop click
const galleryEl = document.getElementById('template-gallery-modal');
if (galleryEl) galleryEl.addEventListener('click', e => { if (e.target === galleryEl) closeTemplateGallery(); });

export { applyTemplate };
