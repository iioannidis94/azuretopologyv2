import { state, RES_TYPES, SUB_COLORS, RG_COLORS, loadedImages } from '../state-management.js';
import { getRenderNodes, getSubBounds, getRgBounds, getMgBounds } from './canvas-layout.js';
import { drawMinimap, setMinimapDrawFn } from './canvas-minimap.js';

const canvas = document.getElementById('diagram-canvas');
const ctx = canvas.getContext('2d');

function safeRR(c,x,y,w,h,r){if(typeof c.roundRect==='function')c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}

export function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function resize() {
  if (!canvas || !canvas.parentElement) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  draw();
}

window.addEventListener('resize', resize);

const resizeObserver = new ResizeObserver(() => {
  resize();
});
if (canvas && canvas.parentElement) {
  resizeObserver.observe(canvas.parentElement);
}

export function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(state.offset.x,state.offset.y);ctx.scale(state.scale,state.scale);
  const nodes=getRenderNodes();
  const map={};nodes.forEach(n=>map[n.id]=n);
  const dw=state.theme==='drawio';

  if(state.layout==='grid'){
    // Draw Management Group bounds (if enabled)
    if (state.mgEnabled && state.managementGroups && state.managementGroups.length > 0) {
      state.managementGroups.forEach((mg) => {
        const b = getMgBounds(mg.id, nodes);
        if (!b) return;
        ctx.beginPath(); safeRR(ctx, b.x, b.y, b.w, b.h, 20);
        ctx.fillStyle = dw ? 'rgba(0,120,212,0.04)' : 'rgba(0,120,212,0.03)'; ctx.fill();
        ctx.setLineDash([12, 6]); ctx.strokeStyle = dw ? 'rgba(0,120,212,0.6)' : 'rgba(0,120,212,0.4)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
        ctx.font = 'bold 13px Syne'; ctx.fillStyle = dw ? '#1E40AF' : '#60A5FA';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('🏛️ ' + mg.name, b.x + 15, b.y + 20);
      });
    }

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

  // DRAW VNet LINK LINES (DNS zones -> VNets, dashed)
  (state.rgResources||[]).forEach(res => {
    if(res.type !== 'dns' || !res.config || !res.config.vnetLinks) return;
    const dnsNode = map[res.id];
    if(!dnsNode) return;
    (res.config.vnetLinks).forEach(link => {
      const target = map[link.vnetId];
      if(!target) return;
      ctx.beginPath();
      ctx.moveTo(dnsNode.x, dnsNode.y);
      ctx.lineTo(target.x, target.y);
      ctx.setLineDash([6, 4]);
      const isSelected = state.selectedId === `vnetlink:${res.id}:${link.vnetId}`;
      if(isSelected) {
        ctx.strokeStyle = '#00B294'; ctx.lineWidth = 3;
      } else if(dw) {
        ctx.strokeStyle = '#6B7280'; ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(0,178,148,0.5)'; ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const midX = (dnsNode.x + target.x) / 2;
      const midY = (dnsNode.y + target.y) / 2 - 6;
      ctx.font = '8px JetBrains Mono'; ctx.fillStyle = dw ? '#6B7280' : '#00B294'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('VNet Link', midX, midY);
    });
  });

  // DRAW NODES
  nodes.filter(n => n.isSubnet).forEach(n => drawSubnet(n, dw));
  nodes.filter(n => !n.isSubnet).forEach(n => drawNode(n, dw));
  
  ctx.restore();
  drawMinimap();
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

// Register draw with the minimap module so it can pan the main canvas without a circular import
setMinimapDrawFn(draw);
