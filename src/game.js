// src/game.js
import { VIEW_W, VIEW_H, WORLD_W, BG_W, CFG, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM,
         THRUST, MAX_SPD, DRAG, GREMLIN_BASE, OBJ_DRAG, WALL_BOUNCE, RESTITUTION, DEBUG,
         OBSTACLE_DENSITY, HUD, COMET } from './const.js';
import { $, cvs, ctx, ui, isTouch, fit, chooseControlLayout, cometSprite, preloadImages } from './assets.js';
import { sfx, music, VOICE_PRI, voice, preloadSFX, preloadVoicesAndMusic, audioCtx } from './audio.js';
import { keys, keyJust, mobile, initTouch, vibrate, gamepad, startGamepadListeners, pollInputs } from './input.js';
import { hookPointer, drawParallax, drawOverlay } from './render.js';
import { SPRITES, dr } from './assets.js';
import { safetyInit } from './safety.js';

// —— Welt-Bounds ——
const BOUNDS = { minX:MARGIN_X, maxX:WORLD_W-MARGIN_X, minY:MARGIN_TOP, maxY:VIEW_H-MARGIN_BOTTOM };
const START_W = 220;
const PROP_LEFT_WALL = BOUNDS.minX + START_W;

// Kamera
const camera = { x:0, y:0 };
const clamp = (v,a,b)=> v<a?a : v>b?b : v;

