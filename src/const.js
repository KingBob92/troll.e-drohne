// const.js
// Debug-Flag aus URL (nur aktiv mit ?debug=1)
export const DEBUG = new URLSearchParams(location.search).has('debug');

// Spielfeld/Viewport
export const VIEW_W = 1536, VIEW_H = 1024;

// Weltgröße (horizontale Strecke)
export const WORLD_W = VIEW_W * 3;
export const BG_W = 2350, BG_H = 1024;

// Game-Config (deine aktuellen Werte beibehalten)
export const CFG = {
  TIME_LIMIT: 60,
  LOW_WARN: 20,
  DOCK_HOLD: 3.0,
  BOOST_FACTOR: 5.6,
  BOOST_TIME: 0.8,
  BOOST_COOLDOWN: 2.0
};

// Bounds
export const MARGIN_X = 28, MARGIN_TOP = 60, MARGIN_BOTTOM = 60;

// Drohne & „Gremlin“ (dein Stand)
export const THRUST = 340, MAX_SPD = 220, DRAG = 1.0;
export const GREMLIN_BASE = { strength: 100, changeMin: 0.7, changeMax: 1.4 };

// Obstacles – Dichte pro View-Breite (dein Stand)
export const OBSTACLE_DENSITY = {
  ASTEROID_PER_VIEW: 5,
  STONE_PER_VIEW:   8,
  TRASH_PER_VIEW:   32
};

// Physik-Kontakt
export const OBJ_DRAG = 0.02, WALL_BOUNCE = 0.6, RESTITUTION = 0.8;

// HUD/Arrow-Tuning (dein Stand)
export const HUD = {
  ARROW: {
    NEAR:   1400,
    MID:    2800,
    FAR:   999999,
    MARGIN: 32,
    BLINK_HZ: 2.0,
    COL_FAR:  'rgba( 90, 220, 140, 1.0)',
    COL_MID:  'rgba(255, 210,  90, 1.0)',
    COL_NEAR: 'rgba(255,  90,  90, 1.0)',
    SIZE_MIN: 14,
    SIZE_MAX: 26,
  }
};

// ——— Komet: seltenes Event ———
export const COMET = {
  SPRITE_PATH: 'Assets/PROPS/Comet_1.png', // bereitgestellt
  SPEED_MIN: 200,  // px/s (negativ, fliegt nach links)
  SPEED_MAX: 600, // px/s
  RADIUS: 65,      // Kollisionsradius um den „Kopf“
  HEAD_OFFSET_X: -40, // Offset des Kollisionskreises relativ zur Sprite-Mitte (nach links Richtung Kopf)
  DAMAGE: 49,      // Schaden an Drohne
  PUSH_FORCE: 1.8, // Impuls-Faktor für Hindernisse
  Y_MARGIN: 40,    // Abstand zu Top/Bottom
  MEAN_INTERVAL: 20, // mittlere Zeit (s) zwischen Spawns (Poisson) → selten & spontan
  DESPAWN_PAD: 260  // wie weit links außerhalb des Screens despawnen
};
