import { state, saveState, fullUpdate, normalizeResourceConfig, createResourceMeta, validateResource, RES_TYPES, getVnetsInRg, findResourceById } from '../state-management.js';
import { closeModal, _iacSafe } from './export-utils.js';

const JSON_EXPORT_VERSION = 2;
const TRANSIENT_KEYS = ['dragging','dragStart','offsetStart','dragNodeId','dragGroup','selectedId','offset','scale','mouseStart','dragNodeStart'];
const FUNCTION_PLAN_SKUS = { Consumption: 'Y1', ElasticPremium: 'EP1', Premium: 'EP1', Dedicated: 'P1v3' };

function _resolveWafPolicyName(wafPolicyRef) {
  if (!wafPolicyRef) return '';
  const linked = (state.rgResources || []).find(r => r.id === wafPolicyRef && r.type === 'wafPolicy');
  return linked?.name || wafPolicyRef;
}

function _resolveWafPolicyArmId(wafPolicyRef) {
  if (!wafPolicyRef) return '';
  if (String(wafPolicyRef).startsWith('/subscriptions/')) return wafPolicyRef;
  const name = _resolveWafPolicyName(wafPolicyRef);
  return `[resourceId('Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies', '${name}')]`;
}


export function exportJson(){
  const exportData = {};
  for (const key of Object.keys(state)) {
    if (!TRANSIENT_KEYS.includes(key)) {
      exportData[key] = JSON.parse(JSON.stringify(state[key]));
    }
  }
  const wrapper = {
    _format: 'AzureArchitectureBuilder',
    _version: JSON_EXPORT_VERSION,
    _exportedAt: new Date().toISOString(),
    state: exportData
  };
  const blob = new Blob([JSON.stringify(wrapper, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `azure-architecture-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 200);
}

/**
 * Export as ARM Template JSON format for direct Azure deployment
 */
export function exportArmTemplate(){
  const template = generateArmTemplate();
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `azure-arm-template-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 200);
}

/**
 * Generate ARM Template JSON structure
 */
export function generateArmTemplate() {
  const resources = [];
  const parameters = {};
  const variables = {};

  // Add location parameter
  parameters.location = {
    type: 'string',
    defaultValue: '[resourceGroup().location]',
    metadata: { description: 'Location for all resources.' }
  };

  // Process each subscription and resource group
  state.subscriptions.forEach(sub => {
    const subRgs = state.resourceGroups.filter(r => r.subId === sub.id);
    subRgs.forEach(rg => {
      // Process VNets in this RG
      getVnetsInRg(rg.id).forEach(vnet => {
        // Add VNet resource
        const vnetResource = _generateArmVnet(vnet, rg);
        resources.push(vnetResource);

        // Process resources in each subnet
        (vnet.subnets || []).forEach(sn => {
          (sn.resources || []).forEach(res => {
            const armRes = _generateArmResource(res, rg, vnet, sn);
            if (armRes) {
              if (Array.isArray(armRes)) {
                resources.push(...armRes);
              } else {
                resources.push(armRes);
              }
            }
          });
        });
      });

      // Process RG-level resources (DNS Zones)
      const rgResources = (state.rgResources || []).filter(r => r.rgId === rg.id);
      rgResources.forEach(res => {
        const armRes = _generateArmRgResource(res, rg);
        if (armRes) {
          if (Array.isArray(armRes)) {
            resources.push(...armRes);
          } else {
            resources.push(armRes);
          }
        }
      });
    });
  });

  return {
    $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
    contentVersion: '1.0.0.0',
    parameters,
    variables,
    resources,
    outputs: {}
  };
}

function _generateArmVnet(vnet, rg) {
  // Resolve a subnet association field (nsgId/routeTableId/natGatewayId) to an ARM resourceId() expression.
  // The field may hold either the id of a real placed resource (preferred) or a legacy free-text resource name.
  const resolveAssocId = (armType, id) => {
    const res = findResourceById(id);
    const name = res ? res.name : id;
    return `[resourceId('${armType}', '${name}')]`;
  };
  const subnets = (vnet.subnets || []).map(sn => {
    const subnet = {
      name: sn.name,
      properties: {
        addressPrefix: sn.cidr
      }
    };
    if (sn.nsgId) {
      subnet.properties.networkSecurityGroup = { id: resolveAssocId('Microsoft.Network/networkSecurityGroups', sn.nsgId) };
    }
    if (sn.routeTableId) {
      subnet.properties.routeTable = { id: resolveAssocId('Microsoft.Network/routeTables', sn.routeTableId) };
    }
    if (sn.natGatewayId) {
      subnet.properties.natGateway = { id: resolveAssocId('Microsoft.Network/natGateways', sn.natGatewayId) };
    }
    if (sn.serviceEndpoints) {
      const eps = sn.serviceEndpoints.split(',').map(e => e.trim()).filter(Boolean);
      if (eps.length) {
        subnet.properties.serviceEndpoints = eps.map(e => ({ service: e }));
      }
    }
    if (sn.delegation && sn.delegation !== 'None') {
      subnet.properties.delegations = [{
        name: 'delegation',
        properties: { serviceName: sn.delegation }
      }];
    }
    if (sn.privateEndpointNetworkPolicies === 'Enabled') {
      subnet.properties.privateEndpointNetworkPolicies = 'Enabled';
    }
    if (sn.privateLinkServiceNetworkPolicies === 'Enabled') {
      subnet.properties.privateLinkServiceNetworkPolicies = 'Enabled';
    }
    return subnet;
  });

  const vnetResource = {
    type: 'Microsoft.Network/virtualNetworks',
    apiVersion: '2023-09-01',
    name: vnet.name,
    location: '[parameters(\'location\')]',
    properties: {
      addressSpace: {
        addressPrefixes: [vnet.cidr]
      },
      subnets
    }
  };

  if (vnet.dnsServers) {
    const dns = vnet.dnsServers.split(',').map(d => d.trim()).filter(Boolean);
    if (dns.length) {
      vnetResource.properties.dhcpOptions = { dnsServers: dns };
    }
  }

  if (vnet.ddosProtectionPlan === 'true') {
    vnetResource.properties.enableDdosProtection = true;
  }

  return vnetResource;
}

function _generateArmResource(res, rg, vnet, sn) {
  const c = res.config || {};
  const subnetId = `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnet.name}', '${sn.name}')]`;

  switch (res.type) {
    case 'vm': {
      const nicName = `${res.name}-nic`;
      const resources = [];

      // Network Interface
      const nic = {
        type: 'Microsoft.Network/networkInterfaces',
        apiVersion: '2023-09-01',
        name: nicName,
        location: '[parameters(\'location\')]',
        dependsOn: [`[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`],
        properties: {
          ipConfigurations: [{
            name: 'ipconfig1',
            properties: {
              privateIPAllocationMethod: 'Dynamic',
              subnet: { id: subnetId }
            }
          }]
        }
      };
      if (c.acceleratedNetworking === 'true') {
        nic.properties.enableAcceleratedNetworking = true;
      }
      resources.push(nic);

      // Virtual Machine
      const isWindows = (c.os || '').toLowerCase().includes('windows');
      const vm = {
        type: 'Microsoft.Compute/virtualMachines',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        dependsOn: [`[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]`],
        properties: {
          hardwareProfile: { vmSize: c.size || 'Standard_D2s_v3' },
          storageProfile: {
            osDisk: {
              createOption: 'FromImage',
              diskSizeGB: parseInt(c.osDiskSizeGB) || 128,
              managedDisk: { storageAccountType: c.osDiskType || 'Premium_LRS' }
            },
            imageReference: isWindows
              ? { publisher: 'MicrosoftWindowsServer', offer: 'WindowsServer', sku: '2022-datacenter-g2', version: 'latest' }
              : { publisher: 'Canonical', offer: '0001-com-ubuntu-server-jammy', sku: '22_04-lts-gen2', version: 'latest' }
          },
          osProfile: {
            computerName: res.name,
            adminUsername: 'azureuser'
          },
          networkProfile: {
            networkInterfaces: [{ id: `[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]` }]
          }
        }
      };
      if (c.availabilityZone && c.availabilityZone !== 'None') {
        vm.zones = [c.availabilityZone];
      }
      resources.push(vm);
      return resources;
    }

    case 'vmss': {
      const isWindows = (c.os || '').toLowerCase().includes('windows');
      const zones = (c.zones || '').split(',').map(z => z.trim()).filter(Boolean);
      return {
        type: 'Microsoft.Compute/virtualMachineScaleSets',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: {
          name: c.size || 'Standard_D2s_v3',
          tier: 'Standard',
          capacity: parseInt(c.instances) || 2
        },
        ...(zones.length ? { zones } : {}),
        dependsOn: [`[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`],
        properties: {
          upgradePolicy: { mode: c.upgradePolicy || 'Rolling' },
          virtualMachineProfile: {
            storageProfile: {
              imageReference: isWindows
                ? { publisher: 'MicrosoftWindowsServer', offer: 'WindowsServer', sku: '2022-datacenter-g2', version: 'latest' }
                : { publisher: 'Canonical', offer: '0001-com-ubuntu-server-jammy', sku: '22_04-lts-gen2', version: 'latest' },
              osDisk: {
                createOption: 'FromImage',
                managedDisk: { storageAccountType: c.osDiskType || 'Premium_LRS' }
              }
            },
            osProfile: {
              computerNamePrefix: res.name.substring(0, 9),
              adminUsername: 'azureuser'
            },
            networkProfile: {
              networkInterfaceConfigurations: [{
                name: 'nic-config',
                properties: {
                  primary: true,
                  enableAcceleratedNetworking: c.acceleratedNetworking === 'true',
                  ipConfigurations: [{
                    name: 'ipconfig1',
                    properties: { subnet: { id: subnetId } }
                  }]
                }
              }]
            }
          }
        }
      };
    }

    case 'aks': {
      return {
        type: 'Microsoft.ContainerService/managedClusters',
        apiVersion: '2024-01-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        identity: { type: 'SystemAssigned' },
        properties: {
          kubernetesVersion: c.version || '1.29',
          dnsPrefix: `${res.name}-dns`,
          agentPoolProfiles: [{
            name: 'agentpool',
            count: parseInt(c.nodes) || 3,
            vmSize: c.nodeSize || 'Standard_D2s_v3',
            mode: 'System',
            vnetSubnetID: subnetId
          }],
          networkProfile: {
            networkPlugin: c.networkPlugin || 'azure',
            podCidr: c.podCidr || '10.244.0.0/16',
            serviceCidr: c.serviceCidr || '10.0.0.0/16',
            dnsServiceIP: c.dnsServiceIp || '10.0.0.10'
          },
          sku: { name: 'Base', tier: c.tier || 'Standard' }
        }
      };
    }

    case 'fa': {
      const storageAccountName = c.storageAccountName || '<REQUIRED:storageAccountName>';
      const workerRuntime = (c.runtime || 'node').toLowerCase();
      const serverFarmName = `${res.name}-plan`;
      const fxVersion = (c.osType || 'Linux') === 'Linux'
        ? `${workerRuntime}|${c.runtimeVersion || '20'}`
        : `${workerRuntime}|${c.runtimeVersion || '20'}`;
      return [
        {
          type: 'Microsoft.Web/serverfarms',
          apiVersion: '2023-12-01',
          name: serverFarmName,
          location: '[parameters(\'location\')]',
          kind: (c.osType || 'Linux').toLowerCase() === 'linux' ? 'linux' : undefined,
          sku: { name: FUNCTION_PLAN_SKUS[c.plan] || 'Y1', tier: c.plan === 'Consumption' ? 'Dynamic' : 'ElasticPremium' },
          properties: { reserved: (c.osType || 'Linux').toLowerCase() === 'linux' }
        },
        {
          type: 'Microsoft.Web/sites',
          apiVersion: '2023-12-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          kind: (c.osType || 'Linux').toLowerCase() === 'linux' ? 'functionapp,linux' : 'functionapp',
          dependsOn: [`[resourceId('Microsoft.Web/serverfarms', '${serverFarmName}')]`],
          properties: {
            serverFarmId: `[resourceId('Microsoft.Web/serverfarms', '${serverFarmName}')]`,
            httpsOnly: true,
            siteConfig: {
              alwaysOn: c.alwaysOn === 'true',
              linuxFxVersion: (c.osType || 'Linux').toLowerCase() === 'linux' ? fxVersion : undefined,
              appSettings: [
                { name: 'FUNCTIONS_WORKER_RUNTIME', value: workerRuntime },
                { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' },
                {
                  name: 'AzureWebJobsStorage',
                  value: `[concat('DefaultEndpointsProtocol=https;AccountName=', '${storageAccountName}', ';AccountKey=<REQUIRED:storageAccountKey>;EndpointSuffix=', environment().suffixes.storage)]`
                }
              ]
            }
          }
        }
      ];
    }

    case 'aca': {
      const environmentId = c.environmentName
        ? `[resourceId('Microsoft.App/managedEnvironments', '${c.environmentName}')]`
        : '<REQUIRED:environmentName>';
      return {
        type: 'Microsoft.App/containerApps',
        apiVersion: '2024-03-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          managedEnvironmentId: environmentId,
          configuration: {
            ingress: {
              external: (c.ingress || 'external') === 'external',
              targetPort: parseInt(c.targetPort) || 80
            }
          },
          template: {
            containers: [{
              name: res.name,
              image: c.image || 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest',
              resources: {
                cpu: Number(c.cpu) || 0.5,
                memory: c.memory || '1.0Gi'
              }
            }],
            scale: {
              minReplicas: parseInt(c.minReplicas) || 1,
              maxReplicas: parseInt(c.replicas) || 10
            }
          }
        }
      };
    }

    case 'fw': {
      const fwZones = c.availabilityZones ? c.availabilityZones.split(',').map(z => z.trim()) : ['1', '2', '3'];
      const pipName = `${res.name}-pip`;
      return [
        {
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          zones: fwZones,
          properties: { publicIPAllocationMethod: 'Static' }
        },
        {
          type: 'Microsoft.Network/azureFirewalls',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          zones: fwZones,
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: {
            sku: { name: 'AZFW_VNet', tier: c.sku || 'Premium' },
            threatIntelMode: c.threatIntelMode || 'Alert',
            ipConfigurations: [{
              name: 'configuration',
              properties: {
                publicIPAddress: { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` },
                subnet: { id: `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnet.name}', 'AzureFirewallSubnet')]` }
              }
            }]
          },
          tags: c.wafPolicy ? { wafPolicyRef: _resolveWafPolicyName(c.wafPolicy) } : undefined
        }
      ];
    }

    case 'nva': {
      const nicName = `${res.name}-nic`;
      const vendor = (c.vendor || 'fortinet').toLowerCase();
      const planName = vendor === 'fortinet' ? 'fortinet_fg-vm' : `${vendor}_nva`;
      const product = vendor === 'fortinet' ? 'fortinet_fortigate-vm_v5' : `${vendor}_nva`;
      return [
        {
          type: 'Microsoft.Network/networkInterfaces',
          apiVersion: '2023-09-01',
          name: nicName,
          location: '[parameters(\'location\')]',
          dependsOn: [`[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`],
          properties: {
            ipConfigurations: [{
              name: 'ipconfig1',
              properties: {
                privateIPAllocationMethod: 'Dynamic',
                subnet: { id: subnetId }
              }
            }]
          }
        },
        {
          type: 'Microsoft.Compute/virtualMachines',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          plan: {
            publisher: vendor,
            product,
            name: planName
          },
          dependsOn: [`[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]`],
          properties: {
            hardwareProfile: { vmSize: c.size || 'Standard_F4s_v2' },
            storageProfile: {
              imageReference: {
                publisher: vendor,
                offer: product,
                sku: c.version || 'latest',
                version: 'latest'
              },
              osDisk: {
                createOption: 'FromImage',
                managedDisk: { storageAccountType: 'Premium_LRS' }
              }
            },
            osProfile: {
              computerName: res.name,
              adminUsername: 'azureuser'
            },
            networkProfile: {
              networkInterfaces: [{ id: `[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]` }]
            }
          }
        }
      ];
    }

    case 'agw': {
      const pipName = `${res.name}-pip`;
      const backendPools = (Array.isArray(c.backendPools) && c.backendPools.length > 0)
        ? c.backendPools
        : [{ name: 'defaultBackendPool', targets: '' }];
      const agwProperties = {
        sku: { name: c.sku || 'WAF_v2', tier: c.tier || c.sku || 'WAF_v2', capacity: parseInt(c.capacity) || 2 },
        gatewayIPConfigurations: [{
          name: 'appGatewayIpConfig',
          properties: { subnet: { id: subnetId } }
        }],
        frontendIPConfigurations: [{
          name: 'appGatewayFrontendIP',
          properties: { publicIPAddress: { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` } }
        }],
        frontendPorts: [{ name: 'port_80', properties: { port: 80 } }],
        backendAddressPools: backendPools.map(pool => ({
          name: pool.name || 'defaultBackendPool',
          properties: {
            backendAddresses: String(pool.targets || '')
              .split(',')
              .map(target => target.trim())
              .filter(Boolean)
              .map(target => /^\d{1,3}(\.\d{1,3}){3}$/.test(target) ? { ipAddress: target } : { fqdn: target })
          }
        })),
        backendHttpSettingsCollection: [{
          name: 'defaultHttpSettings',
          properties: { port: 80, protocol: 'Http', requestTimeout: 30 }
        }],
        httpListeners: [{
          name: 'defaultListener',
          properties: {
            frontendIPConfiguration: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/frontendIPConfigurations/appGatewayFrontendIP')]` },
            frontendPort: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/frontendPorts/port_80')]` },
            protocol: 'Http'
          }
        }],
        requestRoutingRules: [{
          name: 'rule1',
          properties: {
            priority: 100,
            ruleType: 'Basic',
            httpListener: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/httpListeners/defaultListener')]` },
            backendAddressPool: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/backendAddressPools/${backendPools[0].name || 'defaultBackendPool'}')]` },
            backendHttpSettings: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/backendHttpSettingsCollection/defaultHttpSettings')]` }
          }
        }]
      };
      if (String(c.sku || '').toUpperCase().includes('WAF')) {
        agwProperties.webApplicationFirewallConfiguration = { enabled: true, firewallMode: c.wafMode || 'Prevention', ruleSetType: 'OWASP', ruleSetVersion: '3.2' };
        if (c.wafPolicy) {
          agwProperties.firewallPolicy = { id: _resolveWafPolicyArmId(c.wafPolicy) };
        }
      }
      return [
        {
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          properties: { publicIPAllocationMethod: 'Static' }
        },
        {
          type: 'Microsoft.Network/applicationGateways',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: agwProperties
        }
      ];
    }

    case 'lb': {
      const isPublic = (c.type || 'Internal') === 'Public';
      const resources = [];
      const frontendConfig = {};

      if (isPublic) {
        const pipName = `${res.name}-pip`;
        resources.push({
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          properties: { publicIPAllocationMethod: 'Static' }
        });
        frontendConfig.publicIPAddress = { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` };
      } else {
        frontendConfig.subnet = { id: subnetId };
        frontendConfig.privateIPAllocationMethod = 'Dynamic';
      }

      const probeparts = (c.healthProbe || 'TCP/80').split('/');
      resources.push({
        type: 'Microsoft.Network/loadBalancers',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Standard' },
        dependsOn: isPublic
          ? [`[resourceId('Microsoft.Network/publicIPAddresses', '${res.name}-pip')]`]
          : [`[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`],
        properties: {
          frontendIPConfigurations: [{ name: `${res.name}-frontend`, properties: frontendConfig }],
          backendAddressPools: [{ name: `${res.name}-backend` }],
          probes: [{
            name: `${res.name}-probe`,
            properties: {
              protocol: probeparts[0] || 'Tcp',
              port: parseInt(probeparts[1]) || 80,
              intervalInSeconds: 15,
              numberOfProbes: 2
            }
          }],
          loadBalancingRules: [{
            name: `${res.name}-rule`,
            properties: {
              frontendIPConfiguration: { id: `[concat(resourceId('Microsoft.Network/loadBalancers', '${res.name}'), '/frontendIPConfigurations/${res.name}-frontend')]` },
              backendAddressPool: { id: `[concat(resourceId('Microsoft.Network/loadBalancers', '${res.name}'), '/backendAddressPools/${res.name}-backend')]` },
              probe: { id: `[concat(resourceId('Microsoft.Network/loadBalancers', '${res.name}'), '/probes/${res.name}-probe')]` },
              protocol: 'Tcp',
              frontendPort: 80,
              backendPort: 80,
              enableFloatingIP: false,
              idleTimeoutInMinutes: 4
            }
          }]
        },
        tags: c.wafPolicy ? { wafPolicyRef: _resolveWafPolicyName(c.wafPolicy) } : undefined
      });
      return resources;
    }

    case 'bas': {
      const pipName = `${res.name}-pip`;
      return [
        {
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          properties: { publicIPAllocationMethod: 'Static' }
        },
        {
          type: 'Microsoft.Network/bastionHosts',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          sku: { name: c.sku || 'Standard' },
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: {
            scaleUnits: parseInt(c.scaleUnits) || 2,
            enableShareableLink: c.shareableLink === 'true',
            enableIpConnect: c.ipConnect === 'true',
            enableTunneling: c.tunneling === 'true',
            ipConfigurations: [{
              name: 'IpConf',
              properties: {
                publicIPAddress: { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` },
                subnet: { id: `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnet.name}', 'AzureBastionSubnet')]` }
              }
            }]
          }
        }
      ];
    }

    case 'gw': {
      const pipName = `${res.name}-pip`;
      return [
        {
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          properties: { publicIPAllocationMethod: 'Static' }
        },
        {
          type: 'Microsoft.Network/virtualNetworkGateways',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: {
            gatewayType: 'Vpn',
            vpnType: c.vpnType || 'RouteBased',
            vpnGatewayGeneration: c.generation || 'Generation2',
            sku: { name: c.sku || 'VpnGw2AZ', tier: c.sku || 'VpnGw2AZ' },
            activeActive: c.activeActive === 'true',
            enableBgp: c.bgpAsn && c.bgpAsn !== '65515',
            bgpSettings: c.bgpAsn && c.bgpAsn !== '65515' ? { asn: parseInt(c.bgpAsn) } : undefined,
            ipConfigurations: [{
              name: 'default',
              properties: {
                publicIPAddress: { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` },
                subnet: { id: `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnet.name}', 'GatewaySubnet')]` }
              }
            }]
          }
        }
      ];
    }

    case 'ergw': {
      const pipName = `${res.name}-pip`;
      const resources = [
        {
          type: 'Microsoft.Network/publicIPAddresses',
          apiVersion: '2023-09-01',
          name: pipName,
          location: '[parameters(\'location\')]',
          sku: { name: 'Standard' },
          properties: { publicIPAllocationMethod: 'Static' }
        },
        {
          type: 'Microsoft.Network/virtualNetworkGateways',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: {
            gatewayType: c.gatewayType || 'ExpressRoute',
            sku: { name: c.sku || 'ErGw2AZ', tier: c.sku || 'ErGw2AZ' },
            ipConfigurations: [{
              name: 'default',
              properties: {
                publicIPAddress: { id: `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]` },
                subnet: { id: `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnet.name}', 'GatewaySubnet')]` }
              }
            }]
          }
        }
      ];
      if (c.expressRouteCircuitId) {
        resources.push({
          type: 'Microsoft.Network/connections',
          apiVersion: '2023-09-01',
          name: `${res.name}-connection`,
          location: '[parameters(\'location\')]',
          dependsOn: [`[resourceId('Microsoft.Network/virtualNetworkGateways', '${res.name}')]`],
          properties: {
            connectionType: 'ExpressRoute',
            virtualNetworkGateway1: { id: `[resourceId('Microsoft.Network/virtualNetworkGateways', '${res.name}')]` },
            peer: { id: c.expressRouteCircuitId }
          }
        });
      }
      return resources;
    }

    case 'nsg': {
      let nsgRules = [];
      try { nsgRules = JSON.parse(c.rules || '[]'); } catch (e) { nsgRules = []; }
      if (nsgRules.length === 0) {
        nsgRules = [
          { name: 'Allow-HTTP', priority: '100', direction: 'Inbound', access: 'Allow', protocol: 'Tcp', srcPort: '*', dstPort: '80', srcAddr: '*', dstAddr: '*' },
          { name: 'Allow-HTTPS', priority: '110', direction: 'Inbound', access: 'Allow', protocol: 'Tcp', srcPort: '*', dstPort: '443', srcAddr: '*', dstAddr: '*' }
        ];
      }
      return {
        type: 'Microsoft.Network/networkSecurityGroups',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          securityRules: nsgRules.map(rule => ({
            name: rule.name,
            properties: {
              priority: parseInt(rule.priority) || 100,
              direction: rule.direction || 'Inbound',
              access: rule.access || 'Allow',
              protocol: rule.protocol || 'Tcp',
              sourceAddressPrefix: rule.srcAddr || '*',
              destinationAddressPrefix: rule.dstAddr || '*',
              sourcePortRange: rule.srcPort || '*',
              destinationPortRange: rule.dstPort || '80'
            }
          }))
        }
      };
    }

    case 'udr': {
      const routes = Array.isArray(c.routes) ? c.routes : [];
      return {
        type: 'Microsoft.Network/routeTables',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          disableBgpRoutePropagation: c.disableBgpRoutePropagation === 'true',
          routes: routes.map(route => {
            const routeProps = { addressPrefix: route.addressPrefix || '0.0.0.0/0', nextHopType: route.nextHopType || 'VirtualAppliance' };
            if ((route.nextHopType || 'VirtualAppliance') === 'VirtualAppliance' && route.nextHopIpAddress) {
              routeProps.nextHopIpAddress = route.nextHopIpAddress;
            }
            return { name: route.name, properties: routeProps };
          })
        }
      };
    }

    case 'natgw': {
      const natZones = (c.zones || '1').split(',').map(z => z.trim()).filter(Boolean);
      return {
        type: 'Microsoft.Network/natGateways',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Standard' },
        zones: natZones,
        properties: {
          idleTimeoutInMinutes: parseInt(c.idleTimeoutMinutes) || 4
        }
      };
    }

    case 'asg': {
      return {
        type: 'Microsoft.Network/applicationSecurityGroups',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {}
      };
    }

    case 'pip': {
      const pipZones = (c.zones || '').split(',').map(z => z.trim()).filter(Boolean);
      const pip = {
        type: 'Microsoft.Network/publicIPAddresses',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Standard', tier: c.tier || 'Regional' },
        properties: {
          publicIPAllocationMethod: c.allocationMethod || 'Static'
        }
      };
      if (pipZones.length) pip.zones = pipZones;
      if (c.domainNameLabel) pip.properties.dnsSettings = { domainNameLabel: c.domainNameLabel };
      return pip;
    }

    case 'sa': {
      const saKind = c.kind || 'StorageV2';
      const saTier = c.tier || 'Standard';
      return {
        type: 'Microsoft.Storage/storageAccounts',
        apiVersion: '2023-01-01',
        name: res.name.replace(/[^a-z0-9]/g, '').substring(0, 24),
        location: '[parameters(\'location\')]',
        sku: { name: `${saTier}_${c.replication || 'ZRS'}` },
        kind: saKind,
        properties: {
          accessTier: c.accessTier || 'Hot',
          minimumTlsVersion: c.minTlsVersion || 'TLS1_2',
          allowBlobPublicAccess: false,
          supportsHttpsTrafficOnly: c.httpsOnly !== 'false'
        }
      };
    }

    case 'redis': {
      const redisSku = (c.sku || 'Premium P1').split(' ');
      const name = redisSku[0] || 'Premium';
      const family = name === 'Premium' ? 'P' : (name === 'Basic' ? 'C' : 'C');
      const zones = (c.zones || '').split(',').map(z => z.trim()).filter(Boolean);
      return {
        type: 'Microsoft.Cache/Redis',
        apiVersion: '2024-03-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        ...(zones.length ? { zones } : {}),
        properties: {
          sku: { name, family, capacity: parseInt(c.capacity) || 1 },
          enableNonSslPort: c.enableNonSslPort === 'true',
          minimumTlsVersion: c.minTlsVersion || '1.2',
          replicasPerPrimary: parseInt(c.replicasPerPrimary) || 1
        }
      };
    }

    case 'adls': {
      return {
        type: 'Microsoft.Storage/storageAccounts',
        apiVersion: '2023-01-01',
        name: res.name.replace(/[^a-z0-9]/g, '').substring(0, 24),
        location: '[parameters(\'location\')]',
        sku: { name: `${c.tier || 'Standard'}_${c.replication || 'LRS'}` },
        kind: 'StorageV2',
        properties: {
          isHnsEnabled: c.hierarchicalNamespace !== 'false',
          allowBlobPublicAccess: false,
          supportsHttpsTrafficOnly: true
        }
      };
    }

    case 'kv': {
      return {
        type: 'Microsoft.KeyVault/vaults',
        apiVersion: '2023-07-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          sku: { family: 'A', name: (c.sku || 'premium').toLowerCase() },
          tenantId: '[subscription().tenantId]',
          enablePurgeProtection: c.purgeProtection !== 'false',
          enableRbacAuthorization: c.enableRbacAuth !== 'false',
          softDeleteRetentionInDays: parseInt(c.softDeleteDays) || 90,
          networkAcls: c.networkAcls && c.networkAcls !== 'Allow' ? { defaultAction: 'Deny' } : undefined,
          accessPolicies: []
        }
      };
    }

    case 'app': {
      const planName = c.appServicePlanName || `${res.name}-plan`;
      const planSku = c.appServicePlanSku || 'P1v3';
      const runtime = (c.runtime || 'dotnet').toLowerCase();
      const linuxFxVersion = `${runtime}|${c.runtimeVersion || '8.0'}`;
      return [
        {
          type: 'Microsoft.Web/serverfarms',
          apiVersion: '2023-12-01',
          name: planName,
          location: '[parameters(\'location\')]',
          kind: 'linux',
          sku: { name: planSku, tier: planSku.startsWith('P') ? 'PremiumV3' : 'Standard' },
          properties: { reserved: true }
        },
        {
          type: 'Microsoft.Web/sites',
          apiVersion: '2023-12-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          kind: 'app,linux',
          dependsOn: [`[resourceId('Microsoft.Web/serverfarms', '${planName}')]`],
          identity: c.managedIdentity && c.managedIdentity !== 'None' ? { type: 'SystemAssigned' } : undefined,
          properties: {
            serverFarmId: `[resourceId('Microsoft.Web/serverfarms', '${planName}')]`,
            httpsOnly: c.httpsOnly !== 'false',
            siteConfig: {
              alwaysOn: c.alwaysOn === 'true',
              linuxFxVersion,
              minTlsVersion: c.minTlsVersion || '1.2'
            }
          }
        }
      ];
    }

    case 'apim': {
      return {
        type: 'Microsoft.ApiManagement/service',
        apiVersion: '2023-05-01-preview',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.tier || 'Developer', capacity: parseInt(c.capacity) || 1 },
        properties: {
          publisherName: c.publisherName || 'MyOrganization',
          publisherEmail: c.publisherEmail || 'admin@example.com',
          virtualNetworkType: c.vnetType || 'None'
        }
      };
    }

    case 'sb': {
      return {
        type: 'Microsoft.ServiceBus/namespaces',
        apiVersion: '2024-01-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: {
          name: c.tier || 'Premium',
          tier: c.tier || 'Premium',
          capacity: parseInt(c.messagingUnits) || 1
        },
        properties: {
          zoneRedundant: c.zoneRedundant === 'true'
        }
      };
    }

    case 'evh': {
      return [
        {
          type: 'Microsoft.EventHub/namespaces',
          apiVersion: '2024-01-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          sku: {
            name: c.plan || 'Standard',
            tier: c.plan || 'Standard',
            capacity: parseInt(c.throughputUnits) || 1
          },
          properties: {}
        },
        {
          type: 'Microsoft.EventHub/namespaces/eventhubs',
          apiVersion: '2024-01-01',
          name: `${res.name}/${res.name}-hub`,
          dependsOn: [`[resourceId('Microsoft.EventHub/namespaces', '${res.name}')]`],
          properties: {
            partitionCount: parseInt(c.partitions) || 4,
            messageRetentionInDays: parseInt(c.retentionDays) || 7,
            captureDescription: { enabled: c.captureEnabled === 'true' }
          }
        }
      ];
    }

    case 'appcfg': {
      return {
        type: 'Microsoft.AppConfiguration/configurationStores',
        apiVersion: '2024-05-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Standard' },
        properties: {
          publicNetworkAccess: c.publicNetworkAccess || 'Enabled',
          disableLocalAuth: c.disableLocalAuth === 'true'
        }
      };
    }

    case 'egt': {
      return {
        type: 'Microsoft.EventGrid/topics',
        apiVersion: '2023-12-15-preview',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Basic' },
        properties: {
          inputSchema: c.inputSchema || 'EventGridSchema',
          publicNetworkAccess: c.publicNetworkAccess || 'Enabled'
        }
      };
    }

    case 'logic': {
      return {
        type: 'Microsoft.Logic/workflows',
        apiVersion: '2019-05-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          state: c.state || 'Enabled',
          definition: {
            $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
            contentVersion: '1.0.0.0',
            parameters: {},
            triggers: {},
            actions: {},
            outputs: {}
          }
        }
      };
    }

    case 'foundry': {
      return {
        type: 'Microsoft.CognitiveServices/accounts',
        apiVersion: '2024-04-01-preview',
        name: res.name,
        location: '[parameters(\'location\')]',
        kind: c.kind || 'AIServices',
        sku: { name: c.sku || 'S0' },
        properties: {
          customSubDomainName: c.customSubdomain || undefined,
          networkAcls: c.networkRules && c.networkRules !== 'Allow' ? { defaultAction: 'Deny' } : undefined
        }
      };
    }

    case 'openai': {
      return [
        {
          type: 'Microsoft.CognitiveServices/accounts',
          apiVersion: '2024-04-01-preview',
          name: res.name,
          location: '[parameters(\'location\')]',
          kind: 'OpenAI',
          sku: { name: 'S0' },
          properties: {
            customSubDomainName: res.name
          }
        },
        {
          type: 'Microsoft.CognitiveServices/accounts/deployments',
          apiVersion: '2024-04-01-preview',
          name: `${res.name}/${c.deploymentName || c.model || 'gpt-4o'}`,
          dependsOn: [`[resourceId('Microsoft.CognitiveServices/accounts', '${res.name}')]`],
          sku: { name: 'Standard', capacity: parseInt(c.capacity) || 10 },
          properties: {
            model: {
              format: 'OpenAI',
              name: c.model || 'gpt-4o',
              version: c.modelVersion || 'latest'
            }
          }
        }
      ];
    }

    case 'monitor': {
      return {
        type: 'Microsoft.OperationalInsights/workspaces',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        properties: {
          sku: { name: c.workspaceSku || 'PerGB2018' },
          retentionInDays: parseInt(c.retentionDays) || 90,
          workspaceCapping: c.dailyCapGB ? { dailyQuotaGb: Number(c.dailyCapGB) } : undefined
        }
      };
    }

    case 'appi': {
      return {
        type: 'Microsoft.Insights/components',
        apiVersion: '2020-02-02',
        name: res.name,
        location: '[parameters(\'location\')]',
        kind: c.kind || 'web',
        properties: {
          Application_Type: c.applicationType || 'web',
          WorkspaceResourceId: c.workspaceResourceId || undefined
        }
      };
    }

    case 'acr': {
      return {
        type: 'Microsoft.ContainerRegistry/registries',
        apiVersion: '2023-07-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'Premium' },
        properties: {
          adminUserEnabled: c.adminUserEnabled === 'true',
          publicNetworkAccess: c.publicNetworkAccess || 'Enabled'
        }
      };
    }

    case 'search': {
      return {
        type: 'Microsoft.Search/searchServices',
        apiVersion: '2023-11-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        sku: { name: c.sku || 'standard' },
        properties: {
          replicaCount: parseInt(c.replicaCount) || 1,
          partitionCount: parseInt(c.partitionCount) || 1,
          publicNetworkAccess: c.publicNetworkAccess || 'enabled'
        }
      };
    }

    case 'afd': {
      const endpointName = c.endpoints || `${res.name}-endpoint`;
      const originGroupName = c.originGroups || 'default-origin-group';
      const routeName = c.routingRules || 'default-route';
      return [
        {
          type: 'Microsoft.Cdn/profiles',
          apiVersion: '2024-02-01',
          name: res.name,
          location: 'global',
          sku: { name: `${c.sku || 'Premium'}_AzureFrontDoor` },
          properties: { originResponseTimeoutSeconds: 60 }
        },
        {
          type: 'Microsoft.Cdn/profiles/afdEndpoints',
          apiVersion: '2024-02-01',
          name: `${res.name}/${endpointName}`,
          dependsOn: [`[resourceId('Microsoft.Cdn/profiles', '${res.name}')]`],
          location: 'global',
          properties: { enabledState: 'Enabled' }
        },
        {
          type: 'Microsoft.Cdn/profiles/originGroups',
          apiVersion: '2024-02-01',
          name: `${res.name}/${originGroupName}`,
          dependsOn: [`[resourceId('Microsoft.Cdn/profiles', '${res.name}')]`],
          properties: {
            loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 },
            healthProbeSettings: { probePath: '/', probeRequestType: 'HEAD', probeProtocol: 'Https', probeIntervalInSeconds: 120 }
          }
        },
        {
          type: 'Microsoft.Cdn/profiles/afdEndpoints/routes',
          apiVersion: '2024-02-01',
          name: `${res.name}/${endpointName}/${routeName}`,
          dependsOn: [
            `[resourceId('Microsoft.Cdn/profiles/afdEndpoints', '${res.name}', '${endpointName}')]`,
            `[resourceId('Microsoft.Cdn/profiles/originGroups', '${res.name}', '${originGroupName}')]`
          ],
          properties: {
            originGroup: { id: `[resourceId('Microsoft.Cdn/profiles/originGroups', '${res.name}', '${originGroupName}')]` },
            supportedProtocols: ['Http', 'Https'],
            patternsToMatch: ['/*'],
            forwardingProtocol: 'MatchRequest'
          },
          tags: c.wafPolicy ? { wafPolicyRef: _resolveWafPolicyName(c.wafPolicy) } : undefined
        }
      ];
    }

    case 'sql': {
      const sqlServerName = c.serverName || `${res.name}-server`;
      const sqlTier = c.tier || 'GeneralPurpose';
      const sqlSkuName = sqlTier === 'BusinessCritical' ? 'BC_Gen5' : 'GP_Gen5';
      return [
        {
          type: 'Microsoft.Sql/servers',
          apiVersion: '2023-05-01-preview',
          name: sqlServerName,
          location: '[parameters(\'location\')]',
          properties: {
            administratorLogin: 'sqladmin',
            version: '12.0'
          }
        },
        {
          type: 'Microsoft.Sql/servers/databases',
          apiVersion: '2023-05-01-preview',
          name: `${sqlServerName}/${res.name}`,
          location: '[parameters(\'location\')]',
          dependsOn: [`[resourceId('Microsoft.Sql/servers', '${sqlServerName}')]`],
          sku: { name: sqlSkuName, tier: sqlTier, capacity: parseInt(c.vcores) || 4 },
          properties: {
            maxSizeBytes: (parseInt(c.maxSizeGB) || 32) * 1073741824,
            collation: c.collation || 'SQL_Latin1_General_CP1_CI_AS',
            zoneRedundant: c.zoneRedundant === 'true'
          }
        }
      ];
    }

    case 'cosmos': {
      const cosmosKind = c.api === 'MongoDB' ? 'MongoDB' : 'GlobalDocumentDB';
      const cosmosResource = {
        type: 'Microsoft.DocumentDB/databaseAccounts',
        apiVersion: '2023-11-15',
        name: res.name,
        location: '[parameters(\'location\')]',
        kind: cosmosKind,
        properties: {
          databaseAccountOfferType: 'Standard',
          consistencyPolicy: { defaultConsistencyLevel: c.consistencyLevel || 'Session' },
          locations: [{ locationName: '[parameters(\'location\')]', failoverPriority: 0 }],
          enableFreeTier: c.enableFreeTier === 'true'
        }
      };
      if (c.serverless === 'true') {
        cosmosResource.properties.capabilities = [{ name: 'EnableServerless' }];
      }
      return cosmosResource;
    }

    case 'pe': {
      const peGroupId = c.groupId || c.subResource || c.target || 'blob';
      const peConnectionName = c.connectionName || `${res.name}-connection`;
      return {
        type: 'Microsoft.Network/privateEndpoints',
        apiVersion: '2023-09-01',
        name: res.name,
        location: '[parameters(\'location\')]',
        dependsOn: [`[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`],
        properties: {
          subnet: { id: subnetId },
          privateLinkServiceConnections: [{
            name: peConnectionName,
            properties: {
              privateLinkServiceId: c.targetResourceId || '[resourceId(\'Microsoft.Storage/storageAccounts\', \'storageAccountName\')]',
              groupIds: [peGroupId]
            }
          }]
        }
      };
    }

    default:
      return null;
  }
}

