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
      fieldOptions: {
        workspaceSku: { options: ['PerGB2018', 'CapacityReservation', 'Free', 'Standalone', 'PerNode'] }
      },
      validation: { critical: ['workspaceSku'], warning: ['retentionDays'] },
      importMappings: {
        'properties.sku.name': 'workspaceSku',
        'properties.retentionInDays': 'retentionDays',
        'properties.workspaceCapping.dailyQuotaGb': 'dailyCapGB'
      }
    },
    appi: {
      icon: '📊',
      img: 'Application-Insights.svg',
      color: '#8764B8',
      label: 'Application Insights',
      cost: 15,
      pricingCalculatorSlug: 'monitor',
      azureTypes: ['microsoft.insights/components'],
      config: { kind: 'web', applicationType: 'web', workspaceResourceId: '' },
      fieldOptions: {
        kind: { options: ['web', 'java', 'other'] },
        applicationType: { options: ['web', 'other'] }
      },
      validation: { critical: ['applicationType'], warning: ['workspaceResourceId'] },
      importMappings: {
        'kind': 'kind',
        'properties.Application_Type': 'applicationType',
        'properties.WorkspaceResourceId': 'workspaceResourceId'
      },
      dependencies: ['Log Analytics Workspace (optional)']
    }
  }
};
