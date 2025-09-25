import { isTouch, ui } from './assets.js';

export const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

export const mobile = { ix:0, iy:0, boosting:false };

function attachJoystick(wrap, knob){
  if(!wrap) return;
  let active=false, joyId=null;

  const rect = () => wrap.getBoundingClientRect();
  const center = () => { const r=rect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; };

  function setKnob(dx,dy){
    const r=rect(); const R=Math.min(r.width,r.height)/2;
    const mag=Math.hypot(dx,dy); const c=Math.min(mag, R*0.85);
    const nx=(mag?dx/mag:0)*c, ny=(mag?dy/mag:0)*c;
    knob.style.left=(r.width/2+nx)+'px';
    knob.style.top =(r.height/2+ny)+'px';
    knob.style.transform='translate(-50%,-50%)';
    mobile.ix = (mag?dx/mag:0);
    mobile.iy = (mag?dy/mag:0);
  }
  function reset(){
    const r=rect();
    knob.style.left=(r.width/2)+'px';
    knob.style.top =(r.height/2)+'px';
    knob.style.transform='translate(-50%,-50%)';
    mobile.ix=0; mobile.iy=0;
  }
  reset();

  // Reiner Touch-Handler (echtes Multitouch)
  wrap.addEventListener('touchstart', e=>{
    if(active) return;
    const t=e.changedTouches[0]; joyId=t.identifier; active=true;
    const c=center(); setKnob(t.clientX-c.x, t.clientY-c.y);
    e.preventDefault();
  }, {passive:false});

  wrap.addEventListener('touchmove', e=>{
    if(!active) return;
    for(const t of e.changedTouches){
      if(t.identifier===joyId){
        const c=center(); setKnob(t.clientX-c.x, t.clientY-c.y);
        e.preventDefault(); break;
      }
    }
  }, {passive:false});

  function endFrom(list){
    if(!active) return;
    for(const t of list){ if(t.identifier===joyId){ active=false; joyId=null; reset(); break; } }
  }
  wrap.addEventListener('touchend',   e=>{ endFrom(e.changedTouches); /* kein preventDefault nötig */ }, {passive:true});
  wrap.addEventListener('touchcancel',e=>{ endFrom(e.changedTouches); }, {passive:true});

  // WICHTIG: Kein Pointer-Fallback auf Touch-Geräten, sonst „pointerup“ vom 2. Finger killt den Joystick!
  if (!('ontouchstart' in window)) {
    wrap.addEventListener('pointerdown', e=>{active=true; const c=center(); setKnob(e.clientX-c.x,e.clientY-c.y)});
    addEventListener('pointermove', e=>{ if(!active) return; const c=center(); setKnob(e.clientX-c.x,e.clientY-c.y) });
    addEventListener('pointerup',   ()=>{active=false; reset()});
  }
}

function wireButtons(boostBtn, dockBtn, onDock){
  const setBoost=v=>{ mobile.boosting=v; };
  const stop = e => { e.stopPropagation(); e.preventDefault(); };

  ['touchstart','pointerdown','mousedown'].forEach(ev=>boostBtn?.addEventListener(ev, e=>{ setBoost(true); stop(e); }, {passive:false}));
  ['touchend','touchcancel','pointerup','mouseup','mouseleave'].forEach(ev=>boostBtn?.addEventListener(ev, e=>{ setBoost(false); }, {passive:true}));

  ['touchstart','pointerdown','mousedown'].forEach(ev=>dockBtn?.addEventListener(ev, e=>{ onDock(); stop(e); }, {passive:false}));
}

export function initTouch(onDock){
  if(!isTouch) return;
  // Landscape overlay
  attachJoystick(document.getElementById('joy_land'), document.getElementById('knob_land'));
  wireButtons(document.getElementById('boost_land'), document.getElementById('dock_land'), onDock);

  // Portrait bar (deaktiviert)
  // attachJoystick(document.getElementById('joy_port'), document.getElementById('knob_port'));
  // wireButtons(document.getElementById('boost_port'), document.getElementById('dock_port'), onDock);

  ui.howto.innerHTML = 'Links <b>Analog-Stick</b>, rechts <b>Boost</b> &amp; <b>Andocken</b>.';
}

export function vibrate(pattern){
  if(navigator.vibrate) navigator.vibrate(pattern);
  else{
    // Fallback: Tint + Shake
    ui.hitTint.classList.add('show');
    ui.stage.classList.remove('shake'); void ui.stage.offsetWidth; ui.stage.classList.add('shake');
    setTimeout(()=>ui.hitTint.classList.remove('show'), 120);
  }
}
