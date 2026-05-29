import { state, saveState, RES_TYPES, SUB_COLORS, RG_COLORS, loadedImages, AZURE_ICON_BASE, getVnetsInRg } from './state-management.js';
import { fullUpdate } from './state-management.js';

// ================================================================
// CANVAS SETUP & LAYOUT ENGINE
// ================================================================
const canvas = document.getElementById('diagram-canvas');
const ctx = canvas.getContext('2d');

function safeRR(c,x,y,w,h,r){if(typeof c.roundRect==='function')c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function resize(){canvas.width=canvas.parentElement.clientWidth;canvas.height=canvas.parentElement.clientHeight;draw();}
window.addEventListener('resize',resize);

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

function getSubBounds(subId,nodes){
  const related=nodes.filter(n=>n.isVnet&&n.subId===subId);
  if(!related.length)return null;
  let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
  related.forEach(n=>{
    const hw=n.width?n.width/2:n.radius||60,hh=n.height?n.height/2:n.radius||60;
    mx=Math.min(mx,n.x-hw);my=Math.min(my,n.y-hh);Mx=Math.max(Mx,n.x+hw);My=Math.max(My,n.y+hh);
  });
  return{x:mx-30,y:my-50,w:Mx-mx+60,h:My-my+70};
}
function getRgBounds(rgId,nodes){
  const related=nodes.filter(n=>(n.isVnet&&n.rgId===rgId)||(n.isRgLevel&&n.rgId===rgId));
  if(!related.length)return null;
  let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
  related.forEach(n=>{
    const hw=n.width?n.width/2:n.radius||60,hh=n.height?n.height/2:n.radius||60;
    mx=Math.min(mx,n.x-hw);my=Math.min(my,n.y-hh);Mx=Math.max(Mx,n.x+hw);My=Math.max(My,n.y+hh);
  });
  return{x:mx-15,y:my-30,w:Mx-mx+30,h:My-my+45};
}

export function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(state.offset.x,state.offset.y);ctx.scale(state.scale,state.scale);
  const nodes=getRenderNodes();
  const map={};nodes.forEach(n=>map[n.id]=n);
  const dw=state.theme==='drawio';

  if(state.layout==='grid'){
    state.subscriptions.forEach((sub,si)=>{
      const b=getSubBounds(sub.id,nodes);
      if(!b)return;
      const col=SUB_COLORS[si%SUB_COLORS.length];
      ctx.beginPath();safeRR(ctx,b.x,b.y,b.w,b.h,16);
      ctx.fillStyle=dw?`rgba(255,185,0,0.08)`:`rgba(255,185,0,0.05)`;ctx.fill();
      ctx.setLineDash([8,6]);ctx.strokeStyle=dw?`rgba(255,185,0,0.8)`:col+'80';ctx.lineWidth=2.5;ctx.stroke();ctx.setLineDash([]);
      ctx.font='bold 12px Syne';ctx.fillStyle=dw?'#92400E':col;
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText('☁️ '+sub.name,b.x+15,b.y+18);
    });
    state.resourceGroups.forEach((rg,ri)=>{
      const b=getRgBounds(rg.id,nodes);
      if(!b)return;
      const col=RG_COLORS[ri%RG_COLORS.length];
      ctx.beginPath();safeRR(ctx,b.x,b.y,b.w,b.h,10);
      ctx.fillStyle=dw?'rgba(135,100,184,0.08)':'rgba(135,100,184,0.08)';ctx.fill();
      ctx.strokeStyle=dw?'rgba(135,100,184,0.8)':'rgba(135,100,184,0.7)';ctx.lineWidth=2;ctx.stroke();
      ctx.font='bold 10px JetBrains Mono';ctx.fillStyle=dw?'#6B21A8':'#B08BE8';
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText('📁 '+rg.name,b.x+8,b.y+12);
    });
  }

  // LINES (Peerings & On-Prem)
  const drawnLines = new Set();
  nodes.forEach(n => {
    if (n.isOnPrem && n.parentId && map[n.parentId]) {
      const target = map[n.parentId];
      ctx.beginPath();
      ctx.moveTo(n.x + n.width/2, n.y); ctx.lineTo(target.x - (target.width?target.width/2:target.radius), target.y);
      ctx.strokeStyle = dw ? '#107C10' : '#107C10'; ctx.lineWidth = 3; ctx.setLineDash([6,6]);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.font='10px Syne'; ctx.fillStyle = dw?'#107C10':'#107C10'; ctx.textAlign='center';
      ctx.fillText('S2S VPN / ER', (n.x + target.x)/2, n.y - 10);
    }
    else if (n.isVnet && n.peerings) {
      n.peerings.forEach(pId => {
        const target = map[pId];
        if (!target) return;
        const lineKey = [n.id, target.id].sort().join('|');
        if (drawnLines.has(lineKey)) return;
        drawnLines.add(lineKey);

        ctx.beginPath();
        let midX, midY;

        if (state.layout === 'grid') {
          if (n.id === 'hub' || target.id === 'hub') {
            const hubN = n.id === 'hub' ? n : target;
            const spokeN = n.id === 'hub' ? target : n;
            if (spokeN.y > hubN.y) {
              const busY = hubN.y + hubN.height/2 + 40;
              ctx.moveTo(hubN.x, hubN.y + hubN.height/2);
              ctx.lineTo(hubN.x, busY); ctx.lineTo(spokeN.x, busY);
              ctx.lineTo(spokeN.x, spokeN.y - spokeN.height/2);
              midX = (hubN.x + spokeN.x) / 2; midY = busY - 4;
            } else {
              ctx.moveTo(n.x, n.y); ctx.lineTo(target.x, target.y);
              midX = (n.x + target.x) / 2; midY = (n.y + target.y) / 2 - 4;
            }
          } else {
            ctx.moveTo(n.x, n.y + n.height/2);
            const dist = Math.abs(n.x - target.x);
            const curveY = Math.max(n.y, target.y) + n.height/2 + 40 + (dist * 0.1);
            ctx.quadraticCurveTo((n.x + target.x)/2, curveY, target.x, target.y + target.height/2);
            midX = (n.x + target.x) / 2; midY = 0.25*(n.y + n.height/2) + 0.5*curveY + 0.25*(target.y + target.height/2) - 4;
          }
        } else {
          ctx.moveTo(n.x, n.y); ctx.lineTo(target.x, target.y);
          midX = (n.x + target.x) / 2; midY = (n.y + target.y) / 2 - 4;
        }

        if (dw) { ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 2; } 
        else { const g = ctx.createLinearGradient(n.x, n.y, target.x, target.y); g.addColorStop(0, 'rgba(0,120,212,0.6)'); g.addColorStop(1, target.color + 'A0'); ctx.strokeStyle = g; ctx.lineWidth = 2; }
        ctx.stroke();

        if (dw) { ctx.font = '8px JetBrains Mono'; ctx.fillStyle = '#9CA3AF'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('Peering', midX, midY); }
      });
    }
  });

  // DRAW NODES
  nodes.filter(n => n.isSubnet).forEach(n => drawSubnet(n, dw));
  nodes.filter(n => !n.isSubnet).forEach(n => drawNode(n, dw));
  
  ctx.restore();
}

