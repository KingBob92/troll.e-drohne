// Spielfeld/Assets
export const VIEW_W = 1536, VIEW_H = 1024;
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

// Bounds (werden in game.js finalisiert)
export const MARGIN_X = 28, MARGIN_TOP = 60, MARGIN_BOTTOM = 60;

// Drohne & „Gremlin“
export const THRUST = 340, MAX_SPD = 220, DRAG = 1.7;
export const GREMLIN_BASE = { strength: 250, changeMin: 0.7, changeMax: 1.4 };

// Obstacles
export const OBJ_DRAG = 0.02, WALL_BOUNCE = 0.6, RESTITUTION = 0.8;
