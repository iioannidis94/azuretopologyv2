export const dataCategory = {
  key: 'data',
  label: 'Data & Storage',
  resources: {
    sql: {
      icon: '🗄️',
      img: 'SQL-Database.svg',
      color: '#00B294',
      label: 'Azure SQL',
      cost: 380,
      pricingCalculatorSlug: 'sql-database',
      azureTypes: ['microsoft.sql/servers', 'microsoft.sql/servers/databases'],
      config: { serverName: '', vcores: '4', tier: 'GeneralPurpose', maxSizeGB: '32', collation: 'SQL_Latin1_General_CP1_CI_AS', backupRetentionDays: '7', zoneRedundant: 'false' },
      validation: { critical: ['serverName', 'tier'], warning: ['vcores', 'maxSizeGB', 'collation'] },
      importMappings: {
        'sku.tier': 'tier',
        'sku.capacity': 'vcores',
        'properties.maxSizeBytes': { key: 'maxSizeGB', transform: (v) => String(Math.round((v || 0) / 1073741824)) },
        'properties.collation': 'collation',
        'properties.zoneRedundant': 'zoneRedundant'
      }
    },
    cosmos: {
      icon: '🌌',
      img: 'Azure-Cosmos-DB.svg',
      color: '#00B294',
      label: 'Cosmos DB',
      cost: 400,
      pricingCalculatorSlug: 'cosmos-db',
      azureTypes: ['microsoft.documentdb/databaseaccounts'],
      config: { api: 'NoSQL', consistencyLevel: 'Session', geoReplication: 'false', maxRU: '4000', enableFreeTier: 'false', serverless: 'false' },
      validation: { critical: ['api'], warning: ['consistencyLevel', 'maxRU'] },
      importMappings: {
        'kind': { key: 'api', transform: (v) => v === 'MongoDB' ? 'MongoDB' : 'NoSQL' },
        'properties.consistencyPolicy.defaultConsistencyLevel': 'consistencyLevel',
        'properties.enableFreeTier': 'enableFreeTier',
        'properties.capabilities': { key: 'serverless', transform: (v) => v?.some(c => c.name === 'EnableServerless') ? 'true' : 'false' }
      }
    },
    sa: {
      icon: '💾',
      img: 'Storage-Accounts.svg',
      color: '#00B294',
      label: 'Storage Account',
      cost: 25,
      pricingCalculatorSlug: 'storage-accounts',
      azureTypes: ['microsoft.storage/storageaccounts'],
      config: { replication: 'ZRS', kind: 'StorageV2', tier: 'Standard', accessTier: 'Hot', httpsOnly: 'true', minTlsVersion: 'TLS1_2' },
      validation: { critical: ['replication', 'kind'], warning: ['tier', 'accessTier'] },
      importMappings: {
        'sku.name': { key: 'replication', transform: (v) => v?.split('_')[1] || 'ZRS' },
        'sku.tier': 'tier',
        'kind': 'kind',
        'properties.accessTier': 'accessTier',
        'properties.supportsHttpsTrafficOnly': 'httpsOnly',
        'properties.minimumTlsVersion': 'minTlsVersion'
      }
    },
    redis: {
      icon: '⚡',
      img: 'Cache-Redis.svg',
      color: '#E81123',
      label: 'Azure Cache Redis',
      cost: 120,
      pricingCalculatorSlug: 'azure-cache-for-redis',
      azureTypes: ['microsoft.cache/redis'],
      config: { sku: 'Premium P1', capacity: '1', enableNonSslPort: 'false', minTlsVersion: '1.2', zones: '', replicasPerPrimary: '1' },
      validation: { critical: ['sku'], warning: ['capacity', 'zones'] },
      importMappings: {
        'sku.name': { key: 'sku', transform: (v, resource) => `${v || 'Premium'} ${resource?.sku?.family || 'P'}1` },
        'sku.capacity': 'capacity',
        'properties.enableNonSslPort': 'enableNonSslPort',
        'properties.minimumTlsVersion': 'minTlsVersion',
        'zones': { key: 'zones', transform: (v) => Array.isArray(v) ? v.join(',') : '' },
        'properties.replicasPerPrimary': 'replicasPerPrimary'
      }
    },
    adls: {
      icon: '🗃️',
      img: 'Storage-Accounts.svg',
      color: '#0078D4',
      label: 'Data Lake',
      cost: 50,
      pricingCalculatorSlug: 'storage-accounts',
      config: { tier: 'Standard', hierarchicalNamespace: 'true', replication: 'LRS', enableSoftDelete: 'true' },
      validation: { critical: ['tier', 'replication'], warning: ['hierarchicalNamespace'] },
      importMappings: {
        'sku.tier': 'tier',
        'sku.name': { key: 'replication', transform: (v) => v?.split('_')[1] || 'LRS' },
        'properties.isHnsEnabled': 'hierarchicalNamespace',
        'properties.blobServiceProperties.deleteRetentionPolicy.enabled': 'enableSoftDelete'
      }
    },
    search: {
      icon: '🔎',
      img: 'Search-Services.svg',
      color: '#0078D4',
      label: 'AI Search',
      cost: 250,
      pricingCalculatorSlug: 'search',
      azureTypes: ['microsoft.search/searchservices'],
      config: { sku: 'standard', replicaCount: '1', partitionCount: '1', publicNetworkAccess: 'enabled' },
      validation: { critical: ['sku'], warning: ['replicaCount', 'partitionCount', 'publicNetworkAccess'] },
      importMappings: {
        'sku.name': { key: 'sku', transform: (v) => String(v || 'standard').toLowerCase() },
        'properties.replicaCount': 'replicaCount',
        'properties.partitionCount': 'partitionCount',
        'properties.publicNetworkAccess': { key: 'publicNetworkAccess', transform: (v) => String(v || 'enabled').toLowerCase() }
      }
    }
  }
};
