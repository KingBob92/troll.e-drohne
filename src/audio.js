// audio.js
export const audioReport = {
  ok: new Set(),
  fail: new Map(), // key -> url
};

function attachAudioDebug(a, key, url){
  a.addEventListener('canplaythrough', ()=>{ audioReport.ok.add(key); }, { once:true });
  a.addEventListener('error', ()=>{ audioReport.fail.set(key, url); console.error('[AUDIO FAIL]', key, url); }, { once:true });
}

export class SFXPool {
  constructor(map, poolSize = 3) {
    this.pools = new Map();
    this.unlocked = false;
    this.urlMap = map;
    for (const [key, url] of Object.entries(map)) {
      const arr = [];
      for (let i = 0; i < poolSize; i++) {
        const a = new Audio(url);
        a.preload = 'auto';
        a.crossOrigin = 'anonymous';
        attachAudioDebug(a, key, url);
        a.load();
        arr.push(a);
      }
      this.pools.set(key, { arr, idx: 0 });
    }
  }
  elements(){ const out=[]; for (const {arr} of this.pools.values()) out.push(...arr); return out; }

  async unlock() {
    if (this.unlocked) return;
    // erst am Ende auf true setzen, damit während des Unlocks nichts „stumm“ abgespielt wird
    const nodes = this.elements();
    for (const a of nodes) {
      try {
        a.muted = true;
        await a.play().catch(()=>{});
        a.pause(); a.currentTime = 0;
      } catch {}
      a.muted = false;
    }
    this.unlocked = true;
  }

  play(key, { volume = 1.0, loop = false, rate = 1.0 } = {}) {
    if (!this.unlocked) { console.warn('[SFX] play before unlock', key); return null; }
    const p = this.pools.get(key);
    if (!p) { console.warn('[SFX missing key]', key); return null; }
    const a = p.arr[(p.idx = (p.idx + 1) % p.arr.length)];
    try { a.pause(); a.currentTime = 0; } catch {}
    a.loop = loop;
    a.playbackRate = rate;
    a.volume = volume;
    a.play().catch((e) => { console.warn('[SFX play error]', key, e); });
    return a;
  }
}

export class VoiceMgr {
  constructor(voiceMap) {
    this.clips = new Map();
    this.urlMap = voiceMap;
    for (const [k, url] of Object.entries(voiceMap)) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = 0.95;
      attachAudioDebug(a, k, url);
      a.load();
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
    const nodes = this.elements();
    for (const a of nodes) {
      try {
        a.muted = true;
        await a.play().catch(()=>{});
        a.pause(); a.currentTime = 0;
      } catch {}
      a.muted = false;
    }
    this.unlocked = true;
  }

  stop() {
    try {
      if (this.cur) { this.cur.onended = null; this.cur.pause(); this.cur.currentTime = 0; }
    } catch {}
    this.cur = null; this.pri = 0;
  }

  playKey(key, pri, { scheduleNextDialog = true } = {}) {
    if (!this.unlocked) { console.warn('[VOICE] play before unlock', key); return; }
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

export const sfx = new SFXPool({
  start:  'Assets/SOUND/SFX/DROHNE_start.mp3',
  hit1:   'Assets/SOUND/SFX/DROHNE_demage_1.mp3',
  hit2:   'Assets/SOUND/SFX/DROHNE_demage_2.mp3',
  max1:   'Assets/SOUND/SFX/DROHNE_demage_max_1.mp3',
  max2:   'Assets/SOUND/SFX/DROHNE_demage_max_2.mp3',
  max3:   'Assets/SOUND/SFX/DROHNE_demage_max_3.mp3',
  count:  'Assets/SOUND/SFX/ANKER_count.mp3',
  dockok: 'Assets/SOUND/SFX/DOCKING_correct.mp3'
}, 4);

export const music = new Audio('Assets/SOUND/Music.mp3');
music.loop = true;
music.volume = 0.25;
music.preload = 'auto';
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

// Preload-Helfer
function once(el, ev, timeout=10000){ return new Promise(res=>{
  let done=false; const t=setTimeout(()=>{ if(!done){done=true;res();} }, timeout);
  el.addEventListener(ev, ()=>{ if(!done){done=true;clearTimeout(t);res();} }, { once:true });
});}
export async function preloadAllAudio(progressCb){
  const nodes = [...sfx.elements(), ...voice.elements(), music];
  let done=0, total=nodes.length;
  const tick=()=>progressCb && progressCb(++done,total);
  await Promise.all(nodes.map(async a=>{
    try{
      a.load();
      if (a.readyState>=3){ tick(); return; }
      await once(a,'canplaythrough',12000); tick();
    }catch{ tick(); }
  }));
  window.__audioReport = {
    ok: Array.from(audioReport.ok.values()),
    fail: Array.from(audioReport.fail.entries()),
  };
}
