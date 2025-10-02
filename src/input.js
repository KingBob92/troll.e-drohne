// input.js
// Keyboard + Touch + Gamepad (PS5/DualSense) Inputs – mit Edge-Triggern

export const keys = {};
export const keyJust = { boost:false }; // Shift-„just pressed“

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k==='shift' || k==='shiftleft' || k==='shiftright') keyJust.boost = true;
});
addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

// ---- Touch-Controls ----
export const mobile = {
  ix: 0, iy: 0,
  boostPressed: false, // Edge
  _active: false, _joyEl: null, _knobEl: null, _dockBtn: null, _boostBtn: null,
};

export function vibrate(ms = 40){
  if (navigator.vibrate) navigator.vibrate(ms);
}
function clamp(v,a,b){ return v<a?a : v>b?b : v; }

function attachJoystick(rootId, knobId){
  const root = document.getElementById(rootId);
  const knob = document.getElementById(knobId);
  if (!root || !knob) return;

  const getXY = (pageX, pageY) => {
    const r = root.getBoundingClientRect();
    const R = r.width/2;
    const dx = pageX - (r.left + R);
    const dy = pageY - (r.top  + R);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / Math.max(R, len);
    const ny = dy / Math.max(R, len);
    return { nx: clamp(nx, -1, 1), ny: clamp(ny, -1, 1) };
  };
  const moveKnob = (nx, ny) => {
    knob.style.left = `${(0.5 + nx * 0.38) * 100}%`;
    knob.style.top  = `${(0.5 + ny * 0.38) * 100}%`;
  };

  const onStart = e => {
    mobile._active = true;
    const t = (e.touches && e.touches[0]) || e;
    const { nx, ny } = getXY(t.pageX, t.pageY);
    mobile.ix = nx; mobile.iy = ny; moveKnob(nx, ny);
    e.preventDefault();
  };
  const onMove = e => {
    if (!mobile._active) return;
    const t = (e.touches && e.touches[0]) || e;
    const { nx, ny } = getXY(t.pageX, t.pageY);
    mobile.ix = nx; mobile.iy = ny; moveKnob(nx, ny);
    e.preventDefault();
  };
  const onEnd = () => { mobile._active=false; mobile.ix=0; mobile.iy=0; moveKnob(0,0); };

  root.addEventListener('pointerdown', onStart);
  root.addEventListener('pointermove', onMove);
  addEventListener('pointerup', onEnd);
  addEventListener('pointercancel', onEnd);
  root.addEventListener('touchstart', onStart, { passive:false });
  root.addEventListener('touchmove', onMove, { passive:false });
  root.addEventListener('touchend', onEnd);
  root.addEventListener('touchcancel', onEnd);

  mobile._joyEl = root; mobile._knobEl = knob;
}

function attachButtons(boostId, dockId, onDock){
  const boost = document.getElementById(boostId);
  const dock  = document.getElementById(dockId);
  if (boost){
    const fire= (e)=>{ mobile.boostPressed = true; e.preventDefault(); };
    boost.addEventListener('pointerdown', fire);
    boost.addEventListener('touchstart',  fire, { passive:false });
  }
  if (dock){
    const go = ()=> onDock && onDock();
    dock.addEventListener('pointerdown', (e)=>{ go(); e.preventDefault(); });
    dock.addEventListener('touchstart',  (e)=>{ go(); e.preventDefault(); }, { passive:false });
  }
  mobile._boostBtn = boost; mobile._dockBtn = dock;
}

export function initTouch(onDock){
  attachJoystick('joy_land', 'knob_land');
  attachButtons('boost_land', 'dock_land', onDock);
}

// ---- Gamepad (PS5 / DualSense) ----
export const gamepad = {
  connected: false,
  ix: 0, iy: 0,
  justBoost: false,   // Square (2) Edge
  justDock:  false,   // Cross  (0) Edge
  _prevBoost: false,
  _prevDock:  false,
};

const DEADZONE = 0.18;
const dz = v => (Math.abs(v) < DEADZONE ? 0 : v);

function pollGamepad(){
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of gps){ if (g && g.connected) { gp = g; break; } }
  if (!gp){
    gamepad.connected = false;
    gamepad.ix = gamepad.iy = 0;
    gamepad.justBoost = false;
    gamepad.justDock = false;
    gamepad._prevBoost = false;
    gamepad._prevDock = false;
    return;
  }
  gamepad.connected = true;

  let x = dz(gp.axes[0] || 0);
  let y = dz(gp.axes[1] || 0);
  const len = Math.hypot(x, y);
  if (len > 1){ x /= len; y /= len; }
  gamepad.ix = x;
  gamepad.iy = y;

  const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const bBoost = btn(2); // Square
  const bDock  = btn(0); // Cross
  gamepad.justBoost = bBoost && !gamepad._prevBoost;
  gamepad.justDock  = bDock  && !gamepad._prevDock;
  gamepad._prevBoost = bBoost;
  gamepad._prevDock  = bDock;
}

export function startGamepadListeners(){
  addEventListener('gamepadconnected',    ()=>{ gamepad.connected = true; });
  addEventListener('gamepaddisconnected', ()=>{ gamepad.connected = false; });
}

// pro Frame
export function pollInputs(){
  pollGamepad();
  // „just“-Flags der Tastatur/Touch werden im Game-Loop nach Gebrauch wieder gelöscht
}