function drawSubnet(n, dw) {
  const isSel=state.selectedId===n.id;
  ctx.save();
  ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,n.height,6);
  if(dw){
    ctx.fillStyle = isSel?'rgba(0,120,212,0.14)':(n.color+'30'); ctx.fill();
    ctx.strokeStyle=isSel?'#0078D4':n.color; ctx.lineWidth=isSel?2.5:2; ctx.stroke();
  } else {
    ctx.fillStyle = isSel?(n.color+'25'):(n.color+'14'); ctx.fill();
    ctx.strokeStyle=isSel?n.color:(n.color+'88'); ctx.lineWidth=isSel?2:1.5; ctx.stroke();
  }
  ctx.font='bold 10px JetBrains Mono'; ctx.fillStyle=dw?'#1F2937':'rgba(255,255,255,0.90)';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('⬚ '+n.label, n.x-n.width/2+8, n.y-n.height/2+6);
  if(n.sub){
    ctx.font='9px JetBrains Mono'; ctx.fillStyle=dw?'#4B5563':'rgba(255,255,255,0.65)';
    ctx.fillText(n.sub, n.x-n.width/2+8, n.y-n.height/2+19);
  }
  ctx.restore();
}

function drawNode(n, dw){
  const isSel=state.selectedId===n.id;
  ctx.save();
  if(isSel){ctx.shadowColor=dw?'rgba(0,120,212,.4)':n.color||'#0078D4';ctx.shadowBlur=15;}
  
  if (n.isOnPrem) {
    ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,n.height,8);
    if(dw){
      ctx.fillStyle='#FFFFFF'; ctx.fill();
      ctx.strokeStyle=isSel?n.color:'#D1D5DB';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,6,{tl:8,tr:8,bl:0,br:0});
      ctx.fillStyle=n.color;ctx.fill();
    }else{
      ctx.fillStyle=n.color+'20';ctx.fill();
      ctx.strokeStyle=isSel?n.color:n.color+'80';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.shadowBlur=0;
    ctx.font='28px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🏢', n.x, n.y - 10);
    ctx.font='bold 10px Syne';ctx.fillStyle=dw?'#111827':'#FFF';
    ctx.fillText(n.label,n.x,n.y+16);
    ctx.font='9px JetBrains Mono';ctx.fillStyle=dw?'#6B7280':'rgba(255,255,255,0.7)';
    ctx.fillText(n.sub,n.x,n.y+28);
  }
  else if(!n.isVnet){
    const rt=RES_TYPES[n.type]||{icon:'❓'};
    ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,n.height,8);
    if(dw){
      ctx.fillStyle='#FFFFFF';
      if(!isSel){ctx.shadowColor='rgba(0,0,0,.15)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;}
      ctx.fill();
      ctx.strokeStyle=isSel?'#0078D4':(rt.color||'#0078D4')+'88';ctx.lineWidth=isSel?2.5:1.8;ctx.stroke();
      ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,6,{tl:8,tr:8,bl:0,br:0});
      ctx.fillStyle=rt.color||'#0078D4';ctx.fill();
    }else{
      ctx.fillStyle=(rt.color||'#0078D4')+'30';ctx.fill();
      ctx.strokeStyle=isSel?(rt.color||'#0078D4'):(rt.color||'#0078D4')+'90';ctx.lineWidth=isSel?2.5:1.5;ctx.stroke();
    }
    ctx.shadowBlur=0;
    
    const img = loadedImages[n.type];
    if(img && img.complete && img.naturalWidth > 0){
      ctx.drawImage(img, n.x - 14, n.y - 20, 28, 28);
    } else {
      ctx.font='24px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(rt.icon, n.x, n.y - 8);
    }
    
    ctx.font='bold 9px JetBrains Mono';ctx.fillStyle=dw?'#374151':'#FFF';
    ctx.textAlign='center';ctx.textBaseline='top';
    const lbl=n.label.length>14?n.label.slice(0,14)+'…':n.label;
    ctx.fillText(lbl,n.x,n.y+n.height/2-18);
    
  }else{
    if(state.layout==='grid'){
      ctx.beginPath();safeRR(ctx,n.x-n.width/2,n.y-n.height/2,n.width,n.height,12);
      if(dw){
        ctx.fillStyle=n.color+'22';ctx.fill();
        ctx.strokeStyle=isSel?'#0078D4':n.color;ctx.lineWidth=isSel?2.5:2.2;ctx.stroke();
      }else{
        ctx.fillStyle=n.color+'18';ctx.fill();
        ctx.strokeStyle=isSel?n.color:n.color+'90';ctx.lineWidth=isSel?2.5:2;ctx.stroke();
      }
      ctx.shadowBlur=0;
      ctx.font='bold 12px Syne';ctx.fillStyle=dw?'#111827':'#E8F4FD';
      ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText(n.label,n.x-n.width/2+14,n.y-n.height/2+12);
      ctx.font='10px JetBrains Mono';ctx.fillStyle=dw?'#6B7280':'rgba(255,255,255,.6)';
      ctx.fillText(n.sub,n.x-n.width/2+14,n.y-n.height/2+28);
    }else{
      ctx.beginPath();ctx.arc(n.x,n.y,n.radius,0,Math.PI*2);
      if(dw){
        const gDw=ctx.createRadialGradient(n.x-10,n.y-10,0,n.x,n.y,n.radius);gDw.addColorStop(0,n.color+'30');gDw.addColorStop(1,n.color+'12');ctx.fillStyle=gDw;
        if(!isSel){ctx.shadowColor='rgba(0,0,0,.06)';ctx.shadowBlur=8;}
        ctx.fill();ctx.shadowBlur=0;
        ctx.strokeStyle=isSel?'#0078D4':n.color+'CC';ctx.lineWidth=2.5;ctx.stroke();
      }else{
        const g=ctx.createRadialGradient(n.x-10,n.y-10,0,n.x,n.y,n.radius);g.addColorStop(0,n.color+'60');g.addColorStop(1,n.color+'20');ctx.fillStyle=g;ctx.fill();
        ctx.strokeStyle=isSel?n.color:n.color+'90';ctx.lineWidth=2.5;ctx.stroke();
      }
      ctx.shadowBlur=0;
      ctx.font='bold 12px Syne';ctx.fillStyle=dw?'#111827':'#E8F4FD';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(n.label,n.x,n.y-10);
      ctx.font='10px JetBrains Mono';ctx.fillStyle=dw?'#6B7280':'rgba(255,255,255,.6)';
      ctx.fillText(n.sub,n.x,n.y+10);
    }
  }
  ctx.restore();
}

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
      const vnetNode = vnetId ? nodes.find(n => n.id === vnetId) : null;
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
