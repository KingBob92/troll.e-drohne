// src/game.js
import { VIEW_W, VIEW_H, BG_W, CFG, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM,
         THRUST, MAX_SPD, DRAG, GREMLIN_BASE, OBJ_DRAG, WALL_BOUNCE, RESTITUTION } from './const.js';
import { $, cvs, ctx, ui, isTouch, fit, chooseControlLayout } from './assets.js';
import { sfx, music, VOICE_PRI, voice } from './audio.js';
import { keys, mobile, initTouch, vibrate } from './input.js';
import { hookPointer, drawParallax, drawOverlay } from './render.js';
import { SPRITES, dr } from './assets.js';

// TEMP-SHIM: Alte Funktionssignatur aus der Single-File-Version
function stopDockCount(){ try { stopDock(); } catch(_) {} }


// Bounds & Start-/Left-Wall
const BOUNDS = { minX:MARGIN_X, maxX:VIEW_W-MARGIN_X, minY:MARGIN_TOP, maxY:VIEW_H-MARGIN_BOTTOM };
const START_W = 220; const PROP_LEFT_WALL = BOUNDS.minX + START_W;

// UI helpers
function say(s,t){ ui.sub.textContent = s ? `[${s}] ${t}` : ''; }
function fmt(t){ const m=Math.floor(t/60), s=Math.floor(t%60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

// Game state
let gameRunning=false, timeLeft=CFG.TIME_LIMIT, firstCollision=false;
let health=100;
function updateHP(){
  ui.hpText.textContent = `${health}%`;
  ui.hpBar.style.width = `${Math.max(0,health)}%`;
  ui.hpBar.style.background = health>60 ? '#6bffb0' : health>35 ? '#ffd866' : '#ff6b6b';
}

// —— FIX: stopDock() statt stopDockCount() verwenden ——
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
    stopDock();                 // <— HIER lag der Crash
    voice.endPlayed=true; voice.stop();
    ui.goal.textContent='Drohne zerstört – Abbruch';
    showEnd(false,'Drohne zerstört','Die Drohne hat zu viel Schaden erlitten.');
  }
}

// Drone
const drone={ x:BOUNDS.minX+20, y:(BOUNDS.minY+BOUNDS.maxY)/2, vx:0, vy:0, r:24, boostLeft:0, boostCD:0 };
let wallHitCD = 0;

// Gremlin
const GREMLIN={ strength:GREMLIN_BASE.strength, targetX:0,targetY:0,curX:0,curY:0,t:0, changeEvery:1.0 };
function retargetGremlin(){ const a=Math.random()*Math.PI*2, m=0.6+Math.random()*0.9; GREMLIN.targetX=Math.cos(a)*m; GREMLIN.targetY=Math.sin(a)*m; GREMLIN.changeEvery = GREMLIN_BASE.changeMin + Math.random()*(GREMLIN_BASE.changeMax-GREMLIN_BASE.changeMin); }
retargetGremlin();
function updGremlin(dt){ GREMLIN.t+=dt; const f=1-Math.exp(-3.2*dt); GREMLIN.curX+=(GREMLIN.targetX-GREMLIN.curX)*f; GREMLIN.curY+=(GREMLIN.targetY-GREMLIN.curY)*f; if(GREMLIN.t>=GREMLIN.changeEvery){GREMLIN.t=0;retargetGremlin();} }

// Obstacles
const obstacles=[];
const rand = a => a[Math.floor(Math.random()*a.length)];
function makeObstacle(cfg){
  const sprite = rand(SPRITES[cfg.kind]);
  const ang=Math.random()*Math.PI*2, spd=cfg.speed??40, mass=cfg.mass??(cfg.big?2.0:1.0);
  let x=cfg.x, y=cfg.y;
  if (x==null){ do{x=BOUNDS.minX+START_W+10+Math.random()*((BOUNDS.maxX-10)-(BOUNDS.minX+START_W+10));} while(x<PROP_LEFT_WALL+10); }
  if (y==null){ y=BOUNDS.minY+20+Math.random()*(BOUNDS.maxY-BOUNDS.minY-40); }
  return { type:cfg.kind,big:!!cfg.big,dmg:cfg.dmg??(cfg.big?15:5), x,y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
           r:cfg.r??24, angle:Math.random()*Math.PI*2, angVel:cfg.rot??0.8, sprite, mass };
}
function spawnObs(){
  obstacles.length=0;
  for(let i=0;i<5;i++) obstacles.push(makeObstacle({kind:'asteroid', big:true, dmg:15, r:38+Math.random()*10, speed:20+Math.random()*40, rot:(Math.random()*2-1)*0.6}));
  for(let i=0;i<8;i++) obstacles.push(makeObstacle({kind:'stone', big:false, dmg:5, r:20+Math.random()*8, speed:25+Math.random()*55, rot:(Math.random()*2-1)*1.0}));
  for(let i=0;i<12;i++) obstacles.push(makeObstacle({kind:'trash', big:false, dmg:5, r:15+Math.random()*6, speed:30+Math.random()*60, rot:(Math.random()*2-1)*1.4, mass:0.4}));
}

