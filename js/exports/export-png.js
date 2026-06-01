import { state } from '../state-management.js';

export function exportPng() {
  const canvas = document.getElementById('diagram-canvas');
  const ec = document.createElement('canvas'); ec.width = canvas.width * 2; ec.height = canvas.height * 2;
  const c = ec.getContext('2d'); c.scale(2, 2);
  c.fillStyle = state.theme === 'drawio' ? '#F0F2F5' : '#060D18'; c.fillRect(0, 0, canvas.width, canvas.height);

  c.strokeStyle = state.theme === 'drawio' ? 'rgba(0,0,0,0.04)' : 'rgba(0,120,212,0.04)'; c.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, canvas.height); c.stroke(); }
  for (let y = 0; y < canvas.height; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(canvas.width, y); c.stroke(); }

  c.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  const a = document.createElement('a'); a.download = `azure-architecture-${Date.now()}.png`; a.href = ec.toDataURL(); a.click();
}
