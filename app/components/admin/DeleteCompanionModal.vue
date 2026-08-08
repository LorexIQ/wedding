<script setup lang="ts">
import { shortFio } from '#shared/utils/shortFio'

const props = defineProps<{ companion: { id: number, fio: string } | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()

function onConfirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Удалить сопровождающего?"
    :description="props.companion ? `«${shortFio(props.companion.fio)}» будет удалён без возможности восстановления.` : ''"
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
