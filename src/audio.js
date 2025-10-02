// audio.js
// Ziel: super niedrige Latenz für kurze SFX (WebAudio), Voices/Music bleiben <audio> (Streaming)

export const audioReport = {
  ok: new Set(),
  fail: new Map(), // key -> url
};

function attachAudioDebug(a, key, url){
  a.addEventListener('canplaythrough', ()=>{ audioReport.ok.add(key); }, { once:true });
  a.addEventListener('error', ()=>{ audioReport.fail.set(key, url); console.error('[AUDIO FAIL]', key, url); }, { once:true });
}

// ---------- WebAudio für SFX ----------
const AC = window.AudioContext || window.webkitAudioContext;
export const audioCtx = AC ? new AC() : null;

async function fetchDecode(url){
  const r = await fetch(url, { cache:'force-cache' });
  const buf = await r.arrayBuffer();
  // iOS Safari braucht decodeAudioData mit Callback-Wrapper
  return await new Promise((resolve, reject)=>{
    audioCtx.decodeAudioData(buf, resolve, reject);
  });
}

class SFXWebAudio {
  constructor(map){
    this.urls = map;          // key -> url
    this.buffers = new Map(); // key -> AudioBuffer
    this.unlocked = false;
  }
  async preload(progressCb){
    const entries = Object.entries(this.urls);
    let done=0,total=entries.length;
    const tick=()=>progressCb && progressCb(++done,total);
    await Promise.all(entries.map(async ([key,url])=>{
      try{
        const buf = await fetchDecode(url);
        this.buffers.set(key, buf);
      }catch(e){
        console.warn('[SFX decode fail]', key, url, e);
      } finally { tick(); }
    }));
  }
  async unlock(){
    if (!audioCtx) return;
    try{ await audioCtx.resume(); }catch{}
    this.unlocked = (audioCtx.state === 'running');
  }
  play(key, { volume = 1.0, rate = 1.0 } = {}){
    if (!this.unlocked || !audioCtx) return null;
    const buf = this.buffers.get(key);
    if (!buf) { console.warn('[SFX missing buffer]', key); return null; }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
    // Shim-Node mit onended für Sequenzen
    const node = {
      onended: null,
      stop(){ try{ src.stop(); }catch{} },
    };
    src.onended = ()=> node.onended && node.onended();
    return node;
  }
}

// ---------- Voices / Music als <audio> ----------
export class VoiceMgr {
  constructor(voiceMap) {
    this.clips = new Map();
    for (const [k, url] of Object.entries(voiceMap)) {
      const a = new Audio(url);
      a.preload = 'metadata'; // zunächst nur Metadaten (kein dicker Decode vorm Start)
      a.volume = 0.95;
      attachAudioDebug(a, k, url);
      this.clips.set(k, a);
    }
    this.cur = null;
    this.pri = 0;
    this.unlocked = false;
    this.dialogTimer = null;
    this.endPlayed = false;
    this.end10Played = false;
  }
  elements(){ return [...this.clips.values()]; }
  async unlock() {
    if (this.unlocked) return;
    // Einmalig kurz „antippen“, damit Autoplay auf Mobile freigeschaltet ist
    for (const a of this.elements()) {
      try { a.muted = true; await a.play().catch(()=>{}); a.pause(); a.currentTime = 0; } catch {}
      a.muted = false;
    }
    this.unlocked = true;
  }
  // Hintergrund-Decode nach Spielstart
  async warmVoices(progressCb){
    const arr = this.elements();
    let done=0,total=arr.length;
    const tick=()=>progressCb && progressCb(++done,total);
    for (const base of arr){
      try{
        base.preload = 'auto';
        base.load();
        // keine harte Blockade: einfach kurz warten, dann weiter
        await new Promise(r=>setTimeout(r, 20));
      }catch{}
      tick();
    }
  }
  stop() {
    try {
      if (this.cur) { this.cur.onended = null; this.cur.pause(); this.cur.currentTime = 0; }
    } catch {}
    this.cur = null; this.pri = 0;
  }
  playKey(key, pri, { scheduleNextDialog = true } = {}) {
    if (!this.unlocked) return;
    const base = this.clips.get(key);
    if (!base) { console.warn('[VOICE missing key]', key); return; }
    if (this.cur && pri < this.pri) return;
    if (this.cur) this.stop();
    this.pri = pri;
    const a = base.cloneNode(true);
    a.volume = base.volume ?? 0.95;
    this.cur = a;
    a.onended = () => {
      this.cur = null; this.pri = 0;
      if (!this.endPlayed && scheduleNextDialog) {
        clearTimeout(this.dialogTimer);
        this.dialogTimer = setTimeout(() => this.playRandomDialog(), 3000);
      }
    };
    a.play().catch((e)=>{ console.warn('[VOICE play error]', key, e); });
  }
  playRandomDialog() {
    if (!this.unlocked || this.endPlayed) return;
    const n = 1 + Math.floor(Math.random() * 8);
    this.playKey(`dialog${n}`, 1);
  }
}

