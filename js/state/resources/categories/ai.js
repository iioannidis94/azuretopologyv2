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
      fieldOptions: {
        sku: { options: ['S0', 'S1'] },
        kind: { options: ['AIServices', 'CognitiveServices'] },
        networkRules: { options: ['Allow', 'Deny'] }
      },
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
      fieldOptions: {
        model: { options: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'text-embedding-3-large'] },
        modelVersion: { options: ['latest', '2024-08-06', '2024-11-20'] },
        contentFilter: { options: ['Default', 'Strict', 'Relaxed'] }
      },
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
