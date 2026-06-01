import { state, RES_TYPES } from '../state-management.js';

const canvas = document.getElementById('diagram-canvas');

export function getRenderNodes(){
  const cx=canvas.width/2,cy=canvas.height/2,nodes=[];
  
  if(state.layout==='grid'){
    const RW=84,RH=64,RP=24;
    const SPT=30, SPB=12, SPL=12;
    const VPT=45, VPB=18, VGAP=60, SGAP=15;
    const RG_GAP=80, SUB_GAP=120;
    
    const sw = (sn) => Math.max(140, sn.resources.length * (RW+RP) + SPL*2 - RP);
    const sh = () => SPT + RH + SPB;

    const vw = (v) => {
      if(v.subnets.length===0) return 200;
      return v.subnets.reduce((sum, sn) => sum + sw(sn), 0) + (v.subnets.length-1)*SGAP + SPL*2;
    };
    const vh = () => VPT + sh() + VPB;
    
    const tree = state.subscriptions.map(sub => {
      const rgs = state.resourceGroups.filter(rg => rg.subId === sub.id).map(rg => {
        const vnets = [];
        if (state.hub.rgId === rg.id) vnets.push(state.hub);
        vnets.push(...state.spokes.filter(sp => sp.rgId === rg.id));
        const rgLevelRes = (state.rgResources||[]).filter(r => r.rgId === rg.id);
        const vnetWidth = vnets.length > 0 ? vnets.reduce((sum, v) => sum + vw(v), 0) + (vnets.length - 1) * VGAP : 0;
        const rgResWidth = rgLevelRes.length > 0 ? rgLevelRes.length * (RW + RP) + 40 : 0;
        const rgWidth = Math.max(200, vnetWidth + rgResWidth + 40);
        return { ...rg, vnets, rgLevelRes, renderWidth: rgWidth };
      });
      const subWidth = rgs.length > 0 ? rgs.reduce((sum, rg) => sum + rg.renderWidth, 0) + (rgs.length - 1) * RG_GAP + 80 : 300;
      return { ...sub, rgs, renderWidth: subWidth };
    });

    const totalWidth = tree.reduce((sum, sub) => sum + sub.renderWidth, 0) + (tree.length - 1) * SUB_GAP;
    const topY = Math.max(cy - 160, 150);
    const bottomY = topY + 300;
    
    let curX = cx - totalWidth / 2;
    
    tree.forEach(sub => {
      let rgX = curX + 40; 
      sub.rgs.forEach(rg => {
        let vnetX = rgX + 20; 
        rg.vnets.forEach(vnet => {
          const vWidth = vw(vnet);
          const vx = vnetX + vWidth / 2;
          const vy = (vnet.id === 'hub') ? topY : bottomY;
          
          nodes.push({id:vnet.id, isVnet:true, x:vx, y:vy, width:vWidth, height:vh(), label:vnet.name, sub:vnet.cidr, color:vnet.color, peerings:vnet.peerings||[], rgId:rg.id, subId:sub.id});
          
          let snX = vnetX + SPL;
          vnet.subnets.forEach((sn, j) => {
            const snW = sw(sn);
            const cxSn = snX + snW/2;
            nodes.push({id:sn.id, isSubnet:true, parentId:vnet.id, x:cxSn, y:vy+VPT+sh()/2 - (vh()/2), width:snW, height:sh(), label:sn.name, sub:sn.cidr, color:vnet.color});
            
            sn.resources.forEach((res,k)=>{
              const tot=sn.resources.length,tw=tot*RW+(tot-1)*RP;
              nodes.push({id:res.id, isVnet:false, parentId:sn.id, x:cxSn-tw/2+RW/2+k*(RW+RP), y:vy+VPT+SPT+RH/2 - (vh()/2), label:res.name, type:res.type, color:RES_TYPES[res.type]?.color||'#FFF', width:RW, height:RH});
            });
            snX += snW + SGAP;
          });
          
          vnetX += vWidth + VGAP;
        });

        // RG-level resources (DNS zones etc)
        if (rg.rgLevelRes && rg.rgLevelRes.length > 0) {
          const rgResY = bottomY + vh() + 40;
          rg.rgLevelRes.forEach((res, k) => {
            nodes.push({id:res.id, isVnet:false, isRgLevel:true, parentId:null, x:vnetX + k*(RW+RP) + RW/2, y:rgResY, label:res.name, type:res.type, color:RES_TYPES[res.type]?.color||'#FFF', width:RW, height:RH, rgId:rg.id});
          });
        }
        rgX += rg.renderWidth + RG_GAP;
      });
      curX += sub.renderWidth + SUB_GAP;
    });

  } else {
    const r=Math.min(canvas.width,canvas.height)*.34;
    nodes.push({id:state.hub.id,isVnet:true,x:cx,y:cy,label:state.hub.name,sub:state.hub.cidr,color:state.hub.color,radius:70,peerings:state.hub.peerings||[],rgId:state.hub.rgId});
    
    let hRes = []; state.hub.subnets.forEach(sn => hRes.push(...sn.resources));
    hRes.forEach((res,i)=>{
      const angle=(i/Math.max(hRes.length,1))*Math.PI*2-Math.PI/2;
      nodes.push({id:res.id,isVnet:false,parentId:state.hub.id,x:cx+Math.cos(angle)*135,y:cy+Math.sin(angle)*135,label:res.name,type:res.type,color:RES_TYPES[res.type]?.color||'#FFF',width:84,height:64});
    });

    state.spokes.forEach((sp,i)=>{
      const angle=state.spokes.length===1?Math.PI/2:(i/state.spokes.length)*Math.PI*2;
      const sx=cx+Math.cos(angle)*r,sy=cy+Math.sin(angle)*r;
      const perp={x:-Math.sin(angle),y:Math.cos(angle)};
      nodes.push({id:sp.id,isVnet:true,x:sx,y:sy,label:sp.name,sub:sp.cidr,color:sp.color,radius:55,peerings:sp.peerings||[],rgId:sp.rgId});
      
      let sRes = []; sp.subnets.forEach(sn => sRes.push(...sn.resources));
      sRes.forEach((res,j)=>{
        const t=sRes.length>1?(j*90-(sRes.length-1)*45):0;
        nodes.push({id:res.id,isVnet:false,parentId:sp.id,x:sx+Math.cos(angle)*125+perp.x*t,y:sy+Math.sin(angle)*125+perp.y*t,label:res.name,type:res.type,color:RES_TYPES[res.type]?.color||'#FFF',width:84,height:64});
      });
    });
  }

  // ON-PREM NODE
  if (state.onPrem.enabled) {
    const hubNode = nodes.find(n => n.id === 'hub');
    const hx = hubNode ? hubNode.x : cx;
    const hy = hubNode ? hubNode.y : cy;
    nodes.push({
      id: state.onPrem.id, isVnet: false, isOnPrem: true, parentId: 'hub', 
      x: hx - 320, y: hy, width: 140, height: 80, 
      label: state.onPrem.name, sub: state.onPrem.cidr, color: '#107C10'
    });
  }

  // CUSTOM POSITIONS
  if (!state.customPos) state.customPos = {};
  // Store original (layout-computed) positions for offset calculation
  const origPos = {};
  nodes.forEach(n => { origPos[n.id] = {x: n.x, y: n.y}; });
  nodes.forEach(n => {
    if (state.customPos[n.id]) { n.x = state.customPos[n.id].x; n.y = state.customPos[n.id].y; }
  });
  // Re-position child nodes that have no custom position relative to their (possibly moved) parent.
  // First pass: subnets follow their parent VNet
  nodes.forEach(n => {
    if(n.isSubnet && n.parentId && !state.customPos[n.id]){
      const parent = nodes.find(p => p.id === n.parentId);
      if(parent && origPos[parent.id]){
        const dx = parent.x - origPos[parent.id].x;
        const dy = parent.y - origPos[parent.id].y;
        if(dx !== 0 || dy !== 0){
          n.x = origPos[n.id].x + dx;
          n.y = origPos[n.id].y + dy;
        }
      }
    }
  });
  // Second pass: resources follow their parent subnet (or VNet in radial layout)
  nodes.forEach(n => {
    if(!n.isVnet && !n.isSubnet && !n.isOnPrem && !n.isRgLevel && n.parentId && !state.customPos[n.id]){
      const parent = nodes.find(p => p.id === n.parentId);
      if(parent && origPos[parent.id]){
        const dx = parent.x - origPos[parent.id].x;
        const dy = parent.y - origPos[parent.id].y;
        if(dx !== 0 || dy !== 0){
          n.x = origPos[n.id].x + dx;
          n.y = origPos[n.id].y + dy;
        }
      }
    }
  });

  // Resolve subnet collisions within same VNet: push overlapping subnets apart horizontally
  if(state.layout==='grid'){
    nodes.filter(n=>n.isVnet).forEach(vnetNode=>{
      const childSubnets=nodes.filter(n=>n.isSubnet&&n.parentId===vnetNode.id);
      if(childSubnets.length<2)return;
      // Sort subnets by x position (left to right)
      childSubnets.sort((a,b)=>a.x-b.x);
      const gap=15; // minimum gap between subnets
      let changed=true, iterations=0;
      while(changed && iterations<20){
        changed=false; iterations++;
        for(let i=0;i<childSubnets.length-1;i++){
          const a=childSubnets[i], b=childSubnets[i+1];
          const aRight=a.x+a.width/2;
          const bLeft=b.x-b.width/2;
          const overlap=aRight+gap-bLeft;
          if(overlap>0){
            // Push b (and all subnets to its right) to the right
            const shift=overlap;
            for(let j=i+1;j<childSubnets.length;j++){
              childSubnets[j].x+=shift;
              // Also move resources inside this subnet
              const childRes=nodes.filter(n=>!n.isVnet&&!n.isSubnet&&n.parentId===childSubnets[j].id);
              childRes.forEach(r=>{r.x+=shift;});
            }
            changed=true;
          }
        }
      }
    });
  }

  // Expand VNet bounds to contain all its subnets (like RGs expand to contain VNets)
  if(state.layout==='grid'){
    nodes.filter(n=>n.isVnet).forEach(vnetNode=>{
      const childSubnets=nodes.filter(n=>n.isSubnet&&n.parentId===vnetNode.id);
      if(childSubnets.length===0)return;
      let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
      childSubnets.forEach(sn=>{
        mx=Math.min(mx,sn.x-sn.width/2);my=Math.min(my,sn.y-sn.height/2);
        Mx=Math.max(Mx,sn.x+sn.width/2);My=Math.max(My,sn.y+sn.height/2);
      });
      const padL=12,padR=12,padT=45,padB=18;
      const neededW=(Mx-mx)+padL+padR;
      const neededH=(My-my)+padT+padB;
      if(neededW>vnetNode.width) vnetNode.width=neededW;
      if(neededH>vnetNode.height) vnetNode.height=neededH;
      // Re-center VNet on its subnets
      const cxSubs=(mx+Mx)/2;
      const cySubs=(my+My)/2;
      vnetNode.x=cxSubs;
      vnetNode.y=cySubs - (padT-padB)/2;
    });

    // Resolve VNet-to-VNet collisions within same RG: push overlapping VNets apart horizontally
    const rgIds=new Set(nodes.filter(n=>n.isVnet&&n.rgId).map(n=>n.rgId));
    rgIds.forEach(rgId=>{
      const rgVnets=nodes.filter(n=>n.isVnet&&n.rgId===rgId);
      if(rgVnets.length<2)return;
      rgVnets.sort((a,b)=>a.x-b.x);
      const vGap=60;
      let changed=true, iterations=0;
      while(changed && iterations<20){
        changed=false; iterations++;
        for(let i=0;i<rgVnets.length-1;i++){
          const a=rgVnets[i], b=rgVnets[i+1];
          const aRight=a.x+a.width/2;
          const bLeft=b.x-b.width/2;
          const overlap=aRight+vGap-bLeft;
          if(overlap>0){
            const shift=overlap;
            for(let j=i+1;j<rgVnets.length;j++){
              const vn=rgVnets[j];
              vn.x+=shift;
              // Move children (subnets + resources) along with VNet
              nodes.filter(n=>n.isSubnet&&n.parentId===vn.id).forEach(sn=>{
                sn.x+=shift;
                nodes.filter(r=>!r.isVnet&&!r.isSubnet&&r.parentId===sn.id).forEach(r=>{r.x+=shift;});
              });
            }
            changed=true;
          }
        }
      }
    });
  }

  return nodes;
}

