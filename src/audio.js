// audio.js
// Robuster Audio-Manager: nutzt deine echten Pfade unter Assets/SOUND/...
// - Spielt erst nach Nutzer-Geste (unlock())
// - Führt beim Unlock ein kurzes, stummes Warmup aller Audio-Elemente aus (für iOS/Safari/Android)

export class SFXPool {
  constructor(map, poolSize = 3) {
    this.pools = new Map();
    this.unlocked = false;
    for (const [key, url] of Object.entries(map)) {
      const arr = [];
      for (let i = 0; i < poolSize; i++) {
        const a = new Audio(url);
        a.preload = 'auto';
        a.crossOrigin = 'anonymous';
        a.load();
        arr.push(a);
      }
      this.pools.set(key, { arr, idx: 0 });
    }
  }
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    // Warmup: jedes Element einmal stumm anspielen, dann stoppen
    for (const { arr } of this.pools.values()) {
      for (const a of arr) {
        try {
          a.muted = true;
          await a.play().catch(() => {});
          a.pause();
          a.currentTime = 0;
        } catch {}
        a.muted = false;
      }
    }
  }
  play(key, { volume = 1.0, loop = false, rate = 1.0 } = {}) {
    if (!this.unlocked) return null;
    const p = this.pools.get(key);
    if (!p) return null;
    const a = p.arr[(p.idx = (p.idx + 1) % p.arr.length)];
    try { a.pause(); a.currentTime = 0; } catch {}
    a.loop = loop;
    a.playbackRate = rate;
    a.volume = volume;
    a.play().catch(() => {});
    return a;
  }
  stop(node) {
    try { node.pause(); node.currentTime = 0; } catch {}
  }
}

export class VoiceMgr {
  constructor(voiceMap) {
    this.clips = new Map();
    for (const [k, url] of Object.entries(voiceMap)) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = 0.95;
      this.clips.set(k, a);
    }
    this.cur = null;
    this.pri = 0;
    this.unlocked = false;
    this.dialogTimer = null;
    this.endPlayed = false;
    this.end10Played = false;
  }
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    // Warmup: alle Voices stumm anspielen
    for (const a of this.clips.values()) {
      try {
        a.muted = true;
        await a.play().catch(() => {});
        a.pause();
        a.currentTime = 0;
      } catch {}
      a.muted = false;
    }
  }
  stop() {
    try {
      if (this.cur) {
        this.cur.onended = null;
        this.cur.pause();
        this.cur.currentTime = 0;
      }
    } catch {}
    this.cur = null;
    this.pri = 0;
  }
  playKey(key, pri, { scheduleNextDialog = true } = {}) {
    if (!this.unlocked) return;
    const base = this.clips.get(key);
    if (!base) return;
    if (this.cur && pri < this.pri) return;
    if (this.cur) this.stop();
    this.pri = pri;
    const a = base.cloneNode(true);
    a.volume = base.volume ?? 0.95;
    this.cur = a;
    a.onended = () => {
      this.cur = null;
      this.pri = 0;
      if (!this.endPlayed && scheduleNextDialog) {
        clearTimeout(this.dialogTimer);
        this.dialogTimer = setTimeout(() => this.playRandomDialog(), 3000);
      }
    };
    a.play().catch(() => {});
  }
  playRandomDialog() {
    if (!this.unlocked || this.endPlayed) return;
    const n = 1 + Math.floor(Math.random() * 8);
    this.playKey(`dialog${n}`, 1);
  }
}

// === Fabriken mit DEINEN echten Pfaden ===
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

// Musik (dein Pfad)
export const music = new Audio('Assets/SOUND/Music.mp3');
music.loop = true;
music.volume = 0.25;
music.preload = 'auto';
music.crossOrigin = 'anonymous';

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
