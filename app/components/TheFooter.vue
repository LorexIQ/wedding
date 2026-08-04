<script setup lang="ts">
import { ref } from 'vue'
import { wedding } from '../content/wedding'
import { formatPhone, maskPhone } from '../utils/phone'

// Номер скрыт до клика, как в Telegram: примитивный парсер со страницы
// его не соберёт, а гостю достаточно одного нажатия.
// String(...) — обязателен: значение приходит из NUXT_PUBLIC_CONTACT_PHONE,
// а Nuxt/Nitro прогоняет override через destr() и число из одних цифр
// («79066951293») превращается в JS number, ломая .slice() в phone.ts.
const contactDigits = String(useRuntimeConfig().public.contactPhone)
const revealed = ref(false)
</script>

<template>
  <footer class="foot">
    <p class="eyebrow">Остались вопросы</p>

    <a
      v-if="revealed"
      class="foot__phone"
      :href="`tel:+${contactDigits}`"
    >{{ formatPhone(contactDigits) }}</a>

    <button
      v-else
      class="foot__phone foot__phone--masked"
      type="button"
      @click="revealed = true"
    >{{ maskPhone(contactDigits) }}</button>

    <p v-if="!revealed" class="foot__hint">Нажмите, чтобы показать номер</p>

    <p class="foot__sign">{{ wedding.footer.sign }}</p>
  </footer>
</template>

<style scoped>
.foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  padding: clamp(3rem, 8vw, 4.5rem) 24px;
  background: var(--ink);
  color: var(--linen);
  text-align: center;
}

.foot .eyebrow {
  color: #A9B39C;
}

.foot__phone {
  padding-bottom: 2px;
  border: none;
  border-bottom: 1px solid rgba(212, 220, 195, 0.35);
  background: none;
  color: #DCE4CD;
  font-family: var(--serif);
  font-size: clamp(1.35rem, 4vw, 1.7rem);
  text-decoration: none;
}

.foot__phone--masked {
  border-bottom-style: dashed;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.foot__phone:hover {
  border-bottom-color: #DCE4CD;
}

.foot__hint {
  font-family: var(--sans);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: #A9B39C;
}

.foot__sign {
  max-width: 24rem;
  font-style: italic;
  color: #C6CDB4;
}
</style>