function _generateArmRgResource(res, rg) {
  if (res.type === 'wafPolicy') {
    const c = res.config || {};
    const customRules = (c.customRules || []).map(rule => ({
      name: rule.name || 'custom-rule',
      priority: parseInt(rule.priority) || 100,
      ruleType: 'MatchRule',
      action: rule.action || 'Block',
      matchConditions: [{
        matchVariables: [{ variableName: (rule.matchVariable || 'RequestHeaders:User-Agent').split(':')[0], selector: (rule.matchVariable || '').includes(':') ? (rule.matchVariable || '').split(':')[1] : undefined }],
        operator: rule.operator || 'Contains',
        matchValues: [rule.matchValue || '']
      }]
    }));
    return {
      type: 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies',
      apiVersion: '2023-09-01',
      name: res.name,
      location: '[parameters(\'location\')]',
      properties: {
        policySettings: {
          state: 'Enabled',
          mode: c.mode || 'Prevention',
          requestBodyCheck: (c.requestBodyCheck || 'true') === 'true',
          maxRequestBodySizeInKb: parseInt(c.maxRequestBodySizeInKb) || 128,
          fileUploadLimitInMb: parseInt(c.fileUploadLimitInMb) || 100
        },
        managedRules: {
          managedRuleSets: [{
            ruleSetType: c.ruleSetType || 'OWASP',
            ruleSetVersion: c.ruleSetVersion || '3.2'
          }]
        },
        customRules
      }
    };
  }

  if (res.type === 'publicDns') {
    const resources = [{
      type: 'Microsoft.Network/dnsZones',
      apiVersion: '2018-05-01',
      name: res.config.zone,
      location: 'global',
      properties: {}
    }];
    (res.config.records || []).forEach(rec => {
      const ttl = parseInt(rec.ttl) || 3600;
      const recordTarget = rec.target || rec.value;
      if (rec.type === 'A') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/A',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, ARecords: [{ ipv4Address: rec.value }] }
        });
      } else if (rec.type === 'AAAA') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/AAAA',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, AAAARecords: [{ ipv6Address: rec.value }] }
        });
      } else if (rec.type === 'CNAME') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/CNAME',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, CNAMERecord: { cname: recordTarget } }
        });
      } else if (rec.type === 'TXT') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/TXT',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, TXTRecords: [{ value: [rec.value] }] }
        });
      } else if (rec.type === 'MX') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/MX',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, MXRecords: [{ preference: parseInt(rec.preference) || 10, exchange: rec.exchange || rec.value }] }
        });
      } else if (rec.type === 'NS') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/NS',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, NSRecords: [{ nsdname: recordTarget }] }
        });
      } else if (rec.type === 'PTR') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/PTR',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, PTRRecords: [{ ptrdname: recordTarget }] }
        });
      } else if (rec.type === 'SRV') {
        resources.push({
          type: 'Microsoft.Network/dnsZones/SRV',
          apiVersion: '2018-05-01',
          name: `${res.config.zone}/${rec.name}`,
          properties: { TTL: ttl, SRVRecords: [{ priority: parseInt(rec.priority) || 10, weight: parseInt(rec.weight) || 10, port: parseInt(rec.port) || 443, target: rec.target || rec.value }] }
        });
      }
    });
    return resources;
  } else if (res.type === 'dns') {
    const zoneName = res.config.fullZoneName || res.config.zone;
    const resources = [{
      type: 'Microsoft.Network/privateDnsZones',
      apiVersion: '2020-06-01',
      name: zoneName,
      location: 'global',
      properties: {}
    }];
    (res.config.records || []).forEach(rec => {
      const ttl = parseInt(rec.ttl) || 3600;
      const recordTarget = rec.target || rec.value;
      if (rec.type === 'A') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/A',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, aRecords: [{ ipv4Address: rec.value }] }
        });
      } else if (rec.type === 'AAAA') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/AAAA',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, aaaaRecords: [{ ipv6Address: rec.value }] }
        });
      } else if (rec.type === 'CNAME') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/CNAME',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, cnameRecord: { cname: recordTarget } }
        });
      } else if (rec.type === 'TXT') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/TXT',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, txtRecords: [{ value: [rec.value] }] }
        });
      } else if (rec.type === 'MX') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/MX',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, mxRecords: [{ preference: parseInt(rec.preference) || 10, exchange: rec.exchange || rec.value }] }
        });
      } else if (rec.type === 'NS') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/NS',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, nsRecords: [{ nsdname: recordTarget }] }
        });
      } else if (rec.type === 'PTR') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/PTR',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, ptrRecords: [{ ptrdname: recordTarget }] }
        });
      } else if (rec.type === 'SRV') {
        resources.push({
          type: 'Microsoft.Network/privateDnsZones/SRV',
          apiVersion: '2020-06-01',
          name: `${zoneName}/${rec.name}`,
          properties: { ttl, srvRecords: [{ priority: parseInt(rec.priority) || 10, weight: parseInt(rec.weight) || 10, port: parseInt(rec.port) || 443, target: rec.target || rec.value }] }
        });
      }
    });
    (res.config.vnetLinks || []).forEach(link => {
      resources.push({
        type: 'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
        apiVersion: '2020-06-01',
        name: `${zoneName}/${link.linkName || `link-${link.vnetName || 'vnet'}`}`,
        location: 'global',
        properties: {
          registrationEnabled: link.registrationEnabled || res.config.autoRegistration === 'true',
          virtualNetwork: { id: `[resourceId('Microsoft.Network/virtualNetworks', '${link.vnetName || 'vnet'}')]` }
        }
      });
    });
    return resources;
  }
  return null;
}

