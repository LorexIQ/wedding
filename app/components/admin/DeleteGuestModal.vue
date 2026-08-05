<script setup lang="ts">
import type { GuestRecord } from '../../composables/useAdminGuests'

const props = defineProps<{ guest: GuestRecord | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()

function onConfirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <UModal
    v-model="open"
    title="Удалить гостя?"
    :description="props.guest ? `«${props.guest.fio || 'Без имени'}» будет удалён без возможности восстановления.` : ''"
  >
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">
          Отмена
        </UButton>
        <UButton color="error" @click="onConfirm">
          Удалить
        </UButton>
      </div>
    </template>
  </UModal>
</template>
