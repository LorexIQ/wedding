<script setup lang="ts">
import { useRsvpForm } from '../composables/useRsvpForm'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'

const { form, errors, submitted, addCompanion, removeCompanion, submit } = useRsvpForm()
</script>

<template>
  <form v-if="!submitted.success" class="rsvp-form" @submit.prevent="submit">
    <input v-model="form.website" type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off">

    <label>
      ФИО
      <input v-model="form.fio" type="text" required>
    </label>

    <label>
      Телефон
      <input v-model="form.phone" type="tel">
    </label>

    <fieldset>
      <legend>Напитки</legend>
      <label v-for="opt in DRINK_OPTIONS" :key="opt">
        <input v-model="form.drinks" type="checkbox" :value="opt">
        {{ DRINK_LABELS[opt] }}
      </label>
    </fieldset>

    <div v-for="(companion, index) in form.companions" :key="index" class="companion">
      <label>
        ФИО сопровождающего {{ index + 1 }}
        <input v-model="companion.fio" type="text" required>
      </label>
      <fieldset>
        <legend>Напитки</legend>
        <label v-for="opt in DRINK_OPTIONS" :key="opt">
          <input v-model="companion.drinks" type="checkbox" :value="opt">
          {{ DRINK_LABELS[opt] }}
        </label>
      </fieldset>
      <button type="button" @click="removeCompanion(index)">Убрать</button>
    </div>

    <button v-if="form.companions.length < 3" type="button" @click="addCompanion">
      + Добавить сопровождающего
    </button>

    <label>
      Комментарий
      <textarea v-model="form.comment" />
    </label>

    <p v-if="errors.message" class="error">{{ errors.message }}</p>

    <button type="submit" :disabled="submitted.pending">Отправить</button>
  </form>

  <p v-else>Спасибо! Ваш ответ получен.</p>
</template>

<style scoped>
.hp-field {
  position: absolute;
  left: -9999px;
}
</style>
