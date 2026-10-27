import { CFG, type GameMode } from '../config'
import { aiDecide, aiTickTimers, aiTryAttack } from './ai'
import {
  advanceAttackPhase,
  applyHit,
  attackLungeOffset,
  gatherHits,
  idleAttack,
  tryStartAttack,
} from './combat'
import { circlesOverlap, len2, norm, pushApart } from './collision'
import type { Unit, World } from './types'

function spawnUnit(id: number, isPlayer: boolean, x: number, z: number): Unit {
  return {
    id,
    isPlayer,
    alive: true,
    x,
    z,
    facingX: isPlayer ? 0 : 0,
    facingZ: isPlayer ? -1 : 1,
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
    aiTimer: 0.2,
  }
}

export function createWorld(mode: GameMode = 'duel'): World {
  const aiCount = CFG.modes[mode].aiCount
  const units: Unit[] = [spawnUnit(0, true, 0, 3.2)]
  // AI around far side
  for (let i = 0; i < aiCount; i++) {
    const t = aiCount === 1 ? 0 : (i / (aiCount - 1 || 1)) * 2 - 1
    const x = t * (aiCount === 1 ? 0 : 4.5)
    const z = -3.2 - (i % 2) * 0.4
    units.push(spawnUnit(i + 1, false, x, z))
  }
  // Face toward center-ish
  for (const u of units) {
    if (u.isPlayer) {
      u.facingX = 0
      u.facingZ = -1
    } else {
      const d = norm(-u.x, -u.z + 1)
      u.facingX = d.x
      u.facingZ = d.z
    }
  }
  return {
    mode,
    units,
    time: 0,
    swingSeq: 1,
    outcome: 'playing',
    paused: false,
    hits: [],
    message: mode === 'duel' ? '单挑：击败对面的铅笔' : '混战：存活到最后',
  }
}

export function restartWorld(world: World, mode?: GameMode): World {
  return createWorld(mode ?? world.mode)
}

function outOfBounds(u: Unit): boolean {
  return Math.abs(u.x) > CFG.table.halfW || Math.abs(u.z) > CFG.table.halfD
}

function eliminate(u: Unit, reason: string, world: World): void {
  if (!u.alive) return
  u.alive = false
  u.hp = 0
  u.attack = idleAttack()
  u.knockVx = 0
  u.knockVz = 0
  world.message = `${u.isPlayer ? '玩家' : 'AI#' + u.id} 淘汰（${reason}）`
}

function resolveOutcome(world: World): void {
  if (world.outcome === 'player_win' || world.outcome === 'ai_win' || world.outcome === 'draw') return
  const alive = world.units.filter((u) => u.alive)
  const player = world.units.find((u) => u.isPlayer)!

  if (alive.length === 0) {
    world.outcome = 'draw'
    world.message = '平局：同时淘汰'
    return
  }
  if (alive.length === 1) {
    const w = alive[0]
    world.outcome = w.isPlayer ? 'player_win' : 'ai_win'
    world.message = w.isPlayer ? '胜利：玩家存活' : `胜利：AI#${w.id}`
    return
  }
  if (!player.alive && world.outcome === 'playing') {
    world.outcome = 'spectate'
    world.message = '玩家已淘汰 — 观战中（R 重开）'
  }
}

export type PlayerInput = {
  moveX: number
  moveZ: number
  aimX: number
  aimZ: number
  attackPressed: boolean
}

/**
 * Fixed-step friendly update. Caller should clamp dt with CFG.sim.maxDt
 * and optionally substep.
 */
