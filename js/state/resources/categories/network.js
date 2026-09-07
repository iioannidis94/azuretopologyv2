export const networkCategory = {
  key: 'network',
  label: 'Networking',
  skipTypes: [
    'microsoft.network/virtualnetworks',
    'microsoft.network/virtualnetworks/subnets',
    'microsoft.network/networkinterfaces',
    'microsoft.resources/deployments',
    'microsoft.network/networkwatchers',
    'microsoft.compute/disks',
    'microsoft.compute/snapshots',
    'microsoft.compute/images'
  ],
  resources: {
    fw: {
      icon: '🛡️',
      img: 'Firewalls.svg',
      color: '#E81123',
      label: 'Azure Firewall',
      cost: 900,
      pricingCalculatorSlug: 'azure-firewall',
      azureTypes: ['microsoft.network/azurefirewalls'],
      config: { sku: 'Premium', threatIntelMode: 'Alert', dnsProxy: 'true', policyName: '', wafPolicy: '', availabilityZones: '1,2,3' },
      validation: { critical: ['sku'], warning: ['threatIntelMode', 'availabilityZones', 'policyName'] },
      importMappings: {
        'sku.tier': 'sku',
        'properties.threatIntelMode': 'threatIntelMode',
        'properties.additionalProperties.Network.DNS.EnableProxy': 'dnsProxy',
        'zones': { key: 'availabilityZones', transform: (v) => Array.isArray(v) ? v.join(',') : v }
      },
      dependencies: ['AzureFirewallSubnet']
    },
    nva: {
      icon: '🧱',
      img: 'Firewalls.svg',
      color: '#E81123',
      label: 'FortiGate NVA',
      cost: 600,
      pricingCalculatorSlug: 'virtual-machines',
      config: { mode: 'Active/Passive', vendor: 'Fortinet', version: '7.4', licenseType: 'PAYG', size: 'Standard_F4s_v2' },
      validation: { critical: ['vendor', 'size'], warning: ['mode', 'version', 'licenseType'] }
    },
    agw: {
      icon: '🌍',
      img: 'Application-Gateways.svg',
      color: '#FF8C00',
      label: 'App Gateway',
      cost: 350,
      pricingCalculatorSlug: 'application-gateway',
      azureTypes: ['microsoft.network/applicationgateways'],
      config: {
        sku: 'WAF_v2',
        capacity: '2',
        tier: 'WAF_v2',
        sslPolicy: 'AppGwSslPolicy20220101',
        httpListeners: 'HTTP:80',
        wafMode: 'Prevention',
        wafPolicy: '',
        backendPools: [{ name: 'defaultBackendPool', targets: '10.0.2.4' }]
      },
      validation: { critical: ['sku', 'capacity'], warning: ['tier', 'sslPolicy', 'wafPolicy'] },
      importMappings: {
        'sku.name': 'sku',
        'sku.tier': 'tier',
        'sku.capacity': 'capacity',
        'properties.sslPolicy.policyName': 'sslPolicy',
        'properties.webApplicationFirewallConfiguration.firewallMode': 'wafMode',
        'properties.firewallPolicy.id': 'wafPolicy',
        'properties.backendAddressPools': {
          key: 'backendPools',
          transform: (pools) => (pools || []).map(pool => ({
            name: pool.name || 'defaultBackendPool',
            targets: (pool.properties?.backendAddresses || [])
              .map(addr => addr.ipAddress || addr.fqdn)
              .filter(Boolean)
              .join(',')
          }))
        }
      }
    },
    lb: {
      icon: '⚖️',
      img: 'Load-Balancers.svg',
      color: '#00BCF2',
      label: 'Load Balancer',
      cost: 25,
      pricingCalculatorSlug: 'load-balancer',
      azureTypes: ['microsoft.network/loadbalancers'],
      config: { sku: 'Standard', type: 'Internal', frontendIp: 'Dynamic', healthProbe: 'TCP/80', lbRules: 'HTTP:80->80', wafPolicy: '' },
      validation: { critical: ['sku', 'type'], warning: ['healthProbe', 'wafPolicy'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.frontendIPConfigurations[0].properties.privateIPAllocationMethod': 'frontendIp',
        'properties.frontendIPConfigurations[0].properties.publicIPAddress': { key: 'type', value: 'Public' }
      }
    },
    gw: {
      icon: '🔀',
      img: 'Virtual-Network-Gateways.svg',
      color: '#0078D4',
      label: 'VPN Gateway',
      cost: 140,
      pricingCalculatorSlug: 'vpn-gateway',
      azureTypes: ['microsoft.network/virtualnetworkgateways'],
      config: { sku: 'VpnGw2AZ', generation: 'Generation2', vpnType: 'RouteBased', activeActive: 'false', bgpAsn: '65515' },
      validation: { critical: ['sku', 'vpnType'], warning: ['generation', 'bgpAsn'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.vpnType': 'vpnType',
        'properties.vpnGatewayGeneration': 'generation',
        'properties.activeActive': 'activeActive',
        'properties.bgpSettings.asn': 'bgpAsn'
      },
      dependencies: ['GatewaySubnet']
    },
    ergw: {
      icon: '🚄',
      img: 'ExpressRoute-Circuits.svg',
      color: '#003A5C',
      label: 'ExpressRoute GW',
      cost: 450,
      pricingCalculatorSlug: 'expressroute',
      config: { sku: 'ErGw2AZ', gatewayType: 'ExpressRoute', expressRouteCircuitId: '' },
      validation: { critical: ['sku'], warning: ['expressRouteCircuitId'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.gatewayType': 'gatewayType'
      },
      dependencies: ['GatewaySubnet']
    },
    bas: {
      icon: '🔒',
      img: 'Private-Link.svg',
      color: '#0078D4',
      label: 'Azure Bastion',
      cost: 190,
      pricingCalculatorSlug: 'azure-bastion',
      azureTypes: ['microsoft.network/bastionhosts'],
      config: { sku: 'Standard', scaleUnits: '2', shareableLink: 'false', ipConnect: 'true', tunneling: 'true' },
      validation: { critical: ['sku'], warning: ['scaleUnits'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.scaleUnits': 'scaleUnits',
        'properties.enableShareableLink': 'shareableLink',
        'properties.enableIpConnect': 'ipConnect',
        'properties.enableTunneling': 'tunneling'
      },
      dependencies: ['AzureBastionSubnet']
    },
    afd: {
      icon: '⚡',
      img: 'Front-Doors.svg',
      color: '#FF8C00',
      label: 'Azure Front Door',
      cost: 330,
      pricingCalculatorSlug: 'front-door',
      azureTypes: ['microsoft.cdn/profiles'],
      config: { sku: 'Premium', endpoints: 'default-endpoint', originGroups: 'default-origin-group', wafPolicy: '', routingRules: 'default-route' },
      validation: { critical: ['sku'], warning: ['endpoints', 'originGroups'] },
      importMappings: {
        'sku.name': { key: 'sku', transform: (v) => v?.replace('_AzureFrontDoor', '') || 'Premium' }
      }
    },
    pe: {
      icon: '🔌',
      img: 'Private-Link.svg',
      color: '#8764B8',
      label: 'Private Endpoint',
      cost: 10,
      pricingCalculatorSlug: 'private-link',
      azureTypes: ['microsoft.network/privateendpoints'],
      config: { target: 'Storage', groupId: 'blob', privateDnsZoneId: '', connectionName: '', subResource: 'blob', targetResourceId: '', targetResourceName: '' },
      validation: { critical: ['target', 'groupId'], warning: ['targetResourceId', 'privateDnsZoneId'] },
      importMappings: {
        'properties.privateLinkServiceConnections[0].properties.groupIds[0]': 'groupId',
        'properties.privateLinkServiceConnections[0].properties.privateLinkServiceId': 'targetResourceId'
      },
      dependencies: ['Target Resource', 'Private DNS Zone (recommended)']
    },
    dns: {
      icon: '🌐',
      img: 'DNS-Zones.svg',
      color: '#00B294',
      label: 'Private DNS Zone',
      cost: 5,
      pricingCalculatorSlug: 'dns',
      azureTypes: ['microsoft.network/privatednszones'],
      rgLevel: true,
      dnsType: 'private',
      config: { zone: 'privatelink.blob.core.windows.net', fullZoneName: 'privatelink.blob.core.windows.net', records: [], vnetLinks: [], autoRegistration: 'false' },
      validation: { critical: ['zone'], warning: ['records', 'vnetLinks', 'autoRegistration'] },
      importMappings: {
        'name': 'zone',
        'properties.registrationEnabled': 'autoRegistration'
      },
      dependencies: ['Linked VNets']
    },
    publicDns: {
      icon: '🌍',
      img: 'DNS-Zones.svg',
      color: '#00BCF2',
      label: 'Public DNS Zone',
      cost: 5,
      pricingCalculatorSlug: 'dns',
      azureTypes: ['microsoft.network/dnszones'],
      rgLevel: true,
      dnsType: 'public',
      config: { zone: 'example.com', records: [] },
      validation: { critical: ['zone'], warning: [] },
      importMappings: {
        'name': 'zone'
      }
    },
    wafPolicy: {
      icon: '🧰',
      img: 'Application-Gateways.svg',
      color: '#FF8C00',
      label: 'WAF Policy',
      cost: 20,
      pricingCalculatorSlug: 'web-application-firewall',
      azureTypes: ['microsoft.network/applicationgatewaywebapplicationfirewallpolicies'],
      rgLevel: true,
      config: {
        mode: 'Prevention',
        ruleSetType: 'OWASP',
        ruleSetVersion: '3.2',
        requestBodyCheck: 'true',
        maxRequestBodySizeInKb: '128',
        fileUploadLimitInMb: '100',
        customRules: [{
          name: 'BlockBadBots',
          priority: '100',
          action: 'Block',
          matchVariable: 'RequestHeaders:User-Agent',
          operator: 'Contains',
          matchValue: 'BadBot'
        }]
      },
      validation: { critical: ['mode', 'ruleSetType', 'ruleSetVersion'], warning: ['customRules'] },
      importMappings: {
        'properties.policySettings.mode': 'mode'
      }
    },
    nsg: {
      icon: '📋',
      img: 'Network-Security-Groups.svg',
      color: '#E81123',
      label: 'Network Sec Group',
      cost: 0,
      pricingCalculatorSlug: 'network-security-groups',
      azureTypes: ['microsoft.network/networksecuritygroups'],
      config: {
        rules: [
          { name: 'Allow-HTTP', priority: '100', direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRange: '80', sourceAddressPrefix: '*', destinationAddressPrefix: '*', description: 'Allow inbound HTTP' },
          { name: 'Allow-HTTPS', priority: '110', direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRange: '443', sourceAddressPrefix: '*', destinationAddressPrefix: '*', description: 'Allow inbound HTTPS' }
        ]
      },
      validation: { critical: [], warning: ['rules'] },
      importMappings: {
        'properties.securityRules': {
          key: 'rules',
          transform: (rules) => (rules || []).map(r => ({
            name: r.name,
            priority: String(r.properties?.priority || 100),
            direction: r.properties?.direction || 'Inbound',
            access: r.properties?.access || 'Allow',
            protocol: r.properties?.protocol || 'Tcp',
            sourcePortRange: r.properties?.sourcePortRange || '*',
            destinationPortRange: r.properties?.destinationPortRange || '*',
            sourceAddressPrefix: r.properties?.sourceAddressPrefix || '*',
            destinationAddressPrefix: r.properties?.destinationAddressPrefix || '*',
            description: r.properties?.description || ''
          }))
        }
      }
    },
    udr: {
      icon: '🛣️',
      img: 'Route-Tables.svg',
      color: '#E81123',
      label: 'Route Table',
      cost: 0,
      pricingCalculatorSlug: 'virtual-network',
      azureTypes: ['microsoft.network/routetables'],
      config: { disableBgpRoutePropagation: 'false', routes: [{ name: 'default-route', addressPrefix: '0.0.0.0/0', nextHopType: 'VirtualAppliance', nextHopIpAddress: '' }] },
      validation: { critical: [], warning: ['routes'] },
      importMappings: {
        'properties.disableBgpRoutePropagation': { key: 'disableBgpRoutePropagation', transform: (v) => v ? 'true' : 'false' },
        'properties.routes': {
          key: 'routes',
          transform: (routes) => (routes || []).map(r => ({
            name: r.name,
            addressPrefix: r.properties?.addressPrefix || '',
            nextHopType: r.properties?.nextHopType || 'VirtualAppliance',
            nextHopIpAddress: r.properties?.nextHopIpAddress || ''
          }))
        }
      }
    },
    natgw: {
      icon: '🚪',
      img: 'NAT.svg',
      color: '#0078D4',
      label: 'NAT Gateway',
      cost: 35,
      pricingCalculatorSlug: 'virtual-network-nat-gateways',
      azureTypes: ['microsoft.network/natgateways'],
      config: { sku: 'Standard', idleTimeoutMinutes: '4', zones: '1', publicIpName: '' },
      validation: { critical: ['sku'], warning: ['publicIpName', 'idleTimeoutMinutes'] },
      importMappings: {
        'sku.name': 'sku',
        'properties.idleTimeoutInMinutes': { key: 'idleTimeoutMinutes', transform: (v) => String(v || 4) },
        'zones': { key: 'zones', transform: (z) => (z || []).join(',') }
      },
      dependencies: ['Public IP Address (pip/external)']
    },
    asg: {
      icon: '🏷️',
      img: 'Application-Security-Groups.svg',
      color: '#00BCF2',
      label: 'App Security Group',
      cost: 0,
      pricingCalculatorSlug: 'network-security-groups',
      azureTypes: ['microsoft.network/applicationsecuritygroups'],
      config: { description: '' },
      validation: { critical: [], warning: ['description'] },
      importMappings: {
        'properties.description': 'description'
      }
    },
    pip: {
      icon: '📍',
      img: 'Public-IP-Addresses.svg',
      color: '#00BCF2',
      label: 'Public IP Address',
      cost: 4,
      pricingCalculatorSlug: 'ip-addresses',
      azureTypes: ['microsoft.network/publicipaddresses'],
      config: { sku: 'Standard', allocationMethod: 'Static', tier: 'Regional', zones: '1,2,3', ddosProtection: 'false', domainNameLabel: '' },
      validation: { critical: ['sku', 'allocationMethod'], warning: ['tier', 'domainNameLabel'] },
      importMappings: {
        'sku.name': 'sku',
        'sku.tier': 'tier',
        'properties.publicIPAllocationMethod': 'allocationMethod',
        'zones': { key: 'zones', transform: (z) => (z || []).join(',') },
        'properties.dnsSettings.domainNameLabel': 'domainNameLabel'
      }
    }
  }
};
