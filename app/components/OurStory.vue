<script setup lang="ts">
import { ref } from 'vue'
import { wedding } from '../content/wedding'

// Фото пары ещё не прислали. Пока файла нет, показываем размеченную
// заглушку вместо иконки битой картинки.
const photoBroken = ref(false)
</script>

<template>
  <section class="band band--deep">
    <div class="inner inner--wide story">
      <img
        v-if="!photoBroken"
        class="story__photo"
        :src="wedding.story.photo"
        :alt="wedding.story.photoAlt"
        width="640"
        height="640"
        @error="photoBroken = true"
      >
      <div v-else class="story__stub">
        Фото
        <span>квадратное, 1:1</span>
      </div>

      <div class="story__body">
        <p class="eyebrow">Наша история</p>
        <h2>{{ wedding.story.heading }}</h2>
        <p class="story__text">{{ wedding.story.text }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.story {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(1.6rem, 4vw, 2.4rem);
  align-items: center;
}

@media (min-width: 720px) {
  .story {
    grid-template-columns: 19rem 1fr;
  }
}

.story__photo {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  /* Пара стоит в верхней трети кадра — центр-кроп резал бы по лицам. */
  object-position: center 22%;
  /* Плотная сепия и приглушённый контраст — фото будто отпечатано
     на льняной бумаге сайта, а не просто снято вечером. */
  filter: sepia(0.35) contrast(0.92) brightness(0.98) saturate(0.75);
}

.story__stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  aspect-ratio: 1 / 1;
  padding: 12px;
  border: 1px dashed var(--ink-faint);
  background: repeating-linear-gradient(45deg, transparent 0 11px, rgba(147, 164, 127, 0.1) 11px 22px);
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  color: var(--ink-faint);
}

.story__stub span {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: none;
}

.story__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.story__text {
  color: var(--ink-soft);
}
</style>
