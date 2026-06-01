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
  pe:{icon:'🔌', img:'private-endpoint.svg', color:'#8764B8',label:'Private Endpoint',cat:'network', cost: 10, config:{target:'Storage',groupId:'blob',privateDnsZoneId:'',connectionName:'',subResource:'blob'}},
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
  evh:{icon:'📤', img:'event-hubs.svg', color:'#8764B8',label:'Event Hub',cat:'integration', cost: 30, config:{tier:'Standard',throughputUnits:'1',partitions:'4',retentionDays:'7',captureEnabled:'false'}},
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

// ================================================================
// STATE
// ================================================================
export const KEY='azureBuilderV11';
export const SUB_COLORS=['#FFB900','#00BCF2','#00B294','#FF8C00','#8764B8'];
export const RG_COLORS=['#8764B8','#0078D4','#00B294','#FF8C00','#E81123'];
export const VNET_COLORS=['#0078D4','#00BCF2','#00B294','#FF8C00','#8764B8','#107C10'];

const defaultState={
  theme:'dark', layout:'grid',
  onPrem: { enabled: false, id: 'onprem', name: 'Corp Datacenter', cidr: '192.168.0.0/16' },
  mgEnabled: false,
  managementGroups: [],
  customPos: {}, 
  subscriptions:[
    {id:'sub-1',name:'My Subscription',subscriptionId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tenantId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tags:{},mgId:null}
  ],
  resourceGroups:[
    {id:'rg-1', name:'rg-main', location:'eastus', subId:'sub-1', tags:{}, lock:'None', budgetLimit:'', budgetAlertThreshold:'80'}
  ],
  rgResources:[],
  hub:{
    id:'hub',name:'hub-vnet',cidr:'10.0.0.0/16',color:'#0078D4',rgId:'rg-1', peerings: [], peeringConfigs: {},
    subnets:[{id:'sn-hub-default', name:'default', cidr:'10.0.0.0/24', resources:[]}]
  },
  spokes:[],
  selectedId:null, offset:{x:0,y:0}, scale:1, dragging:false, dragStart:{x:0,y:0}, offsetStart:{x:0,y:0}, dragNodeId:null, dragGroup:null
};

export let state;
try{
  const s=localStorage.getItem(KEY);
  state=s?JSON.parse(s):JSON.parse(JSON.stringify(defaultState));
  state.dragging=false; state.dragNodeId=null; state.dragGroup=null;
  if(!state.rgResources) state.rgResources=[];
  if(!state.hub.peeringConfigs) state.hub.peeringConfigs={};
  state.spokes.forEach(s => { if(!s.peeringConfigs) s.peeringConfigs = {}; });
  if(state.mgEnabled===undefined) state.mgEnabled=false;
  if(!state.managementGroups) state.managementGroups=[];
  state.subscriptions.forEach(s => { if(s.mgId===undefined) s.mgId=null; });
  if(state.theme==='dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');
}catch(e){state=JSON.parse(JSON.stringify(defaultState));}

// ================================================================
// UNDO / REDO HISTORY
// ================================================================
const MAX_HISTORY = 5;
const _undoStack = [];
const _redoStack = [];
let _isUndoRedoAction = false;

// Properties that are transient and should NOT be tracked in history
const TRANSIENT_KEYS = ['dragging','dragStart','offsetStart','dragNodeId','dragGroup','selectedId','offset','scale','mouseStart','dragNodeStart'];

