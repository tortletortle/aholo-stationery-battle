import type { PlayerInput } from '../logic/world'

export type ControlState = {
  keys: Set<string>
  mouseX: number
  mouseZ: number
  attackClicked: boolean
  aimValid: boolean
}

export function createControls(): ControlState {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseZ: -1,
    attackClicked: false,
    aimValid: true,
  }
}

export function bindControls(
  canvas: HTMLCanvasElement,
  state: ControlState,
  toTable: (x: number, y: number) => { x: number; z: number } | null,
  onBlurPause: () => void,
): () => void {
  const down = (e: KeyboardEvent) => {
    state.keys.add(e.key.toLowerCase())
  }
  const up = (e: KeyboardEvent) => {
    state.keys.delete(e.key.toLowerCase())
  }
  const move = (e: MouseEvent) => {
    const p = toTable(e.clientX, e.clientY)
    if (p) {
      state.mouseX = p.x
      state.mouseZ = p.z
      state.aimValid = true
    }
  }
  const md = (e: MouseEvent) => {
    if (e.button === 0) {
      state.attackClicked = true
      const p = toTable(e.clientX, e.clientY)
      if (p) {
        state.mouseX = p.x
        state.mouseZ = p.z
      }
    }
  }
  const blur = () => {
    state.keys.clear()
    state.attackClicked = false
    onBlurPause()
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  canvas.addEventListener('mousemove', move)
  canvas.addEventListener('mousedown', md)
  window.addEventListener('blur', blur)

  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    canvas.removeEventListener('mousemove', move)
    canvas.removeEventListener('mousedown', md)
    window.removeEventListener('blur', blur)
  }
}

export function sampleInput(ctrl: ControlState, playerX: number, playerZ: number): PlayerInput {
  let mx = 0
  let mz = 0
  if (ctrl.keys.has('a') || ctrl.keys.has('arrowleft')) mx -= 1
  if (ctrl.keys.has('d') || ctrl.keys.has('arrowright')) mx += 1
  if (ctrl.keys.has('w') || ctrl.keys.has('arrowup')) mz -= 1
  if (ctrl.keys.has('s') || ctrl.keys.has('arrowdown')) mz += 1

  let aimX = ctrl.mouseX - playerX
  let aimZ = ctrl.mouseZ - playerZ
  if (Math.hypot(aimX, aimZ) < 1e-4) {
    aimX = 0
    aimZ = -1
  }

  const attackPressed = ctrl.attackClicked
  ctrl.attackClicked = false

  return { moveX: mx, moveZ: mz, aimX, aimZ, attackPressed }
}
