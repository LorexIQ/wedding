# Конверт-приветствие + салют — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полноэкранный конверт-гейт на первом заходе гостя (`/`), который открывается по клику анимацией «флап-переворот → пауза → сдвиг вниз», после чего запускается салют и ставится флаг `envelopeOpened=true` на сервере.

**Architecture:** Три компонента с чёткими границами. `TheConfetti.vue` теряет автозапуск на `mount` и открывает `fire()` через `defineExpose`. `TheEnvelope.vue` (новый) — самодостаточный: не знает про конфетти и не шлёт запросов, только анимирует открытие и эмитит `opened`. `app/pages/index.vue` — координатор: решает, показывать ли `TheEnvelope` (по `inviteGuest.envelopeOpened`), и по событию `opened` (или сразу на mount, если конверт уже был открыт раньше) вызывает `confettiRef.fire()` и параллельно шлёт `POST /api/invite/[code]/open`.

**Tech Stack:** Nuxt 4 / Vue 3 (`<script setup lang="ts">`), чистый CSS (переходы/3D-transform, без анимационных библиотек — в проекте их нет и не появится).

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-31-invitation-envelope-design.md`. Все требования оттуда — обязательны, эта таблица только фиксирует конкретные числа, которые спека даёт диапазоном.
- Тайминги анимации (взяты серединой заданных в спеке диапазонов, зафиксированы как константы в коде — см. Task 2): флап `600ms`, пауза `500ms`, сдвиг `700ms`.
- Палитра — только существующие CSS-переменные из `app/assets/css/main.css` (`--linen`, `--linen-deep`, `--paper`, `--ink-soft`, `--sage`, `--rule`, `--serif`). Новых цветов не вводим.
- Печать на конверте — `✦`, без монограммы. Никакого ФИО гостя на конверте (явное решение в брейнсторме).
- `prefers-reduced-motion`: конверт исчезает одним кадром, без промежуточных состояний флапа/сдвига; конфетти в этом случае не запускается (уже гарантировано существующим self-guard в `TheConfetti`/новым в `TheEnvelope`).
- Новых npm-зависимостей не добавляем.
- **Тесты**: в проекте нет инфраструктуры для тестов Vue-компонентов (`@vue/test-utils` не установлен, `vitest.config.ts` → `environment: 'node'`), и уже существующий `TheConfetti.vue` explicitly помечен в CodeGraph как «no covering tests». Эта же конвенция сохраняется для `TheConfetti.vue` и нового `TheEnvelope.vue` — оба проверяются вручную через дев-сервер (шаги ниже), а не юнит-тестами. `npm test` (`vitest run`) в каждой задаче используется только как регрессионная проверка, что существующий серверный/утилитный набор тестов не сломан.

---

## Task 1: Конфетти — константы наружу, автозапуск → `fire()`

**Files:**
- Create: `app/utils/confettiConfig.ts`
- Modify: `app/components/TheConfetti.vue` (весь файл — большая часть логики переносится из `onMounted` в новую функцию `fire()`)

**Interfaces:**
- Produces: `TheConfetti.vue` открывает `defineExpose({ fire })`, где `fire(): void` — запускает залп; если элемент ещё не смонтирован, `prefers-reduced-motion` активен, или `fire()` уже вызывался — ничего не делает (idempotent, безопасно звать один раз).

- [ ] **Step 1: Создать `app/utils/confettiConfig.ts`**

```ts
// Тонкая настройка салюта — цвета, физика, интенсивность и тайминг
// залпов. Сама анимация (частицы, канвас) живёт в TheConfetti.vue и
// сюда не заглядывает — трогать её не нужно, чтобы подкрутить шоу.

// Цвета из палитры приглашения: на льняном фоне яркая радуга выглядит
// чужой, а шалфейная зелень с айвори читается как часть оформления.
export const CONFETTI_COLORS = ['#7C8A6E', '#93A47F', '#C7CEB9', '#E8ECDF', '#FBFAF6']

export const CONFETTI_GRAVITY = 620
export const CONFETTI_DRAG = 0.86

export const CONFETTI_SPARK_COUNT = { min: 54, max: 78 }
export const CONFETTI_RIBBON_COUNT = 16

