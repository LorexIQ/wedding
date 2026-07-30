<script setup lang="ts">
import { wedding } from '../content/wedding'
</script>

<template>
  <section class="band band--paper">
    <div class="inner venue">
      <p class="eyebrow">Место проведения</p>
      <h2>{{ wedding.venue.name }}</h2>
      <p class="venue__sub">{{ wedding.venue.subtitle }}</p>
      <p class="venue__addr">{{ wedding.venue.address }}</p>
      <p class="venue__sub">{{ wedding.venue.settlement }}</p>

      <div class="map">
        <iframe
          class="map__frame"
          :src="`https://yandex.ru/map-widget/v1/org/${wedding.venue.orgId}/`"
          title="Карта проезда"
          loading="lazy"
          allowfullscreen
        />
      </div>

      <a class="map__link" :href="wedding.venue.mapUrl" target="_blank" rel="noopener noreferrer">
        Открыть в Яндекс.Картах
      </a>
    </div>
  </section>
</template>

<style scoped>
.venue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

.venue__addr {
  font-size: clamp(1.15rem, 3vw, 1.4rem);
  font-style: italic;
}

.venue__sub {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.map {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--rule);
  background: var(--linen-deep);
}

.map__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.map__link {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
</style>
