import { VIEW_W, VIEW_H } from './const.js';

export const $ = sel => document.querySelector(sel);

export const cvs = $('#game');
export const ctx = cvs.getContext('2d');
export const ui = {
  time: $('#time'), goal: $('#goal'), sub: $('#subtitle'),
  hpText: $('#hpText'), hpBar: $('#hpBar'),
  start: $('#start'), end: $('#end'),
  endTitle: $('#endTitle'), endMsg: $('#endMsg'),
  btnStart: $('#btnStart'), btnRetry: $('#btnRetry'),
  hitTint: $('#hitTint'),
  howto: $('#howto'),
  controlsOverlay: $('#controlsOverlay'),
  controlsBar: $('#controlsBar'),
  stage: $('#stage'), stageWrap: $('#stageWrap'),
  rotate: $('#rotate'),
};

export function fit(){
  const vw = innerWidth, vh = innerHeight, rat = VIEW_W/VIEW_H;
  let w = vw, h = w/rat;
  if (h > vh){ h = vh; w = h*rat; }
  ui.stage.style.width = w+'px';
  ui.stage.style.height = h+'px';
}
addEventListener('resize', fit); fit();

export const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0 || navigator.msMaxTouchPoints>0;

export function chooseControlLayout(){
  const portrait = matchMedia('(orientation: portrait)').matches || innerHeight>innerWidth;
  if(!isTouch){
    ui.controlsOverlay.style.display='none';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='none';
    return;
  }
  if(portrait){
    // Nur Hinweis anzeigen, keine Controls
    ui.controlsOverlay.style.display='none';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='flex';
    // kurze Anweisung im Startpanel anpassen
    if (ui.howto) ui.howto.innerHTML = 'Bitte das Handy ins Querformat drehen.';
  }else{
    // Landscape: Overlay-Controls an, Portrait-Leiste aus, Hinweis weg
    ui.controlsOverlay.style.display='block';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='none';
    if (ui.howto) ui.howto.innerHTML = 'Links Analog-Stick, rechts Boost/Andocken.';
  }
}
addEventListener('resize', chooseControlLayout);
addEventListener('orientationchange', chooseControlLayout);
chooseControlLayout();

export function img(src){
  const i = new Image();
  i.onload  = () => console.info('[IMG ok] ', src, i.naturalWidth+'x'+i.naturalHeight);
  i.onerror = (e) => console.error('[IMG FAIL]', src, e);
  i.src = src;
  return i;
}

// Grafik
export const bgLayers = [
  {img:img('Assets/BACK/BACK_ebene_6.png'), depth:0.0},
  {img:img('Assets/BACK/BACK_ebene_5.png'), depth:0.2},
  {img:img('Assets/BACK/BACK_ebene_4.png'), depth:0.4},
  {img:img('Assets/BACK/BACK_ebene_3.png'), depth:0.6},
  {img:img('Assets/BACK/BACK_ebene_2.png'), depth:0.8},
  {img:img('Assets/BACK/BACK_ebene_1.png'), depth:1.0}
];
// Overlay
export const overlay = img('Assets/MAIN_OVERLAY.png');

// Drohne
export const dr = {
  off:   img('Assets/DROHNE/DROHNE_off.png'),
  on:    img('Assets/DROHNE/DROHNE_on.png'),
  boost: img('Assets/DROHNE/DROHNE_boost.png'),
};

// Props
export const SPRITES = {
  asteroid: [ img('Assets/PROPS/Asteroid_1.png'), img('Assets/PROPS/Asteroid_2.png'), img('Assets/PROPS/Asteroid_3.png') ],
  stone:    [ img('Assets/PROPS/Stone_1.png'),    img('Assets/PROPS/Stone_2.png'),    img('Assets/PROPS/Stone_3.png') ],
  trash:    [ img('Assets/PROPS/Trash_1.png'),    img('Assets/PROPS/Trash_2.png'),    img('Assets/PROPS/Trash_3.png'), img('Assets/PROPS/Trash_4.png'), img('Assets/PROPS/Trash_5.png') ],
};