// Залпы вразнобой: одновременные выстрелы читаются как глитч, а сдвиг
// в полсекунды — как праздник. [время в секундах, летит слева?]
export const CONFETTI_SALVO: Array<[number, boolean]> = [
  [0.15, true], [0.42, false],
  [1.15, true], [1.48, false],
  [2.25, true], [2.40, false]
]
```

- [ ] **Step 2: Запустить регрессионный набор тестов**

Run: `npm test`
Expected: PASS (новый файл — просто константы, ничего не ломает)

- [ ] **Step 3: Переписать `app/components/TheConfetti.vue` целиком**

```vue
<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import {
  CONFETTI_COLORS,
  CONFETTI_GRAVITY,
  CONFETTI_DRAG,
  CONFETTI_SPARK_COUNT,
  CONFETTI_RIBBON_COUNT,
  CONFETTI_SALVO
} from '../utils/confettiConfig'

/**
 * Салют: снаряды взлетают от левого и правого края, на вершине
 * разрываются веером искр и лент. Не запускается сама — вызывающий
 * код зовёт fire() (см. defineExpose ниже), когда решит, что пора.
 * При `prefers-reduced-motion` fire() ничего не делает — вспышки
 * движения бьют по тем, кому от них плохо.
 */

const canvas = ref<HTMLCanvasElement | null>(null)
const done = ref(true)

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
let fired = false
let ctx: CanvasRenderingContext2D | null = null
let w = 0
let h = 0

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

/** Снаряд, летящий вверх от края экрана к центру. */
function launchShell(fromLeft: boolean): Particle {
  const edge = fromLeft ? rand(0.04, 0.14) : rand(0.86, 0.96)
  const inward = fromLeft ? rand(120, 260) : rand(-260, -120)

  return {
    x: w * edge,
    y: h + 10,
    vx: inward,
    vy: -rand(760, 940),
    life: 0,
    maxLife: rand(0.85, 1.15),
    color: pick(CONFETTI_COLORS),
    size: 3,
    angle: 0,
    spin: 0,
    kind: 'shell'
  }
}

/** Разрыв: плотный веер искр и несколько крутящихся лент. */
function burst(at: Particle) {
  const sparks = Math.round(rand(CONFETTI_SPARK_COUNT.min, CONFETTI_SPARK_COUNT.max))
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
      color: Math.random() < 0.75 ? at.color : pick(CONFETTI_COLORS),
      size: rand(1.6, 3.2),
      angle: 0,
      spin: 0,
      kind: 'spark'
    })
  }

  for (let i = 0; i < CONFETTI_RIBBON_COUNT; i += 1) {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(60, 200)
    particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: rand(1.6, 2.6),
      color: pick(CONFETTI_COLORS),
      size: rand(4, 8),
      angle: rand(0, Math.PI),
      spin: rand(-7, 7),
      kind: 'ribbon'
    })
  }
}