export function openArmTemplateModal() {
  const template = generateArmTemplate();
  document.getElementById('arm-output').textContent = JSON.stringify(template, null, 2);
  document.getElementById('arm-modal').classList.add('show');
}

export function openJsonImportModal(){
  document.getElementById('json-import-modal').classList.add('show');
  document.getElementById('json-file-input').value = '';
  document.getElementById('json-paste-input').value = '';
  document.getElementById('json-import-error').textContent = '';
  document.getElementById('json-import-preview').textContent = '';
  document.getElementById('json-import-preview').style.display = 'none';
  document.getElementById('json-import-merge').checked = false;
}

export function handleJsonFile(){
  const fileInput = document.getElementById('json-file-input');
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('json-paste-input').value = e.target.result;
    _previewJson(e.target.result);
  };
  reader.readAsText(file);
}

function _previewJson(raw){
  const errEl = document.getElementById('json-import-error');
  const previewEl = document.getElementById('json-import-preview');
  errEl.textContent = '';
  previewEl.style.display = 'none';
  try {
    const parsed = JSON.parse(raw);
    const data = parsed._format === 'AzureArchitectureBuilder' ? parsed.state : parsed;
    const subs = (data.subscriptions || []).length;
    const rgs = (data.resourceGroups || []).length;
    const spokes = (data.spokes || []).length;
    const hubSubnets = data.hub ? (data.hub.subnets || []).length : 0;
    const totalRes = _countResources(data);
    const lines = [
      `Subscriptions: ${subs}`,
      `Resource Groups: ${rgs}`,
      `Hub VNet subnets: ${hubSubnets}`,
      `Spoke VNets: ${spokes}`,
      `Total resources: ${totalRes}`
    ];
    if (parsed._exportedAt) lines.push(`Exported: ${parsed._exportedAt}`);
    previewEl.textContent = lines.join('\n');
    previewEl.style.display = 'block';
  } catch(e) {
    errEl.textContent = '⚠ Invalid JSON: ' + e.message;
  }
}

