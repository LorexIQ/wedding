<script setup lang="ts">
import { wedding } from '../content/wedding'
</script>

<template>
  <section class="band band--deep">
    <div class="inner notes">
      <div class="notes__head">
        <p class="eyebrow">Несколько просьб</p>
        <h2>Дорогие гости</h2>
      </div>

      <div v-for="(note, index) in wedding.notes" :key="index" class="note">
        <span class="note__mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M7 1v12M1 7h12" />
          </svg>
        </span>
        <p class="note__text">{{ note }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: clamp(1.6rem, 4vw, 2.2rem);
}

.notes__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  text-align: center;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.note__mark {
  flex: 0 0 auto;
  margin-top: 5px;
  color: var(--sage);
}

.note__text {
  color: var(--ink-soft);
}
</style>
