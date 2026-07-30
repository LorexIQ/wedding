<script setup lang="ts">
const login = ref('')
const password = ref('')
const error = ref('')

async function onSubmit() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { login: login.value, password: password.value } })
    await navigateTo('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Ошибка входа'
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <label>Логин <input v-model="login" type="text"></label>
    <label>Пароль <input v-model="password" type="password"></label>
    <p v-if="error" class="error">{{ error }}</p>
    <button type="submit">Войти</button>
  </form>
</template>