function resize() {
  const el = canvas.value
  if (!el || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = window.innerWidth
  h = window.innerHeight
  el.width = Math.floor(w * dpr)
  el.height = Math.floor(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/** Запускает салют. Безопасно звать один раз; повторные вызовы игнорируются. */
function fire() {
  if (fired) return
  const el = canvas.value
  if (!el) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  fired = true
  ctx = el.getContext('2d')
  if (!ctx) return

  done.value = false
  resize()
  window.addEventListener('resize', resize)

  const salvo = CONFETTI_SALVO
  let salvoFired = 0
  let elapsed = 0
  let last = performance.now()

  function frame(now: number) {
    if (stopped || !ctx) return

    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    elapsed += dt

    while (salvoFired < salvo.length && elapsed >= salvo[salvoFired]![0]) {
      particles.push(launchShell(salvo[salvoFired]![1]))
      salvoFired += 1
    }

    ctx!.clearRect(0, 0, w, h)

    const alive: Particle[] = []
    for (const p of particles) {
      p.life += dt

      if (p.kind === 'shell') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += CONFETTI_GRAVITY * dt * 0.55

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

      const drag = CONFETTI_DRAG ** (dt * 60)
      p.vx *= drag
      p.vy = p.vy * drag + CONFETTI_GRAVITY * dt
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

    if (salvoFired >= salvo.length && particles.length === 0) {
      ctx!.clearRect(0, 0, w, h)
      done.value = true
      window.removeEventListener('resize', resize)
      return
    }

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)
}

onUnmounted(() => {
  stopped = true
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})

defineExpose({ fire })
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
```

- [ ] **Step 4: Запустить регрессионный набор тестов**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Ручная проверка (промежуточное состояние — это ожидаемо)**

`npm run dev`, открыть любую страницу под инвайт-гейтом. Конфетти теперь **не запускается сама** (`fire()` пока никто не зовёт) — это ожидаемое промежуточное состояние, консоль браузера должна быть чистой (без ошибок). Полное поведение вернётся в Task 2.

- [ ] **Step 6: Коммит**

```bash
git add app/utils/confettiConfig.ts app/components/TheConfetti.vue
git commit -m "refactor: extract confetti tuning constants, expose fire() instead of autoplay"
```

---

## Task 2: `TheEnvelope.vue` + связка на странице

**Files:**
- Create: `app/components/TheEnvelope.vue`
- Modify: `app/pages/index.vue` (весь файл)

**Interfaces:**
- Consumes: `TheConfetti`'s `fire(): void` (из Task 1, через `defineExpose`); `useInviteCode()` (`app/composables/useInviteCode.ts`, уже существует) → `Ref<string | null>`; `useState('inviteGuest')` (заполняется `app/middleware/invite.global.ts`, уже существует) → объект с полем `envelopeOpened: boolean`.
- Produces: `TheEnvelope.vue` эмитит `opened: []`, когда сайт полностью открыт (сдвиг долистал до конца, либо мгновенно — при `prefers-reduced-motion`). Не принимает пропсов, не знает о `envelopeOpened`/конфетти — видимостью управляет вызывающая страница через `v-if`.

- [ ] **Step 1: Создать `app/components/TheEnvelope.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Гейт-конверт на первом заходе: fixed-оверлей поверх уже отрисованного
 * сайта. По клику — флап открывается 3D-переворотом (как страница
 * книги), пауза, затем весь оверлей уезжает вниз, открывая сайт.
 * `opened` эмитится, когда сайт открыт полностью — что делать дальше
 * (конфетти, пометка на сервере) решает вызывающий код.
 *
 * При `prefers-reduced-motion` конверт исчезает одним кадром — ни флап,
 * ни сдвиг не показываются даже частично.
 */

const emit = defineEmits<{ opened: [] }>()

const FLAP_DURATION_MS = 600
const PAUSE_MS = 500
const SLIDE_DURATION_MS = 700

const closed = ref(false)
const opening = ref(false)
const flapOpen = ref(false)
const sliding = ref(false)
const showHint = ref(false)

const gateStyle = {
  '--flap-duration': `${FLAP_DURATION_MS}ms`,
  '--slide-duration': `${SLIDE_DURATION_MS}ms`
}

let hintTimer = 0

function onOpen() {
  if (opening.value) return
  opening.value = true
  window.clearTimeout(hintTimer)
  showHint.value = false

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    closed.value = true
    emit('opened')
    return
  }

  flapOpen.value = true
  window.setTimeout(() => {
    sliding.value = true
    window.setTimeout(() => {
      closed.value = true
      emit('opened')
    }, SLIDE_DURATION_MS)
  }, FLAP_DURATION_MS + PAUSE_MS)
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  hintTimer = window.setTimeout(() => {
    showHint.value = true
  }, 5000)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.clearTimeout(hintTimer)
})
</script>

<template>
  <div
    v-if="!closed"
    class="envelope-gate"
    :class="{ 'envelope-gate--sliding': sliding }"
    :style="gateStyle"
  >
    <button type="button" class="envelope" :disabled="opening" @click="onOpen">
      <span class="envelope__hint-text">Откройте письмо</span>

      <span class="envelope__body">
        <span class="envelope__flap" :class="{ 'envelope__flap--open': flapOpen }" />
        <span class="envelope__seal" :class="{ 'envelope__seal--pulse': showHint }">✦</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.envelope-gate {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--linen);
  transition: transform var(--slide-duration) ease-in;
}

.envelope-gate--sliding {
  transform: translateY(120vh);
}

.envelope {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--serif);
}

.envelope:disabled {
  cursor: default;
}

.envelope__hint-text {
  font-style: italic;
  font-size: 15px;
  color: var(--ink-soft);
}

.envelope__body {
  position: relative;
  width: min(78vw, 340px);
  aspect-ratio: 3 / 2;
  background: var(--paper);
  border: 1px solid var(--rule);
  box-shadow: 0 10px 30px rgba(54, 59, 50, 0.16);
  perspective: 1400px;
}

