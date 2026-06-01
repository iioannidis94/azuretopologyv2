import { RES_TYPES, AZURE_PRICING_CALCULATOR_BASE_URL, PRICING_CALCULATOR_PARAM_NAME, PRICING_CALCULATOR_SLUGS } from './resource-types.js';
import { getAllDiagramResources } from './state-helpers.js';

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

export function getPricingCalculatorUrl(resourceTypes){
  const slugs=[...new Set(resourceTypes.map(type=>PRICING_CALCULATOR_SLUGS[type]).filter(Boolean))];
  if(!slugs.length) return '';
  const params=new URLSearchParams();
  slugs.forEach(slug=>params.append(PRICING_CALCULATOR_PARAM_NAME,slug));
  return `${AZURE_PRICING_CALCULATOR_BASE_URL}?${params.toString()}`;
}

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
