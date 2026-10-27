import './styles.css'
import { bindControls, createControls, sampleInput } from './input/controls'
import { createWorld, restartWorld, stepWorld } from './logic/world'
import type { World } from './logic/types'
import { BattleScene } from './view/scene'

const canvas = document.querySelector<HTMLCanvasElement>('#c')!
const statusEl = document.querySelector<HTMLDivElement>('#status')!
const rosterEl = document.querySelector<HTMLDivElement>('#roster')!
const debugEl = document.querySelector<HTMLPreElement>('#debug')!

let world: World = createWorld('duel')
const view = new BattleScene(canvas)
const controls = createControls()

bindControls(
  canvas,
  controls,
  (x, y) => view.screenToTable(x, y, canvas),
  () => {
    world.paused = true
    statusEl.textContent = '已失焦暂停 — 点击画面继续'
  },
)

canvas.addEventListener('mousedown', () => {
  if (world.paused) {
    world.paused = false
    statusEl.textContent = world.message
  }
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'r') {
    world = restartWorld(world)
    statusEl.textContent = world.message
  } else if (k === '1') {
    world = restartWorld(world, 'duel')
  } else if (k === '2') {
    world = restartWorld(world, 'melee')
  } else if (k === 'p') {
    world.paused = !world.paused
  } else if (k === 'f8' && import.meta.env.DEV) {
    view.showDebug = !view.showDebug
    debugEl.hidden = !view.showDebug
  }
})

function layout() {
  const r = canvas.parentElement!.getBoundingClientRect()
  view.resize(r.width, r.height)
}
window.addEventListener('resize', layout)
layout()

function refreshHud() {
  statusEl.textContent = `${world.paused ? '[暂停] ' : ''}${world.message} · ${world.mode === 'duel' ? '单挑' : '混战'}`
  rosterEl.innerHTML = world.units
    .map((u) => {
      const name = u.isPlayer ? '玩家' : `AI#${u.id}`
      const cls = `${u.isPlayer ? 'you' : ''} ${u.alive ? '' : 'dead'}`.trim()
      const hp = u.alive ? `HP ${Math.ceil(u.hp)}` : '淘汰'
      const st = u.alive ? u.attack.phase : '-'
      return `<div class="${cls}">${name} · ${hp} · ${st}</div>`
    })
    .join('')

  if (import.meta.env.DEV && view.showDebug) {
    debugEl.hidden = false
    const p = world.units[0]
    debugEl.textContent = [
      '[DEV F8 切换]',
      `phase=${p.attack.phase} t=${p.attack.t.toFixed(2)}`,
      `pos=(${p.x.toFixed(2)},${p.z.toFixed(2)})`,
      `outcome=${world.outcome} alive=${world.units.filter((u) => u.alive).length}`,
    ].join('\n')
  }
}

let last = performance.now()
function frame(now: number) {
  const rawDt = (now - last) / 1000
  last = now
  const player = world.units[0]
  const input = sampleInput(controls, player.x, player.z)
  // After player eliminated, still step for spectate AI fights
  if (!world.paused) {
    stepWorld(world, rawDt, input)
  }
  view.sync(world)
  view.render()
  refreshHud()
  requestAnimationFrame(frame)
}

debugEl.hidden = !import.meta.env.DEV
if (import.meta.env.DEV) view.showDebug = true
refreshHud()
requestAnimationFrame(frame)