// Anchor
const anchor={ baseX: BOUNDS.maxX-120, baseY:(BOUNDS.minY+BOUNDS.maxY)*0.45, rO:52, rI:28, holdLeft:CFG.DOCK_HOLD, active:false, t:0,
               ampX:26, ampY:14, speedX:0.6, speedY:0.9, phase:Math.PI/4, x:0,y:0 };
anchor.x=anchor.baseX; anchor.y=anchor.baseY;
function updAnchor(dt){ anchor.t+=dt; anchor.x=anchor.baseX+Math.cos(anchor.t*anchor.speedX+anchor.phase)*anchor.ampX; anchor.y=anchor.baseY+Math.sin(anchor.t*anchor.speedY)*anchor.ampY; }

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
function stopDock(){ if(dockNode){ try{dockNode.pause(); dockNode.currentTime=0;}catch(_){ } dockNode=null; } }
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
function drawAnchor(){
  const pulse=0.5+0.5*Math.sin(performance.now()/500);
  ctx.strokeStyle=`rgba(120,255,160,${0.5+0.3*pulse})`;
  ctx.lineWidth=6; ctx.beginPath(); ctx.arc(anchor.x,anchor.y,anchor.rO,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth=3; ctx.beginPath(); ctx.arc(anchor.x,anchor.y,anchor.rI*1.2,0,Math.PI*2); ctx.stroke();
  if(anchor.active){
    const total=CFG.DOCK_HOLD, remain=Math.max(0,anchor.holdLeft);
    const p=1 - (remain/total);
    const progR = anchor.rI + (anchor.rO - anchor.rI) * (1 - p);
    ctx.strokeStyle='rgba(120,255,200,0.85)'; ctx.lineWidth=5.5; ctx.beginPath(); ctx.arc(anchor.x,anchor.y,progR,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(120,255,160,0.12)'; ctx.beginPath(); ctx.arc(anchor.x,anchor.y,anchor.rO,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6bffb0'; ctx.font='600 18px system-ui,Segoe UI,Roboto,Arial'; ctx.textAlign='center';
    ctx.fillText(`Andocken… (${remain.toFixed(1)} s)`, anchor.x, anchor.y-(anchor.rO+16));
  }
}

// Obstacles update/draw
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
        if(sepV<0){ const j=-(1+RESTITUTION)*sepV/(1/mA+1/mB), jx=j*nx, jy=j*ny; A.vx-=jx/mA; A.vy-=jy/mA; B.vx+=jx/mB; B.vy+=jy/mB; }
      }
    }
  }
  for(const o of obstacles){
    if (o.sprite && o.sprite.complete && o.sprite.naturalWidth){
      const size=o.r*2; ctx.save(); ctx.translate(o.x,o.y); ctx.rotate(o.angle);
      ctx.drawImage(o.sprite,-size/2,-size/2,size,size); ctx.restore();
    } else { ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill(); }
  }
}

// Drone collisions
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
    const overlap=rSum-d; if(overlap>0){ const push=overlap*0.7; drone.x+=ux*push; drone.y+=uy*push; if(o.type==='trash'){o.x-=ux*push*0.4; o.y-=uy*push*0.4;} }
    if(gameRunning){ applyDamage(o.dmg); }
    if(!firstCollision){ firstCollision=true; say('Rohland','Sanfter. Du fliegst das Ding wie ’n Presslufthammer.'); }
  }
}