function _countResources(data){
  let count = 0;
  if (data.hub && data.hub.subnets) {
    data.hub.subnets.forEach(sn => { count += (sn.resources || []).length; });
  }
  (data.spokes || []).forEach(spoke => {
    (spoke.subnets || []).forEach(sn => { count += (sn.resources || []).length; });
  });
  count += (data.rgResources || []).length;
  return count;
}

export function confirmJsonImport(){
  const errEl = document.getElementById('json-import-error');
  const raw = document.getElementById('json-paste-input').value.trim();
  if (!raw) { errEl.textContent = '⚠ Please select a file or paste JSON content.'; return; }
  
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { errEl.textContent = '⚠ Invalid JSON: ' + e.message; return; }

  const data = parsed._format === 'AzureArchitectureBuilder' ? parsed.state : parsed;

  // Validate minimum structure
  if (!data.subscriptions || !data.resourceGroups || !data.hub) {
    errEl.textContent = '⚠ Invalid diagram format: missing required fields (subscriptions, resourceGroups, hub).';
    return;
  }

  const isMerge = document.getElementById('json-import-merge').checked;

  if (isMerge) {
    if (!confirm('This will merge imported resources into your current diagram. Continue?')) return;
    _mergeJsonData(data);
  } else {
    if (!confirm('This will replace your current diagram. Continue?')) return;
    // Apply imported data onto state
    for (const key of Object.keys(state)) {
      if (!TRANSIENT_KEYS.includes(key) && data[key] !== undefined) {
        state[key] = JSON.parse(JSON.stringify(data[key]));
      }
    }
  }

  // Ensure required arrays exist
  if (!state.rgResources) state.rgResources = [];
  if (!state.spokes) state.spokes = [];
  if (!state.hub.subnets) state.hub.subnets = [];
  if (!state.hub.peerings) state.hub.peerings = [];
  if (!state.hub.peeringConfigs) state.hub.peeringConfigs = {};
  
  // Normalize all resources and add metadata
  _normalizeAndValidateResources();
  
  state.hub.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
  state.spokes.forEach(s => {
    if (!s.subnets) s.subnets = [];
    if (!s.peerings) s.peerings = [];
    if (!s.peeringConfigs) s.peeringConfigs = {};
    s.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
  });

  // Apply theme
  if (state.theme === 'dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');

  saveState();
  closeModal('json-import-modal');
  fullUpdate();
}

