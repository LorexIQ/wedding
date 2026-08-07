<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { ZodIssue } from 'zod'
import { guestCreateSchema, guestPatchSchema } from '#shared/schemas/rsvp'
import { DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import type { GuestRecord, GuestCreateInput } from '../../composables/useAdminGuests'
import GuestFormFields, { type GuestFormState } from './GuestFormFields.vue'
import DeleteGuestModal from './DeleteGuestModal.vue'
import { cellClass, headCellClass, stickyCellClass, stickyHeadCellClass } from './tableClasses'

const props = defineProps<{
  guests: GuestRecord[]
  loading: boolean
  createGuestInvite: (input: GuestCreateInput) => Promise<GuestRecord>
  patchGuest: (id: number, patch: Partial<GuestRecord>) => Promise<void>
  removeGuest: (id: number) => Promise<void>
}>()

const toast = useToast()

function emptyForm(): GuestFormState {
  return { fio: '', phone: '', comment: '', drinks: [], attending: null, allowCompanions: true }
}

function zodIssuesToErrors(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

const editingId = ref<number | null>(null)
const editForm = reactive<GuestFormState>(emptyForm())
const editErrors = ref<Record<string, string>>({})

const creating = ref(false)
const draft = reactive<GuestFormState>(emptyForm())
const createErrors = ref<Record<string, string>>({})

const guestPendingDelete = ref<GuestRecord | null>(null)
const isDeleteModalOpen = ref(false)

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id
  editErrors.value = {}
  editForm.fio = guest.fio ?? ''
  editForm.phone = guest.phone ?? ''
  editForm.comment = guest.comment ?? ''
  editForm.drinks = [...guest.drinks] as DrinkOption[]
  editForm.attending = guest.attending
  editForm.allowCompanions = guest.allowCompanions
}

function cancelEdit() {
  editingId.value = null
}

async function onEditSubmit(guest: GuestRecord) {
  const parsed = guestPatchSchema.safeParse(editForm)
  if (!parsed.success) {
    editErrors.value = zodIssuesToErrors(parsed.error.issues)
    return
  }
  editErrors.value = {}
  try {
    await props.patchGuest(guest.id, parsed.data as Partial<GuestRecord>)
    editingId.value = null
    toast.add({ title: 'Сохранено', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить гостя', color: 'error' })
  }
}

function startCreate() {
  creating.value = true
  createErrors.value = {}
  Object.assign(draft, emptyForm())
}

function cancelCreate() {
  creating.value = false
}

async function onCreateSubmit() {
  const parsed = guestCreateSchema.safeParse(draft)
  if (!parsed.success) {
    createErrors.value = zodIssuesToErrors(parsed.error.issues)
    return
  }
  createErrors.value = {}
  try {
    await props.createGuestInvite(parsed.data)
    creating.value = false
    toast.add({ title: 'Приглашение создано', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось создать', description: 'Не получилось создать приглашение', color: 'error' })
  }
}

async function toggleSubmitted(guest: GuestRecord, value: boolean) {
  try {
    await props.patchGuest(guest.id, { submitted: value })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить статус ответа', color: 'error' })
  }
}

async function toggleEnvelopeOpened(guest: GuestRecord, value: boolean) {
  try {
    await props.patchGuest(guest.id, { envelopeOpened: value })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить статус конверта', color: 'error' })
  }
}

async function copyLink(guest: GuestRecord) {
  try {
    await navigator.clipboard.writeText(`${location.origin}/invite/${guest.inviteCode}`)
    toast.add({ title: 'Ссылка скопирована', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось скопировать', description: 'Не получилось скопировать ссылку', color: 'error' })
  }
}

function requestDelete(guest: GuestRecord) {
  guestPendingDelete.value = guest
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  const guest = guestPendingDelete.value
  if (!guest) return
  try {
    await props.removeGuest(guest.id)
    toast.add({ title: 'Гость удалён', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось удалить', description: 'Не получилось удалить гостя', color: 'error' })
  } finally {
    guestPendingDelete.value = null
  }
}

function attendingLabel(attending: boolean | null) {
  if (attending === true) return 'Да'
  if (attending === false) return 'Нет'
  return '—'
}

function attendingColor(attending: boolean | null): 'success' | 'error' | 'neutral' {
  if (attending === true) return 'success'
  if (attending === false) return 'error'
  return 'neutral'
}
</script>

<template>
  <div>
    <p v-if="loading" class="text-sm text-gray-500">
      Загрузка...
    </p>

    <template v-else>
      <div class="admin-scroll hidden md:block overflow-x-auto border-t border-l border-default rounded-md">
        <table class="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th :class="headCellClass">ФИО</th>
              <th :class="headCellClass">Телефон</th>
              <th :class="headCellClass">Напитки</th>
              <th :class="headCellClass">Комментарий</th>
              <th :class="headCellClass">Придёт</th>
              <th :class="headCellClass">Тип</th>
              <th :class="headCellClass">Сопровождающие</th>
              <th :class="headCellClass">Ответил</th>
              <th :class="headCellClass">Открыл конверт</th>
              <th :class="headCellClass">Ссылка</th>
              <th :class="stickyHeadCellClass">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="guest in guests" :key="guest.id">
              <template v-if="editingId === guest.id">
                <GuestFormFields :state="editForm" layout="row" :errors="editErrors" />
                <td :class="cellClass">{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
                <td :class="cellClass" colspan="3" />
                <td :class="stickyCellClass">
                  <div class="flex gap-2">
                    <UButton size="xs" @click="onEditSubmit(guest)">
                      Сохранить
                    </UButton>
                    <UButton size="xs" color="neutral" variant="ghost" @click="cancelEdit">
                      Отмена
                    </UButton>
                  </div>
                </td>
              </template>

              <template v-else>
                <td :class="cellClass">{{ guest.fio }}</td>
                <td :class="cellClass">{{ guest.phone }}</td>
                <td :class="cellClass">{{ guest.drinks.map((d) => DRINK_LABELS[d as DrinkOption]).join(', ') }}</td>
                <td :class="cellClass">{{ guest.comment }}</td>
                <td :class="cellClass">
                  <UBadge :color="attendingColor(guest.attending)" variant="subtle">
                    {{ attendingLabel(guest.attending) }}
                  </UBadge>
                </td>
                <td :class="cellClass">{{ guest.allowCompanions ? 'Со спутниками' : 'Фиксированное' }}</td>
                <td :class="cellClass">{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
                <td :class="cellClass">
                  <UCheckbox
                    :model-value="guest.submitted"
                    @update:model-value="(v) => toggleSubmitted(guest, Boolean(v))"
                  />
                </td>
                <td :class="cellClass">
                  <UCheckbox
                    :model-value="guest.envelopeOpened"
                    @update:model-value="(v) => toggleEnvelopeOpened(guest, Boolean(v))"
                  />
                </td>
                <td :class="cellClass">
                  <UButton size="xs" variant="soft" :disabled="!guest.inviteCode" @click="copyLink(guest)">
                    Скопировать
                  </UButton>
                </td>
                <td :class="stickyCellClass">
                  <div class="flex gap-2">
                    <UButton size="xs" variant="soft" @click="startEdit(guest)">
                      Изменить
                    </UButton>
                    <UButton size="xs" color="error" variant="soft" @click="requestDelete(guest)">
                      Удалить
                    </UButton>
                  </div>
                </td>
              </template>
            </tr>

            <tr v-if="creating">
              <GuestFormFields :state="draft" layout="row" :errors="createErrors" />
              <td :class="cellClass" />
              <td :class="cellClass" colspan="3" />
              <td :class="stickyCellClass">
                <div class="flex gap-2">
                  <UButton size="xs" @click="onCreateSubmit">
                    ✓
                  </UButton>
                  <UButton size="xs" color="neutral" variant="ghost" @click="cancelCreate">
                    ✗
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <UButton v-if="!creating" class="mt-3" variant="soft" :disabled="creating" @click="startCreate">
          + Создать приглашение
        </UButton>
      </div>

      <div class="md:hidden flex flex-col gap-3">
        <UCard v-for="guest in guests" :key="guest.id">
          <template v-if="editingId === guest.id">
            <GuestFormFields :state="editForm" layout="stack" :errors="editErrors" />
            <div class="flex gap-2 mt-3">
              <UButton size="xs" @click="onEditSubmit(guest)">
                Сохранить
              </UButton>
              <UButton size="xs" color="neutral" variant="ghost" @click="cancelEdit">
                Отмена
              </UButton>
            </div>
          </template>

          <template v-else>
            <p class="font-medium">{{ guest.fio || 'Без имени' }}</p>
            <p class="text-sm text-gray-500">{{ guest.phone }}</p>
            <p class="text-sm">Напитки: {{ guest.drinks.map((d) => DRINK_LABELS[d as DrinkOption]).join(', ') || '—' }}</p>
            <p class="text-sm">Сопровождающие: {{ guest.companions.map((c) => c.fio).join(', ') || '—' }}</p>
            <p class="text-sm">Комментарий: {{ guest.comment || '—' }}</p>
            <div class="flex items-center gap-2 mt-1">
              <UBadge :color="attendingColor(guest.attending)" variant="subtle">
                {{ attendingLabel(guest.attending) }}
              </UBadge>
              <span class="text-sm text-gray-500">{{ guest.allowCompanions ? 'Со спутниками' : 'Фиксированное' }}</span>
            </div>
            <div class="flex items-center gap-3 mt-2">
              <label class="flex items-center gap-1 text-sm">
                <UCheckbox
                  :model-value="guest.submitted"
                  @update:model-value="(v) => toggleSubmitted(guest, Boolean(v))"
                />
                Ответил
              </label>
              <label class="flex items-center gap-1 text-sm">
                <UCheckbox
                  :model-value="guest.envelopeOpened"
                  @update:model-value="(v) => toggleEnvelopeOpened(guest, Boolean(v))"
                />
                Открыл конверт
              </label>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              <UButton size="xs" variant="soft" :disabled="!guest.inviteCode" @click="copyLink(guest)">
                Скопировать ссылку
              </UButton>
              <UButton size="xs" variant="soft" @click="startEdit(guest)">
                Изменить
              </UButton>
              <UButton size="xs" color="error" variant="soft" @click="requestDelete(guest)">
                Удалить
              </UButton>
            </div>
          </template>
        </UCard>

        <UCard v-if="creating">
          <GuestFormFields :state="draft" layout="stack" :errors="createErrors" />
          <div class="flex gap-2 mt-3">
            <UButton size="xs" @click="onCreateSubmit">
              Создать
            </UButton>
            <UButton size="xs" color="neutral" variant="ghost" @click="cancelCreate">
              Отмена
            </UButton>
          </div>
        </UCard>
        <UButton v-else variant="soft" :disabled="creating" @click="startCreate">
          + Создать приглашение
        </UButton>
      </div>
    </template>

    <DeleteGuestModal v-model:open="isDeleteModalOpen" :guest="guestPendingDelete" @confirm="confirmDelete" />
  </div>
</template>
