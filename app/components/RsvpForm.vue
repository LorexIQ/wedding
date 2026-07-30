<script setup lang="ts">
import { useRsvpForm } from '../composables/useRsvpForm'
import { wedding } from '../content/wedding'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'
import { formatFio } from '../utils/formatFio'

const inviteGuest = useState<{ fio: string | null, phone: string | null, comment: string | null, drinks: string[], submitted: boolean } | undefined>('inviteGuest')

const { form, errors, submitted, addCompanion, removeCompanion, toggleDrink, submit } =
  useRsvpForm(inviteGuest.value, inviteGuest.value?.submitted ?? false)

function onFioBlur() {
  form.fio = formatFio(form.fio)
}

function onCompanionFioBlur(index: number) {
  form.companions[index]!.fio = formatFio(form.companions[index]!.fio)
}
</script>

<template>
  <section class="band band--deep">
    <div class="inner">
      <form v-if="!submitted.success" class="form" @submit.prevent="submit">
        <div class="form__head">
          <p class="eyebrow">Подтверждение</p>
          <h2>Будете ли вы с нами?</h2>
          <p class="form__deadline">Ждём ответа до {{ wedding.rsvpDeadline }}</p>
          <p class="form__lede">
            Заполните форму, чтобы мы знали, кого ждать. Если придёте не один — добавьте спутников,
            одной анкеты на всех достаточно.
          </p>
        </div>

        <input
          v-model="form.website"
          class="hp-field"
          type="text"
          name="website"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        >

        <p v-if="errors.message" class="summary">{{ errors.message }}</p>

        <div class="field">
          <label for="fio">Имя и фамилия</label>
          <input
            id="fio"
            v-model="form.fio"
            type="text"
            autocomplete="name"
            placeholder="Иван Петров"
            :aria-invalid="Boolean(errors.fields.fio)"
            @blur="onFioBlur"
          >
          <p v-if="errors.fields.fio" class="error">{{ errors.fields.fio }}</p>
        </div>

        <div class="field">
          <label for="phone">Телефон</label>
          <input
            id="phone"
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            placeholder="+7 900 000-00-00"
            :aria-invalid="Boolean(errors.fields.phone)"
          >
          <p v-if="errors.fields.phone" class="error">{{ errors.fields.phone }}</p>
        </div>

        <div class="field">
          <label id="drinksLabel">Что предпочитаете из напитков</label>
          <div class="drinks" role="group" aria-labelledby="drinksLabel">
            <label v-for="opt in DRINK_OPTIONS" :key="opt" class="drink">
              <input
                type="checkbox"
                :checked="form.drinks.includes(opt)"
                @change="toggleDrink(form, opt)"
              >
              {{ DRINK_LABELS[opt] }}
            </label>
          </div>
          <p v-if="errors.fields.drinks" class="error">{{ errors.fields.drinks }}</p>
        </div>

        <div v-for="(companion, index) in form.companions" :key="index" class="companion">
          <div class="companion__head">
            <p class="companion__title">Спутник {{ index + 1 }}</p>
            <button class="companion__drop" type="button" @click="removeCompanion(index)">
              убрать
            </button>
          </div>

          <div class="field">
            <label :for="`companion-${index}`">Имя и фамилия</label>
            <input
              :id="`companion-${index}`"
              v-model="companion.fio"
              type="text"
              placeholder="Мария Петрова"
              :aria-invalid="Boolean(errors.fields[`companions.${index}.fio`])"
              @blur="onCompanionFioBlur(index)"
            >
            <p v-if="errors.fields[`companions.${index}.fio`]" class="error">
              {{ errors.fields[`companions.${index}.fio`] }}
            </p>
          </div>

          <div class="field">
            <label :id="`companion-${index}-drinks`">Напитки</label>
            <div class="drinks" role="group" :aria-labelledby="`companion-${index}-drinks`">
              <label v-for="opt in DRINK_OPTIONS" :key="opt" class="drink">
                <input
                  type="checkbox"
                  :checked="companion.drinks.includes(opt)"
                  @change="toggleDrink(companion, opt)"
                >
                {{ DRINK_LABELS[opt] }}
              </label>
            </div>
            <p v-if="errors.fields[`companions.${index}.drinks`]" class="error">
              {{ errors.fields[`companions.${index}.drinks`] }}
            </p>
          </div>
        </div>

        <button v-if="form.companions.length < 3" class="addmore" type="button" @click="addCompanion">
          {{ form.companions.length ? '+ Добавить ещё спутника' : '+ Я буду не один — добавить спутника' }}
        </button>

        <div class="field">
          <label for="comment">Что-то важное для нас</label>
          <textarea
            id="comment"
            v-model="form.comment"
            placeholder="Аллергия, детское меню, приеду позже — что угодно"
          />
        </div>

        <button class="submit" type="submit" :disabled="submitted.pending">
          {{ submitted.pending ? 'Отправляем…' : 'Отправить' }}
        </button>
      </form>

      <div v-else class="thanks">
        <p class="eyebrow">Ответ получен</p>
        <h2>Спасибо, ждём вас</h2>
        <p class="form__lede">Если что-то изменится — позвоните нам, номер внизу страницы.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form__head,
.thanks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  text-align: center;
}

.form__deadline {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wheat);
}

.form__lede {
  max-width: 26rem;
  color: var(--ink-soft);
}

/* Приманка для ботов: живой гость этого поля не видит и не заполнит. */
.hp-field {
  position: absolute;
  left: -9999px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field > label {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

input[type="text"],
input[type="tel"],
textarea {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid var(--rule);
  border-radius: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 16px;
}

textarea {
  min-height: 5.2rem;
  resize: vertical;
}

input[aria-invalid="true"],
textarea[aria-invalid="true"] {
  border-color: var(--alarm);
  background: #FBF1ED;
}

.error {
  font-family: var(--sans);
  font-size: 12.5px;
  color: var(--alarm);
}

.summary {
  padding: 12px 14px;
  border: 1px solid #D9B3A6;
  background: #FBF1ED;
  font-family: var(--sans);
  font-size: 13.5px;
  color: var(--alarm);
}

.drinks {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rule);
  background: var(--paper);
}

.drink {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 14px;
  font-family: var(--sans);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.drink + .drink {
  border-top: 1px solid var(--rule);
}

.drink input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--sage);
}

.drink:hover {
  background: #EEF1E6;
}

.drink:has(input:checked) {
  background: #E3E8D8;
}

.companion {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--rule);
}

.companion__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.companion__title {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.companion__drop {
  padding: 0;
  border: none;
  background: none;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.companion__drop:hover {
  color: var(--alarm);
}

.addmore {
  width: 100%;
  padding: 10px;
  border: 1px dashed var(--ink-faint);
  background: none;
  color: var(--ink-soft);
  font-family: var(--sans);
  font-size: 12.5px;
  cursor: pointer;
}

.addmore:hover {
  border-color: var(--wheat);
  color: var(--ink);
}

.submit {
  padding: 16px;
  border: none;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.18s ease;
}

.submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.submit:hover:not(:disabled) {
  background: #454C3D;
}
</style>
