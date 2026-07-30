<script setup lang="ts">
import { ref } from 'vue'
import { wedding } from '../content/wedding'
import { formatPhone, maskPhone } from '../utils/phone'

// Номер скрыт до клика, как в Telegram: примитивный парсер со страницы
// его не соберёт, а гостю достаточно одного нажатия.
const revealed = ref(false)
</script>

<template>
  <footer class="foot">
    <p class="eyebrow">Остались вопросы</p>

    <a
      v-if="revealed"
      class="foot__phone"
      :href="`tel:+${wedding.contactDigits}`"
    >{{ formatPhone(wedding.contactDigits) }}</a>

    <button
      v-else
      class="foot__phone foot__phone--masked"
      type="button"
      @click="revealed = true"
    >{{ maskPhone(wedding.contactDigits) }}</button>

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
  color: #9C8E77;
}

.foot__phone {
  padding-bottom: 2px;
  border: none;
  border-bottom: 1px solid rgba(232, 214, 174, 0.35);
  background: none;
  color: #E8D6AE;
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
  border-bottom-color: #E8D6AE;
}

.foot__hint {
  font-family: var(--sans);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: #9C8E77;
}

.foot__sign {
  max-width: 24rem;
  font-style: italic;
  color: #C3B79F;
}
</style>
