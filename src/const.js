// const.js
// Debug-Flag aus URL (nur aktiv mit ?debug=1)
export const DEBUG = new URLSearchParams(location.search).has('debug');

// Spielfeld/Viewport
export const VIEW_W = 1536, VIEW_H = 1024;

// Weltgröße (horizontale Strecke)
export const WORLD_W = VIEW_W * 3;
export const BG_W = 2350, BG_H = 1024;

// Game-Config
export const CFG = {
  TIME_LIMIT: 120,         // 2 Minuten
  LOW_WARN: 20,
  DOCK_HOLD: 3.0,
  BOOST_FACTOR: 1.6,
  BOOST_TIME: 0.5,
  BOOST_COOLDOWN: 2.0
};

// Bounds
export const MARGIN_X = 28, MARGIN_TOP = 60, MARGIN_BOTTOM = 60;

// Drohne & „Gremlin“
export const THRUST = 340, MAX_SPD = 220, DRAG = 1.7;
export const GREMLIN_BASE = { strength: 250, changeMin: 0.7, changeMax: 1.4 };

// Obstacles – Dichte pro View-Breite
export const OBSTACLE_DENSITY = {
  ASTEROID_PER_VIEW: 8,
  STONE_PER_VIEW:   18,
  TRASH_PER_VIEW:   28
};

// Physik-Kontakt
export const OBJ_DRAG = 0.02, WALL_BOUNCE = 0.6, RESTITUTION = 0.8;

// HUD/Arrow-Tuning
export const HUD = {
  ARROW: {
    // Schwellen deutlich weiter nach vorn, damit Farben schon früh wechseln
    NEAR:   1400,  // < 1400 px Welt → rot + blink
    MID:    2800,  // < 2800 px → gelb
    FAR:   999999, // sonst → grün
    MARGIN: 32,    // Abstand zum Rand
    BLINK_HZ: 2.0, // Hz
    COL_FAR:  'rgba( 90, 220, 140, 1.0)',
    COL_MID:  'rgba(255, 210,  90, 1.0)',
    COL_NEAR: 'rgba(255,  90,  90, 1.0)',
    SIZE_MIN: 14,  // Pfeil-Halblänge min
    SIZE_MAX: 26,  // Pfeil-Halblänge max
  }
};
