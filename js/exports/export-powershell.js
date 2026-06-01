import { state, RES_TYPES, getVnetsInRg } from '../state-management.js';
import { _iacSafe } from './export-utils.js';

// App Service Plan SKU → Tier/WorkerSize lookup tables
const _ASP_TIER_MAP = { F1:'Free', D1:'Shared', B1:'Basic', B2:'Basic', B3:'Basic', S1:'Standard', S2:'Standard', S3:'Standard', P1v2:'PremiumV2', P2v2:'PremiumV2', P3v2:'PremiumV2', P0v3:'PremiumV3', P1v3:'PremiumV3', P2v3:'PremiumV3', P3v3:'PremiumV3', P1mv3:'PremiumV3', P2mv3:'PremiumV3', P3mv3:'PremiumV3', P4mv3:'PremiumV3', P5mv3:'PremiumV3', Y1:'Dynamic' };
const _ASP_SIZE_MAP = { F1:'Small', D1:'Small', B1:'Small', B2:'Medium', B3:'Large', S1:'Small', S2:'Medium', S3:'Large', P1v2:'Small', P2v2:'Medium', P3v2:'Large', P0v3:'Small', P1v3:'Small', P2v3:'Medium', P3v3:'Large', P1mv3:'Small', P2mv3:'Medium', P3mv3:'Large', P4mv3:'Large', P5mv3:'Large', Y1:'Small' };

