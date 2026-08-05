<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  deadline: number | null
  patchSettings: (iso: string | null) => Promise<void>
}>()

const toast = useToast()

function toLocalInputValue(epochMs: number) {
  const date = new Date(epochMs - new Date(epochMs).getTimezoneOffset() * 60000)
  return date.toISOString().slice(0, 16)
}

const deadlineInput = ref(props.deadline ? toLocalInputValue(props.deadline) : '')

watch(() => props.deadline, (value) => {
  deadlineInput.value = value ? toLocalInputValue(value) : ''
})

async function saveDeadline() {
  try {
    const iso = deadlineInput.value ? new Date(deadlineInput.value).toISOString() : null
    await props.patchSettings(iso)
    toast.add({ title: 'Дедлайн сохранён', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Некорректная дата дедлайна', color: 'error' })
  }
}

async function clearDeadline() {
  deadlineInput.value = ''
  await saveDeadline()
}
</script>

<template>
  <UCard class="mb-6">
    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="Дедлайн ответа">
        <UInput v-model="deadlineInput" type="datetime-local" />
      </UFormField>
      <UButton @click="saveDeadline">
        Сохранить дедлайн
      </UButton>
      <UButton v-if="deadline" color="neutral" variant="soft" @click="clearDeadline">
        Снять дедлайн
      </UButton>
    </div>
  </UCard>
</template>
