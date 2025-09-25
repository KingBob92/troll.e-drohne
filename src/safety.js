// safety.js
import { DEBUG } from './const.js';

let box = null, last = performance.now(), frames = 0, acc = 0, fps = 0;

function ensureOverlay(){
  if (!DEBUG || box) return;
  box = document.createElement('div');
  box.style.cssText = `
    position:fixed; right:10px; top:10px; z-index:99999;
    background:#0f1322cc; color:#e8f0ff; border:1px solid #2a3355;
    border-radius:8px; padding:8px 10px; font:12px/1.35 system-ui,Segoe UI,Roboto,Arial,sans-serif;
    pointer-events:none; user-select:none; white-space:pre; min-width:220px;
  `;
  box.textContent = 'FPS: —';
  document.body.appendChild(box);
}

function fmt(n, d=1){ return n.toFixed(d).padStart(4,' '); }

export function safetyInit(){
  if (!DEBUG) return;
  console.info('[SAFETY] Debug aktiv (via ?debug=1)');
  ensureOverlay();

  // Sanity-Checks
  const cvs = document.querySelector('#game');
  if (!cvs) console.warn('[SAFETY] Canvas #game fehlt?');
  const ctx = cvs?.getContext?.('2d');
  if (!ctx) console.warn('[SAFETY] 2D-Context nicht verfügbar.');

  let lastFrameTs = performance.now();

  function tick(){
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now; frames++; acc += dt;

    // Glättung der FPS über 0.5s
    if (acc >= 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; }

    // Framezeit (seit letztem drawFrame-Ende)
    const frameMs = now - lastFrameTs; // nur grob, aber hilfreich

    // Game-Snapshot abfragen (falls gesetzt)
    let snap = null;
    try { snap = window.__gameDebug ? window.__gameDebug() : null; } catch { /* noop */ }

    if (box){
      if (snap){
        const { timeLeft, health, obstacles, drone, gremlin, anchor, audio } = snap;
        box.textContent =
`FPS: ${String(fps).padStart(3,' ')}   Frame: ${fmt(frameMs,1)} ms
HP:  ${String(health).padStart(3,' ')}%   Zeit: ${Math.floor(timeLeft/60).toString().padStart(2,'0')}:${String(Math.floor(timeLeft%60)).padStart(2,'0')}
Obs: ${String(obstacles).padStart(3,' ')}  Dock: ${anchor.active? 'ACTIVE' : (anchor.inAnchor?'IN-RANGE':'—')}  hold: ${anchor.active?fmt(Math.max(0,anchor.holdLeft),1)+'s':'—'}
DRV: x=${fmt(drone.x,0)} y=${fmt(drone.y,0)}  vx=${fmt(drone.vx,0)} vy=${fmt(drone.vy,0)}  spd=${fmt(drone.spd,0)}
GRM: dx=${fmt(gremlin.curX,2)} dy=${fmt(gremlin.curY,2)}
AUD: sfx=${audio.sfxUnlocked?'on':'off'} voice=${audio.voiceUnlocked?'on':'off'}`;
      } else {
        box.textContent = `FPS: ${String(fps).padStart(3,' ')}   Frame: ${fmt(frameMs,1)} ms\n(Kein Snapshot)`;
      }
    }

    lastFrameTs = now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
