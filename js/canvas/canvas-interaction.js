import { state, saveState, fullUpdate } from '../state-management.js';
import { getRenderNodes, getSubBounds, getRgBounds } from './canvas-layout.js';
import { draw, pointToSegmentDist } from './canvas-render.js';

const canvas = document.getElementById('diagram-canvas');

// ================================================================
// CANVAS INTERACTIONS (DRAG & DROP)
// ================================================================
export function selectNode(id){state.selectedId=id;fullUpdate();}

canvas.addEventListener('mousedown',e=>{
  const r=canvas.getBoundingClientRect();
  const px=(e.clientX-r.left-state.offset.x)/state.scale,py=(e.clientY-r.top-state.offset.y)/state.scale;
  const nodes=getRenderNodes();
  let hit=null;
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    if(n.isSubnet){if(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2){hit=n;break;}}
    else if(!n.isVnet && !n.isOnPrem){if(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2){hit=n;break;}}
    else if(state.layout==='grid' || n.isOnPrem){if(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2){hit=n;break;}}
    else{if(Math.sqrt((px-n.x)**2+(py-n.y)**2)<n.radius){hit=n;break;}}
  }
  if(hit){
    selectNode(hit.id);
    state.dragNodeId = hit.id;
    state.dragNodeStart = state.customPos[hit.id] || {x: hit.x, y: hit.y};
    state.mouseStart = {x: px, y: py};
    // Collect group children for drag
    state.dragGroup = null;
    const parentMap = {};
    nodes.forEach(n => { if(n.parentId) parentMap[n.id] = n.parentId; });

    if(hit.isVnet && hit.rgId){
      // VNet drag: move all children (subnets + resources inside subnets)
      const children = nodes.filter(n => n.parentId === hit.id || parentMap[n.parentId] === hit.id);
      if(children.length > 0){
        state.dragGroup = children.map(c=>({id:c.id, start: state.customPos[c.id] || {x:c.x, y:c.y}}));
      }
    } else if(hit.isSubnet && hit.parentId){
      // Subnet drag: move the subnet and its resources together (independently from VNet)
      const children = nodes.filter(n => n.parentId === hit.id);
      if(children.length > 0){
        state.dragGroup = children.map(c=>({id:c.id, start: state.customPos[c.id] || {x:c.x, y:c.y}}));
      }
    } else if(!hit.isVnet && !hit.isOnPrem && hit.parentId){
      // Resource drag: move parent subnet, parent VNet, and all sibling resources
      const subnetNode = nodes.find(n => n.id === hit.parentId);
      const vnetId = subnetNode ? subnetNode.parentId : null;
      // Collect everything in the same VNet
      const allInVnet = nodes.filter(n => n.id !== hit.id && (
        n.id === vnetId || n.parentId === vnetId || parentMap[n.parentId] === vnetId
      ));
      state.dragGroup = allInVnet.map(c=>({id:c.id, start: state.customPos[c.id] || {x:c.x, y:c.y}}));
    }
  } else {
    // Check if clicking on a peering line
    let peeringHit = null;
    const map = {}; nodes.forEach(n => map[n.id] = n);
    const allVnetsForPeering = [state.hub, ...state.spokes];
    for (const vnet of allVnetsForPeering) {
      for (const peerId of (vnet.peerings || [])) {
        const n = map[vnet.id], target = map[peerId];
        if (!n || !target) continue;
        // Check distance from point to line segment
        const dist = pointToSegmentDist(px, py, n.x, n.y, target.x, target.y);
        if (dist < 12) { peeringHit = { id1: vnet.id, id2: peerId }; break; }
      }
      if (peeringHit) break;
    }
    if (peeringHit) {
      state.selectedId = `peering:${peeringHit.id1}:${peeringHit.id2}`;
      fullUpdate();
      return;
    }
    // Check if clicking on a VNet Link line
    let vnetLinkHit = null;
    for (const res of (state.rgResources||[])) {
      if(res.type !== 'dns' || !res.config || !res.config.vnetLinks) continue;
      const dnsNode = map[res.id];
      if(!dnsNode) continue;
      for (const link of res.config.vnetLinks) {
        const target = map[link.vnetId];
        if(!target) continue;
        const dist = pointToSegmentDist(px, py, dnsNode.x, dnsNode.y, target.x, target.y);
        if(dist < 12) { vnetLinkHit = { resId: res.id, vnetId: link.vnetId }; break; }
      }
      if(vnetLinkHit) break;
    }
    if (vnetLinkHit) {
      state.selectedId = `vnetlink:${vnetLinkHit.resId}:${vnetLinkHit.vnetId}`;
      fullUpdate();
      return;
    }
    // Check if clicking on RG or Subscription box (group drag)
    if(state.layout==='grid'){
      let groupHit = null;
      // Check RG bounds first (smaller, more specific)
      for(let ri=0;ri<state.resourceGroups.length;ri++){
        const rg=state.resourceGroups[ri];
        const b=getRgBounds(rg.id,nodes);
        if(b && px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h){
          groupHit={type:'rg', id:rg.id, bounds:b};
          break;
        }
      }
      // Check subscription bounds if no RG hit
      if(!groupHit){
        for(let si=0;si<state.subscriptions.length;si++){
          const sub=state.subscriptions[si];
          const b=getSubBounds(sub.id,nodes);
          if(b && px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h){
            groupHit={type:'sub', id:sub.id, bounds:b};
            break;
          }
        }
      }
      if(groupHit){
        state.selectedId=null; fullUpdate();
        state.dragNodeId = '__group__';
        state.mouseStart = {x: px, y: py};
        // Build hierarchy maps for efficient group collection
        const nodeMap = {}; nodes.forEach(n => nodeMap[n.id] = n);
        const parentMap = {}; nodes.forEach(n => { if(n.parentId) parentMap[n.id] = n.parentId; });
        let groupNodes;
        if(groupHit.type==='rg'){
          // Get VNets in this RG, then their children
          const rgVnets = new Set(nodes.filter(n=>n.rgId===groupHit.id).map(n=>n.id));
          groupNodes = nodes.filter(n => rgVnets.has(n.id) || rgVnets.has(n.parentId) || rgVnets.has(parentMap[n.parentId]));
        } else {
          // Get VNets in this subscription, then their children
          const subVnets = new Set(nodes.filter(n=>n.subId===groupHit.id).map(n=>n.id));
          groupNodes = nodes.filter(n => subVnets.has(n.id) || subVnets.has(n.parentId) || subVnets.has(parentMap[n.parentId]));
        }
        state.dragGroup = groupNodes.map(c=>({id:c.id, start: state.customPos[c.id] || {x:c.x, y:c.y}}));
        canvas.style.cursor='move';
        return;
      }
    }
    state.selectedId=null; fullUpdate();
    state.dragging=true; state.dragStart={x:e.clientX,y:e.clientY}; state.offsetStart={...state.offset};
    canvas.style.cursor='grabbing';
  }
});

