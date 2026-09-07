export const computeCategory = {
  key: 'compute',
  label: 'Compute',
  resources: {
    vm: {
      icon: '💻',
      img: 'Virtual-Machine.svg',
      color: '#00BCF2',
      label: 'Virtual Machine',
      cost: 85,
      pricingCalculatorSlug: 'virtual-machines',
      azureTypes: ['microsoft.compute/virtualmachines'],
      config: { size: 'Standard_D2s_v3', os: 'Ubuntu 22.04', osDiskType: 'Premium_LRS', osDiskSizeGB: '128', dataDisks: '0', dataDiskSizeGB: '256', dataDiskType: 'Premium_LRS', authType: 'SSH Key', availabilityZone: 'None', acceleratedNetworking: 'true', publicIp: 'false', bootDiagnostics: 'true', managedIdentity: 'SystemAssigned', backupEnabled: 'false', patchMode: 'AutomaticByPlatform', securityType: 'TrustedLaunch', vTpmEnabled: 'true', secureBootEnabled: 'true' },
      validation: { critical: ['size', 'os'], warning: ['osDiskType', 'osDiskSizeGB'] },
      importMappings: {
        'properties.hardwareProfile.vmSize': 'size',
        'properties.storageProfile.osDisk.diskSizeGB': 'osDiskSizeGB',
        'properties.storageProfile.osDisk.managedDisk.storageAccountType': 'osDiskType',
        'properties.storageProfile.dataDisks.length': 'dataDisks',
        'properties.osProfile.linuxConfiguration': { key: 'os', value: 'Ubuntu 22.04' },
        'properties.osProfile.windowsConfiguration': { key: 'os', value: 'Windows Server 2022' },
        'zones[0]': 'availabilityZone',
        'properties.networkProfile.networkInterfaceConfigurations[0].properties.enableAcceleratedNetworking': 'acceleratedNetworking',
        'identity.type': 'managedIdentity'
      }
    },
    vmss: {
      icon: '🖥️',
      img: 'VM-Scale-Sets.svg',
      color: '#00A4EF',
      label: 'VM Scale Set',
      cost: 250,
      pricingCalculatorSlug: 'virtual-machine-scale-sets',
      azureTypes: ['microsoft.compute/virtualmachinescalesets'],
      config: { size: 'Standard_D2s_v3', instances: '2', minInstances: '2', maxInstances: '10', upgradePolicy: 'Rolling', zones: '1,2,3', healthProbe: 'TCP/80', os: 'Ubuntu 22.04', acceleratedNetworking: 'true' },
      validation: { critical: ['size', 'instances'], warning: ['minInstances', 'maxInstances', 'zones', 'acceleratedNetworking'] },
      importMappings: {
        'sku.name': 'size',
        'sku.capacity': 'instances',
        'properties.upgradePolicy.mode': 'upgradePolicy',
        'zones': 'zones',
        'properties.virtualMachineProfile.osProfile.linuxConfiguration': { key: 'os', value: 'Ubuntu 22.04' },
        'properties.virtualMachineProfile.osProfile.windowsConfiguration': { key: 'os', value: 'Windows Server 2022' },
        'properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].enableAcceleratedNetworking': 'acceleratedNetworking'
      }
    },
    aks: {
      icon: '☸️',
      img: 'Kubernetes-Services.svg',
      color: '#0078D4',
      label: 'AKS Cluster',
      cost: 150,
      pricingCalculatorSlug: 'kubernetes-service',
      azureTypes: ['microsoft.containerservice/managedclusters'],
      config: { nodes: '3', version: '1.29', nodeSize: 'Standard_D2s_v3', networkPlugin: 'azure', podCidr: '10.244.0.0/16', serviceCidr: '10.0.0.0/16', dnsServiceIp: '10.0.0.10', privateCluster: 'false', tier: 'Standard', availabilityZones: '1,2,3' },
      validation: { critical: ['nodes', 'version', 'nodeSize'], warning: ['networkPlugin', 'podCidr', 'serviceCidr', 'availabilityZones'] },
      importMappings: {
        'properties.kubernetesVersion': 'version',
        'properties.agentPoolProfiles[0].count': 'nodes',
        'properties.agentPoolProfiles[0].vmSize': 'nodeSize',
        'properties.agentPoolProfiles[0].availabilityZones': { key: 'availabilityZones', transform: (v) => Array.isArray(v) ? v.join(',') : (v || '') },
        'properties.networkProfile.networkPlugin': 'networkPlugin',
        'properties.networkProfile.podCidr': 'podCidr',
        'properties.networkProfile.serviceCidr': 'serviceCidr',
        'properties.networkProfile.dnsServiceIP': 'dnsServiceIp',
        'properties.apiServerAccessProfile.enablePrivateCluster': 'privateCluster',
        'sku.tier': 'tier'
      }
    },
    fa: {
      icon: '⚡',
      img: 'Function-Apps.svg',
      color: '#8764B8',
      label: 'Function App',
      cost: 20,
      pricingCalculatorSlug: 'functions',
      config: { plan: 'Consumption', runtime: 'node', runtimeVersion: '20', osType: 'Linux', alwaysOn: 'false', storageAccountName: '' },
      validation: { critical: ['runtime', 'runtimeVersion', 'storageAccountName'], warning: ['plan', 'osType'] },
      importMappings: {
        'properties.siteConfig.linuxFxVersion': 'runtime',
        'properties.siteConfig.windowsFxVersion': 'runtime',
        'kind': { transform: (v) => v?.includes('functionapp') ? 'fa' : 'app' },
        'properties.siteConfig.alwaysOn': 'alwaysOn'
      },
      dependencies: ['Storage Account (sa/adls)']
    },
    aca: {
      icon: '📦',
      img: 'Container-Instances.svg',
      color: '#8764B8',
      label: 'Container Apps',
      cost: 40,
      pricingCalculatorSlug: 'container-apps',
      azureTypes: ['microsoft.app/containerapps'],
      config: { replicas: '10', minReplicas: '1', cpu: '0.5', memory: '1.0Gi', image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest', ingress: 'external', targetPort: '80', environmentName: '' },
      validation: { critical: ['image', 'environmentName'], warning: ['cpu', 'memory', 'targetPort'] },
      importMappings: {
        'properties.template.containers[0].image': 'image',
        'properties.template.containers[0].resources.cpu': 'cpu',
        'properties.template.containers[0].resources.memory': 'memory',
        'properties.template.scale.minReplicas': 'minReplicas',
        'properties.template.scale.maxReplicas': 'replicas',
        'properties.configuration.ingress.targetPort': 'targetPort',
        'properties.configuration.ingress.external': { key: 'ingress', transform: (v) => v ? 'external' : 'internal' },
        'properties.managedEnvironmentId': { key: 'environmentName', transform: (v) => v?.split('/').pop() || '' }
      },
      dependencies: ['Container Apps Environment']
    }
  }
};