// Maps
const SFX_MAP = {
  start:  'Assets/SOUND/SFX/DROHNE_start.mp3',
  hit1:   'Assets/SOUND/SFX/DROHNE_demage_1.mp3',
  hit2:   'Assets/SOUND/SFX/DROHNE_demage_2.mp3',
  max1:   'Assets/SOUND/SFX/DROHNE_demage_max_1.mp3',
  max2:   'Assets/SOUND/SFX/DROHNE_demage_max_2.mp3',
  max3:   'Assets/SOUND/SFX/DROHNE_demage_max_3.mp3',
  count:  'Assets/SOUND/SFX/ANKER_count.mp3',
  dockok: 'Assets/SOUND/SFX/DOCKING_correct.mp3'
};

export const sfx = new SFXWebAudio(SFX_MAP);

export const music = new Audio('Assets/SOUND/Music.mp3');
music.loop = true;
music.volume = 0.25;
music.preload = 'metadata';
music.crossOrigin = 'anonymous';
attachAudioDebug(music, 'music', 'Assets/SOUND/Music.mp3');

export const VOICE_PRI = { dialog:1, start:2, demage:3, end10:4, end:5 };
export const voice = new VoiceMgr({
  start:   'Assets/SOUND/VOICES/VOICE_start.mp3',
  end10:   'Assets/SOUND/VOICES/VOICE_end_10.mp3',
  end:     'Assets/SOUND/VOICES/VOICE_end.mp3',
  demage1: 'Assets/SOUND/VOICES/VOICE_demage_1.mp3',
  demage2: 'Assets/SOUND/VOICES/VOICE_demage_2.mp3',
  demage3: 'Assets/SOUND/VOICES/VOICE_demage_3.mp3',
  dialog1: 'Assets/SOUND/VOICES/VOICE_dialog_1.mp3',
  dialog2: 'Assets/SOUND/VOICES/VOICE_dialog_2.mp3',
  dialog3: 'Assets/SOUND/VOICES/VOICE_dialog_3.mp3',
  dialog4: 'Assets/SOUND/VOICES/VOICE_dialog_4.mp3',
  dialog5: 'Assets/SOUND/VOICES/VOICE_dialog_5.mp3',
  dialog6: 'Assets/SOUND/VOICES/VOICE_dialog_6.mp3',
  dialog7: 'Assets/SOUND/VOICES/VOICE_dialog_7.mp3',
  dialog8: 'Assets/SOUND/VOICES/VOICE_dialog_8.mp3',
});

// ---- Preload-API ----
function once(el, ev, timeout=10000){ return new Promise(res=>{
  let done=false; const t=setTimeout(()=>{ if(!done){done=true;res();} }, timeout);
  el.addEventListener(ev, ()=>{ if(!done){done=true;clearTimeout(t);res();} }, { once:true });
});}

// Stufe A: nur SFX (WebAudio) – wichtig vor Spielstart
export async function preloadSFX(progressCb){
  if (!audioCtx) return;
  await sfx.preload(progressCb);
}

// Stufe B: Voices + Music im Hintergrund nach Start
export async function preloadVoicesAndMusic(progressCb){
  // Music nur metadata → danach play() mit Fade-in startet den eigentlichen Stream
  try{ music.load(); await once(music,'loadedmetadata',5000); }catch{}
  await voice.warmVoices(progressCb);
}
