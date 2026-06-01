/**
 * Produces a safe identifier for PowerShell variables and Bicep symbols.
 * Replaces non-alphanumeric/underscore characters, and prefixes a leading digit
 * with an underscore so the result is always a valid identifier.
 */
export function _iacSafe(name) {
  const safe = (name || '').replace(/[^a-zA-Z0-9_]/g, '_');
  return /^\d/.test(safe) ? '_' + safe : safe || '_resource';
}

export function closeModal(id) { document.getElementById(id).classList.remove('show'); }

export function copyText(id) { navigator.clipboard.writeText(document.getElementById(id).textContent).then(() => alert('Copied successfully!')); }

export function downloadText(id, fn) {
  const b = new Blob([document.getElementById(id).textContent], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = fn;
  a.click();
}

export function toggleExportPanel() {
  const panel = document.getElementById('export-panel');
  const toggle = document.getElementById('export-panel-toggle');
  panel.classList.toggle('collapsed');
  toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '▼';
}

export function _uid() {
  return 'inv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Setup modal close on backdrop click
['ps-modal', 'bicep-modal', 'json-import-modal', 'azure-inventory-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
});
