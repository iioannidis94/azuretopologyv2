import { state } from './state-core.js';

// ================================================================
// CIDR VALIDATION & DYNAMIC SUBNETTING
// ================================================================
export function parseCidr(cidr) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec((cidr||'').trim());
  if (!m) return null;
  const octets = [+m[1],+m[2],+m[3],+m[4]];
  const prefix = +m[5];
  if (octets.some(o => o < 0 || o > 255)) return null;
  if (prefix < 0 || prefix > 32) return null;
  const ip = ((octets[0]<<24)|(octets[1]<<16)|(octets[2]<<8)|octets[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { ip, mask, prefix, network, broadcast, octets };
}

export function cidrToString(network, prefix) {
  return `${(network>>>24)&255}.${(network>>>16)&255}.${(network>>>8)&255}.${network&255}/${prefix}`;
}

export function isValidCidr(cidr) {
  const p = parseCidr(cidr);
  if (!p) return false;
  return p.ip === p.network;
}

export function cidrsOverlap(cidr1, cidr2) {
  const a = parseCidr(cidr1), b = parseCidr(cidr2);
  if (!a || !b) return false;
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

export function getAllVnetCidrs() {
  return [state.hub, ...state.spokes].map(v => v.cidr).filter(Boolean);
}

export function checkCidrOverlap(newCidr, excludeVnetId) {
  const allVnets = [state.hub, ...state.spokes];
  for (const v of allVnets) {
    if (v.id === excludeVnetId) continue;
    if (cidrsOverlap(newCidr, v.cidr)) return v;
  }
  return null;
}

export function autoSubnet(vnetCidr, numSubnets) {
  const p = parseCidr(vnetCidr);
  if (!p) return [];
  const bitsNeeded = Math.ceil(Math.log2(Math.max(numSubnets, 1)));
  const subnetPrefix = Math.min(p.prefix + bitsNeeded, 28);
  const subnetSize = (1 << (32 - subnetPrefix)) >>> 0;
  const maxSubnets = 1 << (subnetPrefix - p.prefix);
  const results = [];
  for (let i = 0; i < Math.min(numSubnets, maxSubnets); i++) {
    const subnetNetwork = (p.network + i * subnetSize) >>> 0;
    results.push(cidrToString(subnetNetwork, subnetPrefix));
  }
  return results;
}

export function nextAvailableVnetCidr() {
  const existingCidrs = getAllVnetCidrs();
  for (let second = 0; second <= 255; second++) {
    const candidate = `10.${second}.0.0/16`;
    const overlaps = existingCidrs.some(c => cidrsOverlap(candidate, c));
    if (!overlaps) return candidate;
  }
  return '172.16.0.0/16';
}

export function nextAvailableSubnetCidr(vnetId) {
  const vnet = [state.hub, ...state.spokes].find(v => v.id === vnetId);
  if (!vnet) return '10.0.0.0/24';
  const vnetParsed = parseCidr(vnet.cidr);
  if (!vnetParsed) return '10.0.0.0/24';
  const existingSubnets = vnet.subnets.map(sn => sn.cidr).filter(c => parseCidr(c));
  return nextAvailableSubnetCidrFromParsed(vnetParsed, existingSubnets);
}

export function nextAvailableSubnetCidrFromParsed(vnetParsed, existingSubnets) {
  const subnetPrefix = 24;
  const subnetSize = (1 << (32 - subnetPrefix)) >>> 0;
  let candidate = vnetParsed.network;
  while (candidate <= vnetParsed.broadcast) {
    const candidateCidr = cidrToString(candidate, subnetPrefix);
    const overlaps = existingSubnets.some(c => cidrsOverlap(candidateCidr, c));
    if (!overlaps) return candidateCidr;
    candidate = (candidate + subnetSize) >>> 0;
  }
  return cidrToString(vnetParsed.network, subnetPrefix);
}
