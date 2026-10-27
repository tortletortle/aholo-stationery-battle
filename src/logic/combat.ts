import { CFG } from '../config'
import { lungePathHits, norm } from './collision'
import type { AttackState, HitEvent, Unit } from './types'

export function idleAttack(): AttackState {
  return {
    phase: 'idle',
    t: 0,
    dirX: 0,
    dirZ: 1,
    swingId: 0,
    hitIds: new Set(),
  }
}

export function canStartAttack(u: Unit): boolean {
  return u.alive && u.attack.phase === 'idle' && u.stun <= 0
}

/** Begin swing; locks facing. Rejects if not idle. */
export function tryStartAttack(u: Unit, aimX: number, aimZ: number, swingId: number): boolean {
  if (!canStartAttack(u)) return false
  const d = norm(aimX, aimZ)
  u.facingX = d.x
  u.facingZ = d.z
  u.attack = {
    phase: 'windup',
    t: CFG.attack.windup,
    dirX: d.x,
    dirZ: d.z,
    swingId,
    hitIds: new Set(),
  }
  u.trail = 0.45
  return true
}

export function advanceAttackPhase(u: Unit, dt: number): void {
  if (!u.alive || u.attack.phase === 'idle') return
  u.attack.t -= dt
  while (u.attack.t <= 0 && u.attack.phase !== 'idle') {
    if (u.attack.phase === 'windup') {
      u.attack.phase = 'active'
      u.attack.t += CFG.attack.active
    } else if (u.attack.phase === 'active') {
      u.attack.phase = 'recovery'
      u.attack.t += CFG.attack.recovery
    } else if (u.attack.phase === 'recovery') {
      u.attack.phase = 'idle'
      u.attack.t = 0
      u.attack.hitIds = new Set()
    }
  }
}

/** Lunge displacement during active only. */
export function attackLungeOffset(u: Unit, dt: number): { dx: number; dz: number } {
  if (!u.alive || u.attack.phase !== 'active') return { dx: 0, dz: 0 }
  return {
    dx: u.attack.dirX * CFG.attack.lungeSpeed * dt,
    dz: u.attack.dirZ * CFG.attack.lungeSpeed * dt,
  }
}

export function gatherHits(
  attacker: Unit,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  targets: Unit[],
): HitEvent[] {
  if (!attacker.alive || attacker.attack.phase !== 'active') return []
  const { dirX, dirZ, swingId, hitIds } = attacker.attack
  const out: HitEvent[] = []
  for (const t of targets) {
    if (!t.alive || t.id === attacker.id) continue
    if (hitIds.has(t.id)) continue
    const hit = lungePathHits(
      x0,
      z0,
      x1,
      z1,
      dirX,
      dirZ,
      CFG.attack.range,
      CFG.attack.hitRadius,
      t.x,
      t.z,
      CFG.unit.radius,
    )
    if (!hit) continue
    hitIds.add(t.id)
    out.push({
      attackerId: attacker.id,
      targetId: t.id,
      swingId,
      damage: CFG.attack.damage,
      x: t.x,
      z: t.z,
    })
  }
  return out
}

export function applyHit(attacker: Unit, target: Unit, damage: number): void {
  if (!target.alive || !attacker.alive) return
  target.hp -= damage
  target.stun = CFG.unit.hitStun
  target.flash = 0.2
  target.knockVx = attacker.attack.dirX * CFG.unit.knockback
  target.knockVz = attacker.attack.dirZ * CFG.unit.knockback
  // Cancel target attack on heavy hit
  if (target.attack.phase !== 'idle') {
    target.attack = idleAttack()
  }
  if (target.hp <= 0) {
    target.hp = 0
    target.alive = false
    target.attack = idleAttack()
  }
}