canvas.addEventListener('dblclick',e=>{
  if (state.selectedId === 'onprem') return;
  const r=canvas.getBoundingClientRect();
  const px=(e.clientX-r.left-state.offset.x)/state.scale,py=(e.clientY-r.top-state.offset.y)/state.scale;
  const nodes=getRenderNodes();
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    if (n.isOnPrem) continue;
    let hit=n.isSubnet?(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2):
      !n.isVnet?(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2):
      state.layout==='grid'?(Math.abs(px-n.x)<n.width/2&&Math.abs(py-n.y)<n.height/2):
      (Math.sqrt((px-n.x)**2+(py-n.y)**2)<n.radius);
    if(hit){startInlineRename(n,e.clientX,e.clientY);break;}
  }
});

function startInlineRename(node,cx,cy){
  const ov=document.getElementById('rename-overlay'),inp=document.getElementById('rename-input');
  ov.style.display='block';ov.style.left=(cx-60)+'px';ov.style.top=(cy-16)+'px';
  inp.value=node.label;inp.focus();inp.select();
  const finish=()=>{
    const v=inp.value.trim();
    if(v){
      if(node.isVnet){
        const vnet=[state.hub,...state.spokes].find(vn=>vn.id===node.id);
        if(vnet){vnet.name=v;fullUpdate();}
      }
      else if(node.isSubnet){
        const vnet=[state.hub,...state.spokes].find(vn=>vn.subnets.some(sn=>sn.id===node.id));
        const sn=vnet?.subnets.find(s=>s.id===node.id);
        if(sn){sn.name=v;fullUpdate();}
      }
      else if(node.parentId){
        [state.hub,...state.spokes].forEach(vn=>vn.subnets.forEach(sn=>{
          const r=sn.resources.find(r=>r.id===node.id);
          if(r){r.name=v;fullUpdate();}
        }));
      }
    }
    ov.style.display='none';inp.removeEventListener('blur',finish);inp.removeEventListener('keydown',kd);
  };
  const kd=e=>{if(e.key==='Enter')finish();if(e.key==='Escape'){ov.style.display='none';inp.removeEventListener('blur',finish);inp.removeEventListener('keydown',kd);}};
  inp.addEventListener('blur',finish);inp.addEventListener('keydown',kd);
}

