import { VIEW_W } from './const.js';

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
  loading: $('#loading'), loadBar: $('#bar')?.firstElementChild, loadMsg: $('#loadMsg'),
  a2hs: $('#a2hs'),
};

function viewportSize(){
  const vv = window.visualViewport;
  const vw = Math.floor((vv?.width ?? window.innerWidth));
  const vh = Math.floor((vv?.height ?? window.innerHeight));
  return {vw, vh};
}

export function fit(){
  const {vw, vh} = viewportSize();
  const rat = 1536/1024;
  let w = vw, h = Math.round(w/rat);
  if (h > vh){ h = vh; w = Math.round(h*rat); }
  ui.stage.style.width  = w+'px';
  ui.stage.style.height = h+'px';
}
addEventListener('resize', fit);
if (window.visualViewport){
  visualViewport.addEventListener('resize', fit);
  visualViewport.addEventListener('scroll', fit);
}
fit();

export const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0 || navigator.msMaxTouchPoints>0;

export function chooseControlLayout(){
  const {vw, vh} = viewportSize();
  const portrait = (vh > vw);
  if(!isTouch){
    ui.controlsOverlay.style.display='none';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='none';
    return;
  }
  if(portrait){
    ui.controlsOverlay.style.display='none';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='flex';
    if (ui.howto) ui.howto.innerHTML = 'Bitte das Handy ins Querformat drehen.';
  }else{
    ui.controlsOverlay.style.display='block';
    ui.controlsBar.style.display='none';
    ui.rotate.style.display='none';
    if (ui.howto) ui.howto.innerHTML = 'Links Analog-Stick, rechts Boost/Andocken.';
  }
}
addEventListener('resize', chooseControlLayout);
addEventListener('orientationchange', chooseControlLayout);
if (window.visualViewport){
  visualViewport.addEventListener('resize', chooseControlLayout);
}
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

// Komet
export const cometSprite = img('Assets/PROPS/Comet_1.png');

// -------- Image-Preload für Loading-Screen --------
const IMG_URLS = [
  // Backdrops + Overlay
  'Assets/BACK/BACK_ebene_6.png','Assets/BACK/BACK_ebene_5.png','Assets/BACK/BACK_ebene_4.png',
  'Assets/BACK/BACK_ebene_3.png','Assets/BACK/BACK_ebene_2.png','Assets/BACK/BACK_ebene_1.png',
  'Assets/MAIN_OVERLAY.png',
  // Drone
  'Assets/DROHNE/DROHNE_off.png','Assets/DROHNE/DROHNE_on.png','Assets/DROHNE/DROHNE_boost.png',
  // Props
  'Assets/PROPS/Asteroid_1.png','Assets/PROPS/Asteroid_2.png','Assets/PROPS/Asteroid_3.png',
  'Assets/PROPS/Stone_1.png','Assets/PROPS/Stone_2.png','Assets/PROPS/Stone_3.png',
  'Assets/PROPS/Trash_1.png','Assets/PROPS/Trash_2.png','Assets/PROPS/Trash_3.png','Assets/PROPS/Trash_4.png','Assets/PROPS/Trash_5.png',
  // Comet
  'Assets/PROPS/Comet_1.png'
];

export async function preloadImages(progressCb){
  let done=0,total=IMG_URLS.length;
  const tick=()=>progressCb && progressCb(++done,total);
  await Promise.all(IMG_URLS.map(url=>new Promise(res=>{
    const i=new Image(); i.onload=()=>{tick();res();}; i.onerror=()=>{tick();res();}; i.src=url;
  })));
}
