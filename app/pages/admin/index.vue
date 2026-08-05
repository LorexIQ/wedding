<script setup lang="ts">
import { useAdminGuests } from '../../composables/useAdminGuests'
import { useAdminSettings } from '../../composables/useAdminSettings'
import GuestsTable from '../../components/admin/GuestsTable.vue'
import SettingsPanel from '../../components/admin/SettingsPanel.vue'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest } = useAdminGuests()
const { deadline, fetchSettings, patchSettings } = useAdminSettings()
await Promise.all([fetchGuests(), fetchSettings()])

async function onLogout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-medium">
        Гости
      </h1>
      <div class="flex items-center gap-4">
        <a href="/api/admin/guests/export" class="text-sm underline underline-offset-2 text-[var(--wheat)]">
          Экспорт CSV
        </a>
        <UButton color="neutral" variant="ghost" @click="onLogout">
          Выйти
        </UButton>
      </div>
    </div>

    <SettingsPanel :deadline="deadline" :patch-settings="patchSettings" />

    <GuestsTable
      :guests="guestsList"
      :loading="loading"
      :create-guest-invite="createGuestInvite"
      :patch-guest="patchGuest"
      :remove-guest="removeGuest"
    />
  </div>
</template>
