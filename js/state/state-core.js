// ================================================================
// STATE
// ================================================================
export const KEY='azureBuilderV11';
export const SUB_COLORS=['#FFB900','#00BCF2','#00B294','#FF8C00','#8764B8'];
export const RG_COLORS=['#8764B8','#0078D4','#00B294','#FF8C00','#E81123'];
export const VNET_COLORS=['#0078D4','#00BCF2','#00B294','#FF8C00','#8764B8','#107C10'];

const defaultState={
  theme:'dark', layout:'grid',
  onPrem: { enabled: false, id: 'onprem', name: 'Corp Datacenter', cidr: '192.168.0.0/16' },
  mgEnabled: false,
  managementGroups: [],
  customPos: {},
  subscriptions:[
    {id:'sub-1',name:'My Subscription',subscriptionId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tenantId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',tags:{},mgId:null}
  ],
  resourceGroups:[
    {id:'rg-1', name:'rg-main', location:'eastus', subId:'sub-1', tags:{}, lock:'None', budgetLimit:'', budgetAlertThreshold:'80'}
  ],
  rgResources:[],
  hub:{
    id:'hub',name:'hub-vnet',cidr:'10.0.0.0/16',color:'#0078D4',rgId:'rg-1', peerings: [], peeringConfigs: {},
    subnets:[{id:'sn-hub-default', name:'default', cidr:'10.0.0.0/24', resources:[]}]
  },
  spokes:[],
  selectedId:null, offset:{x:0,y:0}, scale:1, dragging:false, dragStart:{x:0,y:0}, offsetStart:{x:0,y:0}, dragNodeId:null, dragGroup:null
};

export let state;
try{
  const s=localStorage.getItem(KEY);
  state=s?JSON.parse(s):JSON.parse(JSON.stringify(defaultState));
  state.dragging=false; state.dragNodeId=null; state.dragGroup=null;
  if(!state.rgResources) state.rgResources=[];
  if(!state.hub.peeringConfigs) state.hub.peeringConfigs={};
  state.spokes.forEach(s => { if(!s.peeringConfigs) s.peeringConfigs = {}; });
  if(state.mgEnabled===undefined) state.mgEnabled=false;
  if(!state.managementGroups) state.managementGroups=[];
  state.subscriptions.forEach(s => { if(s.mgId===undefined) s.mgId=null; });
  if(state.theme==='dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');
}catch(e){state=JSON.parse(JSON.stringify(defaultState));}

// ================================================================
// UNDO / REDO HISTORY
// ================================================================
const MAX_HISTORY = 5;
const _undoStack = [];
const _redoStack = [];
let _isUndoRedoAction = false;

// Properties that are transient and should NOT be tracked in history
const TRANSIENT_KEYS = ['dragging','dragStart','offsetStart','dragNodeId','dragGroup','selectedId','offset','scale','mouseStart','dragNodeStart'];

/** Stable JSON serialization (sorted keys) to avoid false positives from key-order changes */
function _stableStringify(obj) {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(v => _stableStringify(v)).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

function _getSerializableState() {
  const snap = {};
  const keys = Object.keys(state).filter(k => !TRANSIENT_KEYS.includes(k)).sort();
  for (const key of keys) {
    snap[key] = JSON.parse(JSON.stringify(state[key]));
  }
  return snap;
}

function _restoreSnapshot(snap) {
  for (const key of Object.keys(state)) {
    if (!TRANSIENT_KEYS.includes(key)) delete state[key];
  }
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  if (state.theme === 'dark') document.body.classList.remove('theme-drawio');
  else document.body.classList.add('theme-drawio');
}

// Initialize _lastSavedSnapshot immediately with the loaded state
let _lastSavedSnapshot = _getSerializableState();

// Render-only function (no save) - injected by main.js
let _renderAll = null;
export function setRenderAll(fn) { _renderAll = fn; }
function renderAll() { if (_renderAll) _renderAll(); }

/** Called after saveState to record the new state in history */
function _recordStateForUndo() {
  if (_isUndoRedoAction) return;
  const snap = _getSerializableState();
  // If this is identical to the last saved snapshot, skip
  if (_lastSavedSnapshot && _stableStringify(_lastSavedSnapshot) === _stableStringify(snap)) return;
  // Push the PREVIOUS state to undo stack (so we can go back to it)
  if (_lastSavedSnapshot !== null) {
    _undoStack.push(_lastSavedSnapshot);
    if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    _redoStack.length = 0;
  }
  _lastSavedSnapshot = snap;
}

/** Undo last action */
export function undo() {
  if (_undoStack.length === 0) return;
  _isUndoRedoAction = true;
  try {
    // Push current state to redo
    _redoStack.push(_getSerializableState());
    const prev = _undoStack.pop();
    _restoreSnapshot(prev);
    _lastSavedSnapshot = prev;
    localStorage.setItem(KEY, JSON.stringify(state));
    // Use render-only path to avoid saveState interference
    renderAll();
  } finally {
    _isUndoRedoAction = false;
  }
}

/** Redo last undone action */
export function redo() {
  if (_redoStack.length === 0) return;
  _isUndoRedoAction = true;
  try {
    // Push current state to undo
    _undoStack.push(_getSerializableState());
    const next = _redoStack.pop();
    _restoreSnapshot(next);
    _lastSavedSnapshot = next;
    localStorage.setItem(KEY, JSON.stringify(state));
    // Use render-only path to avoid saveState interference
    renderAll();
  } finally {
    _isUndoRedoAction = false;
  }
}

export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
export const uid=()=>'id-'+Math.random().toString(36).substring(2,11);
export const esc=s=>String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function saveState(){
  localStorage.setItem(KEY,JSON.stringify(state));
  _recordStateForUndo();
}

export function resetDiagram(){if(confirm('Delete all changes and reset to default?')){localStorage.removeItem(KEY);location.reload();}}
export function resetPositions(){if(confirm('Clear Drag&Drop positions and return to auto-layout?')){state.customPos={};fullUpdate();}}

// fullUpdate will be set by main.js after all modules are loaded
let _fullUpdate = null;
export function setFullUpdate(fn) { _fullUpdate = fn; }
export function fullUpdate() { if (_fullUpdate) _fullUpdate(); }
