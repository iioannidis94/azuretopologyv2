// ================================================================
// RESOURCE TYPES (With Monthly Cost Estimates)
// ================================================================
import {
  AZURE_ICON_BASE,
  AZURE_PRICING_CALCULATOR_BASE_URL,
  PRICING_CALCULATOR_PARAM_NAME,
  PRICING_CALCULATOR_SLUGS,
  RES_CATEGORIES,
  RES_TYPES,
  RESOURCE_CATALOG,
  RESOURCE_CATEGORY_DEFINITIONS,
  RESOURCE_DEPENDENCIES,
  RESOURCE_RULES,
  AZURE_TYPE_MAP,
  SKIP_TYPES,
  cloneResourceDefaultConfig,
  mergeResourceConfigWithDefaults
} from './resources/index.js';

export {
  AZURE_ICON_BASE,
  AZURE_PRICING_CALCULATOR_BASE_URL,
  PRICING_CALCULATOR_PARAM_NAME,
  PRICING_CALCULATOR_SLUGS,
  RES_CATEGORIES,
  RES_TYPES,
  RESOURCE_CATALOG,
  RESOURCE_CATEGORY_DEFINITIONS,
  RESOURCE_DEPENDENCIES,
  RESOURCE_RULES,
  AZURE_TYPE_MAP,
  SKIP_TYPES,
  cloneResourceDefaultConfig,
  mergeResourceConfigWithDefaults
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
