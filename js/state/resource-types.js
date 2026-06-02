// ================================================================
// RESOURCE TYPES (With Monthly Cost Estimates)
// ================================================================
export const AZURE_ICON_BASE = 'https://cdn.jsdelivr.net/gh/benc-uk/icon-collection@master/azure-icons/';

export const RES_CATEGORIES={compute:'Compute',network:'Networking',data:'Data & Storage',security:'Security',integration:'Integration',ai:'AI & Analytics',management:'Management'};
export const RES_TYPES={
  vm:{icon:'💻', img:'virtual-machines.svg', color:'#00BCF2',label:'Virtual Machine',cat:'compute', cost: 85, config:{size:'Standard_D2s_v3',os:'Ubuntu 22.04',osDiskType:'Premium_LRS',osDiskSizeGB:'128',dataDisks:'0',dataDiskSizeGB:'256',dataDiskType:'Premium_LRS',authType:'SSH Key',availabilityZone:'None',acceleratedNetworking:'true',publicIp:'false',bootDiagnostics:'true',managedIdentity:'SystemAssigned',backupEnabled:'false',patchMode:'AutomaticByPlatform',securityType:'TrustedLaunch',vTpmEnabled:'true',secureBootEnabled:'true'}},
  vmss:{icon:'🖥️', img:'virtual-machine-scale-sets.svg', color:'#00A4EF',label:'VM Scale Set',cat:'compute', cost: 250, config:{size:'Standard_D2s_v3',instances:'2',minInstances:'2',maxInstances:'10',upgradePolicy:'Rolling',zones:'1,2,3',healthProbe:'TCP/80',os:'Ubuntu 22.04'}},
  aks:{icon:'☸️', img:'kubernetes-services.svg', color:'#0078D4',label:'AKS Cluster',cat:'compute', cost: 150, config:{nodes:'3',version:'1.29',nodeSize:'Standard_D2s_v3',networkPlugin:'azure',podCidr:'10.244.0.0/16',serviceCidr:'10.0.0.0/16',dnsServiceIp:'10.0.0.10',privateCluster:'false',tier:'Standard'}},
  fa:{icon:'⚡', img:'function-apps.svg', color:'#8764B8',label:'Function App',cat:'compute', cost: 20, config:{plan:'Consumption',runtime:'node',runtimeVersion:'20',osType:'Linux',alwaysOn:'false',storageAccountName:''}},
  aca:{icon:'📦', img:'container-instances.svg', color:'#8764B8',label:'Container Apps',cat:'compute', cost: 40, config:{replicas:'10',minReplicas:'1',cpu:'0.5',memory:'1.0Gi',image:'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest',ingress:'external',targetPort:'80',environmentName:''}},
  fw:{icon:'🛡️', img:'firewalls.svg', color:'#E81123',label:'Azure Firewall',cat:'network', cost: 900, config:{sku:'Premium',threatIntelMode:'Alert',dnsProxy:'true',policyName:'',availabilityZones:'1,2,3'}},
  nva:{icon:'🧱', img:'network-appliances.svg', color:'#E81123',label:'FortiGate NVA',cat:'network', cost: 600, config:{mode:'Active/Passive',vendor:'Fortinet',version:'7.4',licenseType:'PAYG',size:'Standard_F4s_v2'}},
  agw:{icon:'🌍', img:'application-gateways.svg', color:'#FF8C00',label:'App Gateway',cat:'network', cost: 350, config:{sku:'WAF_v2',capacity:'2',tier:'WAF_v2',sslPolicy:'AppGwSslPolicy20220101',httpListeners:'HTTP:80'}},
  lb:{icon:'⚖️', img:'load-balancers.svg', color:'#00BCF2',label:'Load Balancer',cat:'network', cost: 25, config:{sku:'Standard',type:'Internal',frontendIp:'Dynamic',healthProbe:'TCP/80',lbRules:'HTTP:80->80'}},
  gw:{icon:'🔀', img:'virtual-network-gateways.svg', color:'#0078D4',label:'VPN Gateway',cat:'network', cost: 140, config:{sku:'VpnGw2AZ',generation:'Generation2',vpnType:'RouteBased',activeActive:'false',bgpAsn:'65515'}},
  ergw:{icon:'🚄', img:'expressroute-circuits.svg', color:'#003A5C',label:'ExpressRoute GW',cat:'network', cost: 450, config:{sku:'ErGw2AZ',gatewayType:'ExpressRoute',expressRouteCircuitId:''}},
  bas:{icon:'🔒', img:'bastions.svg', color:'#0078D4',label:'Azure Bastion',cat:'network', cost: 190, config:{sku:'Standard',scaleUnits:'2',shareableLink:'false',ipConnect:'true',tunneling:'true'}},
  afd:{icon:'⚡', img:'front-doors.svg', color:'#FF8C00',label:'Azure Front Door',cat:'network', cost: 330, config:{sku:'Premium',endpoints:'default-endpoint',originGroups:'default-origin-group',wafPolicy:'',routingRules:'default-route'}},
  pe:{icon:'🔌', img:'private-endpoint.svg', color:'#8764B8',label:'Private Endpoint',cat:'network', cost: 10, config:{target:'Storage',groupId:'blob',privateDnsZoneId:'',connectionName:'',subResource:'blob',targetResourceId:'',targetResourceName:''}},
  dns:{icon:'🌐', img:'dns-zones.svg', color:'#00B294',label:'Private DNS Zone',cat:'network', cost: 5, config:{zone:'privatelink.blob.core.windows.net',fullZoneName:'privatelink.blob.core.windows.net',vnetLinks:'',autoRegistration:'false'}, rgLevel:true, dnsType:'private'},
  publicDns:{icon:'🌍', img:'dns-zones.svg', color:'#00BCF2',label:'Public DNS Zone',cat:'network', cost: 5, config:{zone:'example.com', records:[]}, rgLevel:true, dnsType:'public'},
  nsg:{icon:'📋', img:'network-security-groups.svg', color:'#E81123',label:'Network Sec Group',cat:'network', cost: 0, config:{rules:'[{"name":"Allow-HTTP","priority":"100","direction":"Inbound","access":"Allow","protocol":"Tcp","srcPort":"*","dstPort":"80","srcAddr":"*","dstAddr":"*"},{"name":"Allow-HTTPS","priority":"110","direction":"Inbound","access":"Allow","protocol":"Tcp","srcPort":"*","dstPort":"443","srcAddr":"*","dstAddr":"*"}]'}},
  sql:{icon:'🗄️', img:'sql-databases.svg', color:'#00B294',label:'Azure SQL',cat:'data', cost: 380, config:{serverName:'',vcores:'4',tier:'GeneralPurpose',maxSizeGB:'32',collation:'SQL_Latin1_General_CP1_CI_AS',backupRetentionDays:'7',zoneRedundant:'false'}},
  cosmos:{icon:'🌌', img:'azure-cosmos-db.svg', color:'#00B294',label:'Cosmos DB',cat:'data', cost: 400, config:{api:'NoSQL',consistencyLevel:'Session',geoReplication:'false',maxRU:'4000',enableFreeTier:'false',serverless:'false'}},
  sa:{icon:'💾', img:'storage-accounts.svg', color:'#00B294',label:'Storage Account',cat:'data', cost: 25, config:{replication:'ZRS',kind:'StorageV2',tier:'Standard',accessTier:'Hot',httpsOnly:'true',minTlsVersion:'TLS1_2'}},
  redis:{icon:'⚡', img:'azure-cache-for-redis.svg', color:'#E81123',label:'Azure Cache Redis',cat:'data', cost: 120, config:{sku:'Premium P1',capacity:'1',enableNonSslPort:'false',minTlsVersion:'1.2',zones:'',replicasPerPrimary:'1'}},
  adls:{icon:'🗃️', img:'storage-accounts.svg', color:'#0078D4',label:'Data Lake',cat:'data', cost: 50, config:{tier:'Standard',hierarchicalNamespace:'true',replication:'LRS',enableSoftDelete:'true'}},
  kv:{icon:'🔑', img:'key-vaults.svg', color:'#FF8C00',label:'Key Vault',cat:'security', cost: 5, config:{sku:'Premium',softDeleteDays:'90',purgeProtection:'true',enableRbacAuth:'true',networkAcls:'Allow'}},
  app:{icon:'📱', img:'app-services.svg', color:'#00BCF2',label:'App Service',cat:'integration', cost: 220, config:{appServicePlanName:'',appServicePlanSku:'P1v3',runtime:'dotnet',runtimeVersion:'8.0',alwaysOn:'true',httpsOnly:'true',minTlsVersion:'1.2',managedIdentity:'SystemAssigned'}},
  apim:{icon:'🔌', img:'api-management.svg', color:'#FF8C00',label:'API Management',cat:'integration', cost: 700, config:{tier:'Developer',capacity:'1',publisherName:'MyOrganization',publisherEmail:'admin@example.com',vnetType:'None'}},
  sb:{icon:'📨', img:'service-bus.svg', color:'#8764B8',label:'Service Bus',cat:'integration', cost: 50, config:{tier:'Premium',messagingUnits:'1',capacity:'1',zoneRedundant:'true'}},
  evh:{icon:'📤', img:'event-hubs.svg', color:'#8764B8',label:'Event Hub',cat:'integration', cost: 30, config:{plan:'Standard',throughputUnits:'1',partitions:'4',retentionDays:'7',captureEnabled:'false'}},
  logic:{icon:'🔄', img:'logic-apps.svg', color:'#8764B8',label:'Logic App',cat:'integration', cost: 15, config:{plan:'Standard',state:'Enabled',triggerType:'HTTP',connectors:'',storageAccountName:''}},
  foundry:{icon:'🤖', img:'cognitive-services.svg', color:'#0078D4',label:'AI Foundry',cat:'ai', cost: 100, config:{sku:'S0',kind:'AIServices',customSubdomain:'',networkRules:'Allow'}},
  openai:{icon:'🧠', img:'cognitive-services.svg', color:'#50E6FF',label:'Azure OpenAI',cat:'ai', cost: 150, config:{model:'gpt-4o',deploymentName:'gpt-4o',capacity:'10',modelVersion:'latest',contentFilter:'Default'}},
  monitor:{icon:'📈', img:'monitor.svg', color:'#00B294',label:'Azure Monitor',cat:'management', cost: 15, config:{retentionDays:'90',workspaceSku:'PerGB2018',dailyCapGB:'',solutions:''}},
};

