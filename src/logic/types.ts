export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery'

export type Vec2 = { x: number; z: number }

export type AttackState = {
  phase: AttackPhase
  /** Remaining time in current phase */
  t: number
  /** Locked aim at attack start */
  dirX: number
  dirZ: number
  /** Unique id per swing */
  swingId: number
  /** Targets already hit by this swing */
  hitIds: Set<number>
}

export type Unit = {
  id: number
  isPlayer: boolean
  alive: boolean
  x: number
  z: number
  facingX: number
  facingZ: number
  hp: number
  attack: AttackState
  stun: number
  /** Visual feedback timers (logic-owned, view reads) */
  flash: number
  trail: number
  knockVx: number
  knockVz: number
  /** AI */
  targetId: number | null
  lockT: number
  aiMode: 'chase' | 'retreat' | 'idle'
  aiTimer: number
  /** Scratch for AI this frame (not serialized) */
  _ai?: { mx: number; mz: number; aimX: number; aimZ: number; wantAttack: boolean }
}

export type HitEvent = {
  attackerId: number
  targetId: number
  swingId: number
  damage: number
  x: number
  z: number
}

export type Outcome = 'playing' | 'player_win' | 'ai_win' | 'draw' | 'spectate'

export type World = {
  mode: 'duel' | 'melee'
  units: Unit[]
  time: number
  swingSeq: number
  outcome: Outcome
  paused: boolean
  hits: HitEvent[]
  message: string
}
