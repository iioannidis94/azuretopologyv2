export const aiCategory = {
  key: 'ai',
  label: 'AI & Analytics',
  resources: {
    foundry: {
      icon: '🤖',
      img: 'Cognitive-Services.svg',
      color: '#0078D4',
      label: 'AI Foundry',
      cost: 100,
      pricingCalculatorSlug: 'azure-ai-foundry',
      config: { sku: 'S0', kind: 'AIServices', customSubdomain: '', networkRules: 'Allow' },
      validation: { critical: ['sku', 'kind'], warning: ['customSubdomain'] },
      importMappings: {
        'sku.name': 'sku',
        'kind': 'kind',
        'properties.customSubDomainName': 'customSubdomain',
        'properties.networkAcls.defaultAction': 'networkRules'
      }
    },
    openai: {
      icon: '🧠',
      img: 'Cognitive-Services.svg',
      color: '#50E6FF',
      label: 'Azure OpenAI',
      cost: 150,
      pricingCalculatorSlug: 'azure-openai',
      azureTypes: ['microsoft.cognitiveservices/accounts'],
      config: { model: 'gpt-4o', deploymentName: 'gpt-4o', capacity: '10', modelVersion: 'latest', contentFilter: 'Default' },
      validation: { critical: ['model', 'deploymentName'], warning: ['capacity', 'modelVersion'] },
      importMappings: {
        'properties.deployments[0].properties.model.name': 'model',
        'properties.deployments[0].name': 'deploymentName',
        'properties.deployments[0].sku.capacity': 'capacity',
        'properties.deployments[0].properties.model.version': 'modelVersion'
      }
    }
  }
};
