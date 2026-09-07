export const integrationCategory = {
  key: 'integration',
  label: 'Integration',
  resources: {
    app: {
      icon: '📱',
      img: 'App-Services.svg',
      color: '#00BCF2',
      label: 'App Service',
      cost: 220,
      pricingCalculatorSlug: 'app-service',
      azureTypes: ['microsoft.web/sites'],
      config: { appServicePlanName: '', appServicePlanSku: 'P1v3', runtime: 'dotnet', runtimeVersion: '8.0', alwaysOn: 'true', httpsOnly: 'true', minTlsVersion: '1.2', managedIdentity: 'SystemAssigned' },
      validation: { critical: ['appServicePlanSku', 'runtime'], warning: ['appServicePlanName', 'runtimeVersion'] },
      importMappings: {
        'properties.serverFarmId': { key: 'appServicePlanName', transform: (v) => v?.split('/').pop() || '' },
        'properties.siteConfig.linuxFxVersion': 'runtime',
        'properties.siteConfig.windowsFxVersion': 'runtime',
        'properties.siteConfig.alwaysOn': 'alwaysOn',
        'properties.httpsOnly': 'httpsOnly',
        'properties.siteConfig.minTlsVersion': 'minTlsVersion',
        'identity.type': 'managedIdentity'
      }
    },
    apim: {
      icon: '🔌',
      img: 'API-Management-Services.svg',
      color: '#FF8C00',
      label: 'API Management',
      cost: 700,
      pricingCalculatorSlug: 'api-management',
      azureTypes: ['microsoft.apimanagement/service'],
      config: { tier: 'Developer', capacity: '1', publisherName: 'MyOrganization', publisherEmail: 'admin@example.com', vnetType: 'None' },
      validation: { critical: ['tier', 'publisherName', 'publisherEmail'], warning: ['capacity'] },
      importMappings: {
        'sku.name': 'tier',
        'sku.capacity': 'capacity',
        'properties.publisherName': 'publisherName',
        'properties.publisherEmail': 'publisherEmail',
        'properties.virtualNetworkType': 'vnetType'
      }
    },
    sb: {
      icon: '📨',
      img: 'Service-Bus.svg',
      color: '#8764B8',
      label: 'Service Bus',
      cost: 50,
      pricingCalculatorSlug: 'service-bus',
      azureTypes: ['microsoft.servicebus/namespaces'],
      config: { tier: 'Premium', messagingUnits: '1', capacity: '1', zoneRedundant: 'true' },
      validation: { critical: ['tier'], warning: ['messagingUnits', 'zoneRedundant'] },
      importMappings: {
        'sku.name': 'tier',
        'sku.capacity': 'messagingUnits',
        'properties.zoneRedundant': 'zoneRedundant'
      }
    },
    evh: {
      icon: '📤',
      img: 'Event-Hubs.svg',
      color: '#8764B8',
      label: 'Event Hub',
      cost: 30,
      pricingCalculatorSlug: 'event-hubs',
      azureTypes: ['microsoft.eventhub/namespaces'],
      config: { plan: 'Standard', throughputUnits: '1', partitions: '4', retentionDays: '7', captureEnabled: 'false', kafkaEnabled: 'false' },
      validation: { critical: ['plan'], warning: ['throughputUnits', 'partitions', 'kafkaEnabled'] },
      importMappings: {
        'sku.name': 'plan',
        'sku.capacity': 'throughputUnits',
        'properties.kafkaEnabled': 'kafkaEnabled'
      }
    },
    logic: {
      icon: '🔄',
      img: 'Logic-Apps.svg',
      color: '#8764B8',
      label: 'Logic App',
      cost: 15,
      pricingCalculatorSlug: 'logic-apps',
      azureTypes: ['microsoft.logic/workflows'],
      config: { plan: 'Standard', state: 'Enabled', triggerType: 'HTTP', connectors: '', storageAccountName: '' },
      validation: { critical: ['plan'], warning: ['triggerType', 'storageAccountName'] },
      importMappings: {
        'sku.name': 'plan',
        'properties.state': 'state'
      },
      dependencies: ['Storage Account (optional/external)']
    },
    appcfg: {
      icon: '⚙️',
      img: 'App-Configuration.svg',
      color: '#00B294',
      label: 'App Configuration',
      cost: 10,
      pricingCalculatorSlug: 'app-configuration',
      azureTypes: ['microsoft.appconfiguration/configurationstores'],
      config: { sku: 'Standard', publicNetworkAccess: 'Enabled', disableLocalAuth: 'false' },
      validation: { critical: ['sku'], warning: ['publicNetworkAccess'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.publicNetworkAccess': 'publicNetworkAccess',
        'properties.disableLocalAuth': 'disableLocalAuth'
      }
    },
    egt: {
      icon: '📣',
      img: 'Event-Grid-Topics.svg',
      color: '#8764B8',
      label: 'Event Grid Topic',
      cost: 15,
      pricingCalculatorSlug: 'event-grid',
      azureTypes: ['microsoft.eventgrid/topics'],
      config: { sku: 'Basic', inputSchema: 'EventGridSchema', publicNetworkAccess: 'Enabled' },
      validation: { critical: ['sku'], warning: ['inputSchema', 'publicNetworkAccess'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.inputSchema': 'inputSchema',
        'properties.publicNetworkAccess': 'publicNetworkAccess'
      }
    }
  }
};