// UI helpers
function say(s,t){ ui.sub.textContent = s ? `[${s}] ${t}` : ''; }
function fmt(t){ const m=Math.floor(t/60), s=Math.floor(t%60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

// Game state
let gameRunning=false, timeLeft=CFG.TIME_LIMIT, firstCollision=false;
let health=100;
let end10Warned = false;
function updateHP(){
  ui.hpText.textContent = `${health}%`;
  ui.hpBar.style.width = `${Math.max(0,health)}%`;
  ui.hpBar.style.background = health>60 ? '#6bffb0' : health>35 ? '#ffd866' : '#ff6b6b';
}

function applyDamage(amount){
  const prev = health;
  health = Math.max(0, health-amount);
  updateHP();
  vibrate(amount>=15?90:40);

  if(prev>=15 && health<15){ voice.playKey('demage3', VOICE_PRI.demage); sfx.play('max3'); }
  else if(prev>=50 && health<50){ voice.playKey('demage2', VOICE_PRI.demage); sfx.play('max2'); }
  else if(prev>=80 && health<80){ voice.playKey('demage1', VOICE_PRI.demage); sfx.play('max1'); }
  else sfx.play(Math.random()<0.5?'hit1':'hit2');

  if(health<=0){
    gameRunning=false;
    stopDock();
    voice.endPlayed=true; // Voice stop lassen; Endscreen sagt genug
    ui.goal.textContent='Drohne zerstört – Abbruch';
    showEnd(false,'Drohne zerstört','Die Drohne hat zu viel Schaden erlitten.');
  }
}

// —— Drohne ——
const drone={ x:BOUNDS.minX+20, y:(BOUNDS.minY+BOUNDS.maxY)/2, vx:0, vy:0, r:24, boostLeft:0, boostCD:0 };
let wallHitCD = 0;

// —— Gremlin ——
const GREMLIN={ strength:GREMLIN_BASE.strength, targetX:0,targetY:0,curX:0,curY:0,t:0, changeEvery:1.0 };
function retargetGremlin(){
  const a=Math.random()*Math.PI*2, m=0.6+Math.random()*0.9;
  GREMLIN.targetX=Math.cos(a)*m; GREMLIN.targetY=Math.sin(a)*m;
  GREMLIN.changeEvery = GREMLIN_BASE.changeMin + Math.random()*(GREMLIN_BASE.changeMax-GREMLIN_BASE.changeMin);
}
retargetGremlin();
function updGremlin(dt){
  GREMLIN.t+=dt; const f=1-Math.exp(-3.2*dt);
  GREMLIN.curX+=(GREMLIN.targetX-GREMLIN.curX)*f;
  GREMLIN.curY+=(GREMLIN.targetY-GREMLIN.curY)*f;
  if(GREMLIN.t>=GREMLIN.changeEvery){GREMLIN.t=0;retargetGremlin();}
}

// —— Obstacles ——
const obstacles=[];
const rand = a => a[Math.floor(Math.random()*a.length)];
function makeObstacle(cfg){
  const sprite = rand(SPRITES[cfg.kind]);
  const ang=Math.random()*Math.PI*2, spd=cfg.speed??40, mass=cfg.mass??(cfg.big?2.0:1.0);
  let x=cfg.x, y=cfg.y;
  if (x==null){
    do{ x = BOUNDS.minX+START_W+10 + Math.random()*( (BOUNDS.maxX-10)-(BOUNDS.minX+START_W+10) ); }
    while(x<PROP_LEFT_WALL+10);
  }
  if (y==null){ y=BOUNDS.minY+20+Math.random()*(BOUNDS.maxY-BOUNDS.minY-40); }
  return { type:cfg.kind,big:!!cfg.big,dmg:cfg.dmg??(cfg.big?25:5), x,y,
           vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
           r:cfg.r??24, angle:Math.random()*Math.PI*2, angVel:cfg.rot??0.8, sprite, mass };
}
function spawnObs(){
  obstacles.length=0;
  const mul = WORLD_W / VIEW_W;
  const A = Math.round(OBSTACLE_DENSITY.ASTEROID_PER_VIEW * mul);
  const S = Math.round(OBSTACLE_DENSITY.STONE_PER_VIEW   * mul);
  const T = Math.round(OBSTACLE_DENSITY.TRASH_PER_VIEW   * mul);
  for(let i=0;i<A;i++) obstacles.push(makeObstacle({kind:'asteroid', big:true, dmg:25, r:68+Math.random()*10, speed:20+Math.random()*40, rot:(Math.random()*2-1)*0.6}));
  for(let i=0;i<S;i++) obstacles.push(makeObstacle({kind:'stone', big:false, dmg:5, r:25+Math.random()*8, speed:25+Math.random()*55, rot:(Math.random()*2-1)*1.0}));
  for(let i=0;i<T;i++) obstacles.push(makeObstacle({kind:'trash', big:false, dmg:1, r:10+Math.random()*6, speed:50+Math.random()*60, rot:(Math.random()*2-1)*1.4, mass:0.4}));
}

// —— Anchor ——
const anchor={ baseX: BOUNDS.maxX-180, baseY:(BOUNDS.minY+BOUNDS.maxY)*0.45, rO:82, rI:42, holdLeft:CFG.DOCK_HOLD, active:false, t:0,
               ampX:26, ampY:14, speedX:0.6, speedY:0.9, phase:Math.PI/4, x:0,y:0 };
anchor.x=anchor.baseX; anchor.y=anchor.baseY;
function updAnchor(dt){
  anchor.t+=dt;
  anchor.x=anchor.baseX+Math.cos(anchor.t*anchor.speedX+anchor.phase)*anchor.ampX;
  anchor.y=anchor.baseY+Math.sin(anchor.t*anchor.speedY)*anchor.ampY;
}

let dockAttempt=false,inAnchor=false,dockNode=null;
function tryDock(){
  if(!gameRunning) return;
  inAnchor = ((drone.x-anchor.x)**2 + (drone.y-anchor.y)**2) <= (drone.r+anchor.rI)*(drone.r+anchor.rI);
  if(!inAnchor) return;
  dockAttempt=true; anchor.active=true; anchor.holdLeft=CFG.DOCK_HOLD;
  ui.goal.textContent='Andocken… Position halten';
  stopDock();
  dockNode = sfx.play('count');
}
function stopDock(){
  if(dockNode && dockNode.stop){ try{dockNode.stop();}catch(_){ } dockNode=null; }
}
function updDock(dt){
  inAnchor = ((drone.x-anchor.x)**2 + (drone.y-anchor.y)**2) <= (drone.r+anchor.rI)*(drone.r+anchor.rI);
  if(!dockAttempt) return;
  if(!inAnchor){ dockAttempt=false; anchor.active=false; ui.goal.textContent='Andocken abgebrochen – Position halten & E drücken'; stopDock(); return; }
  anchor.holdLeft -= dt;
  if(anchor.holdLeft<=0){
    gameRunning=false; anchor.active=false; dockAttempt=false; stopDock();
    ui.goal.textContent='Andocken erfolgreich';
    sfx.play('dockok'); voice.endPlayed=true; voice.playKey('end', VOICE_PRI.end, {scheduleNextDialog:false});
    showEnd(true,'Andocken erfolgreich','Die Wartungs-Drohne hat den Ankerpunkt erreicht.');
  }
}

// —— HUD: Richtungs-Pfeil mit Distanz-Badge ——
function drawAnchorHUD(screenX, screenY){
  const onX = screenX>=0 && screenX<=VIEW_W;
  const onY = screenY>=0 && screenY<=VIEW_H;
  if (onX && onY) return;

  const dxW = anchor.x - drone.x;
  const dyW = anchor.y - drone.y;
  const dist = Math.hypot(dxW, dyW);

  const A = HUD.ARROW;
  let color = A.COL_FAR;
  if (dist < A.NEAR) color = A.COL_NEAR;
  else if (dist < A.MID) color = A.COL_MID;

  let alpha = 1.0;
  if (dist < A.NEAR){
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(2*Math.PI*A.BLINK_HZ * t);
    alpha = 0.55 + 0.45 * pulse;
  }

  const tNorm = Math.max(0, Math.min(1, dist / A.MID));
  const halfLen = Math.round(A.SIZE_MIN + (A.SIZE_MAX - A.SIZE_MIN) * (1 - tNorm));

  const cx=VIEW_W/2, cy=VIEW_H/2;
  const dx=screenX-cx, dy=screenY-cy;
  const ang=Math.atan2(dy,dx);
  let x = cx + Math.cos(ang) * (VIEW_W/2 - A.MARGIN);
  let y = cy + Math.sin(ang) * (VIEW_H/2 - A.MARGIN);
  x = clamp(x, A.MARGIN, VIEW_W-A.MARGIN);
  y = clamp(y, A.MARGIN, VIEW_H-A.MARGIN);

  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  ctx.fillStyle=color;
  ctx.strokeStyle='rgba(15,40,35,0.95)';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo( halfLen, 0);
  ctx.lineTo(-halfLen, 9);
  ctx.lineTo(-halfLen*0.45, 0);
  ctx.lineTo(-halfLen,-9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const meters = Math.max(0, Math.round(dist));
  const label = `${meters} m`;

  const badgeOff = 20;
  const bx = 0, by = -badgeOff;
  ctx.translate(bx, by);
  ctx.rotate(-ang);

  ctx.font = '600 13px system-ui,Segoe UI,Roboto,Arial';
  const w = Math.ceil(ctx.measureText(label).width) + 12;
  const h = 20;
  const rx = -Math.floor(w/2), ry = -h;
  const r = 9;

  ctx.fillStyle = 'rgba(10,20,40,0.85)';
  ctx.strokeStyle = 'rgba(35,60,100,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx+r, ry);
  ctx.lineTo(rx+w-r, ry);
  ctx.quadraticCurveTo(rx+w, ry, rx+w, ry+r);
  ctx.lineTo(rx+w, ry+h-r);
  ctx.quadraticCurveTo(rx+w, ry+h, rx+w-r, ry+h);
  ctx.lineTo(rx+r, ry+h);
  ctx.quadraticCurveTo(rx, ry+h, rx, ry+h-r);
  ctx.lineTo(rx, ry+r);
  ctx.quadraticCurveTo(rx, ry, rx+r, ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(230,240,255,0.98)';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, rx + w/2, ry + h/2);
  ctx.restore();
}

// —— Anchor im Screen zeichnen ——
function drawAnchorScreen(){
  const sx = anchor.x - camera.x;
  const sy = anchor.y - camera.y;
  const visible = sx>-anchor.rO && sx<(VIEW_W+anchor.rO) && sy>-anchor.rO && sy<(VIEW_H+anchor.rO);

  if(visible){
    const pulse=0.6+0.4*Math.sin(performance.now()/400);
    ctx.strokeStyle=`rgba(120,255,160,${0.5+0.35*pulse})`;
    ctx.lineWidth=6; ctx.beginPath(); ctx.arc(sx,sy,anchor.rO,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=3; ctx.beginPath(); ctx.arc(sx,sy,anchor.rI*1.25,0,Math.PI*2); ctx.stroke();
    if(anchor.active){
      const total=CFG.DOCK_HOLD, remain=Math.max(0,anchor.holdLeft);
      const p=1 - (remain/total);
      const progR = anchor.rI + (anchor.rO - anchor.rI) * (1 - p);
      ctx.strokeStyle='rgba(120,255,200,0.9)';
      ctx.lineWidth=5.5; ctx.beginPath(); ctx.arc(sx,sy,progR,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(120,255,160,0.16)'; ctx.beginPath(); ctx.arc(sx,sy,anchor.rO,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#6bffb0'; ctx.font='600 18px system-ui,Segoe UI,Roboto,Arial'; ctx.textAlign='center';
      ctx.fillText(`Andocken… (${remain.toFixed(1)} s)`, sx, sy-(anchor.rO+18));
    }
  }
  return { visible, sx, sy };
}

// —— Komet (selten, spontan) ——
let comet = null;

function maybeSpawnComet(dt){
  if (comet) return;
  const p = dt / COMET.MEAN_INTERVAL; // Poisson
  if (Math.random() < p){
    const y = Math.round( MARGIN_TOP + COMET.Y_MARGIN + Math.random()*( (VIEW_H - MARGIN_TOP - MARGIN_BOTTOM) - COMET.Y_MARGIN*2 ) );
    const speed = -(COMET.SPEED_MIN + Math.random()*(COMET.SPEED_MAX - COMET.SPEED_MIN));
    const x = camera.x + VIEW_W + 100;
    comet = { x, y, vx: speed, r: COMET.RADIUS, drawW: 420, drawH: 180 };
  }
}
function updateComet(dt){
  if (!comet) return;
  comet.x += comet.vx * dt;
  if (comet.x < camera.x - COMET.DESPAWN_PAD){ comet = null; }
}
function drawComet(){
  if (!comet) return;
  const sx = Math.round(comet.x - camera.x);
  const sy = Math.round(comet.y - camera.y);
  if (sx > -comet.drawW && sx < VIEW_W + comet.drawW && sy > -comet.drawH && sy < VIEW_H + comet.drawH){
    if (cometSprite.complete && cometSprite.naturalWidth){
      ctx.drawImage(cometSprite, sx - comet.drawW/2, sy - comet.drawH/2, comet.drawW, comet.drawH);
    } else {
      ctx.fillStyle='#ff9b3b'; ctx.beginPath(); ctx.arc(sx, sy, comet.r, 0, Math.PI*2); ctx.fill();
    }
  }
}
function cometCollisions(){
  if (!comet) return;
  const headX = comet.x + COMET.HEAD_OFFSET_X;
  const headY = comet.y;

  // Drohne
  const dxD = drone.x - headX, dyD = drone.y - headY;
  const d2D = dxD*dxD + dyD*dyD, rSumD = comet.r + drone.r;
  if (d2D < rSumD*rSumD){
    const d = Math.sqrt(d2D)||1, nx = dxD/d, ny = dyD/d;
    const j = Math.abs(comet.vx) * 2.2;
    drone.vx += nx * j; drone.vy += ny * (j*0.6);
    if (gameRunning) applyDamage(COMET.DAMAGE);
    const overlap = (rSumD - d);
    drone.x += nx * overlap * 0.8; drone.y += ny * overlap * 0.8;
  }

  // Hindernisse
  for (const o of obstacles){
    const dx = o.x - headX, dy = o.y - headY;
    const rSum = o.r + comet.r;
    const d2 = dx*dx + dy*dy;
    if (d2 >= rSum*rSum) continue;
    const d = Math.sqrt(d2)||1, nx = dx/d, ny = dy/d;
    const overlap = (rSum - d);
    o.x += nx * overlap * 1.05; o.y += ny * 1.05;
    const push = Math.abs(comet.vx) * COMET.PUSH_FORCE;
    o.vx = o.vx * 0.5 + (-Math.abs(push) * (0.6 + 0.4*Math.random())) * 1.0;
    o.vy = o.vy * 0.5 + (ny * push * 0.3);
  }
}

// —— Obstacles update/draw ——
function updDrawObstacles(dt){
  for(const o of obstacles){
    o.vx -= o.vx * OBJ_DRAG * dt; o.vy -= o.vy * OBJ_DRAG * dt;
    o.x += o.vx * dt; o.y += o.vy * dt; o.angle += o.angVel * dt;
    if (o.x - o.r < BOUNDS.minX){ o.x = BOUNDS.minX + o.r; o.vx = Math.abs(o.vx)*WALL_BOUNCE; }
    if (o.x + o.r > BOUNDS.maxX){ o.x = BOUNDS.maxX - o.r; o.vx = -Math.abs(o.vx)*WALL_BOUNCE; }
    if (o.y - o.r < BOUNDS.minY){ o.y = BOUNDS.minY + o.r; o.vy = Math.abs(o.vy)*WALL_BOUNCE; }
    if (o.y + o.r > BOUNDS.maxY){ o.y = BOUNDS.maxY - o.r; o.vy = -Math.abs(o.vy)*WALL_BOUNCE; }
    if (o.x - o.r < PROP_LEFT_WALL){ o.x = PROP_LEFT_WALL + o.r; o.vx = Math.abs(o.vx)*WALL_BOUNCE; }
  }
  for(let i=0;i<obstacles.length;i++){
    const A=obstacles[i];
    for(let j=i+1;j<obstacles.length;j++){
      const B=obstacles[j];
      const dx=B.x-A.x, dy=B.y-A.y, rSum=A.r+B.r, d2=dx*dx+dy*dy;
      if(d2>0 && d2<rSum*rSum){
        const d=Math.sqrt(d2)||1, nx=dx/d, ny=dy/d;
        const overlap=(rSum-d), mA=A.mass??1, mB=B.mass??1, sum=mA+mB;
        const aPush=overlap*(mB/sum), bPush=overlap*(mA/sum);
        A.x -= nx*aPush; A.y -= ny*aPush; B.x += nx*bPush; B.y += ny*bPush;
        const relVx=B.vx-A.vx, relVy=B.vy-A.vy, sepV=relVx*nx+relVy*ny;
        if(sepV<0){
          const j=-(1+RESTITUTION)*sepV/(1/mA+1/mB), jx=j*nx, jy=j*ny;
          A.vx-=jx/mA; A.vy-=jy/mA; B.vx+=jx/mB; B.vy+=jy/mB;
        }
      }
    }
  }
  for(const o of obstacles){
    const sx = o.x - camera.x;
    const sy = o.y - camera.y;
    if (sx < -o.r-80 || sx > VIEW_W+o.r+80 || sy < -o.r-80 || sy > VIEW_H+o.r+80) continue;
    if (o.sprite && o.sprite.complete && o.sprite.naturalWidth){
      const size=o.r*2; ctx.save(); ctx.translate(sx,sy); ctx.rotate(o.angle);
      ctx.drawImage(o.sprite,-size/2,-size/2,size,size); ctx.restore();
    } else { ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(sx,sy,o.r,0,Math.PI*2); ctx.fill(); }
  }
}

// —— Drone collisions ——
function handleDroneCollisions(){
  for(const o of obstacles){
    const dx=drone.x-o.x, dy=drone.y-o.y, rSum=drone.r+o.r, d2=dx*dx+dy*dy;
    if(d2>rSum*rSum) continue;
    const d=Math.sqrt(d2)||1, ux=dx/d, uy=dy/d;
    const rel=(drone.vx-o.vx)*ux+(drone.vy-o.vy)*uy;
    const mD=1.0, mO=o.mass??(o.big?2.0:1.0), rest=0.7;
    const j=-(1+rest)*rel/(1/mD+1/mO);
    let df=1.0, of=1.0; if(o.type==='trash'){ df=0.25; of=1.2; }
    drone.vx += (j*ux/mD)*df; drone.vy += (j*uy/mD)*df;
    o.vx     -= (j*ux/mO)*of; o.vy     -= (j*uy/mO)*of;
    const overlap=rSum-d;
    if(overlap>0){
      const push=overlap*0.7; drone.x+=ux*push; drone.y+=uy*push;
      if(o.type==='trash'){o.x-=ux*push*0.4; o.y-=uy*push*0.4;}
    }
    if(gameRunning){ applyDamage(o.dmg); }
    if(!firstCollision){ firstCollision=true; say('Rohland','Sanfter. Du fliegst das Ding wie ’n Presslufthammer.'); }
  }
}

// —— Drohne + Inputs (mit mobilem Boost-Plus) ——
function drawDrone(dt){
  pollInputs();

  updGremlin(dt);
  if (wallHitCD>0) wallHitCD -= dt;

  let ix=0, iy=0;
  if (gamepad.connected){ ix = gamepad.ix; iy = gamepad.iy; }
  else if (isTouch){ ix = mobile.ix; iy = mobile.iy; }
  else {
    if(keys['a']||keys['arrowleft'])  ix-=1;
    if(keys['d']||keys['arrowright']) ix+=1;
    if(keys['w']||keys['arrowup'])    iy-=1;
    if(keys['s']||keys['arrowdown'])  iy+=1;
  }

  let accel=THRUST, maxSpd=MAX_SPD;

  // Boost nur bei „just pressed“
  const boostJust = gamepad.justBoost || mobile.boostPressed || keyJust.boost;
  if (drone.boostCD<=0 && boostJust){ drone.boostLeft = CFG.BOOST_TIME; }
  mobile.boostPressed = false; keyJust.boost = false;

  if(drone.boostLeft>0){
    const boostMul = isTouch ? 1.15 : 1.0; // Mobil minimal kräftiger
    accel*=CFG.BOOST_FACTOR*boostMul; maxSpd*=CFG.BOOST_FACTOR*boostMul;
    drone.boostLeft-=dt;
    if(drone.boostLeft<=0){ drone.boostLeft=0; drone.boostCD=CFG.BOOST_COOLDOWN; }
  } else if(drone.boostCD>0){ drone.boostCD-=dt; }

  if(ix||iy){
    const l=Math.hypot(ix,iy)||1; ix/=l; iy/=l;
    drone.vx+=ix*accel*dt; drone.vy+=iy*accel*dt;
  }

  drone.vx += GREMLIN.curX * GREMLIN.strength * dt;
  drone.vy += GREMLIN.curY * GREMLIN.strength * dt;
  drone.vx -= drone.vx*Math.min(1,DRAG*dt);
  drone.vy -= drone.vy*Math.min(1,DRAG*dt);

  const sp=Math.hypot(drone.vx,drone.vy);
  if(sp>maxSpd){ const s=maxSpd/sp; drone.vx*=s; drone.vy*=s; }

  drone.x += drone.vx*dt; drone.y += drone.vy*dt;

  let hitWall=false;
  if (drone.x < BOUNDS.minX){ drone.x=BOUNDS.minX; drone.vx=Math.abs(drone.vx)*0.6; hitWall=true; }
  if (drone.x > BOUNDS.maxX){ drone.x=BOUNDS.maxX; drone.vx=-Math.abs(drone.vx)*0.6; hitWall=true; }
  if (drone.y < BOUNDS.minY){ drone.y=BOUNDS.minY; drone.vy=Math.abs(drone.vy)*0.6; hitWall=true; }
  if (drone.y > BOUNDS.maxY){ drone.y=BOUNDS.maxY; drone.vy=-Math.abs(drone.vy)*0.6; hitWall=true; }
  if (gameRunning && hitWall && wallHitCD<=0){ applyDamage(5); wallHitCD=0.5; }

  camera.x = clamp(drone.x - VIEW_W/2, 0, WORLD_W - VIEW_W);
  camera.y = 0;

  if (gamepad.justDock) tryDock();

  const sx = drone.x - camera.x;
  const sy = drone.y - camera.y;
  const spr = (drone.boostLeft>0 && dr.boost.complete && dr.boost.naturalWidth) ? dr.boost :
              (sp>40 && dr.on.complete && dr.on.naturalWidth) ? dr.on :
              dr.off;
  const size=64, half=size/2;
  if(spr.complete && spr.naturalWidth) ctx.drawImage(spr, Math.round(sx-half), Math.round(sy-half), size, size);
  else { ctx.fillStyle='#5078c8'; ctx.fillRect(sx-20,sy-14,40,28); }
}

// —— Main loop ——
let last = performance.now()/1000;
function loop(){
  const now=performance.now()/1000, dt=Math.min(0.033, now-last); last=now;

  pollInputs();
  maybeSpawnComet(dt);
  updAnchor(dt);
  updateComet(dt);

  drawFrame(dt);
  requestAnimationFrame(loop);
}

function drawFrame(dt){
  const camNx = (WORLD_W - VIEW_W) > 0 ? (camera.x / (WORLD_W - VIEW_W)) : 0;
  const camNy = (drone.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY);
  drawParallax(camNx, camNy);

  const anchorInfo = drawAnchorScreen();
  updDrawObstacles(dt);
  drawComet();

  if (gameRunning) drawDrone(dt); else drawDrone(0);
  handleDroneCollisions();
  cometCollisions();

  drawOverlay();
  if (!anchorInfo.visible) drawAnchorHUD(anchorInfo.sx, anchorInfo.sy);

  if(gameRunning){
    timeLeft -= dt;
    if (!end10Warned && timeLeft <= 10) {
      end10Warned = true;
      voice.end10Played = true;
      voice.playKey('end10', VOICE_PRI.end10);
    }
    if(timeLeft<=0){
      timeLeft=0; gameRunning=false; say('Rüdiger','System hat abgebrochen… Mist.');
      ui.goal.textContent='Sicherheitsprotokoll aktiviert – Abbruch';
      stopDock(); voice.endPlayed=true;
      showEnd(false,'Zeit abgelaufen','Die Drohne hat es nicht rechtzeitig geschafft.');
    } else if(Math.ceil(timeLeft)===CFG.LOW_WARN){
      ui.time.style.color='#ff5c5c';
    }
    updDock(dt);
  }
  ui.time.textContent = fmt(timeLeft);
}

function showEnd(ok,title,msg){
  ui.endTitle.textContent=title;
  ui.endMsg.textContent=msg;
  ui.end.style.display='flex';
}

// —— Loading / Start ——
// Fortschritt: Wir zeigen *Images + SFX* (kritisch), Voices/Music später
function setLoadProgress(done,total){
  const p = total? Math.round(done*100/total):100;
  if (ui.loadBar) ui.loadBar.style.width = p+'%';
  if (ui.loadMsg) ui.loadMsg.textContent = p+'%';
}
function hide(el){ if(!el) return; el.style.display='none'; el.classList.add('hide'); }
function showFlex(el){ if(!el) return; el.classList.remove('hide'); el.style.display='flex'; }
function showStartPanel(){ hide(ui.loading); showFlex(ui.start); }

async function preloadCritical(){
  // 1) Bilder
  let imgTotal=0;
  await preloadImages((d,t)=>{ imgTotal=t; setLoadProgress(d,t); });
  // 2) SFX (WebAudio) – zählt hinter die Bilder
  await preloadSFX((d,t)=>{ setLoadProgress(imgTotal + d, imgTotal + t); });
}

async function preloadBackground(){
  // Voices & Music nach Start (kein UI-Block)
  await preloadVoicesAndMusic();
}

async function startGame(){
  try{
    // Audio-Contexts freigeben
    if (audioCtx && audioCtx.state !== 'running'){
      try { await audioCtx.resume(); } catch {}
    }
    await sfx.unlock();
    await voice.unlock();

    // Start-SFX (WebAudio -> extrem niedrige Latenz)
    const node = sfx.play('start', { volume: 1.0 });

    const startVoiceAndMusic = () => {
      voice.playKey('start', VOICE_PRI.start);
      music.currentTime = 0;
      music.volume = 0.0;
      music.play().catch(()=>{});
      const t0 = performance.now();
      const fade = ()=> {
        const dt = (performance.now() - t0) / 1000;
        music.volume = Math.min(0.9, dt * 0.9);
        if (music.volume < 0.9) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    };

    let done=false;
    if (node) node.onended = ()=>{ if(!done){done=true; startVoiceAndMusic();} };
    setTimeout(()=>{ if(!done){done=true; startVoiceAndMusic();} }, 1200);

    // Spiel los
    gameRunning=true; timeLeft=CFG.TIME_LIMIT; firstCollision=false; health=100; updateHP();
    hide(ui.start);
    if (isTouch && ui.howto) ui.howto.innerHTML = 'Links Analog-Stick, Boost tippen (Square), Andocken (X/E).';

    clearTimeout(voice.dialogTimer);
    voice.dialogTimer = setTimeout(()=>voice.playRandomDialog(), 4000);

    // Stimmen & Musik-Decode jetzt im Hintergrund anschieben
    setTimeout(()=>{ preloadBackground(); }, 300);

  } catch(err){
    console.error('[startGame] Fehler:', err);
  }
}

// Buttons
ui.btnStart?.addEventListener('click', ()=> startGame());
$('#btnRetry')?.addEventListener('click', ()=> location.reload());
addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='e') tryDock(); });

// Init
initTouch(tryDock);
startGamepadListeners();
hookPointer(ui.stage);
fit(); chooseControlLayout();
spawnObs();
updateHP();
ui.time.textContent = fmt(timeLeft);
safetyInit();

// Preload (kritisch) und dann Startpanel
preloadCritical().then(showStartPanel);
// Fallback, falls irgendwas hängt
setTimeout(()=>{ if (ui.loading && ui.loading.style.display!=='none') showStartPanel(); }, 1800);

// Debug
if (DEBUG) {
  window.__gameDebug = () => {
    const spd = Math.hypot(drone.vx, drone.vy);
    return {
      timeLeft,
      health,
      obstacles: obstacles.length,
      drone: { x: drone.x, y: drone.y, vx: drone.vx, vy: drone.vy, spd },
      camera: { x: camera.x },
      gremlin: { curX: GREMLIN.curX, curY: GREMLIN.curY },
      anchor: { inAnchor, active: anchor.active, holdLeft: anchor.holdLeft, wx: anchor.x, wy: anchor.y },
      comet: comet ? { x: comet.x, y: comet.y, vx: comet.vx } : null,
      audio: {
        webaudio: !!audioCtx, ctxState: audioCtx?.state,
        sfxUnlocked: sfx.unlocked, voiceUnlocked: voice.unlocked,
      }
    };
  };
}

requestAnimationFrame(loop);
