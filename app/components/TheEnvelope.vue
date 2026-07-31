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
let flapTimer = 0
let slideTimer = 0

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
  flapTimer = window.setTimeout(() => {
    sliding.value = true
    slideTimer = window.setTimeout(() => {
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
  window.clearTimeout(flapTimer)
  window.clearTimeout(slideTimer)
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
  box-shadow: 0 3px 6px rgba(54, 59, 50, 0.2);
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