/** Stable JSON serialization (sorted keys) to avoid false positives from key-order changes */
function _stableStringify(obj) {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(v => _stableStringify(v)).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

function _getSerializableState() {
  const snap = {};
  const keys = Object.keys(state).filter(k => !TRANSIENT_KEYS.includes(k)).sort();
  for (const key of keys) {
    snap[key] = JSON.parse(JSON.stringify(state[key]));
  }
  return snap;
}

function _restoreSnapshot(snap) {
  for (const key of Object.keys(state)) {
    if (!TRANSIENT_KEYS.includes(key)) delete state[key];
  }
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  if (state.theme === 'dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');
}

// Initialize _lastSavedSnapshot immediately with the loaded state
let _lastSavedSnapshot = _getSerializableState();

// Render-only function (no save) - injected by main.js
let _renderAll = null;
export function setRenderAll(fn) { _renderAll = fn; }
function renderAll() { if (_renderAll) _renderAll(); }

/** Called after saveState to record the new state in history */
function _recordStateForUndo() {
  if (_isUndoRedoAction) return;
  const snap = _getSerializableState();
  // If this is identical to the last saved snapshot, skip
  if (_lastSavedSnapshot && _stableStringify(_lastSavedSnapshot) === _stableStringify(snap)) return;
  // Push the PREVIOUS state to undo stack (so we can go back to it)
  if (_lastSavedSnapshot !== null) {
    _undoStack.push(_lastSavedSnapshot);
    if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    _redoStack.length = 0;
  }
  _lastSavedSnapshot = snap;
}

/** Undo last action */
export function undo() {
  if (_undoStack.length === 0) return;
  _isUndoRedoAction = true;
  try {
    // Push current state to redo
    _redoStack.push(_getSerializableState());
    const prev = _undoStack.pop();
    _restoreSnapshot(prev);
    _lastSavedSnapshot = prev;
    localStorage.setItem(KEY, JSON.stringify(state));
    // Use render-only path to avoid saveState interference
    renderAll();
  } finally {
    _isUndoRedoAction = false;
  }
}

/** Redo last undone action */
export function redo() {
  if (_redoStack.length === 0) return;
  _isUndoRedoAction = true;
  try {
    // Push current state to undo
    _undoStack.push(_getSerializableState());
    const next = _redoStack.pop();
    _restoreSnapshot(next);
    _lastSavedSnapshot = next;
    localStorage.setItem(KEY, JSON.stringify(state));
    // Use render-only path to avoid saveState interference
    renderAll();
  } finally {
    _isUndoRedoAction = false;
  }
}

export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
export const uid=()=>'id-'+Math.random().toString(36).substring(2,11);
export const esc=s=>String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function saveState(){
  localStorage.setItem(KEY,JSON.stringify(state));
  _recordStateForUndo();
}

export function getAllDiagramResources(){
  const vnetRes = [state.hub, ...state.spokes].flatMap(vnet => vnet.subnets.flatMap(sn => sn.resources));
  return [...vnetRes, ...(state.rgResources || [])];
}

export function getPricingCalculatorUrl(resourceTypes){
  const slugs=[...new Set(resourceTypes.map(type=>PRICING_CALCULATOR_SLUGS[type]).filter(Boolean))];
  if(!slugs.length) return '';
  const params=new URLSearchParams();
  slugs.forEach(slug=>params.append(PRICING_CALCULATOR_PARAM_NAME,slug));
  return `${AZURE_PRICING_CALCULATOR_BASE_URL}?${params.toString()}`;
}

// ================================================================
// DYNAMIC PRICING TABLES
// ================================================================
const PRICING_TABLES = {
  vm: { 'Standard_B2s': 35, 'Standard_D2s_v3': 85, 'Standard_D4s_v3': 170, 'Standard_D8s_v3': 340, 'Standard_D16s_v3': 680, 'Standard_E2s_v3': 90, 'Standard_E4s_v3': 180, 'Standard_F2s_v2': 60, 'Standard_F4s_v2': 120 },
  vmss: { 'Standard_B2s': 35, 'Standard_D2s_v3': 85, 'Standard_D4s_v3': 170, 'Standard_D8s_v3': 340 },
  aks: { 'Standard_D2s_v3': 50, 'Standard_D4s_v3': 100, 'Standard_D8s_v3': 200 },
  sql: { 'GeneralPurpose': { 2: 190, 4: 380, 8: 760, 16: 1520 }, 'BusinessCritical': { 2: 450, 4: 900, 8: 1800, 16: 3600 } },
  sa: { 'Standard_LRS': 20, 'Standard_ZRS': 25, 'Standard_GRS': 35, 'Standard_RAGRS': 40, 'Premium_LRS': 60 },
  redis: { 'Basic C0': 15, 'Basic C1': 25, 'Standard C0': 40, 'Standard C1': 60, 'Premium P1': 120, 'Premium P2': 240, 'Premium P3': 480 },
  app: { 'B1': 55, 'B2': 110, 'B3': 165, 'S1': 73, 'S2': 146, 'S3': 292, 'P1v3': 220, 'P2v3': 440, 'P3v3': 880 },
  apim: { 'Developer': 50, 'Basic': 150, 'Standard': 700, 'Premium': 2800 },
  sb: { 'Basic': 5, 'Standard': 10, 'Premium': 50 },
  evh: { 'Basic': 10, 'Standard': 30, 'Premium': 90, 'Dedicated': 500 },
  cosmos: { 'Session': 400 },
  fw: { 'Standard': 650, 'Premium': 900 },
  agw: { 'Standard_v2': 250, 'WAF_v2': 350 },
  foundry: { 'F0': 0, 'S0': 100 },
};

export function calculateDynamicCost(res) {
  const c = res.config || {};
  const baseCost = (RES_TYPES[res.type] && RES_TYPES[res.type].cost) || 0;
  
  switch(res.type) {
    case 'vm': {
      const sizeKey = c.size || 'Standard_D2s_v3';
      return PRICING_TABLES.vm[sizeKey] || baseCost;
    }
    case 'vmss': {
      const sizeKey = c.size || 'Standard_D2s_v3';
      const perInstance = PRICING_TABLES.vmss[sizeKey] || 85;
      return perInstance * (parseInt(c.instances) || 2);
    }
    case 'aks': {
      const nodeSize = c.nodeSize || 'Standard_D2s_v3';
      const perNode = PRICING_TABLES.aks[nodeSize] || 50;
      return perNode * (parseInt(c.nodes) || 3);
    }
    case 'sql': {
      const tier = c.tier || 'GeneralPurpose';
      const vcores = parseInt(c.vcores) || 4;
      const tierPricing = PRICING_TABLES.sql[tier] || PRICING_TABLES.sql['GeneralPurpose'];
      return tierPricing[vcores] || tierPricing[4] || baseCost;
    }
    case 'sa': {
      const skuKey = `${c.tier||'Standard'}_${c.replication||'ZRS'}`;
      return PRICING_TABLES.sa[skuKey] || baseCost;
    }
    case 'redis': {
      const skuKey = c.sku || 'Premium P1';
      return PRICING_TABLES.redis[skuKey] || baseCost;
    }
    case 'app': {
      const skuKey = c.appServicePlanSku || c.sku || 'P1v3';
      return PRICING_TABLES.app[skuKey] || baseCost;
    }
    case 'apim': {
      const tier = c.tier || 'Developer';
      const capacity = parseInt(c.capacity) || 1;
      return (PRICING_TABLES.apim[tier] || baseCost) * capacity;
    }
    case 'sb': {
      const tier = c.tier || 'Premium';
      const units = parseInt(c.messagingUnits) || 1;
      return (PRICING_TABLES.sb[tier] || baseCost) * (tier === 'Premium' ? units : 1);
    }
    case 'evh': {
      const tier = c.tier || 'Standard';
      const tus = parseInt(c.throughputUnits) || 1;
      return (PRICING_TABLES.evh[tier] || baseCost) * tus;
    }
    case 'fw': {
      const sku = c.sku || 'Premium';
      return PRICING_TABLES.fw[sku] || baseCost;
    }
    case 'agw': {
      const sku = c.sku || 'WAF_v2';
      const capacity = parseInt(c.capacity) || 2;
      // Base price is for capacity=2 (default), scale linearly
      return (PRICING_TABLES.agw[sku] || baseCost) * (capacity / 2);
    }
    case 'foundry': {
      const sku = c.sku || 'S0';
      return PRICING_TABLES.foundry[sku] || baseCost;
    }
    default:
      return baseCost;
  }
}

export function updateCost() {
  let total = 0;
  const usedResourceTypes = new Set();
  getAllDiagramResources().forEach(r => {
    total += calculateDynamicCost(r);
    if(PRICING_CALCULATOR_SLUGS[r.type]) usedResourceTypes.add(r.type);
  });
  const costEl = document.getElementById('cost-display');
  const newText = `$${total.toLocaleString()}`;
  if (costEl.innerText !== newText) {
    costEl.innerText = newText;
    costEl.classList.add('cost-flash');
    setTimeout(() => costEl.classList.remove('cost-flash'), 600);
  }
  const pricingLink=document.getElementById('pricing-calculator-link');
  const pricingUrl=getPricingCalculatorUrl([...usedResourceTypes]);
  if(pricingUrl){
    pricingLink.href=pricingUrl;
    pricingLink.classList.remove('is-hidden');
  }else{
    pricingLink.href=AZURE_PRICING_CALCULATOR_BASE_URL;
    pricingLink.classList.add('is-hidden');
  }
}

export function getVnetsInRg(rgId){
  const result=[];
  if(state.hub.rgId===rgId) result.push(state.hub);
  state.spokes.forEach(s=>{if(s.rgId===rgId)result.push(s);});
  return result;
}

export function resetDiagram(){if(confirm('Delete all changes and reset to default?')){localStorage.removeItem(KEY);location.reload();}}
export function resetPositions(){if(confirm('Clear Drag&Drop positions and return to auto-layout?')){state.customPos={};fullUpdate();}}

// fullUpdate will be set by main.js after all modules are loaded
let _fullUpdate = null;
export function setFullUpdate(fn) { _fullUpdate = fn; }
export function fullUpdate() { if (_fullUpdate) _fullUpdate(); }

// ================================================================
// CIDR VALIDATION & DYNAMIC SUBNETTING
// ================================================================
export function parseCidr(cidr) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec((cidr||'').trim());
  if (!m) return null;
  const octets = [+m[1],+m[2],+m[3],+m[4]];
  const prefix = +m[5];
  if (octets.some(o => o < 0 || o > 255)) return null;
  if (prefix < 0 || prefix > 32) return null;
  const ip = ((octets[0]<<24)|(octets[1]<<16)|(octets[2]<<8)|octets[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { ip, mask, prefix, network, broadcast, octets };
}

export function cidrToString(network, prefix) {
  return `${(network>>>24)&255}.${(network>>>16)&255}.${(network>>>8)&255}.${network&255}/${prefix}`;
}

export function isValidCidr(cidr) {
  const p = parseCidr(cidr);
  if (!p) return false;
  return p.ip === p.network;
}

export function cidrsOverlap(cidr1, cidr2) {
  const a = parseCidr(cidr1), b = parseCidr(cidr2);
  if (!a || !b) return false;
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

export function getAllVnetCidrs() {
  return [state.hub, ...state.spokes].map(v => v.cidr).filter(Boolean);
}

export function checkCidrOverlap(newCidr, excludeVnetId) {
  const allVnets = [state.hub, ...state.spokes];
  for (const v of allVnets) {
    if (v.id === excludeVnetId) continue;
    if (cidrsOverlap(newCidr, v.cidr)) return v;
  }
  return null;
}

export function autoSubnet(vnetCidr, numSubnets) {
  const p = parseCidr(vnetCidr);
  if (!p) return [];
  const bitsNeeded = Math.ceil(Math.log2(Math.max(numSubnets, 1)));
  const subnetPrefix = Math.min(p.prefix + bitsNeeded, 28);
  const subnetSize = (1 << (32 - subnetPrefix)) >>> 0;
  const maxSubnets = 1 << (subnetPrefix - p.prefix);
  const results = [];
  for (let i = 0; i < Math.min(numSubnets, maxSubnets); i++) {
    const subnetNetwork = (p.network + i * subnetSize) >>> 0;
    results.push(cidrToString(subnetNetwork, subnetPrefix));
  }
  return results;
}

export function nextAvailableVnetCidr() {
  const existingCidrs = getAllVnetCidrs();
  for (let second = 0; second <= 255; second++) {
    const candidate = `10.${second}.0.0/16`;
    const overlaps = existingCidrs.some(c => cidrsOverlap(candidate, c));
    if (!overlaps) return candidate;
  }
  return '172.16.0.0/16';
}

export function nextAvailableSubnetCidr(vnetId) {
  const vnet = [state.hub, ...state.spokes].find(v => v.id === vnetId);
  if (!vnet) return '10.0.0.0/24';
  const vnetParsed = parseCidr(vnet.cidr);
  if (!vnetParsed) return '10.0.0.0/24';
  const existingSubnets = vnet.subnets.map(sn => sn.cidr).filter(c => parseCidr(c));
  return nextAvailableSubnetCidrFromParsed(vnetParsed, existingSubnets);
}

export function nextAvailableSubnetCidrFromParsed(vnetParsed, existingSubnets) {
  const subnetPrefix = 24;
  const subnetSize = (1 << (32 - subnetPrefix)) >>> 0;
  let candidate = vnetParsed.network;
  while (candidate <= vnetParsed.broadcast) {
    const candidateCidr = cidrToString(candidate, subnetPrefix);
    const overlaps = existingSubnets.some(c => cidrsOverlap(candidateCidr, c));
    if (!overlaps) return candidateCidr;
    candidate = (candidate + subnetSize) >>> 0;
  }
  return cidrToString(vnetParsed.network, subnetPrefix);
}

// ================================================================
// RG-LEVEL RESOURCES
// ================================================================
export function getRgResources(rgId) {
  if (!state.rgResources) state.rgResources = [];
  return state.rgResources.filter(r => r.rgId === rgId);
}

export function getAllDiagramResourcesIncludingRg() {
  const vnetRes = [state.hub, ...state.spokes].flatMap(vnet => vnet.subnets.flatMap(sn => sn.resources));
  return [...vnetRes, ...(state.rgResources || [])];
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
