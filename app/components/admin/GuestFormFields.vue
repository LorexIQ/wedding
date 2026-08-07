<script setup lang="ts">
import { IMaskComponent } from 'vue-imask'
import { DRINK_OPTIONS, DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'
import { cellClass } from './tableClasses'

export interface GuestFormState {
  fio: string
  phone: string
  comment: string
  drinks: DrinkOption[]
  attending: boolean | null
  allowCompanions: boolean
}

const props = defineProps<{
  layout: 'row' | 'stack'
  errors: Record<string, string>
  state: GuestFormState
}>()

// Mirrors Nuxt UI's own UInput `base` slot classes (outline variant, primary
// color, md size) so the plain IMaskComponent-rendered <input> tracks the
// sage/stone theme instead of a hardcoded gray border — vue-imask renders a
// bare <input>, so it can't consume UInput's `:ui`/theme machinery directly.
// Ширина не зашита: в строке таблицы поле фиксированной ширины, в карточке —
// на всю ширину карточки.
const maskedInputClass = 'rounded-md border-0 appearance-none placeholder:text-dimmed disabled:cursor-not-allowed disabled:opacity-75 transition-colors px-2.5 py-1.5 text-base/5 text-highlighted bg-default ring ring-inset ring-accented outline-primary/25 focus-visible:outline-3 focus-visible:ring-primary md:text-sm'

// Ячейки строки не переносят текст (whitespace-nowrap в cellClass), иначе
// колонки скачут по ширине. Сообщение об ошибке — исключение: длинное, и в
// одну строку растянуло бы колонку на пол-экрана.
const wrapErrorUi = { error: 'whitespace-normal' }

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
  props.state.fio = formatFio(props.state.fio)
}
</script>

<template>
  <template v-if="layout === 'row'">
    <td :class="cellClass">
      <UFormField name="fio" :error="errors.fio" :ui="wrapErrorUi">
        <UInput v-model="state.fio" placeholder="ФИО" class="w-56" @blur="onFioBlur" />
      </UFormField>
    </td>
    <td :class="cellClass">
      <UFormField name="phone" :error="errors.phone" :ui="wrapErrorUi">
        <IMaskComponent
          v-model="state.phone"
          mask="+7 000 000-00-00"
          type="tel"
          placeholder="Телефон"
          :class="[maskedInputClass, 'w-44']"
        />
      </UFormField>
    </td>
    <td :class="cellClass">
      <UFormField name="drinks" :error="errors.drinks" :ui="wrapErrorUi">
        <UCheckboxGroup v-model="state.drinks" :items="drinkItems" />
      </UFormField>
    </td>
    <td :class="cellClass">
      <UFormField name="comment" :error="errors.comment" :ui="wrapErrorUi">
        <UTextarea v-model="state.comment" placeholder="Комментарий" class="w-72" />
      </UFormField>
    </td>
    <td :class="cellClass">
      <UFormField name="attending" :error="errors.attending" :ui="wrapErrorUi">
        <USelect v-model="state.attending" :items="attendingItems" class="w-28" />
      </UFormField>
    </td>
    <td :class="cellClass">
      <UFormField name="allowCompanions" :error="errors.allowCompanions" :ui="wrapErrorUi">
        <USelect v-model="state.allowCompanions" :items="allowCompanionsItems" class="w-44" />
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
        :class="[maskedInputClass, 'w-full']"
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