function generatePowerShellResource(res, rg, varN, sn) {
  const lines = [];
  const c = res.config || {};

  switch (res.type) {
    case 'vm': {
      lines.push(`# VM Size: ${c.size||'Standard_D2s_v3'}, OS: ${c.os||'Ubuntu 22.04'}`);
      lines.push(`$vmConfig = New-AzVMConfig -VMName "${res.name}" -VMSize "${c.size||'Standard_D2s_v3'}"`);
      if ((c.os||'').toLowerCase().includes('windows')) {
        lines.push(`$vmConfig = Set-AzVMOperatingSystem -VM $vmConfig -Windows -ComputerName "${res.name}" -Credential $cred`);
      } else {
        lines.push(`$vmConfig = Set-AzVMOperatingSystem -VM $vmConfig -Linux -ComputerName "${res.name}" -Credential $cred`);
      }
      lines.push(`$vmConfig = Set-AzVMOSDisk -VM $vmConfig -DiskSizeInGB ${c.osDiskSizeGB||128} -CreateOption FromImage -StorageAccountType "${c.osDiskType||'Premium_LRS'}"`);
      const nicAccelNet = c.acceleratedNetworking === 'true' ? ' -EnableAcceleratedNetworking' : '';
      lines.push(`$nic = New-AzNetworkInterface -Name "${res.name}-nic" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SubnetId (Get-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN}).Id${nicAccelNet}`);
      if (c.publicIp === 'true') {
        lines.push(`$pip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
      }
      if (c.availabilityZone && c.availabilityZone !== 'None') {
        lines.push(`New-AzVM -ResourceGroupName "${rg.name}" -Location "${rg.location}" -VM $vmConfig -Zone "${c.availabilityZone}"`);
      } else {
        lines.push(`New-AzVM -ResourceGroupName "${rg.name}" -Location "${rg.location}" -VM $vmConfig`);
      }
      break;
    }
    case 'vmss': {
      lines.push(`$vmssConfig = New-AzVmssConfig -Location "${rg.location}" -SkuCapacity ${c.instances||2} -SkuName "${c.size||'Standard_D2s_v3'}" -UpgradePolicyMode "${c.upgradePolicy||'Rolling'}"`);
      if (c.zones) {
        lines.push(`$vmssConfig.Zones = @(${c.zones.split(',').map(z => `"${z.trim()}"`).join(',')})`);
      }
      if ((c.os||'').toLowerCase().includes('windows')) {
        lines.push(`$vmssConfig = Set-AzVmssOsProfile -VirtualMachineScaleSet $vmssConfig -ComputerNamePrefix "${res.name}" -AdminUsername "azureuser" -AdminPassword $password -Windows`);
      } else {
        lines.push(`$vmssConfig = Set-AzVmssOsProfile -VirtualMachineScaleSet $vmssConfig -ComputerNamePrefix "${res.name}" -AdminUsername "azureuser" -AdminPassword $password -Linux`);
      }
      lines.push(`# Autoscale: Min=${c.minInstances||2}, Max=${c.maxInstances||10}`);
      lines.push(`New-AzVmss -ResourceGroupName "${rg.name}" -VMScaleSetName "${res.name}" -VirtualMachineScaleSet $vmssConfig`);
      break;
    }
    case 'aks': {
      let aksCmd = `New-AzAksCluster -ResourceGroupName "${rg.name}" -Name "${res.name}" -NodeCount ${c.nodes||3} -KubernetesVersion "${c.version||'1.29'}" -NodeVmSize "${c.nodeSize||'Standard_D2s_v3'}" -NetworkPlugin "${c.networkPlugin||'azure'}" -Tier "${c.tier||'Standard'}"`;
      if (c.privateCluster === 'true') aksCmd += ' -EnablePrivateCluster';
      if (c.podCidr) aksCmd += ` -PodCidr "${c.podCidr}"`;
      if (c.serviceCidr) aksCmd += ` -ServiceCidr "${c.serviceCidr}"`;
      if (c.dnsServiceIp) aksCmd += ` -DnsServiceIP "${c.dnsServiceIp}"`;
      lines.push(aksCmd);
      break;
    }
    case 'fa': {
      lines.push(`New-AzFunctionApp -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -Runtime "${c.runtime||'node'}" -RuntimeVersion "${c.runtimeVersion||'20'}" -FunctionsVersion 4 -OSType "${c.osType||'Linux'}" -StorageAccountName "${c.storageAccountName||'<storage-account-name>'}"`);
      if (c.plan !== 'Consumption' && c.alwaysOn === 'true') {
        lines.push(`# AlwaysOn enabled for ${c.plan} plan`);
      }
      break;
    }
    case 'aca': {
      const acaEnvRef = c.environmentName
        ? `(Get-AzContainerAppManagedEnv -ResourceGroupName "${rg.name}" -EnvName "${c.environmentName}").Id`
        : '"<container-apps-environment-id>"';
      lines.push(`# Container Apps Environment required. Provide environmentName in config or replace the placeholder.`);
      lines.push(`# NOTE: The environment is assumed to be in the same resource group ("${rg.name}"). Update -ResourceGroupName if it differs.`);
      lines.push(`$acaEnvId = ${acaEnvRef}`);
      lines.push(`New-AzContainerApp -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -ManagedEnvironmentId $acaEnvId -Image "${c.image||'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'}" -Cpu ${c.cpu||'0.5'} -Memory "${c.memory||'1.0Gi'}" -MinReplicas ${c.minReplicas||1} -MaxReplicas ${c.replicas||10} -TargetPort ${c.targetPort||80} -IngressType "${c.ingress||'external'}"`);
      break;
    }
    case 'fw': {
      const fwZones = c.availabilityZones ? c.availabilityZones.split(',').map(z => `"${z.trim()}"`).join(',') : '"1","2","3"';
      lines.push(`$fwPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard -Zone @(${fwZones})`);
      lines.push(`$fwPolicy = New-AzFirewallPolicy -Name "${c.policyName || res.name + '-policy'}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -ThreatIntelMode "${c.threatIntelMode||'Alert'}" -DnsSetting @{ EnableProxy = $${c.dnsProxy||'true'} }`);
      lines.push(`New-AzFirewall -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -VirtualNetwork ${varN} -PublicIpAddress $fwPip -Sku "${c.sku||'Premium'}" -FirewallPolicyId $fwPolicy.Id -Zone @(${fwZones})`);
      break;
    }
    case 'nva': {
      const nvaVendor = (c.vendor||'Fortinet').toLowerCase();
      const nvaProduct = nvaVendor === 'fortinet' ? 'fortinet_fortigate-vm_v5' : `${nvaVendor}_nva`;
      const nvaPlanName = nvaVendor === 'fortinet' ? 'fortinet_fg-vm' : `${nvaVendor}_nva`;
      lines.push(`# NVA: ${res.name} (Vendor: ${c.vendor||'Fortinet'}, Mode: ${c.mode||'Active/Passive'}, Version: ${c.version||'7.4'}, License: ${c.licenseType||'PAYG'})`);
      lines.push(`# Deploy via Azure Marketplace — use New-AzMarketplaceTerms and New-AzVM with plan`);
      lines.push(`$nvaConfig = New-AzVMConfig -VMName "${res.name}" -VMSize "${c.size||'Standard_F4s_v2'}"`);
      lines.push(`$nvaConfig = Set-AzVMPlan -VM $nvaConfig -Publisher "${nvaVendor}" -Product "${nvaProduct}" -Name "${nvaPlanName}"`);
      lines.push(`# License Type: ${c.licenseType||'PAYG'} | Version: ${c.version||'7.4'}`);
      lines.push(`New-AzVM -ResourceGroupName "${rg.name}" -Location "${rg.location}" -VM $nvaConfig`);
      break;
    }
    case 'agw': {
      lines.push(`$agwPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
      lines.push(`$agwIpConfig = New-AzApplicationGatewayIPConfiguration -Name "appGatewayIpConfig" -Subnet (Get-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN})`);
      lines.push(`$agwFrontendIp = New-AzApplicationGatewayFrontendIPConfig -Name "appGatewayFrontendIp" -PublicIPAddress $agwPip`);
      lines.push(`$agwFrontendPort = New-AzApplicationGatewayFrontendPort -Name "appGatewayFrontendPort" -Port 80`);
      lines.push(`$agwBackendPool = New-AzApplicationGatewayBackendAddressPool -Name "appGatewayBackendPool"`);
      lines.push(`$agwBackendSettings = New-AzApplicationGatewayBackendHttpSetting -Name "appGatewayBackendHttpSettings" -Port 80 -Protocol Http -RequestTimeout 30`);
      lines.push(`$agwListener = New-AzApplicationGatewayHttpListener -Name "appGatewayHttpListener" -Protocol Http -FrontendIPConfiguration $agwFrontendIp -FrontendPort $agwFrontendPort`);
      lines.push(`$agwRule = New-AzApplicationGatewayRequestRoutingRule -Name "rule1" -RuleType Basic -HttpListener $agwListener -BackendAddressPool $agwBackendPool -BackendHttpSettings $agwBackendSettings -Priority 100`);
      lines.push(`$agwSku = New-AzApplicationGatewaySku -Name "${c.sku||'WAF_v2'}" -Tier "${c.tier||c.sku||'WAF_v2'}" -Capacity ${c.capacity||2}`);
      lines.push(`$agwSslPolicy = New-AzApplicationGatewaySslPolicy -PolicyType Predefined -PolicyName "${c.sslPolicy||'AppGwSslPolicy20220101'}"`);
      lines.push(`New-AzApplicationGateway -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Sku $agwSku -SslPolicy $agwSslPolicy -GatewayIPConfigurations $agwIpConfig -FrontendIPConfigurations $agwFrontendIp -FrontendPorts $agwFrontendPort -BackendAddressPools $agwBackendPool -BackendHttpSettingsCollection $agwBackendSettings -HttpListeners $agwListener -RequestRoutingRules $agwRule`);
      break;
    }
    case 'lb': {
      const lbIsPublic = (c.type||'Internal') === 'Public';
      if (lbIsPublic) {
        lines.push(`$lbPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
        lines.push(`$lbFrontendIp = New-AzLoadBalancerFrontendIpConfig -Name "${res.name}-frontend" -PublicIpAddress $lbPip`);
      } else {
        lines.push(`$lbFrontendIp = New-AzLoadBalancerFrontendIpConfig -Name "${res.name}-frontend" -SubnetId (Get-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN}).Id`);
      }
      lines.push(`$lbBackendPool = New-AzLoadBalancerBackendAddressPoolConfig -Name "${res.name}-backend"`);
      const probeparts = (c.healthProbe||'TCP/80').split('/');
      lines.push(`$lbProbe = New-AzLoadBalancerProbeConfig -Name "${res.name}-probe" -Protocol ${probeparts[0]||'Tcp'} -Port ${probeparts[1]||80} -IntervalInSeconds 15 -ProbeCount 2`);
      lines.push(`$lbRule = New-AzLoadBalancerRuleConfig -Name "${res.name}-rule" -FrontendIpConfiguration $lbFrontendIp -BackendAddressPool $lbBackendPool -Probe $lbProbe -Protocol Tcp -FrontendPort 80 -BackendPort 80`);
      lines.push(`New-AzLoadBalancer -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Sku "${c.sku||'Standard'}" -FrontendIpConfiguration $lbFrontendIp -BackendAddressPool $lbBackendPool -Probe $lbProbe -LoadBalancingRule $lbRule`);
      break;
    }
    case 'gw': {
      lines.push(`$gwPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
      lines.push(`$gwSubnet = Get-AzVirtualNetworkSubnetConfig -Name "GatewaySubnet" -VirtualNetwork ${varN}`);
      lines.push(`$gwIpConfig = New-AzVirtualNetworkGatewayIpConfig -Name "${res.name}-ipconfig" -Subnet $gwSubnet -PublicIpAddress $gwPip`);
      const gwActiveActive = c.activeActive === 'true' ? ' -EnableActiveActiveFeature' : '';
      const gwBgp = c.bgpAsn && c.bgpAsn !== '65515' ? ` -EnableBgp $true -Asn ${c.bgpAsn}` : '';
      lines.push(`New-AzVirtualNetworkGateway -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -IpConfigurations $gwIpConfig -GatewayType Vpn -VpnType "${c.vpnType||'RouteBased'}" -VpnGatewayGeneration "${c.generation||'Generation2'}" -GatewaySku "${c.sku||'VpnGw2AZ'}"${gwActiveActive}${gwBgp}`);
      break;
    }
    case 'ergw': {
      lines.push(`$ergwPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
      lines.push(`$ergwSubnet = Get-AzVirtualNetworkSubnetConfig -Name "GatewaySubnet" -VirtualNetwork ${varN}`);
      lines.push(`$ergwIpConfig = New-AzVirtualNetworkGatewayIpConfig -Name "${res.name}-ipconfig" -Subnet $ergwSubnet -PublicIpAddress $ergwPip`);
      lines.push(`New-AzVirtualNetworkGateway -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -IpConfigurations $ergwIpConfig -GatewayType "${c.gatewayType||'ExpressRoute'}" -GatewaySku "${c.sku||'ErGw2AZ'}"`);
      if (c.expressRouteCircuitId) {
        lines.push(`# Connect to ExpressRoute Circuit: ${c.expressRouteCircuitId}`);
        lines.push(`New-AzVirtualNetworkGatewayConnection -Name "${res.name}-connection" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -VirtualNetworkGateway1 (Get-AzVirtualNetworkGateway -Name "${res.name}" -ResourceGroupName "${rg.name}") -ConnectionType ExpressRoute -PeerId "${c.expressRouteCircuitId}"`);
      }
      break;
    }
    case 'bas': {
      lines.push(`$basPip = New-AzPublicIpAddress -Name "${res.name}-pip" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AllocationMethod Static -Sku Standard`);
      lines.push(`New-AzBastion -Name "${res.name}" -ResourceGroupName "${rg.name}" -VirtualNetworkId ${varN}.Id -PublicIpAddressId $basPip.Id -Sku "${c.sku||'Standard'}" -ScaleUnit ${c.scaleUnits||2}${c.shareableLink==='true' ? ' -EnableShareableLink' : ''}${c.ipConnect==='true' ? ' -EnableIpConnect' : ''}${c.tunneling==='true' ? ' -EnableTunneling' : ''}`);
      break;
    }
    case 'afd': {
      lines.push(`New-AzFrontDoorCdnProfile -ProfileName "${res.name}" -ResourceGroupName "${rg.name}" -Location "Global" -SkuName "${c.sku||'Premium'}_AzureFrontDoor"`);
      lines.push(`$afdEndpoint = New-AzFrontDoorCdnEndpoint -EndpointName "${c.endpoints||res.name+'-endpoint'}" -ProfileName "${res.name}" -ResourceGroupName "${rg.name}" -Location "Global"`);
      lines.push(`$afdOriginGroup = New-AzFrontDoorCdnOriginGroup -OriginGroupName "${c.originGroups||'default-origin-group'}" -ProfileName "${res.name}" -ResourceGroupName "${rg.name}" -LoadBalancingSettingSampleSize 4 -LoadBalancingSettingSuccessfulSamplesRequired 3`);
      if (c.wafPolicy) {
        lines.push(`# WAF Policy: ${c.wafPolicy}`);
        lines.push(`$afdSecurityPolicy = New-AzFrontDoorCdnSecurityPolicy -ProfileName "${res.name}" -ResourceGroupName "${rg.name}" -Name "${c.wafPolicy}" -PolicyType "WebApplicationFirewall"`);
      }
      lines.push(`New-AzFrontDoorCdnRoute -RouteName "${c.routingRules||'default-route'}" -EndpointName "${c.endpoints||res.name+'-endpoint'}" -ProfileName "${res.name}" -ResourceGroupName "${rg.name}" -OriginGroupId $afdOriginGroup.Id -SupportedProtocol @("Http","Https") -PatternsToMatch @("/*")`);
      break;
    }
    case 'pe': {
      const peConnectionName = c.connectionName || `${res.name}-connection`;
      const peGroupId = c.groupId || c.subResource || c.target || 'blob';
      lines.push(`$privateEndpointConnection = New-AzPrivateLinkServiceConnection -Name "${peConnectionName}" -PrivateLinkServiceId "<target-resource-id>" -GroupId "${peGroupId}"`);
      lines.push(`New-AzPrivateEndpoint -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Subnet (Get-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN}) -PrivateLinkServiceConnection $privateEndpointConnection`);
      if (c.privateDnsZoneId) {
        lines.push(`$privateDnsZoneConfig = New-AzPrivateDnsZoneConfig -Name "default" -PrivateDnsZoneId "${c.privateDnsZoneId}"`);
        lines.push(`New-AzPrivateDnsZoneGroup -Name "${res.name}-dns-group" -ResourceGroupName "${rg.name}" -PrivateEndpointName "${res.name}" -PrivateDnsZoneConfig $privateDnsZoneConfig`);
      }
      break;
    }
    case 'nsg': {
      let nsgRules = [];
      try { nsgRules = JSON.parse(c.rules || '[]'); } catch(e) { nsgRules = []; }
      if (nsgRules.length === 0) {
        nsgRules = [
          {name:'Allow-HTTP',priority:'100',direction:'Inbound',access:'Allow',protocol:'Tcp',srcPort:'*',dstPort:'80',srcAddr:'*',dstAddr:'*'},
          {name:'Allow-HTTPS',priority:'110',direction:'Inbound',access:'Allow',protocol:'Tcp',srcPort:'*',dstPort:'443',srcAddr:'*',dstAddr:'*'}
        ];
      }
      lines.push(`$nsgRules = @()`);
      nsgRules.forEach(rule => {
        lines.push(`$nsgRules += New-AzNetworkSecurityRuleConfig -Name "${rule.name}" -Protocol ${rule.protocol||'Tcp'} -Direction ${rule.direction||'Inbound'} -Priority ${rule.priority||100} -SourceAddressPrefix "${rule.srcAddr||'*'}" -SourcePortRange "${rule.srcPort||'*'}" -DestinationAddressPrefix "${rule.dstAddr||'*'}" -DestinationPortRange "${rule.dstPort||'80'}" -Access ${rule.access||'Allow'}`);
      });
      lines.push(`New-AzNetworkSecurityGroup -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SecurityRules $nsgRules`);
      break;
    }
    case 'sql': {
      const sqlTier = c.tier || 'GeneralPurpose';
      const sqlSkuPrefix = sqlTier === 'BusinessCritical' ? 'BC_Gen5' : 'GP_Gen5';
      const sqlServerName = c.serverName || `${res.name}-server`;
      lines.push(`New-AzSqlServer -ServerName "${sqlServerName}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SqlAdministratorCredentials $cred`);
      lines.push(`New-AzSqlDatabase -DatabaseName "${res.name}" -ServerName "${sqlServerName}" -ResourceGroupName "${rg.name}" -Edition "${sqlTier}" -VCore ${c.vcores||4} -ComputeGeneration "Gen5" -MaxSizeBytes ${(parseInt(c.maxSizeGB)||32)*1073741824} -Collation "${c.collation||'SQL_Latin1_General_CP1_CI_AS'}" -BackupStorageRedundancy "${c.zoneRedundant==='true'?'Zone':'Local'}" -ZoneRedundant:$${c.zoneRedundant==='true'?'true':'false'}`);
      if(c.backupRetentionDays && c.backupRetentionDays !== '7') lines.push(`Set-AzSqlDatabaseBackupShortTermRetentionPolicy -ServerName "${sqlServerName}" -DatabaseName "${res.name}" -ResourceGroupName "${rg.name}" -RetentionDays ${c.backupRetentionDays}`);
      break;
    }
    case 'cosmos': {
      const cosmosConsistency = c.consistencyLevel || 'Session';
      const cosmosServerless = c.serverless === 'true' ? ' -Capabilities @("EnableServerless")' : '';
      const cosmosFreeTier = c.enableFreeTier === 'true' ? ' -EnableFreeTier $true' : '';
      lines.push(`New-AzCosmosDBAccount -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -ApiKind "${c.api||'Sql'}" -DefaultConsistencyLevel "${cosmosConsistency}"${cosmosFreeTier}${cosmosServerless}`);
      if(c.geoReplication === 'true') lines.push(`# Enable geo-replication by adding additional locations`);
      if(c.serverless !== 'true') lines.push(`New-AzCosmosDBSqlDatabase -ResourceGroupName "${rg.name}" -AccountName "${res.name}" -Name "${res.name}-db" -Throughput ${c.maxRU||400}`);
      else lines.push(`New-AzCosmosDBSqlDatabase -ResourceGroupName "${rg.name}" -AccountName "${res.name}" -Name "${res.name}-db"`);
      break;
    }
    case 'sa': {
      const saKind = c.kind || 'StorageV2';
      const saTier = c.tier || 'Standard';
      const saAccessTier = c.accessTier || 'Hot';
      lines.push(`New-AzStorageAccount -Name "${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SkuName "${saTier}_${c.replication||'ZRS'}" -Kind "${saKind}" -AccessTier "${saAccessTier}" -MinimumTlsVersion "${c.minTlsVersion||'TLS1_2'}" -AllowBlobPublicAccess $false -EnableHttpsTrafficOnly $${c.httpsOnly!=='false'?'true':'false'}`);
      break;
    }
    case 'redis': {
      const redisSku = (c.sku||'Premium P1').split(' ');
      const redisSkuName = redisSku[0] || 'Premium';
      const redisSize = redisSku[1] || 'P1';
      const redisZones = c.zones ? ` -Zone @(${c.zones.split(',').map(z=>`"${z.trim()}"`).join(',')})` : '';
      lines.push(`New-AzRedisCache -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Sku "${redisSkuName}" -Size "${redisSize}" -MinimumTlsVersion "${c.minTlsVersion||'1.2'}" -EnableNonSslPort $${c.enableNonSslPort==='true'?'true':'false'} -ReplicasPerPrimary ${c.replicasPerPrimary||1} -Capacity ${c.capacity||1}${redisZones}`);
      break;
    }
    case 'adls': {
      const adlsReplication = c.replication || 'LRS';
      lines.push(`New-AzStorageAccount -Name "${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SkuName "${c.tier||'Standard'}_${adlsReplication}" -Kind "StorageV2" -EnableHierarchicalNamespace $${c.hierarchicalNamespace!=='false'?'true':'false'}${c.enableSoftDelete==='true'?' -EnableBlobDeleteRetentionPolicy $true -BlobDeleteRetentionDays 7':''}`);
      break;
    }
    case 'kv': {
      let kvCmd = `New-AzKeyVault -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Sku "${c.sku||'Premium'}"`;
      if(c.purgeProtection !== 'false') kvCmd += ` -EnablePurgeProtection`;
      if(c.enableRbacAuth !== 'false') kvCmd += ` -EnableRbacAuthorization`;
      if(c.softDeleteDays && c.softDeleteDays !== '90') kvCmd += ` -SoftDeleteRetentionInDays ${c.softDeleteDays}`;
      if(c.networkAcls && c.networkAcls !== 'Allow') kvCmd += ` -NetworkRuleSet @{ DefaultAction = "Deny" }`;
      lines.push(kvCmd);
      break;
    }
    case 'app': {
      const aspName = c.appServicePlanName || `${res.name}-plan`;
      const aspSku = c.appServicePlanSku || c.sku || 'P1v3';
      const aspTier = _ASP_TIER_MAP[aspSku] || 'PremiumV3';
      const aspWorkerSize = _ASP_SIZE_MAP[aspSku] || 'Small';
      lines.push(`New-AzAppServicePlan -Name "${aspName}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Tier "${aspTier}" -WorkerSize "${aspWorkerSize}"`);
      let appCmd = `New-AzWebApp -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AppServicePlan "${aspName}"`;
      lines.push(appCmd);
      if(c.httpsOnly !== 'false') lines.push(`Set-AzWebApp -Name "${res.name}" -ResourceGroupName "${rg.name}" -HttpsOnly $true`);
      if(c.runtime) lines.push(`# Runtime: ${c.runtime} ${c.runtimeVersion||''}`);
      if(c.alwaysOn === 'true') lines.push(`# AlwaysOn: Enabled`);
      if(c.minTlsVersion) lines.push(`# Min TLS Version: ${c.minTlsVersion}`);
      if(c.managedIdentity && c.managedIdentity !== 'None') lines.push(`Set-AzWebApp -Name "${res.name}" -ResourceGroupName "${rg.name}" -AssignIdentity $true`);
      break;
    }
    case 'apim': {
      lines.push(`New-AzApiManagement -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Organization "${c.publisherName||'MyOrg'}" -AdminEmail "${c.publisherEmail||'admin@example.com'}" -Sku "${c.tier||'Developer'}" -Capacity ${c.capacity||1}${c.vnetType && c.vnetType!=='None' ? ` -VpnType "${c.vnetType}"` : ''}`);
      break;
    }
    case 'sb': {
      let sbCmd = `New-AzServiceBusNamespace -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SkuName "${c.tier||'Premium'}" -SkuCapacity ${c.messagingUnits||1}`;
      if(c.zoneRedundant === 'true') sbCmd += ` -ZoneRedundant`;
      lines.push(sbCmd);
      break;
    }
    case 'evh': {
      let evhCmd = `New-AzEventHubNamespace -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SkuName "${c.tier||'Standard'}" -SkuCapacity ${c.throughputUnits||1}`;
      lines.push(evhCmd);
      lines.push(`New-AzEventHub -Name "${res.name}-hub" -NamespaceName "${res.name}" -ResourceGroupName "${rg.name}" -PartitionCount ${c.partitions||4} -MessageRetentionInDays ${c.retentionDays||7}${c.captureEnabled==='true' ? ' -CaptureEnabled' : ''}`);
      break;
    }
    case 'logic': {
      lines.push(`# Logic App (${c.plan||'Standard'}): ${res.name} — Trigger: ${c.triggerType||'HTTP'}${c.connectors ? ', Connectors: '+c.connectors : ''}`);
      lines.push(`New-AzLogicApp -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -State "${c.state||'Enabled'}"`);
      break;
    }
    case 'foundry': {
      let foundryCmd = `New-AzCognitiveServicesAccount -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Kind "${c.kind||'AIServices'}" -SkuName "${c.sku||'S0'}"`;
      if(c.customSubdomain) foundryCmd += ` -CustomSubdomainName "${c.customSubdomain}"`;
      if(c.networkRules && c.networkRules !== 'Allow') foundryCmd += ` -NetworkRuleSet @{ DefaultAction = "Deny" }`;
      lines.push(foundryCmd);
      break;
    }
    case 'openai': {
      lines.push(`New-AzCognitiveServicesAccount -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Kind "OpenAI" -SkuName "S0" -CustomSubdomainName "${res.name}"`);
      lines.push(`# Deploy model: ${c.model||'gpt-4o'} (deployment: ${c.deploymentName||c.model||'gpt-4o'}, version: ${c.modelVersion||'latest'})`);
      lines.push(`New-AzCognitiveServicesAccountDeployment -ResourceGroupName "${rg.name}" -AccountName "${res.name}" -Name "${c.deploymentName||c.model||'gpt-4o'}" -Properties @{ model = @{ format = "OpenAI"; name = "${c.model||'gpt-4o'}"; version = "${c.modelVersion||'latest'}" } } -Sku @{ name = "Standard"; capacity = ${c.capacity||10} }`);
      if(c.contentFilter && c.contentFilter !== 'Default') lines.push(`# Content Filter: ${c.contentFilter}`);
      break;
    }
    case 'monitor': {
      lines.push(`New-AzOperationalInsightsWorkspace -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -Sku "${c.workspaceSku||'PerGB2018'}" -RetentionInDays ${c.retentionDays||90}${c.dailyCapGB ? ` -DailyQuotaGb ${c.dailyCapGB}` : ''}`);
      if(c.solutions) lines.push(`# Solutions: ${c.solutions}`);
      break;
    }
    default: {
      lines.push(`# Resource "${res.name}" (type: ${res.type}) — no specific PowerShell generation available`);
      break;
    }
  }
  return lines;
}


export function generatePowerShell(){
  const lines=[`# Azure PowerShell Deployment Script\n# Generated: ${new Date().toISOString()}\n`];
  const allVnets = [state.hub, ...state.spokes];

  // Management Groups
  if (state.mgEnabled && state.managementGroups && state.managementGroups.length > 0) {
    lines.push(`# ============ MANAGEMENT GROUPS ============`);
    // Create top-level MGs first, then children
    const topMgs = state.managementGroups.filter(mg => !mg.parentId);
    const childMgs = state.managementGroups.filter(mg => mg.parentId);
    topMgs.forEach(mg => {
      lines.push(`New-AzManagementGroup -GroupName "${mg.name}"`);
    });
    childMgs.forEach(mg => {
      const parent = state.managementGroups.find(p => p.id === mg.parentId);
      if (parent) {
        lines.push(`New-AzManagementGroup -GroupName "${mg.name}" -ParentId "/providers/Microsoft.Management/managementGroups/${parent.name}"`);
      } else {
        lines.push(`New-AzManagementGroup -GroupName "${mg.name}"`);
      }
    });
    lines.push('');
    // Assign subscriptions to MGs
    state.subscriptions.forEach(sub => {
      if (sub.mgId) {
        const mg = state.managementGroups.find(m => m.id === sub.mgId);
        if (mg) {
          const subIdRef = sub.subscriptionId || '<SUBSCRIPTION-ID>';
          lines.push(`New-AzManagementGroupSubscription -GroupName "${mg.name}" -SubscriptionId "${subIdRef}"`);
        }
      }
    });
    lines.push('');
  }

  state.subscriptions.forEach(sub=>{
    lines.push(`# ============ SUBSCRIPTION: ${sub.name} ============`);
    if (sub.subscriptionId && sub.subscriptionId !== 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx') {
      lines.push(`Set-AzContext -SubscriptionId "${sub.subscriptionId}"\n`);
    } else {
      lines.push(`Set-AzContext -SubscriptionName "${sub.name}"\n`);
    }
    const subRgs=state.resourceGroups.filter(r=>r.subId===sub.id);
    subRgs.forEach(rg=>{
      lines.push(`# -- Resource Group: ${rg.name} --`);
      const rgTags = rg.tags && Object.keys(rg.tags).length > 0 ? ` -Tag @{${Object.entries(rg.tags).map(([k,v])=>`"${k}"="${v}"`).join(';')}}` : '';
      lines.push(`New-AzResourceGroup -Name "${rg.name}" -Location "${rg.location}"${rgTags} -ErrorAction SilentlyContinue`);
      if(rg.lock && rg.lock !== 'None') lines.push(`New-AzResourceLock -LockName "${rg.name}-lock" -LockLevel "${rg.lock}" -ResourceGroupName "${rg.name}" -Force`);
      lines.push('');
      getVnetsInRg(rg.id).forEach(vnet=>{
        const varN=`$vnet_${_iacSafe(vnet.name)}`;
        
        lines.push(`$subnets = @()`);
        (vnet.subnets || []).forEach(sn => {
          let snCmd = `$subnets += New-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -AddressPrefix "${sn.cidr}"`;
          if(sn.serviceEndpoints) {
            const eps = sn.serviceEndpoints.split(',').map(e=>e.trim()).filter(Boolean);
            if(eps.length) snCmd += ` -ServiceEndpoint @(${eps.map(e=>`"${e}"`).join(',')})`;
          }
          if(sn.delegation && sn.delegation !== 'None') snCmd += ` -Delegation (New-AzDelegation -Name "delegation" -ServiceName "${sn.delegation}")`;
          if(sn.privateEndpointNetworkPolicies === 'Enabled') snCmd += ` -PrivateEndpointNetworkPoliciesFlag "Enabled"`;
          if(sn.privateLinkServiceNetworkPolicies === 'Enabled') snCmd += ` -PrivateLinkServiceNetworkPoliciesFlag "Enabled"`;
          lines.push(snCmd);
        });

        let vnetCmd = `${varN} = New-AzVirtualNetwork -Name "${vnet.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AddressPrefix "${vnet.cidr}" -Subnet $subnets`;
        if(vnet.dnsServers) {
          const dns = vnet.dnsServers.split(',').map(d=>d.trim()).filter(Boolean);
          if(dns.length) vnetCmd += ` -DnsServer @(${dns.map(d=>`"${d}"`).join(',')})`;
        }
        if(vnet.ddosProtectionPlan === 'true') vnetCmd += ` -EnableDdosProtection`;
        if(vnet.encryption === 'true') vnetCmd += ` -EnableEncryption -EncryptionEnforcementPolicy "AllowUnencrypted"`;
        lines.push(vnetCmd);

        // NSG and Route Table associations
        (vnet.subnets || []).forEach(sn => {
          if(sn.nsgId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -NetworkSecurityGroupId (Get-AzNetworkSecurityGroup -Name "${sn.nsgId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
          if(sn.routeTableId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -RouteTableId (Get-AzRouteTable -Name "${sn.routeTableId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
          if(sn.natGatewayId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -NatGatewayId (Get-AzNatGateway -Name "${sn.natGatewayId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
        });
        
        if (vnet.peerings && vnet.peerings.length > 0) {
            vnet.peerings.forEach(pId => {
                const target = allVnets.find(v => v.id === pId);
                if (target) {
                    lines.push(`Add-AzVirtualNetworkPeering -Name "${vnet.name}-to-${target.name}" -VirtualNetwork ${varN} -RemoteVirtualNetworkId $vnet_${_iacSafe(target.name)}.Id -ErrorAction SilentlyContinue`);
                }
            });
        }

        (vnet.subnets || []).forEach(sn => {
          (sn.resources || []).forEach(res => {
            const t=RES_TYPES[res.type]||{label:'Resource'};
            lines.push(`# Deploying ${t.label}: ${res.name} (Subnet: ${sn.name})`);
            lines.push(...generatePowerShellResource(res, rg, varN, sn));
          });
        });
        lines.push('');
      });

      // RG-level resources (DNS Zones)
      const rgResources = (state.rgResources||[]).filter(r => r.rgId === rg.id);
      rgResources.forEach(res => {
        if(res.type === 'publicDns') {
          lines.push(`# -- Public DNS Zone: ${res.config.zone} --`);
          lines.push(`$zone = New-AzDnsZone -Name "${res.config.zone}" -ResourceGroupName "${rg.name}"\n`);
          (res.config.records||[]).forEach(rec => {
            if(rec.type === 'A') {
              lines.push(`New-AzDnsRecordSet -Name "${rec.name}" -RecordType A -ZoneName "${res.config.zone}" -ResourceGroupName "${rg.name}" -Ttl ${rec.ttl||3600} -DnsRecords (New-AzDnsRecordConfig -IPv4Address "${rec.value}")`);
            } else if(rec.type === 'CNAME') {
              lines.push(`New-AzDnsRecordSet -Name "${rec.name}" -RecordType CNAME -ZoneName "${res.config.zone}" -ResourceGroupName "${rg.name}" -Ttl ${rec.ttl||3600} -DnsRecords (New-AzDnsRecordConfig -Cname "${rec.value}")`);
            } else if(rec.type === 'MX') {
              lines.push(`New-AzDnsRecordSet -Name "${rec.name}" -RecordType MX -ZoneName "${res.config.zone}" -ResourceGroupName "${rg.name}" -Ttl ${rec.ttl||3600} -DnsRecords (New-AzDnsRecordConfig -Exchange "${rec.value}" -Preference 10)`);
            } else if(rec.type === 'TXT') {
              lines.push(`New-AzDnsRecordSet -Name "${rec.name}" -RecordType TXT -ZoneName "${res.config.zone}" -ResourceGroupName "${rg.name}" -Ttl ${rec.ttl||3600} -DnsRecords (New-AzDnsRecordConfig -Value "${rec.value}")`);
            } else {
              lines.push(`# ${rec.type} Record: ${rec.name} -> ${rec.value}`);
            }
          });
          lines.push('');
        } else if(res.type === 'dns') {
          const zoneName = res.config.fullZoneName || res.config.zone;
          lines.push(`# -- Private DNS Zone: ${zoneName} --`);
          lines.push(`$privateDnsZone = New-AzPrivateDnsZone -Name "${zoneName}" -ResourceGroupName "${rg.name}"\n`);
          (res.config.records||[]).forEach(rec => {
            if(rec.type === 'A') {
              lines.push(`New-AzPrivateDnsRecordSet -Name "${rec.name}" -RecordType A -ZoneName "${zoneName}" -ResourceGroupName "${rg.name}" -Ttl ${rec.ttl||3600} -PrivateDnsRecords (New-AzPrivateDnsRecordConfig -IPv4Address "${rec.value}")`);
            } else {
              lines.push(`# ${rec.type} Record: ${rec.name} -> ${rec.value}`);
            }
          });
          (res.config.vnetLinks||[]).forEach(link => {
            const enableReg = link.registrationEnabled || res.config.autoRegistration === 'true';
            lines.push(`New-AzPrivateDnsVirtualNetworkLink -Name "link-${link.vnetName}" -ResourceGroupName "${rg.name}" -ZoneName "${zoneName}" -VirtualNetworkId $vnet_${link.vnetName.replace(/[^a-zA-Z0-9]/g,'_')}.Id${enableReg ? ' -EnableRegistration' : ''}`);
          });
          lines.push('');
        }
      });
    });
  });

  if (state.onPrem.enabled) {
    lines.push(`# ============ HYBRID CONNECTIVITY ============`);
    lines.push(`# On-Premises Local Network Gateway`);
    lines.push(`New-AzLocalNetworkGateway -Name "lng-${state.onPrem.name.replace(/[^a-zA-Z0-9]/g,'')}" -ResourceGroupName "${state.resourceGroups[0].name}" -Location "eastus" -GatewayIpAddress "8.8.8.8" -AddressPrefix @("${state.onPrem.cidr}")`);
  }
  return lines.join('\n');
}

export function openPsModal(){document.getElementById('ps-output').textContent=generatePowerShell();document.getElementById('ps-modal').classList.add('show');}