.envelope__flap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 58%;
  background: var(--linen-deep);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  transform-origin: bottom center;
  transform: rotateX(0deg);
  transition: transform var(--flap-duration) cubic-bezier(0.4, 0.1, 0.2, 1);
  backface-visibility: hidden;
}

.envelope__flap--open {
  transform: rotateX(-165deg);
}

.envelope__seal {
  position: absolute;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sage);
  color: var(--paper);
  font-size: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.envelope__seal--pulse::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: var(--sage);
  opacity: 0.5;
  animation: envelope-pulse 1.6s ease-in-out infinite;
}

@keyframes envelope-pulse {
  0%   { transform: scale(0.7); opacity: 0.6; }
  60%  { transform: scale(1.7); opacity: 0; }
  100% { transform: scale(1.7); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .envelope__seal--pulse::after {
    display: none;
  }
}
</style>
```

- [ ] **Step 2: Переписать `app/pages/index.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { wedding } from '../content/wedding'
import { useInviteCode } from '../composables/useInviteCode'

const title = `${wedding.groom} и ${wedding.bride} — ${wedding.dateLabel.replace('среда, ', '')}`
const description = `Приглашаем вас на нашу свадьбу ${wedding.dateLabel}, ${wedding.timeLabel}. `
  + `${wedding.venue.name} («${wedding.venue.subtitle}»), ${wedding.venue.address}, ${wedding.venue.settlement}.`

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogImage: '/og-image.jpg',
  ogType: 'website'
})

useHead({
  htmlAttrs: { lang: 'ru' }
})

const inviteGuest = useState<{ envelopeOpened: boolean } | undefined>('inviteGuest')
const inviteCode = useInviteCode()
const confettiRef = ref<{ fire: () => void } | null>(null)

onMounted(() => {
  if (inviteGuest.value?.envelopeOpened) {
    confettiRef.value?.fire()
  }
})

function onEnvelopeOpened() {
  confettiRef.value?.fire()

  const code = inviteCode.value
  if (code) {
    $fetch(`/api/invite/${encodeURIComponent(code)}/open`, { method: 'POST' }).catch((error) => {
      console.error(error)
    })
  }
}
</script>

<template>
  <main>
    <TheConfetti ref="confettiRef" />
    <TheEnvelope v-if="!inviteGuest?.envelopeOpened" @opened="onEnvelopeOpened" />

    <TheHero />
    <OurStory v-reveal />
    <TheVenue v-reveal />
    <GuestNotes v-reveal />
    <TheCountdown v-reveal />
    <RsvpForm v-reveal />
    <TheFooter v-reveal />
  </main>
</template>
```

- [ ] **Step 3: Запустить регрессионный набор тестов**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Ручная проверка — полный сценарий**

`npm run dev`, затем:

1. Залогиниться в `/admin/login` (используя аккаунт из `npm run seed:admin`, если ещё не создан).
2. В `/admin` нажать «+ Создать приглашение», сохранить пустой черновик (все поля необязательны), скопировать ссылку кнопкой «Скопировать ссылку».
3. В приватном окне браузера открыть скопированную ссылку `/invite/<код>` → должен произойти редирект на `/`.
4. Убедиться: виден конверт с печатью ✦ и текстом «Откройте письмо», ФИО нигде не показано.
5. Подождать 5с, не кликая — на печати должна появиться пульсирующая точка.
6. Кликнуть по конверту → флап переворачивается (видна 3D-глубина), короткая пауза, весь конверт уезжает вниз, под ним открывается сайт, тут же — салют.
7. В `/admin` у этого гостя должна стоять галочка «Открыл конверт».
8. Обновить страницу `/` в том же окне (тот же invite-cookie) → конверта больше нет, но салют стреляет сразу при загрузке.
9. В `/admin` снять галочку «Открыл конверт» → обновить `/` у гостя → конверт показывается снова.
10. В DevTools включить эмуляцию `prefers-reduced-motion: reduce` (Rendering tab → Emulate CSS media feature), зайти по новой пригласительной ссылке (другой созданный инвайт) → конверт должен исчезнуть по клику одним кадром, без видимого флапа/сдвига, салют не запускается.

- [ ] **Step 5: Коммит**

```bash
git add app/components/TheEnvelope.vue app/pages/index.vue
git commit -m "feat: add envelope gate with page-turn open animation, wire up confetti + envelopeOpened flag"
```

---

## Execution Handoff

План сохранён в `docs/superpowers/plans/2026-07-31-invitation-envelope-plan.md`.
