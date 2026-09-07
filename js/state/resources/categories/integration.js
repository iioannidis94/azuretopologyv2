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
      fieldOptions: {
        appServicePlanSku: { options: ['B1', 'B2', 'S1', 'S2', 'P1v3', 'P2v3', 'P3v3'] },
        runtime: { options: ['dotnet', 'node', 'python', 'java', 'php'] },
        runtimeVersion: { options: ['6.0', '8.0', '18', '20', '3.11', '17'] },
        minTlsVersion: { options: ['1.0', '1.1', '1.2', '1.3'] },
        managedIdentity: { options: ['SystemAssigned', 'UserAssigned', 'None'] }
      },
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
      fieldOptions: {
        tier: { options: ['Consumption', 'Developer', 'Basic', 'Standard', 'Premium', 'Isolated'] },
        vnetType: { options: ['None', 'External', 'Internal'] }
      },
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
      fieldOptions: {
        tier: { options: ['Basic', 'Standard', 'Premium'] }
      },
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
      fieldOptions: {
        plan: { options: ['Basic', 'Standard', 'Premium', 'Dedicated'] }
      },
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
      fieldOptions: {
        plan: { options: ['Consumption', 'Standard'] },
        state: { options: ['Enabled', 'Disabled'] },
        triggerType: { options: ['HTTP', 'Recurrence', 'ServiceBus', 'EventGrid'] }
      },
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
      fieldOptions: {
        sku: { options: ['Free', 'Standard'] },
        publicNetworkAccess: { options: ['Enabled', 'Disabled'] }
      },
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
      fieldOptions: {
        sku: { options: ['Basic'] },
        inputSchema: { options: ['EventGridSchema', 'CloudEventSchemaV1_0', 'CustomEventSchema'] },
        publicNetworkAccess: { options: ['Enabled', 'Disabled'] }
      },
      validation: { critical: ['sku'], warning: ['inputSchema', 'publicNetworkAccess'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.inputSchema': 'inputSchema',
        'properties.publicNetworkAccess': 'publicNetworkAccess'
      }
    }
  }
};
