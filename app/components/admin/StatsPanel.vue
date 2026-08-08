<script setup lang="ts">
import { computed } from 'vue'
import { DRINK_OPTIONS, DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import type { GuestRecord } from '../../composables/useAdminGuests'

const props = defineProps<{
  guests: GuestRecord[]
}>()

const invitesCount = computed(() => props.guests.length)
const attendingCount = computed(() => props.guests.filter((g) => g.attending === true).length)
const notAttendingCount = computed(() => props.guests.filter((g) => g.attending === false).length)
const respondedCount = computed(() => props.guests.filter((g) => g.submitted).length)
const notRespondedCount = computed(() => props.guests.filter((g) => g.attending === null).length)
const companionsCount = computed(() => props.guests.reduce((sum, g) => sum + g.companions.length, 0))
const envelopeOpenedCount = computed(() => props.guests.filter((g) => g.envelopeOpened).length)

const tiles = computed(() => [
  { label: 'Приглашений', value: invitesCount.value },
  { label: 'Согласились', value: attendingCount.value },
  { label: 'Отказались', value: notAttendingCount.value },
  { label: 'Всего ответило', value: respondedCount.value },
  { label: 'Не ответили', value: notRespondedCount.value },
  { label: 'Спутников', value: companionsCount.value },
  { label: 'Открыли конверт', value: envelopeOpenedCount.value }
])

const drinkCounts = computed(() => {
  const counts = Object.fromEntries(DRINK_OPTIONS.map((option) => [option, 0])) as Record<DrinkOption, number>
  for (const guest of props.guests) {
    for (const drink of guest.drinks) counts[drink as DrinkOption]++
    for (const companion of guest.companions) {
      for (const drink of companion.drinks) counts[drink as DrinkOption]++
    }
  }
  return counts
})
</script>

<template>
  <UCard class="mb-6">
    <div class="flex flex-wrap gap-3">
      <div v-for="tile in tiles" :key="tile.label" class="rounded-md border border-default px-3 py-2 min-w-24">
        <p class="text-xs text-gray-500">{{ tile.label }}</p>
        <p class="text-lg font-medium">{{ tile.value }}</p>
      </div>
    </div>

    <p class="text-xs text-gray-500" style="padding: 15px 0 5px;">Алкоголь</p>
    <div class="flex flex-wrap gap-2">
      <UBadge v-for="option in DRINK_OPTIONS" :key="option" color="neutral" variant="subtle">
        {{ DRINK_LABELS[option] }}: {{ drinkCounts[option] }}
      </UBadge>
    </div>
  </UCard>
</template>
