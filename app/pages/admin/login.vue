<script setup lang="ts">
import { reactive, ref } from 'vue'

// См. комментарий в admin/index.vue: класс на <body>, чтобы интерфейсный
// шрифт доставал и до телепортируемых оверлеев Nuxt UI.
useHead({ bodyAttrs: { class: 'admin-ui' } })

const state = reactive({ login: '', password: '' })
const error = ref('')

async function onSubmit() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { login: state.login, password: state.password } })
    await navigateTo('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Ошибка входа'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <UForm :state="state" class="flex flex-col gap-4" @submit="onSubmit">
        <h1 class="text-lg font-medium">
          Вход в админку
        </h1>
        <UFormField label="Логин" name="login">
          <UInput v-model="state.login" class="w-full" />
        </UFormField>
        <UFormField label="Пароль" name="password">
          <UInput v-model="state.password" type="password" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
        <UButton type="submit" block>
          Войти
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