/**
 * Normalizes all resources in state to ensure consistent config structure
 * and adds metadata for imported resources
 */
function _normalizeAndValidateResources() {
  const importTime = new Date().toISOString();
  
  // Helper to normalize a single resource
  const normalizeResource = (res) => {
    // Normalize config to include all default fields
    const normalized = normalizeResourceConfig(res);
    
    // Add or update metadata
    if (!normalized._meta) {
      normalized._meta = createResourceMeta('json-import', {
        importedAt: importTime
      });
    }
    
    // Update validation status
    const validation = validateResource(normalized);
    normalized._meta.validationStatus = validation.status;
    if (validation.warnings.length > 0) {
      normalized._meta.warnings = [...(normalized._meta.warnings || []), ...validation.warnings];
    }
    
    return normalized;
  };
  
  // Process hub subnets
  if (state.hub && state.hub.subnets) {
    state.hub.subnets.forEach(sn => {
      if (sn.resources) {
        sn.resources = sn.resources.map(normalizeResource);
      }
    });
  }
  
  // Process spoke subnets
  (state.spokes || []).forEach(spoke => {
    (spoke.subnets || []).forEach(sn => {
      if (sn.resources) {
        sn.resources = sn.resources.map(normalizeResource);
      }
    });
  });
  
  // Process RG-level resources
  if (state.rgResources) {
    state.rgResources = state.rgResources.map(normalizeResource);
  }
}

