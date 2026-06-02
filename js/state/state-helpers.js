import { state } from './state-core.js';

// ================================================================
// STATE HELPER FUNCTIONS
// ================================================================
export function getAllDiagramResources(){
  const vnetRes = [state.hub, ...state.spokes].flatMap(vnet => vnet.subnets.flatMap(sn => sn.resources));
  return [...vnetRes, ...(state.rgResources || [])];
}

// Alias kept for backward compatibility — same as getAllDiagramResources
export function getAllDiagramResourcesIncludingRg() {
  return getAllDiagramResources();
}

export function getRgResources(rgId) {
  if (!state.rgResources) state.rgResources = [];
  return state.rgResources.filter(r => r.rgId === rgId);
}

export function getVnetsInRg(rgId){
  const result=[];
  if(state.hub.rgId===rgId) result.push(state.hub);
  state.spokes.forEach(s=>{if(s.rgId===rgId)result.push(s);});
  return result;
}

// ================================================================
// AZURE PRIVATE DNS ZONES LIST
// ================================================================
export const AZURE_PRIVATE_DNS_ZONES = [
  'privatelink.blob.core.windows.net',
  'privatelink.file.core.windows.net',
  'privatelink.queue.core.windows.net',
  'privatelink.table.core.windows.net',
  'privatelink.web.core.windows.net',
  'privatelink.dfs.core.windows.net',
  'privatelink.database.windows.net',
  'privatelink.documents.azure.com',
  'privatelink.mongo.cosmos.azure.com',
  'privatelink.cassandra.cosmos.azure.com',
  'privatelink.gremlin.cosmos.azure.com',
  'privatelink.table.cosmos.azure.com',
  'privatelink.postgres.database.azure.com',
  'privatelink.mysql.database.azure.com',
  'privatelink.mariadb.database.azure.com',
  'privatelink.redis.cache.windows.net',
  'privatelink.vaultcore.azure.net',
  'privatelink.managedhsm.azure.net',
  'privatelink.azurewebsites.net',
  'privatelink.azurecr.io',
  'privatelink.servicebus.windows.net',
  'privatelink.eventhubs.azure.net',
  'privatelink.azure-api.net',
  'privatelink.cognitiveservices.azure.com',
  'privatelink.openai.azure.com',
  'privatelink.search.windows.net',
  'privatelink.azuresynapse.net',
  'privatelink.datafactory.azure.net',
  'privatelink.adf.azure.com',
  'privatelink.monitor.azure.com',
  'privatelink.oms.opinsights.azure.com',
  'privatelink.ods.opinsights.azure.com',
  'privatelink.agentsvc.azure-automation.net',
  'privatelink.azurehdinsight.net',
  'privatelink.his.arc.azure.com',
  'privatelink.guestconfiguration.azure.com',
  'privatelink.dp.kubernetesconfiguration.azure.com',
  'privatelink.azmk8s.io',
  'privatelink.siterecovery.windowsazure.com',
  'privatelink.signalr.azure.com',
  'privatelink.webpubsub.azure.com',
  'privatelink.azconfig.io',
  'privatelink.attest.azure.net',
  'privatelink.health.azure.com',
  'privatelink.dicom.azurehealthcareapis.com',
  'privatelink.api.azureml.ms',
  'privatelink.notebooks.azure.net',
  'privatelink.purview.azure.com',
  'privatelink.purviewstudio.azure.com',
  'privatelink.digitaltwins.azure.net',
  'privatelink.media.azure.net',
  'privatelink.batch.azure.com',
  'privatelink.prod.migration.windowsazure.com',
];

// Mapping from Private Endpoint target types to recommended DNS zones
export const PE_TARGET_DNS_RECOMMENDATIONS = {
  'Storage': ['privatelink.blob.core.windows.net', 'privatelink.file.core.windows.net', 'privatelink.queue.core.windows.net', 'privatelink.table.core.windows.net', 'privatelink.dfs.core.windows.net', 'privatelink.web.core.windows.net'],
  'Blob': ['privatelink.blob.core.windows.net'],
  'File': ['privatelink.file.core.windows.net'],
  'Queue': ['privatelink.queue.core.windows.net'],
  'Table': ['privatelink.table.core.windows.net'],
  'Data Lake': ['privatelink.dfs.core.windows.net'],
  'SQL': ['privatelink.database.windows.net'],
  'SQL Server': ['privatelink.database.windows.net'],
  'Cosmos DB': ['privatelink.documents.azure.com', 'privatelink.mongo.cosmos.azure.com', 'privatelink.cassandra.cosmos.azure.com', 'privatelink.table.cosmos.azure.com'],
  'PostgreSQL': ['privatelink.postgres.database.azure.com'],
  'MySQL': ['privatelink.mysql.database.azure.com'],
  'MariaDB': ['privatelink.mariadb.database.azure.com'],
  'Redis': ['privatelink.redis.cache.windows.net'],
  'Key Vault': ['privatelink.vaultcore.azure.net'],
  'App Service': ['privatelink.azurewebsites.net'],
  'Web App': ['privatelink.azurewebsites.net'],
  'Function App': ['privatelink.azurewebsites.net'],
  'Container Registry': ['privatelink.azurecr.io'],
  'ACR': ['privatelink.azurecr.io'],
  'Service Bus': ['privatelink.servicebus.windows.net'],
  'Event Hub': ['privatelink.eventhubs.azure.net'],
  'Event Hubs': ['privatelink.eventhubs.azure.net'],
  'API Management': ['privatelink.azure-api.net'],
  'Cognitive Services': ['privatelink.cognitiveservices.azure.com'],
  'OpenAI': ['privatelink.openai.azure.com'],
  'Azure OpenAI': ['privatelink.openai.azure.com'],
  'Search': ['privatelink.search.windows.net'],
  'Synapse': ['privatelink.azuresynapse.net'],
  'Data Factory': ['privatelink.datafactory.azure.net', 'privatelink.adf.azure.com'],
  'Monitor': ['privatelink.monitor.azure.com', 'privatelink.oms.opinsights.azure.com', 'privatelink.ods.opinsights.azure.com'],
  'AKS': ['privatelink.azmk8s.io'],
  'SignalR': ['privatelink.signalr.azure.com'],
  'App Configuration': ['privatelink.azconfig.io'],
  'Machine Learning': ['privatelink.api.azureml.ms', 'privatelink.notebooks.azure.net'],
  'Purview': ['privatelink.purview.azure.com', 'privatelink.purviewstudio.azure.com'],
  'Batch': ['privatelink.batch.azure.com'],
};

