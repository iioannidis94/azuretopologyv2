export const securityCategory = {
  key: 'security',
  label: 'Security',
  resources: {
    kv: {
      icon: '🔑',
      img: 'Key-Vaults.svg',
      color: '#FF8C00',
      label: 'Key Vault',
      cost: 5,
      pricingCalculatorSlug: 'key-vault',
      azureTypes: ['microsoft.keyvault/vaults'],
      config: { sku: 'Premium', softDeleteDays: '90', purgeProtection: 'true', enableRbacAuth: 'true', networkAcls: 'Allow' },
      validation: { critical: ['sku'], warning: ['softDeleteDays', 'purgeProtection'] },
      importMappings: {
        'properties.sku.name': 'sku',
        'properties.softDeleteRetentionInDays': 'softDeleteDays',
        'properties.enablePurgeProtection': 'purgeProtection',
        'properties.enableRbacAuthorization': 'enableRbacAuth',
        'properties.networkAcls.defaultAction': 'networkAcls'
      }
    }
  }
};