function _mergeJsonData(data) {
  // Merge subscriptions (avoid duplicates by name)
  const importedSubs = JSON.parse(JSON.stringify(data.subscriptions || []));
  importedSubs.forEach(sub => {
    const existing = state.subscriptions.find(s => s.name === sub.name);
    if (!existing) {
      state.subscriptions.push(sub);
    }
  });

  // Merge resource groups (avoid duplicates by name)
  const importedRgs = JSON.parse(JSON.stringify(data.resourceGroups || []));
  importedRgs.forEach(rg => {
    const existing = state.resourceGroups.find(r => r.name === rg.name);
    if (!existing) {
      state.resourceGroups.push(rg);
    }
  });

  // Merge hub subnets and their resources
  if (data.hub && data.hub.subnets) {
    const importedHub = JSON.parse(JSON.stringify(data.hub));
    if (!state.hub.subnets) state.hub.subnets = [];
    importedHub.subnets.forEach(importedSn => {
      const existingSn = state.hub.subnets.find(s => s.name === importedSn.name);
      if (existingSn) {
        // Merge resources into existing subnet (avoid duplicates by name+type)
        if (!existingSn.resources) existingSn.resources = [];
        (importedSn.resources || []).forEach(res => {
          const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
          if (!dup) existingSn.resources.push(res);
        });
      } else {
        if (!importedSn.resources) importedSn.resources = [];
        state.hub.subnets.push(importedSn);
      }
    });
    // Merge hub peerings
    if (importedHub.peerings) {
      if (!state.hub.peerings) state.hub.peerings = [];
      importedHub.peerings.forEach(p => {
        const isDup = state.hub.peerings.some(ep => 
          (typeof ep === 'string' && ep === p) || 
          (typeof ep === 'object' && typeof p === 'object' && ep.id === p.id)
        );
        if (!isDup) {
          state.hub.peerings.push(p);
        }
      });
    }
  }

  // Merge spokes
  const importedSpokes = JSON.parse(JSON.stringify(data.spokes || []));
  importedSpokes.forEach(spoke => {
    const existingSpoke = state.spokes.find(s => s.name === spoke.name);
    if (existingSpoke) {
      // Merge subnets within the existing spoke
      if (!existingSpoke.subnets) existingSpoke.subnets = [];
      (spoke.subnets || []).forEach(importedSn => {
        const existingSn = existingSpoke.subnets.find(s => s.name === importedSn.name);
        if (existingSn) {
          if (!existingSn.resources) existingSn.resources = [];
          (importedSn.resources || []).forEach(res => {
            const dup = existingSn.resources.find(r => r.name === res.name && r.type === res.type);
            if (!dup) existingSn.resources.push(res);
          });
        } else {
          if (!importedSn.resources) importedSn.resources = [];
          existingSpoke.subnets.push(importedSn);
        }
      });
    } else {
      // Ensure the new spoke has required arrays before pushing
      if (!spoke.subnets) spoke.subnets = [];
      if (!spoke.peerings) spoke.peerings = [];
      if (!spoke.peeringConfigs) spoke.peeringConfigs = {};
      spoke.subnets.forEach(sn => { if (!sn.resources) sn.resources = []; });
      state.spokes.push(spoke);
    }
  });

  // Merge RG-level resources
  const importedRgRes = JSON.parse(JSON.stringify(data.rgResources || []));
  importedRgRes.forEach(res => {
    const dup = (state.rgResources || []).find(r => r.name === res.name && r.type === res.type);
    if (!dup) {
      if (!state.rgResources) state.rgResources = [];
      state.rgResources.push(res);
    }
  });

  // Merge management groups if present
  if (data.managementGroups && data.managementGroups.length > 0) {
    const importedMgs = JSON.parse(JSON.stringify(data.managementGroups));
    if (!state.managementGroups) state.managementGroups = [];
    importedMgs.forEach(mg => {
      const existing = state.managementGroups.find(m => m.name === mg.name);
      if (!existing) state.managementGroups.push(mg);
    });
    if (data.mgEnabled) state.mgEnabled = true;
  }
}

export function previewPastedJson(){
  const raw = document.getElementById('json-paste-input').value.trim();
  if (raw) _previewJson(raw);
}