canvas.addEventListener('mousemove',e=>{
  if (state.dragNodeId) {
    const r=canvas.getBoundingClientRect();
    const px=(e.clientX-r.left-state.offset.x)/state.scale,py=(e.clientY-r.top-state.offset.y)/state.scale;
    const dx = px - state.mouseStart.x;
    const dy = py - state.mouseStart.y;
    if(state.dragNodeId !== '__group__'){
      state.customPos[state.dragNodeId] = {
        x: state.dragNodeStart.x + dx,
        y: state.dragNodeStart.y + dy
      };
    }
    // Move group children together
    if(state.dragGroup){
      state.dragGroup.forEach(c=>{
        state.customPos[c.id] = { x: c.start.x + dx, y: c.start.y + dy };
      });
    }
    draw();
  } else if (state.dragging) {
    state.offset.x=state.offsetStart.x+(e.clientX-state.dragStart.x);
    state.offset.y=state.offsetStart.y+(e.clientY-state.dragStart.y);
    draw();
  }
});

canvas.addEventListener('mouseup',()=>{
  if(state.dragNodeId) { state.dragNodeId = null; state.dragGroup = null; saveState(); }
  if(state.dragging){state.dragging=false;saveState();}
  canvas.style.cursor='grab';
});
canvas.addEventListener('mouseleave',()=>{
  if(state.dragNodeId) { state.dragNodeId = null; state.dragGroup = null; saveState(); }
  if(state.dragging){state.dragging=false;saveState();}
  canvas.style.cursor='grab';
});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.scale=Math.max(.2,Math.min(3,state.scale*(e.deltaY<0?1.1:.9)));saveState();draw();},{passive:false});

// TOUCH EVENTS FOR MOBILE
let lastPinchDist = 0;
canvas.addEventListener('touchstart',e=>{
  if(e.touches.length===2){
    lastPinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    return;
  }
  e.preventDefault();
  const touch = e.touches[0];
  canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, clientX:touch.clientX, clientY:touch.clientY}));
},{passive:false});
canvas.addEventListener('touchmove',e=>{
  if(e.touches.length===2){
    e.preventDefault();
    const dist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    if(lastPinchDist > 0){
      const factor = dist / lastPinchDist;
      state.scale = Math.max(.2, Math.min(3, state.scale * factor));
      draw();
    }
    lastPinchDist = dist;
    return;
  }
  e.preventDefault();
  const touch = e.touches[0];
  canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:touch.clientX, clientY:touch.clientY}));
},{passive:false});
canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  lastPinchDist = 0;
  canvas.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
},{passive:false});
