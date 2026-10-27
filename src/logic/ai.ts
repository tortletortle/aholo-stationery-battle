import { CFG } from '../config'
import { canStartAttack, tryStartAttack } from './combat'
import { len2, norm } from './collision'
import type { Unit, World } from './types'

function pickTarget(self: Unit, units: Unit[]): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const u of units) {
    if (!u.alive || u.id === self.id) continue
    const d = len2(u.x - self.x, u.z - self.z)
    if (d < bestD) {
      bestD = d
      best = u.id
    }
  }
  return best
}

function steerAwayFromEdge(u: Unit): { x: number; z: number } {
  const m = CFG.ai.edgeMargin
  const hw = CFG.table.halfW
  const hd = CFG.table.halfD
  let x = 0
  let z = 0
  if (u.x > hw - m) x -= 1
  if (u.x < -hw + m) x += 1
  if (u.z > hd - m) z -= 1
  if (u.z < -hd + m) z += 1
  return { x, z }
}

function separation(self: Unit, units: Unit[]): { x: number; z: number } {
  let x = 0
  let z = 0
  for (const o of units) {
    if (!o.alive || o.id === self.id) continue
    const dx = self.x - o.x
    const dz = self.z - o.z
    const d = len2(dx, dz)
    if (d < CFG.ai.separation && d > 1e-6) {
      const n = norm(dx, dz)
      const w = (CFG.ai.separation - d) / CFG.ai.separation
      x += n.x * w
      z += n.z * w
    }
  }
  return { x, z }
}

/** Returns desired move vector (not normalized) and whether to attack. */
export function aiDecide(
  world: World,
  self: Unit,
): { mx: number; mz: number; aimX: number; aimZ: number; wantAttack: boolean } {
  if (!self.alive) return { mx: 0, mz: 0, aimX: self.facingX, aimZ: self.facingZ, wantAttack: false }

  if (self.lockT <= 0 || self.targetId === null || !world.units.find((u) => u.id === self.targetId)?.alive) {
    self.targetId = pickTarget(self, world.units)
    self.lockT = CFG.ai.lockTime
  }

  const target = world.units.find((u) => u.id === self.targetId && u.alive)
  let aimX = self.facingX
  let aimZ = self.facingZ
  let mx = 0
  let mz = 0
  let wantAttack = false

  if (target) {
    const dx = target.x - self.x
    const dz = target.z - self.z
    const d = len2(dx, dz)
    const dir = norm(dx, dz)
    aimX = dir.x
    aimZ = dir.z

    if (self.aiMode === 'retreat') {
      mx = -dir.x
      mz = -dir.z
    } else if (d > CFG.ai.attackRange) {
      mx = dir.x
      mz = dir.z
      self.aiMode = 'chase'
    } else if (d < CFG.ai.holdRange) {
      // slight circle / hold
      mx = -dir.z * 0.4
      mz = dir.x * 0.4
      wantAttack = canStartAttack(self)
    } else {
      wantAttack = canStartAttack(self)
    }
  }

  const edge = steerAwayFromEdge(self)
  const sep = separation(self, world.units)
  mx += edge.x * 1.4 + sep.x * 1.2
  mz += edge.z * 1.4 + sep.z * 1.2

  return { mx, mz, aimX, aimZ, wantAttack }
}

export function aiTickTimers(self: Unit, dt: number): void {
  if (!self.alive) return
  self.lockT -= dt
  self.aiTimer -= dt
  if (self.aiTimer <= 0) {
    self.aiTimer = CFG.ai.repath
    if (self.aiMode !== 'retreat' && Math.random() < CFG.ai.retreatChance) {
      self.aiMode = 'retreat'
      self.aiTimer = CFG.ai.retreatTime
    } else if (self.aiMode === 'retreat') {
      self.aiMode = 'chase'
    }
  }
}

export function aiTryAttack(world: World, self: Unit, aimX: number, aimZ: number): void {
  if (!self.alive) return
  if (tryStartAttack(self, aimX, aimZ, ++world.swingSeq)) {
    // started
  }
}
