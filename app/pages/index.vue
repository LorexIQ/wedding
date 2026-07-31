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