export function updateWorld(world: World, dt: number, input: PlayerInput): void {
  if (world.paused) return
  if (world.outcome === 'player_win' || world.outcome === 'ai_win' || world.outcome === 'draw') return

  world.time += dt
  world.hits = []

  // AI decisions
  for (const u of world.units) {
    if (u.isPlayer || !u.alive) continue
    aiTickTimers(u, dt)
    const d = aiDecide(world, u)
    u._ai = d
  }

  // Movement + attacks
  for (const u of world.units) {
    if (!u.alive) continue
    u.stun = Math.max(0, u.stun - dt)
    u.flash = Math.max(0, u.flash - dt)
    u.trail = Math.max(0, u.trail - dt)

    const x0 = u.x
    const z0 = u.z

    // Knockback decay
    u.x += u.knockVx * dt
    u.z += u.knockVz * dt
    u.knockVx *= Math.max(0, 1 - dt * 6)
    u.knockVz *= Math.max(0, 1 - dt * 6)

    let mx = 0
    let mz = 0
    let aimX = u.facingX
    let aimZ = u.facingZ

    if (u.isPlayer) {
      if (u.stun <= 0 && u.attack.phase === 'idle') {
        mx = input.moveX
        mz = input.moveZ
      }
      aimX = input.aimX
      aimZ = input.aimZ
      if (input.attackPressed && world.outcome === 'playing') {
        tryStartAttack(u, aimX, aimZ, ++world.swingSeq)
      }
      if (u.attack.phase === 'idle' && u.stun <= 0) {
        const d = norm(aimX, aimZ)
        u.facingX = d.x
        u.facingZ = d.z
      }
    } else {
      const d = u._ai!
      if (u.stun <= 0 && u.attack.phase === 'idle') {
        mx = d.mx
        mz = d.mz
      }
      aimX = d.aimX
      aimZ = d.aimZ
      if (u.attack.phase === 'idle' && u.stun <= 0) {
        const f = norm(aimX, aimZ)
        u.facingX = f.x
        u.facingZ = f.z
      }
      if (d.wantAttack) aiTryAttack(world, u, aimX, aimZ)
    }

    // Walk
    if (u.attack.phase === 'idle' || u.attack.phase === 'recovery') {
      const ml = len2(mx, mz)
      if (ml > 1e-6 && u.stun <= 0) {
        const n = norm(mx, mz)
        const speed = u.attack.phase === 'recovery' ? CFG.unit.moveSpeed * 0.45 : CFG.unit.moveSpeed
        u.x += n.x * speed * dt
        u.z += n.z * speed * dt
      }
    }

    // Lunge during active (locked dir)
    const lung = attackLungeOffset(u, dt)
    u.x += lung.dx
    u.z += lung.dz

    advanceAttackPhase(u, dt)

    // Hits along path this substep
    const hits = gatherHits(u, x0, z0, u.x, u.z, world.units)
    for (const h of hits) {
      const target = world.units.find((t) => t.id === h.targetId)
      if (!target || !target.alive) continue
      applyHit(u, target, h.damage)
      world.hits.push(h)
    }

    if (outOfBounds(u)) eliminate(u, '出界', world)
  }

  // Soft separation (alive only)
  for (let i = 0; i < world.units.length; i++) {
    for (let j = i + 1; j < world.units.length; j++) {
      const a = world.units[i]
      const b = world.units[j]
      if (!a.alive || !b.alive) continue
      const p = pushApart(a.x, a.z, CFG.unit.radius, b.x, b.z, CFG.unit.radius)
      if (p) {
        a.x = p.ax
        a.z = p.az
        b.x = p.bx
        b.z = p.bz
      }
    }
  }

  resolveOutcome(world)
}

/**
 * Advance simulation for one display frame.
 * - Hard-cap spiral with 0.25s
 * - Split into maxDt chunks so one long frame cannot jump over combat windows
 * - Substep inside each chunk for lunge hit sampling
 * - Attack press only on the first substep
 */
export function stepWorld(world: World, rawDt: number, input: PlayerInput): void {
  let left = Math.min(Math.max(rawDt, 0), 0.25)
  let attack = input.attackPressed
  while (left > 1e-8) {
    const chunk = Math.min(left, CFG.sim.maxDt)
    let rem = chunk
    while (rem > 1e-8) {
      const slice = Math.min(CFG.sim.substep, rem)
      updateWorld(world, slice, { ...input, attackPressed: attack })
      attack = false
      rem -= slice
    }
    left -= chunk
  }
}

export function aliveCount(world: World): number {
  return world.units.filter((u) => u.alive).length
}

export function unitsOverlap(a: Unit, b: Unit): boolean {
  return circlesOverlap(a.x, a.z, CFG.unit.radius, b.x, b.z, CFG.unit.radius)
}
