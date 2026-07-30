<script setup lang="ts">
useSeoMeta({
  title: 'Приглашение на свадьбу',
  ogTitle: 'Приглашение на свадьбу',
  description: 'Приглашаем вас на нашу свадьбу — подтвердите участие',
  ogDescription: 'Приглашаем вас на нашу свадьбу — подтвердите участие',
  ogImage: '/og-image.jpg',
  ogType: 'website'
})
</script>

<template>
  <main>
    <h1>Мы женимся!</h1>
    <p>Дата и место проведения — здесь.</p>
    <RsvpForm />
  </main>
</template>
