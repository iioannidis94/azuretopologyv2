export const managementCategory = {
  key: 'management',
  label: 'Management',
  resources: {
    monitor: {
      icon: '📈',
      img: 'Monitor.svg',
      color: '#00B294',
      label: 'Azure Monitor',
      cost: 15,
      pricingCalculatorSlug: 'azure-monitor',
      azureTypes: ['microsoft.operationalinsights/workspaces'],
      config: { retentionDays: '90', workspaceSku: 'PerGB2018', dailyCapGB: '', solutions: '' },
      validation: { critical: ['workspaceSku'], warning: ['retentionDays'] },
      importMappings: {
        'properties.sku.name': 'workspaceSku',
        'properties.retentionInDays': 'retentionDays',
        'properties.workspaceCapping.dailyQuotaGb': 'dailyCapGB'
      }
    }
  }
};
