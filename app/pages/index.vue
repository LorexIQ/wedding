<script setup lang="ts">
import { wedding } from '../content/wedding'

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
</script>

<template>
  <main>
    <TheConfetti />

    <TheHero />
    <OurStory v-reveal />
    <TheVenue v-reveal />
    <GuestNotes v-reveal />
    <TheCountdown v-reveal />
    <RsvpForm v-reveal />
    <TheFooter v-reveal />
  </main>
</template>
