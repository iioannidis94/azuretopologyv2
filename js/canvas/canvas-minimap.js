import { state } from '../state-management.js';
import { getRenderNodes } from './canvas-layout.js';

const canvas = document.getElementById('diagram-canvas');

const MM_W = 200;
const MM_H = 150;
const MM_PAD = 40; // world-space padding around content
let _minimapVisible = true;
let _draw = null;

export function setMinimapDrawFn(fn) { _draw = fn; }

function _getMinimapTransform(nodes) {
  if (!nodes.length) return null;
  let wx0=Infinity,wy0=Infinity,wx1=-Infinity,wy1=-Infinity;
  nodes.forEach(n=>{
    const hw=n.width?n.width/2:(n.radius||60);
    const hh=n.height?n.height/2:(n.radius||60);
    wx0=Math.min(wx0,n.x-hw); wy0=Math.min(wy0,n.y-hh);
    wx1=Math.max(wx1,n.x+hw); wy1=Math.max(wy1,n.y+hh);
  });
  wx0-=MM_PAD; wy0-=MM_PAD; wx1+=MM_PAD; wy1+=MM_PAD;
  const worldW=wx1-wx0, worldH=wy1-wy0;
  const mmScale=Math.min(MM_W/worldW, MM_H/worldH);
  const mmOffX=(MM_W-worldW*mmScale)/2;
  const mmOffY=(MM_H-worldH*mmScale)/2;
  return {wx0,wy0,mmScale,mmOffX,mmOffY};
}

function _worldToMM(wx, wy, t) {
  return { x: (wx-t.wx0)*t.mmScale+t.mmOffX, y: (wy-t.wy0)*t.mmScale+t.mmOffY };
}

export function drawMinimap() {
  const mm = document.getElementById('minimap-canvas');
  if (!mm || !_minimapVisible) return;
  const mc = mm.getContext('2d');
  const dw = state.theme === 'drawio';
  const nodes = getRenderNodes();

  mc.clearRect(0,0,MM_W,MM_H);
  mc.fillStyle = dw ? 'rgba(250,251,252,0.96)' : 'rgba(6,13,24,0.93)';
  mc.fillRect(0,0,MM_W,MM_H);

  if (!nodes.length) {
    mc.strokeStyle = dw ? 'rgba(0,0,0,0.2)' : 'rgba(0,120,212,0.5)';
    mc.lineWidth = 1; mc.strokeRect(0,0,MM_W,MM_H);
    return;
  }

  const t = _getMinimapTransform(nodes);
  if (!t) return;

  // Draw simplified nodes
  nodes.forEach(n=>{
    const p = _worldToMM(n.x, n.y, t);
    if (n.isVnet && state.layout !== 'grid') {
      const r = (n.radius||55)*t.mmScale;
      mc.beginPath(); mc.arc(p.x,p.y,Math.max(r,2),0,Math.PI*2);
      mc.fillStyle=(n.color||'#0078D4')+'55'; mc.fill();
      mc.strokeStyle=n.color||'#0078D4'; mc.lineWidth=0.8; mc.stroke();
    } else if (n.isVnet || n.isSubnet) {
      const hw=(n.width/2)*t.mmScale, hh=(n.height/2)*t.mmScale;
      mc.fillStyle=(n.color||'#0078D4')+'40';
      mc.fillRect(p.x-hw, p.y-hh, hw*2, hh*2);
      mc.strokeStyle=(n.color||'#0078D4')+'AA'; mc.lineWidth=0.7;
      mc.strokeRect(p.x-hw, p.y-hh, hw*2, hh*2);
    } else {
      const hw=Math.max((n.width/2)*t.mmScale,2), hh=Math.max((n.height/2)*t.mmScale,2);
      mc.fillStyle=n.color||'#0078D4';
      mc.fillRect(p.x-hw, p.y-hh, hw*2, hh*2);
    }
  });

  // Viewport indicator rectangle
  const vx=(-state.offset.x)/state.scale, vy=(-state.offset.y)/state.scale;
  const vw=canvas.width/state.scale, vh=canvas.height/state.scale;
  const vp0=_worldToMM(vx,vy,t), vp1=_worldToMM(vx+vw,vy+vh,t);
  const vrw=vp1.x-vp0.x, vrh=vp1.y-vp0.y;
  mc.fillStyle=dw?'rgba(0,120,212,0.07)':'rgba(255,185,0,0.07)';
  mc.fillRect(vp0.x,vp0.y,vrw,vrh);
  mc.strokeStyle=dw?'rgba(0,120,212,0.85)':'rgba(255,185,0,0.95)';
  mc.lineWidth=1.5; mc.setLineDash([]); mc.strokeRect(vp0.x,vp0.y,vrw,vrh);

  // Border
  mc.strokeStyle=dw?'rgba(0,0,0,0.2)':'rgba(0,120,212,0.5)';
  mc.lineWidth=1; mc.strokeRect(0,0,MM_W,MM_H);
}

export function toggleMinimap() {
  _minimapVisible = !_minimapVisible;
  const mm = document.getElementById('minimap-canvas');
  const btn = document.getElementById('minimap-toggle');
  if (mm) mm.style.display = _minimapVisible ? 'block' : 'none';
  if (btn) btn.title = _minimapVisible ? 'Hide Minimap' : 'Show Minimap';
  if (btn) btn.textContent = _minimapVisible ? '🗺' : '⊞';
}

// Minimap click / drag → navigate main canvas
(function setupMinimapInteraction() {
  const mm = document.getElementById('minimap-canvas');
  if (!mm) return;
  let mmDragging = false;

  function navigateFromMM(e) {
    const nodes = getRenderNodes();
    const t = _getMinimapTransform(nodes);
    if (!t) return;
    const r = mm.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (MM_W / r.width);
    const my = (e.clientY - r.top)  * (MM_H / r.height);
    const wx = (mx - t.mmOffX) / t.mmScale + t.wx0;
    const wy = (my - t.mmOffY) / t.mmScale + t.wy0;
    // Pan so clicked world point is at canvas center
    state.offset.x = canvas.width/2  - wx * state.scale;
    state.offset.y = canvas.height/2 - wy * state.scale;
    if (_draw) _draw();
  }

  mm.addEventListener('mousedown', e => { mmDragging=true; navigateFromMM(e); e.stopPropagation(); e.preventDefault(); });
  mm.addEventListener('mousemove', e => { if(mmDragging){ navigateFromMM(e); e.stopPropagation(); } });
  mm.addEventListener('mouseup',   e => { mmDragging=false; e.stopPropagation(); });
  mm.addEventListener('mouseleave',  () => { mmDragging=false; });

  // Touch support
  mm.addEventListener('touchstart', e => {
    e.stopPropagation(); e.preventDefault();
    mmDragging=true; navigateFromMM(e.touches[0]);
  }, {passive:false});
  mm.addEventListener('touchmove', e => {
    e.stopPropagation(); e.preventDefault();
    if(mmDragging) navigateFromMM(e.touches[0]);
  }, {passive:false});
  mm.addEventListener('touchend', e => { e.stopPropagation(); mmDragging=false; }, {passive:false});
})();
