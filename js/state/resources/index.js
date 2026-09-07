import { deepClone } from './helpers.js';
import { aiCategory } from './categories/ai.js';
import { computeCategory } from './categories/compute.js';
import { dataCategory } from './categories/data.js';
import { integrationCategory } from './categories/integration.js';
import { managementCategory } from './categories/management.js';
import { networkCategory } from './categories/network.js';
import { securityCategory } from './categories/security.js';

export const AZURE_ICON_BASE = 'https://cdn.jsdelivr.net/gh/benc-uk/icon-collection@master/azure-icons/';
export const AZURE_PRICING_CALCULATOR_BASE_URL = 'https://azure.microsoft.com/en-us/pricing/calculator';
export const PRICING_CALCULATOR_PARAM_NAME = 'service';

export const RESOURCE_CATEGORY_DEFINITIONS = [
  computeCategory,
  networkCategory,
  dataCategory,
  securityCategory,
  integrationCategory,
  aiCategory,
  managementCategory
];

const resourceCatalog = {};
const resourceTypes = {};
const resourceRules = {};
const requiredFields = {};
const importMappings = {};
const pricingCalculatorSlugs = {};
const azureTypeMap = {};
const skipTypes = new Set();
const resourceCategories = {};

RESOURCE_CATEGORY_DEFINITIONS.forEach(category => {
  resourceCategories[category.key] = category.label;

  (category.skipTypes || []).forEach(type => skipTypes.add(type));

  Object.entries(category.resources || {}).forEach(([type, resource]) => {
    const {
      validation = { critical: [], warning: [] },
      importMappings: mappingSet = {},
      dependencies = [],
      pricingCalculatorSlug = '',
      azureTypes = [],
      ...definition
    } = resource;

    const normalizedDefinition = { ...definition, cat: category.key };
    const normalizedValidation = {
      critical: [...(validation.critical || [])],
      warning: [...(validation.warning || [])]
    };
    const normalizedDependencies = [...dependencies];

    resourceCatalog[type] = {
      definition: normalizedDefinition,
      rules: {
        validation: normalizedValidation,
        dependencies: normalizedDependencies
      },
      importMappings: mappingSet,
      pricingCalculatorSlug,
      azureTypes: [...azureTypes]
    };

    resourceTypes[type] = normalizedDefinition;
    resourceRules[type] = resourceCatalog[type].rules;
    requiredFields[type] = normalizedValidation;
    importMappings[type] = mappingSet;
    pricingCalculatorSlugs[type] = pricingCalculatorSlug;

    azureTypes.forEach(azureType => {
      azureTypeMap[azureType] = type;
    });
  });
});

export const RESOURCE_CATALOG = resourceCatalog;
export const RESOURCE_RULES = resourceRules;
export const RESOURCE_DEPENDENCIES = Object.fromEntries(
  Object.entries(resourceRules).map(([type, rules]) => [type, rules.dependencies])
);
export const RES_CATEGORIES = resourceCategories;
export const RES_TYPES = resourceTypes;
export const REQUIRED_FIELDS = requiredFields;
export const IMPORT_MAPPINGS = importMappings;
export const PRICING_CALCULATOR_SLUGS = pricingCalculatorSlugs;
export const AZURE_TYPE_MAP = azureTypeMap;
export const SKIP_TYPES = skipTypes;

export function cloneResourceDefaultConfig(type) {
  return deepClone(RES_TYPES[type]?.config || {});
}

export function mergeResourceConfigWithDefaults(type, config = {}) {
  return { ...cloneResourceDefaultConfig(type), ...deepClone(config || {}) };
}