export function getSubBounds(subId,nodes){
  const related=nodes.filter(n=>n.isVnet&&n.subId===subId);
  if(!related.length)return null;
  let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
  related.forEach(n=>{
    const hw=n.width?n.width/2:n.radius||60,hh=n.height?n.height/2:n.radius||60;
    mx=Math.min(mx,n.x-hw);my=Math.min(my,n.y-hh);Mx=Math.max(Mx,n.x+hw);My=Math.max(My,n.y+hh);
  });
  return{x:mx-30,y:my-50,w:Mx-mx+60,h:My-my+70};
}

export function getRgBounds(rgId,nodes){
  const related=nodes.filter(n=>(n.isVnet&&n.rgId===rgId)||(n.isRgLevel&&n.rgId===rgId));
  if(!related.length)return null;
  let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
  related.forEach(n=>{
    const hw=n.width?n.width/2:n.radius||60,hh=n.height?n.height/2:n.radius||60;
    mx=Math.min(mx,n.x-hw);my=Math.min(my,n.y-hh);Mx=Math.max(Mx,n.x+hw);My=Math.max(My,n.y+hh);
  });
  return{x:mx-15,y:my-30,w:Mx-mx+30,h:My-my+45};
}

export function getMgBounds(mgId, nodes) {
  // Get all subscription IDs under this MG (direct children)
  const mgSubs = state.subscriptions.filter(s => s.mgId === mgId).map(s => s.id);
  // Get child MGs
  const childMgs = (state.managementGroups || []).filter(m => m.parentId === mgId);
  
  let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
  let hasContent = false;
  
  // Include subscription bounds
  mgSubs.forEach(subId => {
    const b = getSubBounds(subId, nodes);
    if (b) {
      hasContent = true;
      mx = Math.min(mx, b.x); my = Math.min(my, b.y);
      Mx = Math.max(Mx, b.x + b.w); My = Math.max(My, b.y + b.h);
    }
  });
  
  // Include child MG bounds recursively
  childMgs.forEach(child => {
    const b = getMgBounds(child.id, nodes);
    if (b) {
      hasContent = true;
      mx = Math.min(mx, b.x); my = Math.min(my, b.y);
      Mx = Math.max(Mx, b.x + b.w); My = Math.max(My, b.y + b.h);
    }
  });
  
  if (!hasContent) return null;
  return { x: mx - 20, y: my - 40, w: Mx - mx + 40, h: My - my + 55 };
}
