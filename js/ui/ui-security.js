import { state, esc, parseCidr } from '../state-management.js';

// ================================================================
// SECURITY POSTURE ANALYSIS
// ================================================================
function analyzeSecurityPosture() {
  const findings = [];
  const allVnets = [state.hub, ...state.spokes];

  function vnetResources(vnet) { return vnet.subnets.flatMap(sn => sn.resources); }
  function subnetHasType(sn, type) { return sn.resources.some(r => r.type === type); }
  function vnetHasType(vnet, type) { return vnet.subnets.some(sn => subnetHasType(sn, type)); }

  // 1. SQL without Private Endpoint
  allVnets.forEach(vnet => {
    vnet.subnets.forEach(sn => {
      sn.resources.filter(r => r.type === 'sql' || r.type === 'cosmos').forEach(r => {
        const vnetHasPe = vnetHasType(vnet, 'pe');
        if (!vnetHasPe) {
          findings.push({ severity: 'warning', icon: '⚠️', message: `${r.name} has no Private Endpoint in ${vnet.name}. Data may be exposed over public internet.`, resId: r.id });
        }
      });
    });
  });

  // 2. VM without NSG
  allVnets.forEach(vnet => {
    vnet.subnets.forEach(sn => {
      const vms = sn.resources.filter(r => r.type === 'vm' || r.type === 'vmss');
      const hasNsg = subnetHasType(sn, 'nsg');
      if (vms.length > 0 && !hasNsg) {
        findings.push({ severity: 'warning', icon: '⚠️', message: `Subnet "${sn.name}" has VMs without a Network Security Group. Traffic is unrestricted.`, resId: vms[0].id });
      }
    });
  });

  // 3. Public App without WAF/Front Door
  allVnets.forEach(vnet => {
    const hasApp = vnetHasType(vnet, 'app');
    const hasWaf = vnetHasType(vnet, 'agw') || vnetHasType(vnet, 'afd');
    if (hasApp && !hasWaf) {
      const firstApp = vnetResources(vnet).find(r => r.type === 'app');
      findings.push({ severity: 'suggestion', icon: '💡', message: `App Service in ${vnet.name} has no WAF (App Gateway) or Front Door. Consider adding one for DDoS and OWASP protection.`, resId: firstApp?.id });
    }
  });

  // 4. Key Vault without Private Endpoint
  allVnets.forEach(vnet => {
    const hasKv = vnetHasType(vnet, 'kv');
    const hasPe = vnetHasType(vnet, 'pe');
    if (hasKv && !hasPe) {
      const firstKv = vnetResources(vnet).find(r => r.type === 'kv');
      findings.push({ severity: 'recommendation', icon: '🔐', message: `Key Vault in ${vnet.name} has no Private Endpoint. Restrict access to private network for better security.`, resId: firstKv?.id });
    }
  });

  // 5. Hub without Firewall
  if (!vnetHasType(state.hub, 'fw') && !vnetHasType(state.hub, 'nva')) {
    findings.push({ severity: 'recommendation', icon: '🛡️', message: `Hub VNet "${state.hub.name}" has no Azure Firewall or NVA. All traffic between spokes is unfiltered.`, resId: state.hub.id });
  }

  // 6. Storage Account without Private Endpoint
  allVnets.forEach(vnet => {
    vnetResources(vnet).filter(r => r.type === 'sa' || r.type === 'adls').forEach(r => {
      const vnetHasPe = vnetHasType(vnet, 'pe');
      if (!vnetHasPe) {
        findings.push({ severity: 'suggestion', icon: '💡', message: `Storage Account "${r.name}" has no Private Endpoint in ${vnet.name}. Consider adding private connectivity.`, resId: r.id });
      }
    });
  });

  // 7. AKS without Key Vault
  const allResources = [state.hub, ...state.spokes].flatMap(v => v.subnets.flatMap(sn => sn.resources));
  const aksResource = allResources.find(r => r.type === 'aks');
  const hasKvAnywhere = allResources.some(r => r.type === 'kv');
  if (aksResource && !hasKvAnywhere) {
    findings.push({ severity: 'suggestion', icon: '💡', message: `AKS Cluster "${aksResource.name}" detected without Key Vault in the architecture. Consider adding Key Vault for secrets management.`, resId: aksResource.id });
  }

  // 8. DEPENDENCY / ERROR CHECKS
  // VNet without subnets
  allVnets.forEach(vnet => {
    if (vnet.subnets.length === 0) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has no subnets. A VNet requires at least one subnet to be functional.`, resId: vnet.id });
    }
  });

  // Peering to non-existent VNet (stale peering references)
  allVnets.forEach(vnet => {
    (vnet.peerings || []).forEach(peerId => {
      const target = allVnets.find(v => v.id === peerId);
      if (!target) {
        findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has a peering reference to a non-existent VNet. Remove the stale peering.`, resId: vnet.id });
      }
    });
  });

  // Gateway Transit enabled but no VPN/ER Gateway in VNet
  allVnets.forEach(vnet => {
    const hasGw = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
    if (vnet.peeringConfigs) {
      Object.entries(vnet.peeringConfigs).forEach(([peerId, cfg]) => {
        if (cfg.allowGatewayTransit && !hasGw) {
          const peer = allVnets.find(v => v.id === peerId);
          findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has Gateway Transit enabled toward "${peer?.name || 'unknown'}" but contains no VPN/ExpressRoute Gateway.`, resId: vnet.id });
        }
        if (cfg.useRemoteGateways) {
          const peer = allVnets.find(v => v.id === peerId);
          const peerHasGw = peer?.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
          if (peer && !peerHasGw) {
            findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" uses Remote Gateways from "${peer.name}" but that VNet has no VPN/ExpressRoute Gateway.`, resId: vnet.id });
          }
        }
      });
    }
  });

  // Subnet with resources but no parent VNet CIDR containing it
  allVnets.forEach(vnet => {
    const vnetParsed = parseCidr(vnet.cidr);
    if (!vnetParsed) return;
    vnet.subnets.forEach(sn => {
      const snParsed = parseCidr(sn.cidr);
      if (snParsed && (snParsed.network < vnetParsed.network || snParsed.broadcast > vnetParsed.broadcast)) {
        findings.push({ severity: 'error', icon: '🚫', message: `Subnet "${sn.name}" (${sn.cidr}) is outside VNet "${vnet.name}" address space (${vnet.cidr}).`, resId: sn.id });
      }
    });
  });

  // VPN Gateway without GatewaySubnet
  allVnets.forEach(vnet => {
    const hasVpnGw = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'gw' || r.type === 'ergw'));
    const hasGwSubnet = vnet.subnets.some(sn => sn.name.toLowerCase() === 'gatewaysubnet');
    if (hasVpnGw && !hasGwSubnet) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has a VPN/ER Gateway but no subnet named "GatewaySubnet". This is required by Azure.`, resId: vnet.id });
    }
  });

  // Bastion without AzureBastionSubnet
  allVnets.forEach(vnet => {
    const hasBastion = vnet.subnets.some(sn => sn.resources.some(r => r.type === 'bas'));
    const hasBastionSubnet = vnet.subnets.some(sn => sn.name.toLowerCase() === 'azurebastionsubnet');
    if (hasBastion && !hasBastionSubnet) {
      findings.push({ severity: 'error', icon: '🚫', message: `VNet "${vnet.name}" has Azure Bastion but no subnet named "AzureBastionSubnet". This is required by Azure.`, resId: vnet.id });
    }
  });

  // PE-SPECIFIC CHECKS (new)
  const { getPeTargetableResources, getPeTargetResource, PE_TARGET_DNS_RECOMMENDATIONS, getAllPrivateEndpoints, getRecommendedVnetLinksForDnsZone } = window._state || {};
  
  if (getAllPrivateEndpoints) {
    // 9. PE without target resource selected
    const allPes = getAllPrivateEndpoints();
    allPes.forEach(pe => {
      if (!pe.config.targetResourceId) {
        findings.push({ severity: 'error', icon: '🚫', message: `Private Endpoint "${pe.name}" has no target resource selected. Link it to a resource (Storage, SQL, Key Vault, etc.).`, resId: pe.id });
      }
    });
    
    // 10. PE with non-existent target resource
    allPes.forEach(pe => {
      if (pe.config.targetResourceId) {
        const targetRes = getPeTargetResource(pe.id);
        if (!targetRes) {
          findings.push({ severity: 'error', icon: '🚫', message: `Private Endpoint "${pe.name}" targets a non-existent resource. Update the target.`, resId: pe.id });
        }
      }
    });
    
    // 11. PE without required DNS zones
    allPes.forEach(pe => {
      if (pe.config.target && pe.config.targetResourceId && PE_TARGET_DNS_RECOMMENDATIONS) {
        const recommendedZones = PE_TARGET_DNS_RECOMMENDATIONS[pe.config.target] || [];
        const existingZones = (state.rgResources || []).filter(r => r.type === 'dns' && r.config.zone).map(r => r.config.zone);
        const missingZones = recommendedZones.filter(z => !existingZones.includes(z));
        
        if (missingZones.length > 0) {
          findings.push({ 
            severity: 'warning', 
            icon: '⚠️', 
            message: `Private Endpoint "${pe.name}" requires DNS zones (${missingZones.slice(0, 2).join(', ')}${missingZones.length > 2 ? '...' : ''}). Create them for proper name resolution.`, 
            resId: pe.id 
          });
        }
      }
    });
  }
  
  // 12. Private DNS zones without required VNET links
  const allDnsZones = (state.rgResources || []).filter(r => r.type === 'dns');
  allDnsZones.forEach(dnsZone => {
    if (getRecommendedVnetLinksForDnsZone) {
      const recommendedLinks = getRecommendedVnetLinksForDnsZone(dnsZone.id);
      const currentLinks = (dnsZone.config.vnetLinks || []).map(l => l.vnetId);
      const missingLinks = recommendedLinks.filter(r => !currentLinks.includes(r.vnetId));
      
      if (missingLinks.length > 0) {
        findings.push({ 
          severity: 'warning', 
          icon: '⚠️', 
          message: `Private DNS Zone "${dnsZone.name}" (${dnsZone.config.zone}) is missing VNET links to ${missingLinks.map(l => l.vnetName).join(', ')}. Add them for DNS resolution in those VNets.`, 
          resId: dnsZone.id 
        });
      }
    }
  });

  return findings;
}

export function renderSecurityPanel() {
  const panel = document.getElementById('security-panel');
  const findings = analyzeSecurityPosture();

  if (findings.length === 0) {
    panel.innerHTML = `<div class="security-score"><div class="security-score-badge good">A+</div><div class="security-score-label">Security Score<br><span style="font-size:9px;font-weight:normal;">No issues detected</span></div></div><div class="security-empty">✅ Architecture follows best practices</div>`;
    return;
  }

  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const suggestions = findings.filter(f => f.severity === 'suggestion').length;
  const recommendations = findings.filter(f => f.severity === 'recommendation').length;

  let grade, gradeClass;
  if (errors >= 1) { grade = 'F'; gradeClass = 'danger'; }
  else if (warnings >= 3) { grade = 'D'; gradeClass = 'danger'; }
  else if (warnings >= 2) { grade = 'C'; gradeClass = 'danger'; }
  else if (warnings >= 1) { grade = 'B'; gradeClass = 'warning'; }
  else if (suggestions + recommendations > 0) { grade = 'B+'; gradeClass = 'warning'; }
  else { grade = 'A+'; gradeClass = 'good'; }

  const summaryParts = [];
  if (errors > 0) summaryParts.push(`${errors} error${errors!==1?'s':''}`);
  if (warnings > 0) summaryParts.push(`${warnings} warning${warnings!==1?'s':''}`);
  if (suggestions > 0) summaryParts.push(`${suggestions} suggestion${suggestions!==1?'s':''}`);
  if (recommendations > 0) summaryParts.push(`${recommendations} recommendation${recommendations!==1?'s':''}`);

  let h = `<div class="security-score"><div class="security-score-badge ${gradeClass}">${grade}</div><div class="security-score-label">Security Score<br><span style="font-size:9px;font-weight:normal;">${summaryParts.join(', ')}</span></div></div>`;

  // Show errors first
  const sortedFindings = [...findings].sort((a, b) => {
    const order = { error: 0, warning: 1, recommendation: 2, suggestion: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  sortedFindings.forEach(f => {
    const classes = `security-item ${f.severity}${f.resId ? ' clickable' : ''}`;
    const extraAttrs = f.resId ? ` onclick="window._selectNode('${f.resId}')" title="Click to select resource"` : '';
    h += `<div class="${classes}"${extraAttrs}><span class="sev-icon">${f.icon}</span><div class="sev-text"><span class="sev-label ${f.severity}">${f.severity}</span><br>${esc(f.message)}</div></div>`;
  });

  panel.innerHTML = h;
}

export function toggleSecurityPanel() {
  const panel = document.getElementById('security-panel');
  const toggle = document.getElementById('security-panel-toggle');
  const collapsed = panel.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '▶' : '▼';
}

export function toggleCostPanel() {
  const panel = document.getElementById('cost-panel');
  const toggle = document.getElementById('cost-panel-toggle');
  const collapsed = panel.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '▶' : '▼';
}
