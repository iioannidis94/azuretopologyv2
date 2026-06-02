import { state, RES_TYPES, getVnetsInRg } from '../state-management.js';
import { _iacSafe } from './export-utils.js';

function generateBicepResource(res, rg, vnet, sn) {
  const lines = [];
  const c = res.config || {};
  const safeName = _iacSafe(res.name);
  const rgRef = _iacSafe(rg.id);
  const vnetSafeName = _iacSafe(vnet.name);
  // Bicep reference to the subnet resource ID via the AVM VNet module output
  const subnetRef = `vnet_${vnetSafeName}.outputs.subnetResourceIds['${sn.name}']`;
  switch (res.type) {
    case 'vm': {
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    vmSize: '${c.size||'Standard_D2s_v3'}'`);
      lines.push(`    osType: '${(c.os||'').toLowerCase().includes('windows') ? 'Windows' : 'Linux'}'`);
      lines.push(`    osDisk: { diskSizeGB: ${c.osDiskSizeGB||128}, managedDisk: { storageAccountType: '${c.osDiskType||'Premium_LRS'}' } }`);
      lines.push(`    zone: ${c.availabilityZone && c.availabilityZone !== 'None' ? c.availabilityZone : '0'}`);
      lines.push(`    nicConfigurations: [{ enableAcceleratedNetworking: ${c.acceleratedNetworking||'true'} }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'vmss': {
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine-scale-set:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    skuName: '${c.size||'Standard_D2s_v3'}'`);
      lines.push(`    skuCapacity: ${c.instances||2}`);
      lines.push(`    upgradePolicy: '${c.upgradePolicy||'Rolling'}'`);
      lines.push(`    zones: [${(c.zones||'1,2,3').split(',').map(z => `'${z.trim()}'`).join(', ')}]`);
      lines.push(`    autoScaleSettings: { minCount: ${c.minInstances||2}, maxCount: ${c.maxInstances||10} }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'aks': {
      lines.push(`module ${safeName} 'br/public:avm/res/container-service/managed-cluster:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kubernetesVersion: '${c.version||'1.29'}'`);
      lines.push(`    agentPoolProfiles: [{ count: ${c.nodes||3}, vmSize: '${c.nodeSize||'Standard_D2s_v3'}' }]`);
      lines.push(`    networkPlugin: '${c.networkPlugin||'azure'}'`);
      lines.push(`    podCidr: '${c.podCidr||'10.244.0.0/16'}'`);
      lines.push(`    serviceCidr: '${c.serviceCidr||'10.0.0.0/16'}'`);
      lines.push(`    dnsServiceIP: '${c.dnsServiceIp||'10.0.0.10'}'`);
      lines.push(`    enablePrivateCluster: ${c.privateCluster === 'true'}`);
      lines.push(`    sku: { name: 'Base', tier: '${c.tier||'Standard'}' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'fa': {
      lines.push(`module ${safeName} 'br/public:avm/res/web/site:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'functionapp'`);
      lines.push(`    runtime: '${c.runtime||'node'}'`);
      lines.push(`    runtimeVersion: '${c.runtimeVersion||'20'}'`);
      lines.push(`    osType: '${c.osType||'Linux'}'`);
      lines.push(`    alwaysOn: ${c.alwaysOn === 'true'}`);
      if (c.storageAccountName) lines.push(`    storageAccountResourceId: resourceId('Microsoft.Storage/storageAccounts', '${c.storageAccountName}') // same subscription + RG; cross-RG: resourceId(rgName, type, name); cross-subscription: resourceId(sub, rgName, type, name)`);
      else lines.push(`    // storageAccountResourceId: '<storage-account-resource-id>' // required for Function Apps`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'aca': {
      lines.push(`module ${safeName} 'br/public:avm/res/app/container-app:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      if (c.environmentName) lines.push(`    environmentResourceId: resourceId('Microsoft.App/managedEnvironments', '${c.environmentName}') // same subscription + RG; cross-RG: resourceId(rgName, type, name); cross-subscription: resourceId(sub, rgName, type, name)`);
      else lines.push(`    // environmentResourceId: '<container-apps-environment-resource-id>' // required`);
      lines.push(`    containers: [{ image: '${c.image||'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'}', resources: { cpu: ${c.cpu||'0.5'}, memory: '${c.memory||'1.0Gi'}' } }]`);
      lines.push(`    scale: { minReplicas: ${c.minReplicas||1}, maxReplicas: ${c.replicas||10} }`);
      lines.push(`    ingress: { external: ${c.ingress === 'external'}, targetPort: ${c.targetPort||80} }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'fw': {
      const fwZones = c.availabilityZones ? c.availabilityZones.split(',').map(z => z.trim()) : ['1','2','3'];
      lines.push(`module ${safeName} 'br/public:avm/res/network/azure-firewall:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    skuTier: '${c.sku||'Premium'}'`);
      lines.push(`    threatIntelMode: '${c.threatIntelMode||'Alert'}'`);
      lines.push(`    hubIPAddresses: { publicIPs: { count: 1 } }`);
      lines.push(`    zones: [${fwZones.map(z => `'${z}'`).join(', ')}]`);
      if (c.dnsProxy === 'true') {
        lines.push(`    additionalProperties: { 'Network.DNS.EnableProxy': 'true' }`);
      }
      if (c.policyName) {
        lines.push(`    firewallPolicyId: '${c.policyName}'`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'nva': {
      const nvaVendor = (c.vendor||'Fortinet').toLowerCase();
      const nvaProduct = nvaVendor === 'fortinet' ? 'fortinet_fortigate-vm_v5' : `${nvaVendor}_nva`;
      const nvaPlanName = nvaVendor === 'fortinet' ? 'fortinet_fg-vm' : `${nvaVendor}_nva`;
      lines.push(`// NVA: ${res.name} — Vendor: ${c.vendor||'Fortinet'}, Version: ${c.version||'7.4'}, License: ${c.licenseType||'PAYG'}`);
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    vmSize: '${c.size||'Standard_F4s_v2'}'`);
      lines.push(`    plan: { publisher: '${nvaVendor}', product: '${nvaProduct}', name: '${nvaPlanName}' }`);
      lines.push(`    // Mode: ${c.mode||'Active/Passive'} | License: ${c.licenseType||'PAYG'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'agw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/application-gateway:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.sku||'WAF_v2'}', tier: '${c.tier||c.sku||'WAF_v2'}', capacity: ${c.capacity||2} }`);
      lines.push(`    sslPolicy: { policyType: 'Predefined', policyName: '${c.sslPolicy||'AppGwSslPolicy20220101'}' }`);
      lines.push(`    gatewayIPConfigurations: [{ subnetId: ${subnetRef} }]`);
      lines.push(`    frontendIPConfigurations: [{ publicIPAddressId: '${res.name}-pip' }]`);
      lines.push(`    frontendPorts: [{ port: 80 }]`);
      lines.push(`    backendAddressPools: [{ name: 'defaultBackendPool' }]`);
      lines.push(`    backendHttpSettingsCollection: [{ port: 80, protocol: 'Http' }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'lb': {
      const lbIsPublic = (c.type||'Internal') === 'Public';
      lines.push(`module ${safeName} 'br/public:avm/res/network/load-balancer:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: '${c.sku||'Standard'}'`);
      if (lbIsPublic) {
        lines.push(`    frontendIPConfigurations: [{ name: '${res.name}-frontend', publicIPAddressId: '${res.name}-pip' }]`);
      } else {
        lines.push(`    frontendIPConfigurations: [{ name: '${res.name}-frontend', subnetId: ${subnetRef} }]`);
      }
      const probeparts = (c.healthProbe||'TCP/80').split('/');
      lines.push(`    backendAddressPools: [{ name: '${res.name}-backend' }]`);
      lines.push(`    probes: [{ name: '${res.name}-probe', protocol: '${probeparts[0]||'Tcp'}', port: ${probeparts[1]||80} }]`);
      lines.push(`    loadBalancingRules: [{ name: '${res.name}-rule', frontendPort: 80, backendPort: 80, protocol: 'Tcp' }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'gw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/virtual-network-gateway:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    gatewayType: 'Vpn'`);
      lines.push(`    vpnType: '${c.vpnType||'RouteBased'}'`);
      lines.push(`    vpnGatewayGeneration: '${c.generation||'Generation2'}'`);
      lines.push(`    sku: { name: '${c.sku||'VpnGw2AZ'}', tier: '${c.sku||'VpnGw2AZ'}' }`);
      lines.push(`    activeActive: ${c.activeActive||'false'}`);
      if (c.bgpAsn && c.bgpAsn !== '65515') {
        lines.push(`    enableBgp: true`);
        lines.push(`    bgpSettings: { asn: ${c.bgpAsn} }`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'ergw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/virtual-network-gateway:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    gatewayType: '${c.gatewayType||'ExpressRoute'}'`);
      lines.push(`    sku: { name: '${c.sku||'ErGw2AZ'}', tier: '${c.sku||'ErGw2AZ'}' }`);
      if (c.expressRouteCircuitId) {
        lines.push(`    // ExpressRoute Circuit: ${c.expressRouteCircuitId}`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'bas': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/bastion-host:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: '${c.sku||'Standard'}'`);
      lines.push(`    scaleUnits: ${c.scaleUnits||2}`);
      lines.push(`    virtualNetworkId: '${vnet.name}'`);
      if (c.shareableLink === 'true') lines.push(`    enableShareableLink: true`);
      if (c.ipConnect === 'true') lines.push(`    enableIpConnect: true`);
      if (c.tunneling === 'true') lines.push(`    enableTunneling: true`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'afd': {
      lines.push(`module ${safeName} 'br/public:avm/res/cdn/profile:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.sku||'Premium'}_AzureFrontDoor' }`);
      lines.push(`    originResponseTimeoutSeconds: 60`);
      lines.push(`    endpoints: [{ name: '${c.endpoints||res.name+'-endpoint'}' }]`);
      lines.push(`    originGroups: [{ name: '${c.originGroups||'default-origin-group'}' }]`);
      if (c.wafPolicy) {
        lines.push(`    securityPolicies: [{ name: '${c.wafPolicy}' }]`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'pe': {
      const peGroupId = c.groupId || c.subResource || c.target || 'blob';
      const peConnectionName = c.connectionName || `${res.name}-connection`;
      const targetInfo = c.targetResourceName ? ` (${c.targetResourceName})` : '';
      lines.push(`// Private Endpoint: ${res.name}${targetInfo}`);
      lines.push(`// NOTE: Replace '<target-resource-id>' with actual resource ID. Target should be: ${c.targetResourceId ? 'Selected' : 'NOT SELECTED'}`);
      lines.push(`module ${safeName} 'br/public:avm/res/network/private-endpoint:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    subnetResourceId: ${subnetRef}`);
      lines.push(`    privateLinkServiceConnections: [{ name: '${peConnectionName}', privateLinkServiceId: '<target-resource-id>', groupIds: ['${peGroupId}'] }]`);
      if (c.privateDnsZoneId) {
        lines.push(`    privateDnsZoneGroup: { privateDnsZoneGroupConfigs: [{ privateDnsZoneResourceId: '${c.privateDnsZoneId}' }] }`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'nsg': {
      let nsgRules = [];
      try { nsgRules = JSON.parse(c.rules || '[]'); } catch(e) { nsgRules = []; }
      if (nsgRules.length === 0) {
        nsgRules = [
          {name:'Allow-HTTP',priority:'100',direction:'Inbound',access:'Allow',protocol:'Tcp',srcPort:'*',dstPort:'80',srcAddr:'*',dstAddr:'*'},
          {name:'Allow-HTTPS',priority:'110',direction:'Inbound',access:'Allow',protocol:'Tcp',srcPort:'*',dstPort:'443',srcAddr:'*',dstAddr:'*'}
        ];
      }
      lines.push(`module ${safeName} 'br/public:avm/res/network/network-security-group:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    securityRules: [`);
      nsgRules.forEach(rule => {
        lines.push(`      { name: '${rule.name}', priority: ${rule.priority||100}, direction: '${rule.direction||'Inbound'}', access: '${rule.access||'Allow'}', protocol: '${rule.protocol||'Tcp'}', sourceAddressPrefix: '${rule.srcAddr||'*'}', destinationAddressPrefix: '${rule.dstAddr||'*'}', sourcePortRange: '${rule.srcPort||'*'}', destinationPortRange: '${rule.dstPort||'80'}' }`);
      });
      lines.push(`    ]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sql': {
      const sqlTier = c.tier || 'GeneralPurpose';
      const sqlSkuName = sqlTier === 'BusinessCritical' ? 'BC_Gen5' : 'GP_Gen5';
      const sqlServerName = c.serverName || `${res.name}-server`;
      lines.push(`module ${safeName}_server 'br/public:avm/res/sql/server:0.4.0' = {`);
      lines.push(`  name: '${sqlServerName}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${sqlServerName}'`);
      lines.push(`    administratorLogin: 'sqladmin'`);
      lines.push(`    administratorLoginPassword: '<password>'`);
      lines.push(`    databases: [{ name: '${res.name}', sku: { name: '${sqlSkuName}', tier: '${sqlTier}', capacity: ${c.vcores||4} }, maxSizeBytes: ${(parseInt(c.maxSizeGB)||32)*1073741824}, collation: '${c.collation||'SQL_Latin1_General_CP1_CI_AS'}', zoneRedundant: ${c.zoneRedundant==='true'} }]`);
      lines.push(`    backupRetentionDays: ${c.backupRetentionDays||7}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'cosmos': {
      const cosmosKind = c.api === 'MongoDB' ? 'MongoDB' : 'GlobalDocumentDB';
      const cosmosCapabilities = c.serverless === 'true' ? `\n    capabilities: [{ name: 'EnableServerless' }]` : '';
      lines.push(`module ${safeName} 'br/public:avm/res/document-db/database-account:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    databaseAccountOfferType: 'Standard'`);
      lines.push(`    kind: '${cosmosKind}'`);
      lines.push(`    consistencyPolicy: { defaultConsistencyLevel: '${c.consistencyLevel||'Session'}' }`);
      lines.push(`    locations: [{ locationName: '${rg.location}', failoverPriority: 0 }]`);
      lines.push(`    enableFreeTier: ${c.enableFreeTier==='true'}${cosmosCapabilities}`);
      if(c.serverless !== 'true' && c.maxRU) lines.push(`    totalThroughputLimit: ${c.maxRU}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sa': {
      const saKind = c.kind || 'StorageV2';
      const saTier = c.tier || 'Standard';
      const saAccessTier = c.accessTier || 'Hot';
      lines.push(`module ${safeName} 'br/public:avm/res/storage/storage-account:0.9.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}'`);
      lines.push(`    kind: '${saKind}'`);
      lines.push(`    skuName: '${saTier}_${c.replication||'ZRS'}'`);
      lines.push(`    accessTier: '${saAccessTier}'`);
      lines.push(`    minimumTlsVersion: '${c.minTlsVersion||'TLS1_2'}'`);
      lines.push(`    allowBlobPublicAccess: false`);
      lines.push(`    supportsHttpsTrafficOnly: ${c.httpsOnly!=='false'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'redis': {
      const redisSku = (c.sku||'Premium P1').split(' ');
      const redisSkuName = redisSku[0] || 'Premium';
      const redisFamily = redisSkuName === 'Premium' ? 'P' : 'C';
      lines.push(`module ${safeName} 'br/public:avm/res/cache/redis:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${redisSkuName}', family: '${redisFamily}', capacity: ${c.capacity||1} }`);
      lines.push(`    minimumTlsVersion: '${c.minTlsVersion||'1.2'}'`);
      lines.push(`    enableNonSslPort: ${c.enableNonSslPort==='true'}`);
      lines.push(`    replicasPerPrimary: ${c.replicasPerPrimary||1}`);
      if(c.zones) lines.push(`    zones: [${c.zones.split(',').map(z=>`'${z.trim()}'`).join(', ')}]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'adls': {
      const adlsReplication = c.replication || 'LRS';
      lines.push(`module ${safeName} 'br/public:avm/res/storage/storage-account:0.9.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}'`);
      lines.push(`    kind: 'StorageV2'`);
      lines.push(`    skuName: '${c.tier||'Standard'}_${adlsReplication}'`);
      lines.push(`    isHnsEnabled: ${c.hierarchicalNamespace!=='false'}`);
      if(c.enableSoftDelete==='true') lines.push(`    deleteRetentionPolicy: { enabled: true, days: 7 }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'kv': {
      lines.push(`module ${safeName} 'br/public:avm/res/key-vault/vault:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { family: 'A', name: '${(c.sku||'premium').toLowerCase()}' }`);
      lines.push(`    enablePurgeProtection: ${c.purgeProtection !== 'false'}`);
      lines.push(`    enableRbacAuthorization: ${c.enableRbacAuth !== 'false'}`);
      lines.push(`    softDeleteRetentionInDays: ${c.softDeleteDays || 90}`);
      if(c.networkAcls && c.networkAcls !== 'Allow') lines.push(`    networkAcls: { defaultAction: 'Deny' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'app': {
      const aspNameBicep = c.appServicePlanName || `${res.name}-plan`;
      const aspSkuBicep = c.appServicePlanSku || c.sku || 'P1v3';
      lines.push(`module ${safeName}_plan 'br/public:avm/res/web/server-farm:0.2.0' = {`);
      lines.push(`  name: '${aspNameBicep}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: { name: '${aspNameBicep}', sku: { name: '${aspSkuBicep}' } }`);
      lines.push(`}\n`);
      lines.push(`module ${safeName} 'br/public:avm/res/web/site:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'app,linux'`);
      lines.push(`    serverFarmResourceId: ${safeName}_plan.outputs.resourceId`);
      lines.push(`    siteConfig: { alwaysOn: ${c.alwaysOn === 'true'}, httpsOnly: ${c.httpsOnly !== 'false'}, minTlsVersion: '${c.minTlsVersion||'1.2'}' }`);
      if(c.runtime) lines.push(`    // Runtime: ${c.runtime} ${c.runtimeVersion||''}`);
      if(c.managedIdentity && c.managedIdentity !== 'None') lines.push(`    managedIdentities: { systemAssigned: true }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'apim': {
      lines.push(`module ${safeName} 'br/public:avm/res/api-management/service:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    publisherName: '${c.publisherName||'MyOrganization'}'`);
      lines.push(`    publisherEmail: '${c.publisherEmail||'admin@example.com'}'`);
      lines.push(`    sku: { name: '${c.tier||'Developer'}', capacity: ${c.capacity||1} }`);
      if(c.vnetType && c.vnetType !== 'None') lines.push(`    virtualNetworkType: '${c.vnetType}'`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sb': {
      lines.push(`module ${safeName} 'br/public:avm/res/service-bus/namespace:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.tier||'Premium'}', tier: '${c.tier||'Premium'}', capacity: ${c.messagingUnits||1} }`);
      lines.push(`    zoneRedundant: ${c.zoneRedundant === 'true'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'evh': {
      lines.push(`module ${safeName} 'br/public:avm/res/event-hub/namespace:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.tier||'Standard'}', tier: '${c.tier||'Standard'}', capacity: ${c.throughputUnits||1} }`);
      lines.push(`    eventhubs: [{ name: '${res.name}-hub', partitionCount: ${c.partitions||4}, messageRetentionInDays: ${c.retentionDays||7}${c.captureEnabled==='true' ? ', captureDescription: { enabled: true }' : ''} }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'logic': {
      lines.push(`module ${safeName} 'br/public:avm/res/logic/workflow:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    state: '${c.state||'Enabled'}'`);
      if(c.triggerType) lines.push(`    // Trigger: ${c.triggerType}`);
      if(c.connectors) lines.push(`    // Connectors: ${c.connectors}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'foundry': {
      lines.push(`module ${safeName} 'br/public:avm/res/cognitive-services/account:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: '${c.kind||'AIServices'}'`);
      lines.push(`    sku: { name: '${c.sku||'S0'}' }`);
      if(c.customSubdomain) lines.push(`    customSubDomainName: '${c.customSubdomain}'`);
      if(c.networkRules && c.networkRules !== 'Allow') lines.push(`    networkAcls: { defaultAction: 'Deny' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'openai': {
      lines.push(`module ${safeName} 'br/public:avm/res/cognitive-services/account:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'OpenAI'`);
      lines.push(`    sku: { name: 'S0' }`);
      lines.push(`    customSubDomainName: '${res.name}'`);
      lines.push(`    deployments: [{ name: '${c.deploymentName||c.model||'gpt-4o'}', model: { format: 'OpenAI', name: '${c.model||'gpt-4o'}', version: '${c.modelVersion||'latest'}' }, sku: { name: 'Standard', capacity: ${c.capacity||10} } }]`);
      if(c.contentFilter && c.contentFilter !== 'Default') lines.push(`    // Content Filter: ${c.contentFilter}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'monitor': {
      lines.push(`module ${safeName} 'br/public:avm/res/operational-insights/workspace:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.workspaceSku||'PerGB2018'}' }`);
      lines.push(`    retentionInDays: ${c.retentionDays||90}`);
      if(c.dailyCapGB) lines.push(`    workspaceCapping: { dailyQuotaGb: ${c.dailyCapGB} }`);
      if(c.solutions) lines.push(`    // Solutions: ${c.solutions}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    default: {
      lines.push(`// module ${safeName} 'br/public:avm/res/...' — type ${res.type} not yet supported`);
      break;
    }
  }
  return lines;
}


export function generateBicep(){
  const lines=[];
  
  // Determine target scope based on MG/Sub structure
  if (state.mgEnabled && state.managementGroups && state.managementGroups.length > 0) {
    lines.push(`// Bicep Template — Azure Architecture Builder\ntargetScope = 'managementGroup'\n`);
    // Management Group deployments
    const topMgs = state.managementGroups.filter(mg => !mg.parentId);
    const childMgs = state.managementGroups.filter(mg => mg.parentId);
    topMgs.forEach(mg => {
      const safeName = _iacSafe(mg.name);
      lines.push(`resource mg_${safeName} 'Microsoft.Management/managementGroups@2021-04-01' = {`);
      lines.push(`  name: '${mg.name}'`);
      lines.push(`  properties: {`);
      lines.push(`    displayName: '${mg.name}'`);
      lines.push(`  }`);
      lines.push(`}\n`);
    });
    childMgs.forEach(mg => {
      const safeName = _iacSafe(mg.name);
      const parent = state.managementGroups.find(p => p.id === mg.parentId);
      const parentRef = parent ? `mg_${_iacSafe(parent.name)}.id` : '';
      lines.push(`resource mg_${safeName} 'Microsoft.Management/managementGroups@2021-04-01' = {`);
      lines.push(`  name: '${mg.name}'`);
      lines.push(`  properties: {`);
      lines.push(`    displayName: '${mg.name}'`);
      if (parentRef) {
        lines.push(`    details: { parent: { id: ${parentRef} } }`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
    });
    // Subscription assignments
    state.subscriptions.forEach(sub => {
      if (sub.mgId) {
        const mg = state.managementGroups.find(m => m.id === sub.mgId);
        if (mg) {
          const safeName = _iacSafe(sub.name);
          const subIdRef = sub.subscriptionId || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
          lines.push(`resource sub_${safeName} 'Microsoft.Management/managementGroups/subscriptions@2021-04-01' = {`);
          lines.push(`  parent: mg_${_iacSafe(mg.name)}`);
          lines.push(`  name: '${subIdRef}'`);
          lines.push(`}\n`);
        }
      }
    });
    lines.push('');
  } else {
    lines.push(`// Bicep Template — Azure Architecture Builder\ntargetScope = 'subscription'\n`);
  }

  state.subscriptions.forEach(sub=>{
    lines.push(`// --- Subscription: ${sub.name} ---`);
    const subRgs=state.resourceGroups.filter(r=>r.subId===sub.id);
    subRgs.forEach(rg=>{
      const rgSafe = _iacSafe(rg.id);
      let rgBicep = `resource ${rgSafe} 'Microsoft.Resources/resourceGroups@2021-04-01' = {\n  name: '${rg.name}'\n  location: '${rg.location}'`;
      if(rg.tags && Object.keys(rg.tags).length > 0) {
        rgBicep += `\n  tags: {${Object.entries(rg.tags).map(([k,v])=>`\n    '${k}': '${v}'`).join('')}\n  }`;
      }
      rgBicep += `\n}\n`;
      lines.push(rgBicep);
      if(rg.lock && rg.lock !== 'None') {
        lines.push(`resource ${rgSafe}_lock 'Microsoft.Authorization/locks@2020-05-01' = {\n  name: '${rg.name}-lock'\n  scope: ${rgSafe}\n  properties: {\n    level: '${rg.lock}'\n  }\n}\n`);
      }
      getVnetsInRg(rg.id).forEach(vnet=>{
        const vnetSafeName = _iacSafe(vnet.name);
        lines.push(`module vnet_${vnetSafeName} 'br/public:avm/res/network/virtual-network:0.2.0' = {`);
        lines.push(`  name: '${vnet.name}'`);
        lines.push(`  scope: ${rgSafe}`);
        lines.push(`  params: {`);
        lines.push(`    name: '${vnet.name}'`);
        lines.push(`    addressPrefixes: ['${vnet.cidr}']`);
        if(vnet.dnsServers) {
          const dns = vnet.dnsServers.split(',').map(d=>d.trim()).filter(Boolean);
          if(dns.length) lines.push(`    dnsServers: [${dns.map(d=>`'${d}'`).join(', ')}]`);
        }
        if(vnet.ddosProtectionPlan === 'true') lines.push(`    enableDdosProtection: true`);
        if(vnet.encryption === 'true') lines.push(`    encryption: { enabled: true }`);
        if(vnet.flowTimeout) lines.push(`    flowTimeoutInMinutes: ${vnet.flowTimeout}`);
        lines.push(`    subnets: [`);
        (vnet.subnets || []).forEach(sn => {
          let snProps = `{ name: '${sn.name}', addressPrefix: '${sn.cidr}'`;
          if(sn.nsgId) snProps += `, networkSecurityGroupId: '${sn.nsgId}'`;
          if(sn.routeTableId) snProps += `, routeTableId: '${sn.routeTableId}'`;
          if(sn.natGatewayId) snProps += `, natGatewayId: '${sn.natGatewayId}'`;
          if(sn.serviceEndpoints) {
            const eps = sn.serviceEndpoints.split(',').map(e=>e.trim()).filter(Boolean);
            if(eps.length) snProps += `, serviceEndpoints: [${eps.map(e=>`{ service: '${e}' }`).join(', ')}]`;
          }
          if(sn.delegation && sn.delegation !== 'None') snProps += `, delegations: [{ name: 'delegation', properties: { serviceName: '${sn.delegation}' } }]`;
          if(sn.privateEndpointNetworkPolicies === 'Enabled') snProps += `, privateEndpointNetworkPolicies: 'Enabled'`;
          if(sn.privateLinkServiceNetworkPolicies === 'Enabled') snProps += `, privateLinkServiceNetworkPolicies: 'Enabled'`;
          snProps += ` }`;
          lines.push(`      ${snProps}`);
        });
        lines.push(`    ]`);
        lines.push(`  }`);
        lines.push(`}\n`);
        
        (vnet.subnets || []).forEach(sn => {
          (sn.resources || []).forEach(res => {
            lines.push(...generateBicepResource(res, rg, vnet, sn));
          });
        });
        lines.push('');
      });

      // RG-level resources (DNS Zones)
      const rgResources = (state.rgResources||[]).filter(r => r.rgId === rg.id);
      rgResources.forEach(res => {
        if(res.type === 'publicDns') {
          const safeName = _iacSafe(res.config.zone);
          lines.push(`module dnsZone_${safeName} 'br/public:avm/res/network/dns-zone:0.3.0' = {`);
          lines.push(`  name: '${res.config.zone}'`);
          lines.push(`  scope: ${rgSafe}`);
          lines.push(`  params: { name: '${res.config.zone}' }`);
          lines.push(`}\n`);
          (res.config.records||[]).forEach(rec => {
            lines.push(`// DNS Record: ${rec.name} ${rec.type} ${rec.value}`);
          });
        } else if(res.type === 'dns') {
          const zoneName = res.config.fullZoneName || res.config.zone;
          const safeName = _iacSafe(zoneName);
          lines.push(`module privateDnsZone_${safeName} 'br/public:avm/res/network/private-dns-zone:0.3.0' = {`);
          lines.push(`  name: '${zoneName}'`);
          lines.push(`  scope: ${rgSafe}`);
          lines.push(`  params: {`);
          lines.push(`    name: '${zoneName}'`);
          if(res.config.vnetLinks && res.config.vnetLinks.length > 0) {
            // NOTE: vnet_X modules must be declared before this DNS zone module in the Bicep file (they are emitted
            // earlier in the hub/spoke loop above, so ordering is correct for single-file deployments).
            lines.push(`    virtualNetworkLinks: [`);
            res.config.vnetLinks.forEach(link => {
              const enableReg = link.registrationEnabled || res.config.autoRegistration === 'true';
              lines.push(`      { virtualNetworkResourceId: vnet_${_iacSafe(link.vnetName)}.outputs.resourceId, registrationEnabled: ${enableReg} }`);
            });
            lines.push(`    ]`);
          }
          lines.push(`  }`);
          lines.push(`}\n`);
          (res.config.records||[]).forEach(rec => {
            lines.push(`// Private DNS Record: ${rec.name} ${rec.type} ${rec.value}`);
          });
        }
        lines.push('');
      });
    });
  });
  if (state.onPrem.enabled) {
    lines.push(`// --- Hybrid Connectivity: ${state.onPrem.name} ---`);
    lines.push(`// Local Network Gateway for CIDR: ${state.onPrem.cidr}`);
  }
  return lines.join('\n');
}

export function openBicepModal(){document.getElementById('bicep-output').textContent=generateBicep();document.getElementById('bicep-modal').classList.add('show');}
