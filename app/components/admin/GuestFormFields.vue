<script setup lang="ts">
import { IMaskComponent } from 'vue-imask'
import { DRINK_OPTIONS, DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'

export interface GuestFormState {
  fio: string
  phone: string
  comment: string
  drinks: DrinkOption[]
  attending: boolean | null
  allowCompanions: boolean
}

defineProps<{
  layout: 'row' | 'stack'
  errors: Record<string, string>
}>()

const state = defineModel<GuestFormState>('state', { required: true })

const drinkItems = DRINK_OPTIONS.map((opt) => ({ label: DRINK_LABELS[opt], value: opt }))

const attendingItems = [
  { label: '—', value: null },
  { label: 'Да', value: true },
  { label: 'Нет', value: false }
]

const allowCompanionsItems = [
  { label: 'Со спутниками', value: true },
  { label: 'Фиксированное', value: false }
]

function onFioBlur() {
  state.value.fio = formatFio(state.value.fio)
}
</script>

<template>
  <template v-if="layout === 'row'">
    <td class="px-3 py-2 align-top">
      <UFormField name="fio" :error="errors.fio">
        <UInput v-model="state.fio" placeholder="ФИО" @blur="onFioBlur" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="phone" :error="errors.phone">
        <IMaskComponent
          v-model="state.phone"
          mask="+7 000 000-00-00"
          type="tel"
          placeholder="Телефон"
          class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-transparent"
        />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="drinks" :error="errors.drinks">
        <UCheckboxGroup v-model="state.drinks" :items="drinkItems" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="comment" :error="errors.comment">
        <UTextarea v-model="state.comment" placeholder="Комментарий" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="attending" :error="errors.attending">
        <USelect v-model="state.attending" :items="attendingItems" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="allowCompanions" :error="errors.allowCompanions">
        <USelect v-model="state.allowCompanions" :items="allowCompanionsItems" />
      </UFormField>
    </td>
  </template>

  <div v-else class="flex flex-col gap-3">
    <UFormField label="ФИО" name="fio" :error="errors.fio">
      <UInput v-model="state.fio" placeholder="ФИО" class="w-full" @blur="onFioBlur" />
    </UFormField>
    <UFormField label="Телефон" name="phone" :error="errors.phone">
      <IMaskComponent
        v-model="state.phone"
        mask="+7 000 000-00-00"
        type="tel"
        placeholder="Телефон"
        class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-transparent"
      />
    </UFormField>
    <UFormField label="Напитки" name="drinks" :error="errors.drinks">
      <UCheckboxGroup v-model="state.drinks" :items="drinkItems" />
    </UFormField>
    <UFormField label="Комментарий" name="comment" :error="errors.comment">
      <UTextarea v-model="state.comment" placeholder="Комментарий" class="w-full" />
    </UFormField>
    <UFormField label="Придёт" name="attending" :error="errors.attending">
      <USelect v-model="state.attending" :items="attendingItems" class="w-full" />
    </UFormField>
    <UFormField label="Тип приглашения" name="allowCompanions" :error="errors.allowCompanions">
      <USelect v-model="state.allowCompanions" :items="allowCompanionsItems" class="w-full" />
    </UFormField>
  </div>
</template>
