<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAdminGuests, type GuestRecord } from '../../composables/useAdminGuests'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest } = useAdminGuests()
await fetchGuests()

const editingId = ref<number | null>(null)
const editForm = reactive({ fio: '', phone: '', comment: '', drinks: [] as string[] })

const creating = ref(false)
const draft = reactive({ fio: '', phone: '', comment: '', drinks: [] as string[] })

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id
  editForm.fio = guest.fio ?? ''
  editForm.phone = guest.phone ?? ''
  editForm.comment = guest.comment ?? ''
  editForm.drinks = [...guest.drinks]
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  await patchGuest(id, {
    fio: formatFio(editForm.fio),
    phone: editForm.phone,
    comment: editForm.comment,
    drinks: editForm.drinks
  })
  editingId.value = null
}

function startCreate() {
  creating.value = true
  draft.fio = ''
  draft.phone = ''
  draft.comment = ''
  draft.drinks = []
}

function cancelCreate() {
  creating.value = false
}

async function confirmCreate() {
  await createGuestInvite({
    fio: formatFio(draft.fio) || undefined,
    phone: draft.phone || undefined,
    comment: draft.comment || undefined,
    drinks: draft.drinks
  })
  creating.value = false
}

async function toggleSubmitted(guest: GuestRecord) {
  await patchGuest(guest.id, { submitted: !guest.submitted })
}

async function toggleEnvelopeOpened(guest: GuestRecord) {
  await patchGuest(guest.id, { envelopeOpened: !guest.envelopeOpened })
}

async function copyLink(guest: GuestRecord) {
  await navigator.clipboard.writeText(`${location.origin}/invite/${guest.inviteCode}`)
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
        <tr>
          <th>ФИО</th><th>Телефон</th><th>Напитки</th><th>Сопровождающие</th><th>Комментарий</th>
          <th>Ответил</th><th>Открыл конверт</th><th>Ссылка</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="guest in guestsList" :key="guest.id">
          <template v-if="editingId === guest.id">
            <td><input v-model="editForm.fio" type="text"></td>
            <td><input v-model="editForm.phone" type="tel"></td>
            <td>
              <label v-for="opt in DRINK_OPTIONS" :key="opt">
                <input v-model="editForm.drinks" type="checkbox" :value="opt">
                {{ DRINK_LABELS[opt] }}
              </label>
            </td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td><textarea v-model="editForm.comment" /></td>
            <td colspan="3"></td>
            <td>
              <button @click="saveEdit(guest.id)">Сохранить</button>
              <button @click="cancelEdit">Отмена</button>
            </td>
          </template>

          <template v-else>
            <td>{{ guest.fio }}</td>
            <td>{{ guest.phone }}</td>
            <td>{{ guest.drinks.join(', ') }}</td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td>{{ guest.comment }}</td>
            <td><input type="checkbox" :checked="guest.submitted" @change="toggleSubmitted(guest)"></td>
            <td><input type="checkbox" :checked="guest.envelopeOpened" @change="toggleEnvelopeOpened(guest)"></td>
            <td><button @click="copyLink(guest)">Скопировать ссылку</button></td>
            <td>
              <button @click="startEdit(guest)">Изменить</button>
              <button @click="removeGuest(guest.id)">Удалить</button>
            </td>
          </template>
        </tr>

        <tr v-if="creating">
          <td><input v-model="draft.fio" type="text" placeholder="ФИО"></td>
          <td><input v-model="draft.phone" type="tel" placeholder="Телефон"></td>
          <td>
            <label v-for="opt in DRINK_OPTIONS" :key="opt">
              <input v-model="draft.drinks" type="checkbox" :value="opt">
              {{ DRINK_LABELS[opt] }}
            </label>
          </td>
          <td></td>
          <td><textarea v-model="draft.comment" placeholder="Комментарий" /></td>
          <td colspan="2"></td>
          <td>
            <button @click="confirmCreate">✓</button>
            <button @click="cancelCreate">✗</button>
          </td>
        </tr>

        <tr v-else>
          <td colspan="9">
            <button :disabled="creating" @click="startCreate">+ Создать приглашение</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
