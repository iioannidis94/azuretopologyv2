import { state, saveState, fullUpdate, normalizeResourceConfig, createResourceMeta, validateResource, RES_TYPES, getVnetsInRg } from '../state-management.js';
import { closeModal, _iacSafe } from './export-utils.js';

const JSON_EXPORT_VERSION = 2;
const TRANSIENT_KEYS = ['dragging','dragStart','offsetStart','dragNodeId','dragGroup','selectedId','offset','scale','mouseStart','dragNodeStart'];


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
  const subnets = (vnet.subnets || []).map(sn => {
    const subnet = {
      name: sn.name,
      properties: {
        addressPrefix: sn.cidr
      }
    };
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
          }
        }
      ];
    }

    case 'agw': {
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
          type: 'Microsoft.Network/applicationGateways',
          apiVersion: '2023-09-01',
          name: res.name,
          location: '[parameters(\'location\')]',
          dependsOn: [
            `[resourceId('Microsoft.Network/publicIPAddresses', '${pipName}')]`,
            `[resourceId('Microsoft.Network/virtualNetworks', '${vnet.name}')]`
          ],
          properties: {
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
            backendAddressPools: [{ name: 'defaultBackendPool', properties: {} }],
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
                backendAddressPool: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/backendAddressPools/defaultBackendPool')]` },
                backendHttpSettings: { id: `[concat(resourceId('Microsoft.Network/applicationGateways', '${res.name}'), '/backendHttpSettingsCollection/defaultHttpSettings')]` }
              }
            }]
          }
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
        }
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
          accessPolicies: []
        }
      };
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
  if (res.type === 'publicDns') {
    return {
      type: 'Microsoft.Network/dnsZones',
      apiVersion: '2018-05-01',
      name: res.config.zone,
      location: 'global',
      properties: {}
    };
  } else if (res.type === 'dns') {
    const zoneName = res.config.fullZoneName || res.config.zone;
    return {
      type: 'Microsoft.Network/privateDnsZones',
      apiVersion: '2020-06-01',
      name: zoneName,
      location: 'global',
      properties: {}
    };
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

