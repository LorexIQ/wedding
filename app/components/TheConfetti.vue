<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Салют при заходе на страницу: снаряды взлетают от левого и правого
 * края, на вершине разрываются веером искр и лент.
 *
 * Работает один раз за визит, поверх страницы и мимо кликов. При
 * `prefers-reduced-motion` не запускается вовсе — вспышки движения
 * бьют по тем, кому от них плохо.
 */

const canvas = ref<HTMLCanvasElement | null>(null)
const done = ref(false)

// Цвета из палитры приглашения: на льняном фоне яркая радуга выглядит
// чужой, а золото с зеленью читается как часть оформления.
const COLORS = ['#B99A62', '#8B9880', '#8E6F3E', '#C7B08A', '#6E6255']

const GRAVITY = 620
const DRAG = 0.86

type Kind = 'shell' | 'spark' | 'ribbon'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  angle: number
  spin: number
  kind: Kind
}

let particles: Particle[] = []
let raf = 0
let stopped = false

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

/** Снаряд, летящий вверх от края экрана к центру. */
function launchShell(fromLeft: boolean, w: number, h: number): Particle {
  const edge = fromLeft ? rand(0.04, 0.14) : rand(0.86, 0.96)
  const inward = fromLeft ? rand(120, 260) : rand(-260, -120)

  return {
    x: w * edge,
    y: h + 10,
    vx: inward,
    vy: -rand(760, 940),
    life: 0,
    maxLife: rand(0.85, 1.15),
    color: pick(COLORS),
    size: 3,
    angle: 0,
    spin: 0,
    kind: 'shell'
  }
}

/** Разрыв: плотный веер искр и несколько крутящихся лент. */
function burst(at: Particle) {
  const sparks = Math.round(rand(54, 78))
  for (let i = 0; i < sparks; i += 1) {
    const angle = (Math.PI * 2 * i) / sparks + rand(-0.06, 0.06)
    const speed = rand(90, 320)
    particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: rand(0.9, 1.7),
      color: Math.random() < 0.75 ? at.color : pick(COLORS),
      size: rand(1.6, 3.2),
      angle: 0,
      spin: 0,
      kind: 'spark'
    })
  }

  for (let i = 0; i < 16; i += 1) {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(60, 200)
    particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: rand(1.6, 2.6),
      color: pick(COLORS),
      size: rand(4, 8),
      angle: rand(0, Math.PI),
      spin: rand(-7, 7),
      kind: 'ribbon'
    })
  }
}

onMounted(() => {
  const el = canvas.value
  if (!el) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    done.value = true
    return
  }

  const ctx = el.getContext('2d')
  if (!ctx) return

  let w = 0
  let h = 0

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    el!.width = Math.floor(w * dpr)
    el!.height = Math.floor(h * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()
  window.addEventListener('resize', resize)

  // Залпы вразнобой: одновременные выстрелы читаются как глитч,
  // а сдвиг в полсекунды — как праздник.
  const salvo: Array<[number, boolean]> = [
    [0.15, true], [0.42, false],
    [1.15, true], [1.48, false],
    [2.25, true], [2.40, false]
  ]
  let fired = 0
  let elapsed = 0
  let last = performance.now()

  function frame(now: number) {
    if (stopped) return

    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    elapsed += dt

    while (fired < salvo.length && elapsed >= salvo[fired]![0]) {
      particles.push(launchShell(salvo[fired]![1], w, h))
      fired += 1
    }

    ctx!.clearRect(0, 0, w, h)

    const alive: Particle[] = []
    for (const p of particles) {
      p.life += dt

      if (p.kind === 'shell') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += GRAVITY * dt * 0.55

        if (p.life >= p.maxLife || p.vy >= 0) {
          burst(p)
          continue
        }

        ctx!.globalAlpha = 1
        ctx!.fillStyle = p.color
        ctx!.beginPath()
        ctx!.ellipse(p.x, p.y, p.size, p.size * 2.6, 0, 0, Math.PI * 2)
        ctx!.fill()
        alive.push(p)
        continue
      }

      const drag = DRAG ** (dt * 60)
      p.vx *= drag
      p.vy = p.vy * drag + GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt

      const t = p.life / p.maxLife
      if (t >= 1 || p.y > h + 60) continue

      ctx!.globalAlpha = 1 - t * t
      ctx!.fillStyle = p.color

      if (p.kind === 'ribbon') {
        p.angle += p.spin * dt
        ctx!.save()
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.angle)
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx!.restore()
      } else {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }

      alive.push(p)
    }

    particles = alive

    if (fired >= salvo.length && particles.length === 0) {
      ctx!.clearRect(0, 0, w, h)
      done.value = true
      window.removeEventListener('resize', resize)
      return
    }

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  onUnmounted(() => {
    stopped = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  })
})
</script>

<template>
  <canvas
    v-show="!done"
    ref="canvas"
    class="confetti"
    aria-hidden="true"
  />
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  z-index: 50;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
