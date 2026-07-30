<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { wedding } from '../content/wedding'
import { splitRemaining, type Remaining } from '../utils/countdown'

const target = new Date(wedding.startsAt).getTime()
const left = ref<Remaining | null>(null)

let timer: ReturnType<typeof setInterval> | undefined

function tick() {
  left.value = splitRemaining(target - Date.now())
}

// Только на клиенте: на сервере остаток застынет на момент рендера.
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <section class="band band--paper">
    <div class="inner count">
      <p class="eyebrow">До торжества осталось</p>

      <div class="clock" role="timer">
        <div class="clock__cell">
          <b>{{ left ? left.days : '—' }}</b>
          <small>дней</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.hours) : '—' }}</b>
          <small>часов</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.minutes) : '—' }}</b>
          <small>минут</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.seconds) : '—' }}</b>
          <small>секунд</small>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.8rem;
  text-align: center;
}

.clock {
  display: flex;
  gap: clamp(14px, 5vw, 34px);
  font-variant-numeric: tabular-nums;
}

.clock__cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 3.4rem;
}

.clock__cell b {
  font-size: clamp(2.1rem, 7vw, 3.1rem);
  font-weight: 400;
  line-height: 1;
}

.clock__cell small {
  font-family: var(--sans);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
</style>
