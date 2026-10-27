/** Central tunables — combat numbers live here, not scattered in systems. */
export const CFG = {
  table: { halfW: 8, halfD: 5.5 },
  unit: {
    radius: 0.35,
    moveSpeed: 4.2,
    maxHp: 100,
    knockback: 2.8,
    hitStun: 0.18,
  },
  attack: {
    windup: 0.18,
    active: 0.22,
    recovery: 0.28,
    lungeSpeed: 9.5,
    range: 0.95,
    hitRadius: 0.28,
    damage: 34,
  },
  ai: {
    repath: 0.35,
    attackRange: 1.15,
    holdRange: 0.85,
    retreatChance: 0.22,
    retreatTime: 0.35,
    lockTime: 2.4,
    separation: 0.85,
    edgeMargin: 0.9,
  },
  sim: {
    /** Cap dt so large frame gaps cannot skip hit windows entirely */
    maxDt: 1 / 30,
    substep: 1 / 120,
  },
  modes: {
    duel: { aiCount: 1 },
    melee: { aiCount: 5 },
  },
} as const

export type GameMode = keyof typeof CFG.modes
