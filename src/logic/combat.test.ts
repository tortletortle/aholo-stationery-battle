import { describe, expect, it } from 'vitest'
import { CFG } from '../config'
import { lungePathHits, segmentHitsCircle } from './collision'
import {
  advanceAttackPhase,
  applyHit,
  canStartAttack,
  gatherHits,
  idleAttack,
  tryStartAttack,
} from './combat'
import { createWorld, restartWorld, stepWorld, updateWorld, type PlayerInput } from './world'
import type { Unit } from './types'

const idleInput: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, attackPressed: false }

function unitAt(partial: Partial<Unit> & Pick<Unit, 'id' | 'x' | 'z'>): Unit {
  return {
    isPlayer: false,
    alive: true,
    facingX: 0,
    facingZ: -1,
    hp: CFG.unit.maxHp,
    attack: idleAttack(),
    stun: 0,
    flash: 0,
    trail: 0,
    knockVx: 0,
    knockVz: 0,
    targetId: null,
    lockT: 0,
    aiMode: 'chase',
    aiTimer: 0,
    ...partial,
  }
}

describe('attack state machine', () => {
  it('transitions windup → active → recovery → idle in order', () => {
    const u = unitAt({ id: 0, x: 0, z: 0, isPlayer: true })
    expect(tryStartAttack(u, 0, -1, 1)).toBe(true)
    expect(u.attack.phase).toBe('windup')
    expect(canStartAttack(u)).toBe(false)

    advanceAttackPhase(u, CFG.attack.windup + 1e-4)
    expect(u.attack.phase).toBe('active')

    advanceAttackPhase(u, CFG.attack.active + 1e-4)
    expect(u.attack.phase).toBe('recovery')

    advanceAttackPhase(u, CFG.attack.recovery + 1e-4)
    expect(u.attack.phase).toBe('idle')
  })

  it('rejects restart during windup', () => {
    const u = unitAt({ id: 0, x: 0, z: 0, isPlayer: true })
    expect(tryStartAttack(u, 0, -1, 1)).toBe(true)
    expect(tryStartAttack(u, 1, 0, 2)).toBe(false)
    expect(u.attack.swingId).toBe(1)
  })
})

describe('hit windows', () => {
  it('does not damage outside active phase', () => {
    const a = unitAt({ id: 0, x: 0, z: 0, isPlayer: true })
    const t = unitAt({ id: 1, x: 0, z: -0.8 })
    tryStartAttack(a, 0, -1, 1)
    // still windup
    const hits = gatherHits(a, 0, 0, 0, 0, [a, t])
    expect(hits).toHaveLength(0)
  })

  it('one swing hits the same target at most once', () => {
    const a = unitAt({ id: 0, x: 0, z: 0, isPlayer: true })
    const t = unitAt({ id: 1, x: 0, z: -0.7 })
    tryStartAttack(a, 0, -1, 7)
    advanceAttackPhase(a, CFG.attack.windup + 1e-4)
    expect(a.attack.phase).toBe('active')
    const h1 = gatherHits(a, 0, 0, 0, 0, [a, t])
    expect(h1).toHaveLength(1)
    const h2 = gatherHits(a, 0, 0, 0.1, 0, [a, t])
    expect(h2).toHaveLength(0)
  })

  it('eliminated unit cannot attack or take further hits', () => {
    const a = unitAt({ id: 0, x: 0, z: 0, isPlayer: true })
    const t = unitAt({ id: 1, x: 0, z: -0.7, hp: 1 })
    tryStartAttack(a, 0, -1, 3)
    advanceAttackPhase(a, CFG.attack.windup + 1e-4)
    const hits = gatherHits(a, 0, 0, 0, 0, [a, t])
    applyHit(a, t, hits[0].damage)
    expect(t.alive).toBe(false)
    expect(tryStartAttack(t, 0, 1, 9)).toBe(false)
    t.alive = false
    const again = gatherHits(a, 0, 0, 0, 0, [a, t])
    expect(again).toHaveLength(0)
  })
})

describe('lunge path hit', () => {
  it('detects fast lunge that crosses target between samples', () => {
    // Target between start and end along tip path
    const hit = lungePathHits(
      0,
      0,
      0,
      -1.2,
      0,
      -1,
      CFG.attack.range,
      CFG.attack.hitRadius,
      0,
      -0.6,
      CFG.unit.radius,
    )
    expect(hit).toBe(true)
    expect(segmentHitsCircle(0, 2, 0, -1, CFG.attack.range, CFG.attack.hitRadius, 0, 0, CFG.unit.radius)).toBe(false)
  })
})

describe('bounds and outcome', () => {
  it('out of bounds eliminates and can decide winner', () => {
    const w = createWorld('duel')
    const player = w.units[0]
    const ai = w.units[1]
    player.x = CFG.table.halfW + 0.5
    updateWorld(w, 0.016, idleInput)
    expect(player.alive).toBe(false)
    expect(ai.alive).toBe(true)
    expect(w.outcome).toBe('ai_win')
  })

  it('last survivor wins; simultaneous wipe is draw', () => {
    const w = createWorld('duel')
    w.units[0].alive = false
    w.units[0].hp = 0
    w.units[1].alive = false
    w.units[1].hp = 0
    updateWorld(w, 0.016, idleInput)
    expect(w.outcome).toBe('draw')

    const w2 = createWorld('duel')
    w2.units[1].alive = false
    w2.units[1].hp = 0
    updateWorld(w2, 0.016, idleInput)
    expect(w2.outcome).toBe('player_win')
  })

  it('restart clears combat state', () => {
    let w = createWorld('duel')
    tryStartAttack(w.units[0], 0, -1, 5)
    w.units[0].flash = 1
    w.hits.push({ attackerId: 0, targetId: 1, swingId: 5, damage: 1, x: 0, z: 0 })
    w = restartWorld(w, 'duel')
    expect(w.units[0].attack.phase).toBe('idle')
    expect(w.units[0].flash).toBe(0)
    expect(w.hits).toHaveLength(0)
    expect(w.outcome).toBe('playing')
    expect(w.units.every((u) => u.alive && u.hp === CFG.unit.maxHp)).toBe(true)
  })
})

describe('large dt', () => {
  it('stepWorld substeps so active window is not skipped entirely', () => {
    const w = createWorld('duel')
    // Place AI in lunge line
    w.units[1].x = 0
    w.units[1].z = -0.75
    w.units[0].x = 0
    w.units[0].z = 0
    const input: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, attackPressed: true }
    // One huge frame: still should enter active and be able to hit via substeps
    stepWorld(w, 0.5, input)
    // After 0.5s from windup start, attack finished; check that AI took damage or died
    const ai = w.units[1]
    expect(ai.hp < CFG.unit.maxHp || !ai.alive).toBe(true)
  })
})

describe('melee mode spawn', () => {
  it('creates player + 5 AI', () => {
    const w = createWorld('melee')
    expect(w.units).toHaveLength(6)
    expect(w.units.filter((u) => u.isPlayer)).toHaveLength(1)
  })
})
