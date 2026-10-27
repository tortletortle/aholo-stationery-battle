import type { Vec2 } from './types'

export function len2(x: number, z: number): number {
  return Math.hypot(x, z)
}

export function norm(x: number, z: number): Vec2 {
  const l = len2(x, z)
  if (l < 1e-8) return { x: 0, z: 1 }
  return { x: x / l, z: z / l }
}

/** Closest point on segment AB to point P */
export function closestOnSegment(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
): Vec2 {
  const abx = bx - ax
  const abz = bz - az
  const apx = px - ax
  const apz = pz - az
  const ab2 = abx * abx + abz * abz
  if (ab2 < 1e-12) return { x: ax, z: az }
  let t = (apx * abx + apz * abz) / ab2
  t = Math.max(0, Math.min(1, t))
  return { x: ax + abx * t, z: az + abz * t }
}

/**
 * Swept attack capsule: segment from (ox,oz) along dir for `range`,
 * thickness hitRadius, vs circle (tx,tz,tr).
 * Returns true if overlapping.
 */
export function segmentHitsCircle(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  range: number,
  hitRadius: number,
  tx: number,
  tz: number,
  tr: number,
): boolean {
  const bx = ox + dirX * range
  const bz = oz + dirZ * range
  const c = closestOnSegment(ox, oz, bx, bz, tx, tz)
  const d = len2(tx - c.x, tz - c.z)
  return d <= hitRadius + tr
}

/**
 * Continuous check along a movement path: sample segment from previous tip path
 * (attacker moved while active). Uses start and end attacker positions.
 */
export function lungePathHits(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  dirX: number,
  dirZ: number,
  range: number,
  hitRadius: number,
  tx: number,
  tz: number,
  tr: number,
): boolean {
  // Check at start, end, and mid of attacker motion (covers tunneling for our maxDt)
  if (segmentHitsCircle(x0, z0, dirX, dirZ, range, hitRadius, tx, tz, tr)) return true
  if (segmentHitsCircle(x1, z1, dirX, dirZ, range, hitRadius, tx, tz, tr)) return true
  const mx = (x0 + x1) * 0.5
  const mz = (z0 + z1) * 0.5
  if (segmentHitsCircle(mx, mz, dirX, dirZ, range, hitRadius, tx, tz, tr)) return true
  // Also sweep tip endpoints as a segment (blade tip travel)
  const tip0x = x0 + dirX * range
  const tip0z = z0 + dirZ * range
  const tip1x = x1 + dirX * range
  const tip1z = z1 + dirZ * range
  const c = closestOnSegment(tip0x, tip0z, tip1x, tip1z, tx, tz)
  return len2(tx - c.x, tz - c.z) <= hitRadius + tr
}

export function circlesOverlap(ax: number, az: number, ar: number, bx: number, bz: number, br: number): boolean {
  return len2(ax - bx, az - bz) < ar + br
}

export function pushApart(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): { ax: number; az: number; bx: number; bz: number } | null {
  const dx = bx - ax
  const dz = bz - az
  const d = len2(dx, dz)
  const min = ar + br
  if (d >= min || d < 1e-8) return null
  const n = norm(dx, dz)
  const push = (min - d) * 0.5
  return {
    ax: ax - n.x * push,
    az: az - n.z * push,
    bx: bx + n.x * push,
    bz: bz + n.z * push,
  }
}