// Draw drone & movement
function drawDrone(dt){
  updGremlin(dt);
  if (wallHitCD>0) wallHitCD -= dt;

  let ix=0,iy=0;
  if(isTouch){ ix=mobile.ix; iy=mobile.iy; }
  else{
    if(keys['a']||keys['arrowleft']) ix-=1;
    if(keys['d']||keys['arrowright']) ix+=1;
    if(keys['w']||keys['arrowup']) iy-=1;
    if(keys['s']||keys['arrowdown']) iy+=1;
  }

  let accel=THRUST, maxSpd=MAX_SPD;
  const wantBoost = isTouch ? mobile.boosting : (keys['shift']||keys['shiftleft']||keys['shiftright']);
  if(drone.boostCD<=0 && wantBoost) drone.boostLeft = CFG.BOOST_TIME;
  if(drone.boostLeft>0){ accel*=CFG.BOOST_FACTOR; maxSpd*=CFG.BOOST_FACTOR; drone.boostLeft-=dt; if(drone.boostLeft<=0){drone.boostLeft=0;drone.boostCD=CFG.BOOST_COOLDOWN}}
  else if(drone.boostCD>0){ drone.boostCD-=dt; }

  if(ix||iy){ const l=Math.hypot(ix,iy)||1; ix/=l; iy/=l; drone.vx+=ix*accel*dt; drone.vy+=iy*accel*dt; }
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

  const spr = (drone.boostLeft>0 && dr.boost.complete && dr.boost.naturalWidth) ? dr.boost :
              (sp>40 && dr.on.complete && dr.on.naturalWidth) ? dr.on :
              dr.off;
  const size=64, half=size/2;
  if(spr.complete && spr.naturalWidth) ctx.drawImage(spr, Math.round(drone.x-half), Math.round(drone.y-half), size, size);
  else { ctx.fillStyle='#5078c8'; ctx.fillRect(drone.x-20,drone.y-14,40,28); }

  return {nx:(drone.x-BOUNDS.minX)/(BOUNDS.maxX-BOUNDS.minX),
          ny:(drone.y-BOUNDS.minY)/(BOUNDS.maxY-BOUNDS.minY)};
}

// Main loop
let last = performance.now()/1000;
function loop(){
  const now=performance.now()/1000, dt=Math.min(0.033, now-last); last=now;

  updAnchor(dt);
  const {nx,ny} = drawFrame(dt);
  requestAnimationFrame(loop);
}

function drawFrame(dt){
  const nx=(drone.x-BOUNDS.minX)/(BOUNDS.maxX-BOUNDS.minX);
  const ny=(drone.y-BOUNDS.minY)/(BOUNDS.maxY-BOUNDS.minY);

  drawParallax(nx, ny);
  drawAnchor();
  updDrawObstacles(dt);
  if (gameRunning) drawDrone(dt); else drawDrone(0);
  handleDroneCollisions();
  drawOverlay();

  if(gameRunning){
    timeLeft -= dt;
    if(!voice.end10Played && timeLeft<=10){ voice.end10Played=true; voice.playKey('end10', VOICE_PRI.end10); }
    if(timeLeft<=0){
      timeLeft=0; gameRunning=false; say('Rüdiger','System hat abgebrochen… Mist.');
      ui.goal.textContent='Sicherheitsprotokoll aktiviert – Abbruch';
      stopDock(); voice.endPlayed=true; voice.stop();        // <— ebenfalls stopDock()
      showEnd(false,'Zeit abgelaufen','Die Drohne hat es nicht rechtzeitig geschafft.');
    } else if(Math.ceil(timeLeft)===CFG.LOW_WARN){
      ui.time.style.color='#ff5c5c';
    }
    updDock(dt);
  }
  ui.time.textContent = fmt(timeLeft);
  return {nx,ny};
}

function showEnd(ok,title,msg){
  ui.endTitle.textContent=title;
  ui.endMsg.textContent=msg;
  ui.end.style.display='flex';
}

// Start/Retry
ui.btnStart.addEventListener('click', ()=>{
  // Audio erst jetzt „freischalten“
  sfx.unlock(); voice.unlock();
  music.currentTime=0; music.play().catch(()=>{});
  sfx.play('start');

  gameRunning=true; timeLeft=CFG.TIME_LIMIT; firstCollision=false; health=100; updateHP();
  ui.start.style.display='none';
  if (isTouch) ui.howto.innerHTML = 'Links Analog-Stick, rechts Boost/Andocken.';
  setTimeout(()=>{ if(gameRunning) voice.playKey('start', VOICE_PRI.start); }, 1500);
  clearTimeout(voice.dialogTimer); voice.dialogTimer = setTimeout(()=>voice.playRandomDialog(), 4000);
});
ui.btnRetry.addEventListener('click', ()=>location.reload());

// Keyboard: Dock
addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='e') tryDock(); });

// Init
initTouch(tryDock);
hookPointer(ui.stage);
fit(); chooseControlLayout();
spawnObs();
updateHP();
ui.time.textContent = fmt(timeLeft);

requestAnimationFrame(loop); // ← Loop einmal anstoßen

