<script setup lang="ts">
useSeoMeta({ title: 'Открываем приглашение…' })

const route = useRoute()
const code = String(route.params.code)
const inviteCode = useInviteCode()

try {
  await $fetch(`/api/invite/${encodeURIComponent(code)}`)
  inviteCode.value = code
  await navigateTo('/')
} catch {
  await navigateTo('/not-invited')
}
</script>

<template>
  <p>Открываем приглашение…</p>
</template>