// Get recommended DNS zones based on Private Endpoints in the diagram
export function getRecommendedDnsZones() {
  const allVnets = [state.hub, ...state.spokes];
  const peTargets = new Set();
  allVnets.forEach(vnet => {
    vnet.subnets.forEach(sn => {
      sn.resources.filter(r => r.type === 'pe').forEach(r => {
        if(r.config && r.config.target) peTargets.add(r.config.target);
      });
    });
  });
  const recommended = new Set();
  peTargets.forEach(target => {
    const zones = PE_TARGET_DNS_RECOMMENDATIONS[target];
    if(zones) zones.forEach(z => recommended.add(z));
  });
  return [...recommended];
}

// ================================================================
// PRIVATE ENDPOINT DEPENDENCY HELPERS
// ================================================================

// Get all resources that can be PE targets (exclude peering resources)
export function getPeTargetableResources() {
  const peTargetTypes = ['sa', 'sql', 'kv', 'cosmos', 'redis', 'app', 'apim', 'sb', 'evh', 'aks', 'fa', 'monitor'];
  return getAllDiagramResources().filter(r => peTargetTypes.includes(r.type));
}

// Get all Private Endpoints in the diagram
export function getAllPrivateEndpoints() {
  const allVnets = [state.hub, ...state.spokes];
  return allVnets.flatMap(vnet => 
    vnet.subnets.flatMap(sn => 
      sn.resources.filter(r => r.type === 'pe')
    )
  );
}

// Get target resource for a PE by its ID
export function getPeTargetResource(peId) {
  const pe = getAllPrivateEndpoints().find(p => p.id === peId);
  if (!pe || !pe.config.targetResourceId) return null;
  return getAllDiagramResources().find(r => r.id === pe.config.targetResourceId);
}

// Get all PEs targeting a specific resource
export function getPesForResource(resourceId) {
  return getAllPrivateEndpoints().filter(pe => 
    pe.config && pe.config.targetResourceId === resourceId
  );
}

// Get VNets that contain Private Endpoints
export function getVnetsWithPrivateEndpoints() {
  const allVnets = [state.hub, ...state.spokes];
  return allVnets.filter(vnet =>
    vnet.subnets.some(sn =>
      sn.resources.some(r => r.type === 'pe')
    )
  );
}

// Get recommended VNET links for a private DNS zone based on PE placement
export function getRecommendedVnetLinksForDnsZone(dnsZoneId) {
  const dnsZone = (state.rgResources || []).find(r => r.id === dnsZoneId && r.type === 'dns');
  if (!dnsZone || !dnsZone.config.zone) return [];
  
  const zone = dnsZone.config.zone;
  const allVnets = [state.hub, ...state.spokes];
  const recommendedVnets = [];
  
  // Find all VNets that contain PEs targeting resources that need this DNS zone
  allVnets.forEach(vnet => {
    const hasRelevantPe = vnet.subnets.some(sn =>
      sn.resources.some(r => {
        if (r.type !== 'pe' || !r.config || !r.config.target) return false;
        const recommendedZones = PE_TARGET_DNS_RECOMMENDATIONS[r.config.target] || [];
        return recommendedZones.includes(zone);
      })
    );
    
    if (hasRelevantPe) {
      recommendedVnets.push({
        vnetId: vnet.id,
        vnetName: vnet.name,
        peCount: vnet.subnets.reduce((sum, sn) => 
          sum + sn.resources.filter(r => r.type === 'pe').length, 0)
      });
    }
  });
  
  return recommendedVnets;
}

// Validate PE configuration
export function validatePeConfiguration(peId) {
  const pe = getAllPrivateEndpoints().find(p => p.id === peId);
  if (!pe) return { valid: false, error: 'PE not found' };
  
  const targetResource = getPeTargetResource(peId);
  if (!pe.config.targetResourceId) {
    return { valid: false, error: 'Target resource not selected' };
  }
  if (!targetResource) {
    return { valid: false, error: 'Target resource does not exist' };
  }
  
  // Check if PE and target are in same RG
  if (pe.rgId !== targetResource.rgId) {
    return { valid: false, warning: 'PE and target resource are in different RGs' };
  }
  
  // Check DNS zone configuration
  const recommendedZones = PE_TARGET_DNS_RECOMMENDATIONS[pe.config.target] || [];
  const existingZones = (state.rgResources || []).filter(r => r.type === 'dns' && r.config.zone).map(r => r.config.zone);
  const missingZones = recommendedZones.filter(z => !existingZones.includes(z));
  
  if (missingZones.length > 0) {
    return { valid: true, warning: `Missing DNS zones: ${missingZones.join(', ')}` };
  }
  
  return { valid: true };
}
