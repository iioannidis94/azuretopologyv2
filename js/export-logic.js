import { state, getVnetsInRg, RES_TYPES } from './state-management.js';

// ================================================================
// EXPORTS (PNG, PowerShell, Bicep)
// ================================================================
export function exportPng(){
  const canvas = document.getElementById('diagram-canvas');
  const ec=document.createElement('canvas');ec.width=canvas.width*2;ec.height=canvas.height*2;
  const c=ec.getContext('2d');c.scale(2,2);
  c.fillStyle=state.theme==='drawio'?'#F0F2F5':'#060D18';c.fillRect(0,0,canvas.width,canvas.height);
  
  c.strokeStyle=state.theme==='drawio'?'rgba(0,0,0,0.04)':'rgba(0,120,212,0.04)';c.lineWidth=1;
  for(let x=0;x<canvas.width;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,canvas.height);c.stroke();}
  for(let y=0;y<canvas.height;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(canvas.width,y);c.stroke();}

  c.drawImage(canvas,0,0,canvas.width,canvas.height);
  const a=document.createElement('a');a.download=`azure-architecture-${Date.now()}.png`;a.href=ec.toDataURL();a.click();
}

// ================================================================
// POWERSHELL RESOURCE GENERATORS
// ================================================================
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
      if (c.acceleratedNetworking === 'true') {
        lines.push(`$nic = New-AzNetworkInterface -Name "${res.name}-nic" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SubnetId ${varN}.Subnets[0].Id -EnableAcceleratedNetworking`);
      } else {
        lines.push(`$nic = New-AzNetworkInterface -Name "${res.name}-nic" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SubnetId ${varN}.Subnets[0].Id`);
      }
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
      lines.push(`New-AzFunctionApp -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -Runtime "${c.runtime||'node'}" -RuntimeVersion "${c.runtimeVersion||'20'}" -FunctionsVersion 4 -OSType "${c.osType||'Linux'}" -StorageAccountName "<storage-account>"`);
      if (c.plan !== 'Consumption' && c.alwaysOn === 'true') {
        lines.push(`# AlwaysOn enabled for ${c.plan} plan`);
      }
      break;
    }
    case 'aca': {
      lines.push(`New-AzContainerApp -ResourceGroupName "${rg.name}" -Name "${res.name}" -Location "${rg.location}" -Image "${c.image||'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'}" -Cpu ${c.cpu||'0.5'} -Memory "${c.memory||'1.0Gi'}" -MinReplicas ${c.minReplicas||1} -MaxReplicas ${c.replicas||10} -TargetPort ${c.targetPort||80} -IngressType "${c.ingress||'external'}"`);
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
      lines.push(`$nvaConfig = New-AzVMConfig -VMName "${res.name}" -VMSize "Standard_F4s_v2"`);
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
      lines.push(`New-AzSqlServer -ServerName "${res.name}-server" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -SqlAdministratorCredentials $cred`);
      lines.push(`New-AzSqlDatabase -DatabaseName "${res.name}" -ServerName "${res.name}-server" -ResourceGroupName "${rg.name}" -Edition "${sqlTier}" -VCore ${c.vcores||4} -ComputeGeneration "Gen5" -MaxSizeBytes ${(parseInt(c.maxSizeGB)||32)*1073741824} -Collation "${c.collation||'SQL_Latin1_General_CP1_CI_AS'}" -BackupStorageRedundancy "${c.zoneRedundant==='true'?'Zone':'Local'}" -ZoneRedundant:$${c.zoneRedundant==='true'?'true':'false'}`);
      if(c.backupRetentionDays && c.backupRetentionDays !== '7') lines.push(`Set-AzSqlDatabaseBackupShortTermRetentionPolicy -ServerName "${res.name}-server" -DatabaseName "${res.name}" -ResourceGroupName "${rg.name}" -RetentionDays ${c.backupRetentionDays}`);
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
      lines.push(`New-AzAppServicePlan -Name "${res.name}-plan" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -Tier "PremiumV3" -WorkerSize "Small" -Linux`);
      let appCmd = `New-AzWebApp -Name "${res.name}" -ResourceGroupName "${rg.name}" -Location "${rg.location}" -AppServicePlan "${res.name}-plan"`;
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

  state.subscriptions.forEach(sub=>{
    lines.push(`# ============ SUBSCRIPTION: ${sub.name} ============`);
    lines.push(`# Set-AzContext -SubscriptionName "${sub.name}"\n`);
    const subRgs=state.resourceGroups.filter(r=>r.subId===sub.id);
    subRgs.forEach(rg=>{
      lines.push(`# -- Resource Group: ${rg.name} --`);
      const rgTags = rg.tags && Object.keys(rg.tags).length > 0 ? ` -Tag @{${Object.entries(rg.tags).map(([k,v])=>`"${k}"="${v}"`).join(';')}}` : '';
      lines.push(`New-AzResourceGroup -Name "${rg.name}" -Location "${rg.location}"${rgTags} -ErrorAction SilentlyContinue`);
      if(rg.lock && rg.lock !== 'None') lines.push(`New-AzResourceLock -LockName "${rg.name}-lock" -LockLevel "${rg.lock}" -ResourceGroupName "${rg.name}" -Force`);
      lines.push('');
      getVnetsInRg(rg.id).forEach(vnet=>{
        const varN=`$vnet_${vnet.name.replace(/[^a-zA-Z0-9]/g,'_')}`;
        
        lines.push(`$subnets = @()`);
        vnet.subnets.forEach(sn => {
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
        vnet.subnets.forEach(sn => {
          if(sn.nsgId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -NetworkSecurityGroupId (Get-AzNetworkSecurityGroup -Name "${sn.nsgId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
          if(sn.routeTableId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -RouteTableId (Get-AzRouteTable -Name "${sn.routeTableId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
          if(sn.natGatewayId) lines.push(`Set-AzVirtualNetworkSubnetConfig -Name "${sn.name}" -VirtualNetwork ${varN} -AddressPrefix "${sn.cidr}" -NatGatewayId (Get-AzNatGateway -Name "${sn.natGatewayId}" -ResourceGroupName "${rg.name}").Id | Set-AzVirtualNetwork`);
        });
        
        if (vnet.peerings && vnet.peerings.length > 0) {
            vnet.peerings.forEach(pId => {
                const target = allVnets.find(v => v.id === pId);
                if (target) {
                    lines.push(`Add-AzVirtualNetworkPeering -Name "${vnet.name}-to-${target.name}" -VirtualNetwork ${varN} -RemoteVirtualNetworkId $vnet_${target.name.replace(/[^a-zA-Z0-9]/g,'_')}.Id -ErrorAction SilentlyContinue`);
                }
            });
        }

        vnet.subnets.forEach(sn => {
          sn.resources.forEach(res => {
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

// ================================================================
// BICEP RESOURCE GENERATORS
// ================================================================
function generateBicepResource(res, rg, vnet, sn) {
  const lines = [];
  const c = res.config || {};
  const safeName = res.name.replace(/[^a-zA-Z0-9]/g,'_');
  const rgRef = rg.id.replace(/-/g,'_');

  switch (res.type) {
    case 'vm': {
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    vmSize: '${c.size||'Standard_D2s_v3'}'`);
      lines.push(`    osType: '${(c.os||'').toLowerCase().includes('windows') ? 'Windows' : 'Linux'}'`);
      lines.push(`    osDisk: { diskSizeGB: ${c.osDiskSizeGB||128}, managedDisk: { storageAccountType: '${c.osDiskType||'Premium_LRS'}' } }`);
      lines.push(`    zone: ${c.availabilityZone && c.availabilityZone !== 'None' ? c.availabilityZone : '0'}`);
      lines.push(`    nicConfigurations: [{ enableAcceleratedNetworking: ${c.acceleratedNetworking||'true'} }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'vmss': {
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine-scale-set:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    skuName: '${c.size||'Standard_D2s_v3'}'`);
      lines.push(`    skuCapacity: ${c.instances||2}`);
      lines.push(`    upgradePolicy: '${c.upgradePolicy||'Rolling'}'`);
      lines.push(`    zones: [${(c.zones||'1,2,3').split(',').map(z => `'${z.trim()}'`).join(', ')}]`);
      lines.push(`    autoScaleSettings: { minCount: ${c.minInstances||2}, maxCount: ${c.maxInstances||10} }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'aks': {
      lines.push(`module ${safeName} 'br/public:avm/res/container-service/managed-cluster:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kubernetesVersion: '${c.version||'1.29'}'`);
      lines.push(`    agentPoolProfiles: [{ count: ${c.nodes||3}, vmSize: '${c.nodeSize||'Standard_D2s_v3'}' }]`);
      lines.push(`    networkPlugin: '${c.networkPlugin||'azure'}'`);
      lines.push(`    podCidr: '${c.podCidr||'10.244.0.0/16'}'`);
      lines.push(`    serviceCidr: '${c.serviceCidr||'10.0.0.0/16'}'`);
      lines.push(`    dnsServiceIP: '${c.dnsServiceIp||'10.0.0.10'}'`);
      lines.push(`    enablePrivateCluster: ${c.privateCluster === 'true'}`);
      lines.push(`    sku: { name: 'Base', tier: '${c.tier||'Standard'}' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'fa': {
      lines.push(`module ${safeName} 'br/public:avm/res/web/site:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'functionapp'`);
      lines.push(`    runtime: '${c.runtime||'node'}'`);
      lines.push(`    runtimeVersion: '${c.runtimeVersion||'20'}'`);
      lines.push(`    osType: '${c.osType||'Linux'}'`);
      lines.push(`    alwaysOn: ${c.alwaysOn === 'true'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'aca': {
      lines.push(`module ${safeName} 'br/public:avm/res/app/container-app:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    containers: [{ image: '${c.image||'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'}', resources: { cpu: ${c.cpu||'0.5'}, memory: '${c.memory||'1.0Gi'}' } }]`);
      lines.push(`    scale: { minReplicas: ${c.minReplicas||1}, maxReplicas: ${c.replicas||10} }`);
      lines.push(`    ingress: { external: ${c.ingress === 'external'}, targetPort: ${c.targetPort||80} }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'fw': {
      const fwZones = c.availabilityZones ? c.availabilityZones.split(',').map(z => z.trim()) : ['1','2','3'];
      lines.push(`module ${safeName} 'br/public:avm/res/network/azure-firewall:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    skuTier: '${c.sku||'Premium'}'`);
      lines.push(`    threatIntelMode: '${c.threatIntelMode||'Alert'}'`);
      lines.push(`    hubIPAddresses: { publicIPs: { count: 1 } }`);
      lines.push(`    zones: [${fwZones.map(z => `'${z}'`).join(', ')}]`);
      if (c.dnsProxy === 'true') {
        lines.push(`    additionalProperties: { 'Network.DNS.EnableProxy': 'true' }`);
      }
      if (c.policyName) {
        lines.push(`    firewallPolicyId: '${c.policyName}'`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'nva': {
      const nvaVendor = (c.vendor||'Fortinet').toLowerCase();
      const nvaProduct = nvaVendor === 'fortinet' ? 'fortinet_fortigate-vm_v5' : `${nvaVendor}_nva`;
      const nvaPlanName = nvaVendor === 'fortinet' ? 'fortinet_fg-vm' : `${nvaVendor}_nva`;
      lines.push(`// NVA: ${res.name} — Vendor: ${c.vendor||'Fortinet'}, Version: ${c.version||'7.4'}, License: ${c.licenseType||'PAYG'}`);
      lines.push(`module ${safeName} 'br/public:avm/res/compute/virtual-machine:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    vmSize: 'Standard_F4s_v2'`);
      lines.push(`    plan: { publisher: '${nvaVendor}', product: '${nvaProduct}', name: '${nvaPlanName}' }`);
      lines.push(`    // Mode: ${c.mode||'Active/Passive'} | License: ${c.licenseType||'PAYG'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'agw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/application-gateway:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.sku||'WAF_v2'}', tier: '${c.tier||c.sku||'WAF_v2'}', capacity: ${c.capacity||2} }`);
      lines.push(`    sslPolicy: { policyType: 'Predefined', policyName: '${c.sslPolicy||'AppGwSslPolicy20220101'}' }`);
      lines.push(`    gatewayIPConfigurations: [{ subnetId: '${sn.name}' }]`);
      lines.push(`    frontendIPConfigurations: [{ publicIPAddressId: '${res.name}-pip' }]`);
      lines.push(`    frontendPorts: [{ port: 80 }]`);
      lines.push(`    backendAddressPools: [{ name: 'defaultBackendPool' }]`);
      lines.push(`    backendHttpSettingsCollection: [{ port: 80, protocol: 'Http' }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'lb': {
      const lbIsPublic = (c.type||'Internal') === 'Public';
      lines.push(`module ${safeName} 'br/public:avm/res/network/load-balancer:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: '${c.sku||'Standard'}'`);
      if (lbIsPublic) {
        lines.push(`    frontendIPConfigurations: [{ name: '${res.name}-frontend', publicIPAddressId: '${res.name}-pip' }]`);
      } else {
        lines.push(`    frontendIPConfigurations: [{ name: '${res.name}-frontend', subnetId: '${sn.name}' }]`);
      }
      const probeparts = (c.healthProbe||'TCP/80').split('/');
      lines.push(`    backendAddressPools: [{ name: '${res.name}-backend' }]`);
      lines.push(`    probes: [{ name: '${res.name}-probe', protocol: '${probeparts[0]||'Tcp'}', port: ${probeparts[1]||80} }]`);
      lines.push(`    loadBalancingRules: [{ name: '${res.name}-rule', frontendPort: 80, backendPort: 80, protocol: 'Tcp' }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'gw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/virtual-network-gateway:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    gatewayType: 'Vpn'`);
      lines.push(`    vpnType: '${c.vpnType||'RouteBased'}'`);
      lines.push(`    vpnGatewayGeneration: '${c.generation||'Generation2'}'`);
      lines.push(`    sku: { name: '${c.sku||'VpnGw2AZ'}', tier: '${c.sku||'VpnGw2AZ'}' }`);
      lines.push(`    activeActive: ${c.activeActive||'false'}`);
      if (c.bgpAsn && c.bgpAsn !== '65515') {
        lines.push(`    enableBgp: true`);
        lines.push(`    bgpSettings: { asn: ${c.bgpAsn} }`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'ergw': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/virtual-network-gateway:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    gatewayType: '${c.gatewayType||'ExpressRoute'}'`);
      lines.push(`    sku: { name: '${c.sku||'ErGw2AZ'}', tier: '${c.sku||'ErGw2AZ'}' }`);
      if (c.expressRouteCircuitId) {
        lines.push(`    // ExpressRoute Circuit: ${c.expressRouteCircuitId}`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'bas': {
      lines.push(`module ${safeName} 'br/public:avm/res/network/bastion-host:0.2.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: '${c.sku||'Standard'}'`);
      lines.push(`    scaleUnits: ${c.scaleUnits||2}`);
      lines.push(`    virtualNetworkId: '${vnet.name}'`);
      if (c.shareableLink === 'true') lines.push(`    enableShareableLink: true`);
      if (c.ipConnect === 'true') lines.push(`    enableIpConnect: true`);
      if (c.tunneling === 'true') lines.push(`    enableTunneling: true`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'afd': {
      lines.push(`module ${safeName} 'br/public:avm/res/cdn/profile:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.sku||'Premium'}_AzureFrontDoor' }`);
      lines.push(`    originResponseTimeoutSeconds: 60`);
      lines.push(`    endpoints: [{ name: '${c.endpoints||res.name+'-endpoint'}' }]`);
      lines.push(`    originGroups: [{ name: '${c.originGroups||'default-origin-group'}' }]`);
      if (c.wafPolicy) {
        lines.push(`    securityPolicies: [{ name: '${c.wafPolicy}' }]`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'pe': {
      const peGroupId = c.groupId || c.subResource || c.target || 'blob';
      const peConnectionName = c.connectionName || `${res.name}-connection`;
      lines.push(`module ${safeName} 'br/public:avm/res/network/private-endpoint:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    subnetResourceId: '${sn.name}'`);
      lines.push(`    privateLinkServiceConnections: [{ name: '${peConnectionName}', privateLinkServiceId: '<target-resource-id>', groupIds: ['${peGroupId}'] }]`);
      if (c.privateDnsZoneId) {
        lines.push(`    privateDnsZoneGroup: { privateDnsZoneGroupConfigs: [{ privateDnsZoneResourceId: '${c.privateDnsZoneId}' }] }`);
      }
      lines.push(`  }`);
      lines.push(`}\n`);
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
      lines.push(`module ${safeName} 'br/public:avm/res/network/network-security-group:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    securityRules: [`);
      nsgRules.forEach(rule => {
        lines.push(`      { name: '${rule.name}', priority: ${rule.priority||100}, direction: '${rule.direction||'Inbound'}', access: '${rule.access||'Allow'}', protocol: '${rule.protocol||'Tcp'}', sourceAddressPrefix: '${rule.srcAddr||'*'}', destinationAddressPrefix: '${rule.dstAddr||'*'}', sourcePortRange: '${rule.srcPort||'*'}', destinationPortRange: '${rule.dstPort||'80'}' }`);
      });
      lines.push(`    ]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sql': {
      const sqlTier = c.tier || 'GeneralPurpose';
      const sqlSkuName = sqlTier === 'BusinessCritical' ? 'BC_Gen5' : 'GP_Gen5';
      lines.push(`module ${safeName}_server 'br/public:avm/res/sql/server:0.4.0' = {`);
      lines.push(`  name: '${res.name}-server'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}-server'`);
      lines.push(`    administratorLogin: 'sqladmin'`);
      lines.push(`    administratorLoginPassword: '<password>'`);
      lines.push(`    databases: [{ name: '${res.name}', sku: { name: '${sqlSkuName}', tier: '${sqlTier}', capacity: ${c.vcores||4} }, maxSizeBytes: ${(parseInt(c.maxSizeGB)||32)*1073741824}, collation: '${c.collation||'SQL_Latin1_General_CP1_CI_AS'}', zoneRedundant: ${c.zoneRedundant==='true'} }]`);
      lines.push(`    backupRetentionDays: ${c.backupRetentionDays||7}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'cosmos': {
      const cosmosKind = c.api === 'MongoDB' ? 'MongoDB' : 'GlobalDocumentDB';
      const cosmosCapabilities = c.serverless === 'true' ? `\n    capabilities: [{ name: 'EnableServerless' }]` : '';
      lines.push(`module ${safeName} 'br/public:avm/res/document-db/database-account:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    databaseAccountOfferType: 'Standard'`);
      lines.push(`    kind: '${cosmosKind}'`);
      lines.push(`    consistencyPolicy: { defaultConsistencyLevel: '${c.consistencyLevel||'Session'}' }`);
      lines.push(`    locations: [{ locationName: '${rg.location}', failoverPriority: 0 }]`);
      lines.push(`    enableFreeTier: ${c.enableFreeTier==='true'}${cosmosCapabilities}`);
      if(c.serverless !== 'true' && c.maxRU) lines.push(`    totalThroughputLimit: ${c.maxRU}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sa': {
      const saKind = c.kind || 'StorageV2';
      const saTier = c.tier || 'Standard';
      const saAccessTier = c.accessTier || 'Hot';
      lines.push(`module ${safeName} 'br/public:avm/res/storage/storage-account:0.9.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}'`);
      lines.push(`    kind: '${saKind}'`);
      lines.push(`    skuName: '${saTier}_${c.replication||'ZRS'}'`);
      lines.push(`    accessTier: '${saAccessTier}'`);
      lines.push(`    minimumTlsVersion: '${c.minTlsVersion||'TLS1_2'}'`);
      lines.push(`    allowBlobPublicAccess: false`);
      lines.push(`    supportsHttpsTrafficOnly: ${c.httpsOnly!=='false'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'redis': {
      const redisSku = (c.sku||'Premium P1').split(' ');
      const redisSkuName = redisSku[0] || 'Premium';
      const redisFamily = redisSkuName === 'Premium' ? 'P' : 'C';
      lines.push(`module ${safeName} 'br/public:avm/res/cache/redis:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${redisSkuName}', family: '${redisFamily}', capacity: ${c.capacity||1} }`);
      lines.push(`    minimumTlsVersion: '${c.minTlsVersion||'1.2'}'`);
      lines.push(`    enableNonSslPort: ${c.enableNonSslPort==='true'}`);
      lines.push(`    replicasPerPrimary: ${c.replicasPerPrimary||1}`);
      if(c.zones) lines.push(`    zones: [${c.zones.split(',').map(z=>`'${z.trim()}'`).join(', ')}]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'adls': {
      const adlsReplication = c.replication || 'LRS';
      lines.push(`module ${safeName} 'br/public:avm/res/storage/storage-account:0.9.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name.replace(/[^a-z0-9]/g,'').substring(0,24)}'`);
      lines.push(`    kind: 'StorageV2'`);
      lines.push(`    skuName: '${c.tier||'Standard'}_${adlsReplication}'`);
      lines.push(`    isHnsEnabled: ${c.hierarchicalNamespace!=='false'}`);
      if(c.enableSoftDelete==='true') lines.push(`    deleteRetentionPolicy: { enabled: true, days: 7 }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'kv': {
      lines.push(`module ${safeName} 'br/public:avm/res/key-vault/vault:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { family: 'A', name: '${(c.sku||'premium').toLowerCase()}' }`);
      lines.push(`    enablePurgeProtection: ${c.purgeProtection !== 'false'}`);
      lines.push(`    enableRbacAuthorization: ${c.enableRbacAuth !== 'false'}`);
      lines.push(`    softDeleteRetentionInDays: ${c.softDeleteDays || 90}`);
      if(c.networkAcls && c.networkAcls !== 'Allow') lines.push(`    networkAcls: { defaultAction: 'Deny' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'app': {
      lines.push(`module ${safeName} 'br/public:avm/res/web/site:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'app,linux'`);
      lines.push(`    serverFarmResourceId: '${res.name}-plan'`);
      lines.push(`    siteConfig: { alwaysOn: ${c.alwaysOn === 'true'}, httpsOnly: ${c.httpsOnly !== 'false'}, minTlsVersion: '${c.minTlsVersion||'1.2'}' }`);
      if(c.runtime) lines.push(`    // Runtime: ${c.runtime} ${c.runtimeVersion||''}`);
      if(c.managedIdentity && c.managedIdentity !== 'None') lines.push(`    managedIdentities: { systemAssigned: true }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'apim': {
      lines.push(`module ${safeName} 'br/public:avm/res/api-management/service:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    publisherName: '${c.publisherName||'MyOrganization'}'`);
      lines.push(`    publisherEmail: '${c.publisherEmail||'admin@example.com'}'`);
      lines.push(`    sku: { name: '${c.tier||'Developer'}', capacity: ${c.capacity||1} }`);
      if(c.vnetType && c.vnetType !== 'None') lines.push(`    virtualNetworkType: '${c.vnetType}'`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'sb': {
      lines.push(`module ${safeName} 'br/public:avm/res/service-bus/namespace:0.6.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.tier||'Premium'}', tier: '${c.tier||'Premium'}', capacity: ${c.messagingUnits||1} }`);
      lines.push(`    zoneRedundant: ${c.zoneRedundant === 'true'}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'evh': {
      lines.push(`module ${safeName} 'br/public:avm/res/event-hub/namespace:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.tier||'Standard'}', tier: '${c.tier||'Standard'}', capacity: ${c.throughputUnits||1} }`);
      lines.push(`    eventhubs: [{ name: '${res.name}-hub', partitionCount: ${c.partitions||4}, messageRetentionInDays: ${c.retentionDays||7}${c.captureEnabled==='true' ? ', captureDescription: { enabled: true }' : ''} }]`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'logic': {
      lines.push(`module ${safeName} 'br/public:avm/res/logic/workflow:0.3.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    state: '${c.state||'Enabled'}'`);
      if(c.triggerType) lines.push(`    // Trigger: ${c.triggerType}`);
      if(c.connectors) lines.push(`    // Connectors: ${c.connectors}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'foundry': {
      lines.push(`module ${safeName} 'br/public:avm/res/cognitive-services/account:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: '${c.kind||'AIServices'}'`);
      lines.push(`    sku: { name: '${c.sku||'S0'}' }`);
      if(c.customSubdomain) lines.push(`    customSubDomainName: '${c.customSubdomain}'`);
      if(c.networkRules && c.networkRules !== 'Allow') lines.push(`    networkAcls: { defaultAction: 'Deny' }`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'openai': {
      lines.push(`module ${safeName} 'br/public:avm/res/cognitive-services/account:0.5.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    kind: 'OpenAI'`);
      lines.push(`    sku: { name: 'S0' }`);
      lines.push(`    customSubDomainName: '${res.name}'`);
      lines.push(`    deployments: [{ name: '${c.deploymentName||c.model||'gpt-4o'}', model: { format: 'OpenAI', name: '${c.model||'gpt-4o'}', version: '${c.modelVersion||'latest'}' }, sku: { name: 'Standard', capacity: ${c.capacity||10} } }]`);
      if(c.contentFilter && c.contentFilter !== 'Default') lines.push(`    // Content Filter: ${c.contentFilter}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    case 'monitor': {
      lines.push(`module ${safeName} 'br/public:avm/res/operational-insights/workspace:0.4.0' = {`);
      lines.push(`  name: '${res.name}'`);
      lines.push(`  scope: ${rgRef}`);
      lines.push(`  params: {`);
      lines.push(`    name: '${res.name}'`);
      lines.push(`    sku: { name: '${c.workspaceSku||'PerGB2018'}' }`);
      lines.push(`    retentionInDays: ${c.retentionDays||90}`);
      if(c.dailyCapGB) lines.push(`    workspaceCapping: { dailyQuotaGb: ${c.dailyCapGB} }`);
      if(c.solutions) lines.push(`    // Solutions: ${c.solutions}`);
      lines.push(`  }`);
      lines.push(`}\n`);
      break;
    }
    default: {
      lines.push(`// module ${safeName} 'br/public:avm/res/...' — type ${res.type} not yet supported`);
      break;
    }
  }
  return lines;
}

export function generateBicep(){
  const lines=[`// Bicep Template — Azure Architecture Builder\ntargetScope = 'subscription'\n`];
  state.subscriptions.forEach(sub=>{
    lines.push(`// --- Subscription: ${sub.name} ---`);
    const subRgs=state.resourceGroups.filter(r=>r.subId===sub.id);
    subRgs.forEach(rg=>{
      let rgBicep = `resource ${rg.id.replace(/-/g,'_')} 'Microsoft.Resources/resourceGroups@2021-04-01' = {\n  name: '${rg.name}'\n  location: '${rg.location}'`;
      if(rg.tags && Object.keys(rg.tags).length > 0) {
        rgBicep += `\n  tags: {${Object.entries(rg.tags).map(([k,v])=>`\n    '${k}': '${v}'`).join('')}\n  }`;
      }
      rgBicep += `\n}\n`;
      lines.push(rgBicep);
      if(rg.lock && rg.lock !== 'None') {
        lines.push(`resource ${rg.id.replace(/-/g,'_')}_lock 'Microsoft.Authorization/locks@2020-05-01' = {\n  name: '${rg.name}-lock'\n  scope: ${rg.id.replace(/-/g,'_')}\n  properties: {\n    level: '${rg.lock}'\n  }\n}\n`);
      }
      getVnetsInRg(rg.id).forEach(vnet=>{
        const vnetSafeName = vnet.name.replace(/[^a-zA-Z0-9]/g,'_');
        lines.push(`module vnet_${vnetSafeName} 'br/public:avm/res/network/virtual-network:0.2.0' = {`);
        lines.push(`  name: '${vnet.name}'`);
        lines.push(`  scope: ${rg.id.replace(/-/g,'_')}`);
        lines.push(`  params: {`);
        lines.push(`    name: '${vnet.name}'`);
        lines.push(`    addressPrefixes: ['${vnet.cidr}']`);
        if(vnet.dnsServers) {
          const dns = vnet.dnsServers.split(',').map(d=>d.trim()).filter(Boolean);
          if(dns.length) lines.push(`    dnsServers: [${dns.map(d=>`'${d}'`).join(', ')}]`);
        }
        if(vnet.ddosProtectionPlan === 'true') lines.push(`    enableDdosProtection: true`);
        if(vnet.encryption === 'true') lines.push(`    encryption: { enabled: true }`);
        if(vnet.flowTimeout) lines.push(`    flowTimeoutInMinutes: ${vnet.flowTimeout}`);
        lines.push(`    subnets: [`);
        vnet.subnets.forEach(sn => {
          let snProps = `{ name: '${sn.name}', addressPrefix: '${sn.cidr}'`;
          if(sn.nsgId) snProps += `, networkSecurityGroupId: '${sn.nsgId}'`;
          if(sn.routeTableId) snProps += `, routeTableId: '${sn.routeTableId}'`;
          if(sn.natGatewayId) snProps += `, natGatewayId: '${sn.natGatewayId}'`;
          if(sn.serviceEndpoints) {
            const eps = sn.serviceEndpoints.split(',').map(e=>e.trim()).filter(Boolean);
            if(eps.length) snProps += `, serviceEndpoints: [${eps.map(e=>`{ service: '${e}' }`).join(', ')}]`;
          }
          if(sn.delegation && sn.delegation !== 'None') snProps += `, delegations: [{ name: 'delegation', properties: { serviceName: '${sn.delegation}' } }]`;
          if(sn.privateEndpointNetworkPolicies === 'Enabled') snProps += `, privateEndpointNetworkPolicies: 'Enabled'`;
          if(sn.privateLinkServiceNetworkPolicies === 'Enabled') snProps += `, privateLinkServiceNetworkPolicies: 'Enabled'`;
          snProps += ` }`;
          lines.push(`      ${snProps}`);
        });
        lines.push(`    ]`);
        lines.push(`  }`);
        lines.push(`}\n`);
        
        vnet.subnets.forEach(sn => {
          sn.resources.forEach(res => {
            lines.push(...generateBicepResource(res, rg, vnet, sn));
          });
        });
        lines.push('');
      });

      // RG-level resources (DNS Zones)
      const rgResources = (state.rgResources||[]).filter(r => r.rgId === rg.id);
      rgResources.forEach(res => {
        if(res.type === 'publicDns') {
          const safeName = res.config.zone.replace(/[^a-zA-Z0-9]/g,'_');
          lines.push(`module dnsZone_${safeName} 'br/public:avm/res/network/dns-zone:0.3.0' = {`);
          lines.push(`  name: '${res.config.zone}'`);
          lines.push(`  scope: ${rg.id.replace(/-/g,'_')}`);
          lines.push(`  params: { name: '${res.config.zone}' }`);
          lines.push(`}\n`);
          (res.config.records||[]).forEach(rec => {
            lines.push(`// DNS Record: ${rec.name} ${rec.type} ${rec.value}`);
          });
        } else if(res.type === 'dns') {
          const zoneName = res.config.fullZoneName || res.config.zone;
          const safeName = zoneName.replace(/[^a-zA-Z0-9]/g,'_');
          lines.push(`module privateDnsZone_${safeName} 'br/public:avm/res/network/private-dns-zone:0.3.0' = {`);
          lines.push(`  name: '${zoneName}'`);
          lines.push(`  scope: ${rg.id.replace(/-/g,'_')}`);
          lines.push(`  params: {`);
          lines.push(`    name: '${zoneName}'`);
          if(res.config.vnetLinks && res.config.vnetLinks.length > 0) {
            lines.push(`    virtualNetworkLinks: [`);
            res.config.vnetLinks.forEach(link => {
              const enableReg = link.registrationEnabled || res.config.autoRegistration === 'true';
              lines.push(`      { virtualNetworkResourceId: ${link.vnetName.replace(/[^a-zA-Z0-9]/g,'_')}.id, registrationEnabled: ${enableReg} }`);
            });
            lines.push(`    ]`);
          }
          lines.push(`  }`);
          lines.push(`}\n`);
          (res.config.records||[]).forEach(rec => {
            lines.push(`// Private DNS Record: ${rec.name} ${rec.type} ${rec.value}`);
          });
        }
        lines.push('');
      });
    });
  });
  if (state.onPrem.enabled) {
    lines.push(`// --- Hybrid Connectivity: ${state.onPrem.name} ---`);
    lines.push(`// Local Network Gateway for CIDR: ${state.onPrem.cidr}`);
  }
  return lines.join('\n');
}

export function openPsModal(){document.getElementById('ps-output').textContent=generatePowerShell();document.getElementById('ps-modal').classList.add('show');}
export function openBicepModal(){document.getElementById('bicep-output').textContent=generateBicep();document.getElementById('bicep-modal').classList.add('show');}
export function closeModal(id){document.getElementById(id).classList.remove('show');}
export function copyText(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>alert('Copied successfully!'));}
export function downloadText(id,fn){const b=new Blob([document.getElementById(id).textContent],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();}

// Setup modal close on backdrop click
['ps-modal','bicep-modal'].forEach(id=>document.getElementById(id).addEventListener('click',e=>{if(e.target===document.getElementById(id))closeModal(id);}));
