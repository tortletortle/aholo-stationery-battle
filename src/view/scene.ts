import * as THREE from 'three'
import { CFG } from '../config'
import type { HitEvent, Unit, World } from '../logic/types'

type PencilMesh = {
  root: THREE.Group
  body: THREE.Mesh
  tip: THREE.Mesh
  ring?: THREE.Mesh
}

export class BattleScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private readonly pencils = new Map<number, PencilMesh>()
  private readonly fx = new THREE.Group()
  private readonly debugGroup = new THREE.Group()
  showDebug = import.meta.env.DEV

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.scene.background = new THREE.Color(0x1a2230)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.9)
    sun.position.set(4, 10, 6)
    this.scene.add(sun)

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    this.camera.position.set(0, 16, 0.01)
    this.camera.lookAt(0, 0, 0)

    this.buildTable()
    this.scene.add(this.fx)
    this.scene.add(this.debugGroup)
  }

  private buildTable() {
    const { halfW, halfD } = CFG.table
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.4, 0.25, halfD * 2 + 0.4),
      new THREE.MeshStandardMaterial({ color: 0xc4a574, metalness: 0.15, roughness: 0.7 }),
    )
    top.position.y = -0.2
    this.scene.add(top)
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, halfD * 2),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc8, metalness: 0.05, roughness: 0.85 }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.y = -0.05
    this.scene.add(pad)
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private ensurePencil(u: Unit): PencilMesh {
    let p = this.pencils.get(u.id)
    if (p) return p
    const root = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 1.1, 8),
      new THREE.MeshStandardMaterial({
        color: u.isPlayer ? 0x38bdf8 : 0xf59e0b,
        roughness: 0.45,
      }),
    )
    body.rotation.x = Math.PI / 2
    body.position.z = -0.15
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.1 }),
    )
    tip.rotation.x = -Math.PI / 2
    tip.position.z = -0.85
    root.add(body, tip)
    if (u.isPlayer) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.03, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.02
      root.add(ring)
      p = { root, body, tip, ring }
    } else {
      p = { root, body, tip }
    }
    this.scene.add(root)
    this.pencils.set(u.id, p)
    return p
  }

  sync(world: World) {
    // Remove dead visuals stay but dim
    for (const u of world.units) {
      const p = this.ensurePencil(u)
      p.root.visible = true
      p.root.position.set(u.x, u.flash > 0 ? 0.08 : 0.05, u.z)
      const yaw = Math.atan2(u.facingX, u.facingZ)
      p.root.rotation.y = yaw
      // Lunge / attack lean
      const lean =
        u.attack.phase === 'windup' ? -0.25 : u.attack.phase === 'active' ? 0.35 : u.attack.phase === 'recovery' ? -0.1 : 0
      p.root.rotation.x = lean
      const mat = p.body.material as THREE.MeshStandardMaterial
      if (u.flash > 0) mat.emissive = new THREE.Color(0xffffff)
      else mat.emissive = new THREE.Color(0x000000)
      p.root.scale.setScalar(u.alive ? 1 : 0.7)
      mat.opacity = u.alive ? 1 : 0.35
      mat.transparent = !u.alive
      if (u.trail > 0 && u.alive) {
        const ghost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, 0.6, 6),
          new THREE.MeshBasicMaterial({ color: u.isPlayer ? 0x7dd3fc : 0xfbbf24, transparent: true, opacity: 0.25 }),
        )
        ghost.rotation.x = Math.PI / 2
        ghost.position.set(u.x - u.facingX * 0.4, 0.12, u.z - u.facingZ * 0.4)
        this.fx.add(ghost)
        window.setTimeout(() => {
          this.fx.remove(ghost)
          ghost.geometry.dispose()
          ;(ghost.material as THREE.Material).dispose()
        }, 180)
      }
    }

    for (const h of world.hits) {
      this.spawnHitFlash(h)
    }

    this.drawDebug(world)
  }

  private spawnHitFlash(h: HitEvent) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff7ae, transparent: true, opacity: 0.9 }),
    )
    s.position.set(h.x, 0.3, h.z)
    this.fx.add(s)
    window.setTimeout(() => {
      this.fx.remove(s)
      s.geometry.dispose()
      ;(s.material as THREE.Material).dispose()
    }, 120)
  }

  private drawDebug(world: World) {
    while (this.debugGroup.children.length) {
      const c = this.debugGroup.children.pop()!
      this.debugGroup.remove(c)
      ;(c as THREE.Mesh).geometry?.dispose?.()
    }
    if (!this.showDebug) return
    for (const u of world.units) {
      if (!u.alive) continue
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(CFG.unit.radius - 0.02, CFG.unit.radius, 24),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(u.x, 0.06, u.z)
      this.debugGroup.add(ring)
      if (u.attack.phase === 'active' || u.attack.phase === 'windup') {
        const len = CFG.attack.range
        const geo = new THREE.PlaneGeometry(CFG.attack.hitRadius * 2, len)
        const atk = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            color: u.attack.phase === 'active' ? 0xef4444 : 0xf59e0b,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          }),
        )
        atk.rotation.x = -Math.PI / 2
        const mid = len * 0.5
        atk.position.set(u.x + u.attack.dirX * mid, 0.07, u.z + u.attack.dirZ * mid)
        atk.rotation.z = -Math.atan2(u.attack.dirX, u.attack.dirZ)
        this.debugGroup.add(atk)
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  /** Raycast mouse to table plane y=0 */
  screenToTable(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; z: number } | null {
    const rect = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    if (!ray.ray.intersectPlane(plane, hit)) return null
    return { x: hit.x, z: hit.z }
  }
}
