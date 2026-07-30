<script setup lang="ts">
import { wedding } from '../content/wedding'
</script>

<template>
  <header class="hero">
    <p class="eyebrow">Приглашение на свадьбу</p>

    <h1 class="hero__names">
      {{ wedding.groom }}
      <span class="hero__amp">&amp;</span>
      {{ wedding.bride }}
    </h1>

    <div class="sprig" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M11 20V5" />
        <path d="M11 9c-3 0-4.5-1.5-4.5-4C9.5 5 11 6.5 11 9Z" />
        <path d="M11 9c3 0 4.5-1.5 4.5-4C12.5 5 11 6.5 11 9Z" />
        <path d="M11 15c-2.4 0-3.6-1.2-3.6-3.2C10 11.8 11 13 11 15Z" />
        <path d="M11 15c2.4 0 3.6-1.2 3.6-3.2C12 11.8 11 13 11 15Z" />
      </svg>
    </div>

    <p class="hero__when">
      <span>{{ wedding.dateLabel }}</span>
      <span>{{ wedding.timeLabel }}</span>
    </p>

    <p class="hero__lede">{{ wedding.hero.lede }}</p>
  </header>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.9rem;
  padding: clamp(4rem, 12vw, 7.5rem) 24px clamp(3rem, 8vw, 5rem);
  background: var(--paper);
  text-align: center;
}

.hero > * {
  animation: rise 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
}

.hero > *:nth-child(1) { animation-delay: 0.05s; }
.hero > *:nth-child(2) { animation-delay: 0.2s; }
.hero > *:nth-child(3) { animation-delay: 0.45s; }
.hero > *:nth-child(4) { animation-delay: 0.6s; }
.hero > *:nth-child(5) { animation-delay: 0.75s; }

.hero__names {
  font-size: clamp(2.9rem, 11vw, 5.1rem);
  font-style: italic;
  line-height: 1.06;
}

.hero__amp {
  display: block;
  margin: 0.24em 0;
  font-size: 0.42em;
  font-style: normal;
  color: var(--wheat);
}

.hero__when {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-family: var(--sans);
  font-size: 13px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.hero__lede {
  max-width: 27rem;
  font-style: italic;
  color: var(--ink-soft);
}

.sprig {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--wheat);
}

.sprig::before,
.sprig::after {
  content: "";
  width: clamp(40px, 14vw, 88px);
  height: 1px;
  background: linear-gradient(to right, transparent, var(--rule), transparent);
}
</style>
