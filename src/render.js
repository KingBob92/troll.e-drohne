import { VIEW_W, VIEW_H, BG_W, BG_H } from './const.js';
import { ctx, bgLayers, overlay } from './assets.js';

// Parallax
const SCROLL_X_MAX = BG_W - VIEW_W, VSHIFT_MAX = 60;
let mouseX=0, mouseY=0;
export function hookPointer(stageEl){
  stageEl.addEventListener('pointermove', e=>{
    const r=stageEl.getBoundingClientRect();
    mouseX=((e.clientX-r.left)/r.width-0.5)*2;
    mouseY=((e.clientY-r.top)/r.height-0.5)*2;
  });
  stageEl.addEventListener('pointerleave', ()=>{ mouseX=mouseY=0; });
}

export function drawParallax(nx, ny){
  for(const L of bgLayers){
    let sx = Math.round((nx + mouseX*0.05) * SCROLL_X_MAX * L.depth);
    if(sx<0) sx=0; if(sx>SCROLL_X_MAX) sx=SCROLL_X_MAX;
    const vshift = Math.round(((ny-0.5) - mouseY*0.05) * VSHIFT_MAX * L.depth * -1);
    if(L.img.complete && L.img.naturalWidth){
      ctx.drawImage(L.img, sx, 0, VIEW_W, VIEW_H, 0, vshift, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle='#05070e'; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    }
  }
}

export function drawOverlay(){
  if(overlay.complete && overlay.naturalWidth) ctx.drawImage(overlay,0,0,VIEW_W,VIEW_H);
}
