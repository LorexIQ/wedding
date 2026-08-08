<script setup lang="ts">
useSeoMeta({ title: 'Вы не приглашены' })
</script>

<template>
  <main class="band band--paper stub">
    <div class="inner stub__body">
      <p class="eyebrow">Дмитрий и Александра</p>
      <h1>Вы не приглашены на мероприятие, извините :(</h1>
    </div>
  </main>
</template>

<style scoped>
.stub {
  display: flex;
  align-items: center;
  min-height: 100vh;
}

.stub__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  text-align: center;
}

.stub__body h1 {
  font-size: clamp(1.5rem, 5vw, 2.1rem);
  font-style: italic;
  color: var(--ink-soft);
}
</style>
