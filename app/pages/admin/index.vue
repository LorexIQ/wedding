<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAdminGuests, type GuestRecord } from '../../composables/useAdminGuests'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, patchGuest, removeGuest } = useAdminGuests()
await fetchGuests()

const editingId = ref<number | null>(null)
const editForm = reactive({ phone: '', comment: '', drinks: [] as string[] })

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id
  editForm.phone = guest.phone ?? ''
  editForm.comment = guest.comment ?? ''
  editForm.drinks = [...guest.drinks]
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  await patchGuest(id, {
    phone: editForm.phone,
    comment: editForm.comment,
    drinks: editForm.drinks
  })
  editingId.value = null
}

async function onLogout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <div>
    <button @click="onLogout">Выйти</button>
    <a href="/api/admin/guests/export">Экспорт CSV</a>

    <p v-if="loading">Загрузка...</p>

    <table v-else>
      <thead>
        <tr><th>ФИО</th><th>Телефон</th><th>Напитки</th><th>Сопровождающие</th><th>Комментарий</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="guest in guestsList" :key="guest.id">
          <td>{{ guest.fio }}</td>

          <template v-if="editingId === guest.id">
            <td><input v-model="editForm.phone" type="tel"></td>
            <td>
              <label v-for="opt in DRINK_OPTIONS" :key="opt">
                <input v-model="editForm.drinks" type="checkbox" :value="opt">
                {{ DRINK_LABELS[opt] }}
              </label>
            </td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td><textarea v-model="editForm.comment" /></td>
            <td>
              <button @click="saveEdit(guest.id)">Сохранить</button>
              <button @click="cancelEdit">Отмена</button>
            </td>
          </template>

          <template v-else>
            <td>{{ guest.phone }}</td>
            <td>{{ guest.drinks.join(', ') }}</td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td>{{ guest.comment }}</td>
            <td>
              <button @click="startEdit(guest)">Изменить</button>
              <button @click="removeGuest(guest.id)">Удалить</button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>