export const AZURE_PRICING_CALCULATOR_BASE_URL='https://azure.microsoft.com/en-us/pricing/calculator';
export const PRICING_CALCULATOR_PARAM_NAME='service';
export const PRICING_CALCULATOR_SLUGS={
  vm:'virtual-machines',
  vmss:'virtual-machine-scale-sets',
  aks:'kubernetes-service',
  fa:'functions',
  aca:'container-apps',
  fw:'azure-firewall',
  nva:'virtual-machines',
  agw:'application-gateway',
  lb:'load-balancer',
  gw:'vpn-gateway',
  ergw:'expressroute',
  bas:'azure-bastion',
  afd:'front-door',
  pe:'private-link',
  dns:'dns',
  publicDns:'dns',
  nsg:'network-security-groups',
  sql:'sql-database',
  cosmos:'cosmos-db',
  sa:'storage-accounts',
  redis:'azure-cache-for-redis',
  adls:'storage-accounts',
  kv:'key-vault',
  app:'app-service',
  apim:'api-management',
  sb:'service-bus',
  evh:'event-hubs',
  logic:'logic-apps',
  foundry:'azure-ai-foundry',
  openai:'azure-openai',
  monitor:'azure-monitor',
};

// ================================================================
// ICON LOADER
// ================================================================
export const loadedImages = {};
export function loadAzureIcons(callback) {
  let toLoad = Object.keys(RES_TYPES).length;
  let loaded = 0;
  Object.keys(RES_TYPES).forEach(key => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { loadedImages[key] = img; checkDone(); };
    img.onerror = () => { checkDone(); };
    img.src = AZURE_ICON_BASE + RES_TYPES[key].img;
  });
  function checkDone() { loaded++; if (loaded === toLoad && callback) callback(); }
}
