<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { wedding } from '../content/wedding'

/**
 * Гейт-конверт на первом заходе — порт референса (claude.ai/design
 * "Envelope Invite"), адаптированный под Vue и под то, что вместо
 * плейсхолдерного письма с RSVP разворачивается настоящий сайт (слот).
 *
 * Движется КОНВЕРТ, а не лист. Лист неподвижен в центре рамки от первого
 * кадра до последнего — рамка отцентрирована во вьюпорте, значит лист не
 * может уехать за его край ни при какой ширине экрана. Прошлый вариант
 * (лист выезжает вверх) на узких экранах выносил его за пределы viewport.
 *
 * Последовательность:
 * 1. Флап (48% высоты рамки) переворачивается 3D, двухслойный (лицо +
 *    заранее перевёрнутая изнанка) — не пропадает между 90°/180°.
 *    С полпути (48% длительности) перестаёт быть "поверх" — z-index.
 *    Пока он открывается, в вырезе передней стенки показывается клин
 *    лежащего внутри листа — единственное, что от листа видно.
 * 2. Конверт целиком уезжает вниз, а лист гасит этот сдвиг встречным
 *    transform'ом и остаётся на месте: передняя стенка сползает с листа
 *    и открывает его сверху вниз. Заслоняет лист сама стенка —
 *    непрозрачный элемент выше по z, — а не маска.
 * 3. FLIP из этого кадра: карточка-письмо прячется, её место (по реальным
 *    координатам getBoundingClientRect) занимает slot-контент (настоящий
 *    сайт), снапается на невидимый кадр к тем же координатам и уезжает
 *    transform'ом к 0/100% — вырастает в нормальный поток документа.
 *    Лист лежит в центре экрана, поэтому и зум идёт из центра.
 *
 * `envelopeOpened` — разовый флаг, назад в конверт пути нет.
 * `prefers-reduced-motion` — всё схлопывается в один кадр.
 */

const props = defineProps<{ alreadyOpened: boolean }>()
const emit = defineEmits<{ opened: [] }>()

const SPEED_MS = 950
const FLAP_HANDOFF_MS = Math.round(SPEED_MS * 0.48)
/** Пауза после открытия флапа — на неё видно лист в вырезе, до отъезда конверта. */
const REVEAL_DELAY_MS = Math.round(SPEED_MS * 1.15)
/** = длительность transform-перехода .envelope-visual--leaving и встречного ему .letter-clip--counter. */
const ENVELOPE_EXIT_MS = 900
const FLIP_MS = 750

const open = ref(false)
const flapOnTop = ref(true)
const opening = ref(false)
const envelopeLeaving = ref(false)
const pageGrowing = ref(false)
const revealed = ref(props.alreadyOpened)
const showHint = ref(false)

const gateStyle = {
  '--speed': `${SPEED_MS}ms`,
  '--envelope-exit': `${ENVELOPE_EXIT_MS}ms`
}

const peekCard = ref<HTMLElement | null>(null)
const siteWrap = ref<HTMLElement | null>(null)

let hintTimer = 0
let handoffTimer = 0
let envelopeExitTimer = 0
let growTimer = 0

function finishReveal() {
  revealed.value = true
  emit('opened')
}

/** Шаг 3: FLIP карточки-письма в настоящий сайт. Конверт к этому моменту уже уехал. */
function growPage() {
  const card = peekCard.value
  const wrap = siteWrap.value
  if (!card || !wrap) {
    finishReveal()
    return
  }

  const rect = card.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dx = rect.left + rect.width / 2 - vw / 2
  const dy = rect.top + rect.height / 2 - vh / 2
  const sx = rect.width / vw
  const sy = rect.height / vh

  pageGrowing.value = true

  requestAnimationFrame(() => {
    wrap.style.transition = 'none'
    wrap.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`

    requestAnimationFrame(() => {
      wrap.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      wrap.style.transform = 'translate(0px, 0px) scale(1, 1)'
    })
  })

  window.setTimeout(finishReveal, FLIP_MS)
}

/** Шаг 2: конверт уезжает вниз, лист встречным transform'ом стоит на месте. */
function startEnvelopeExit() {
  envelopeLeaving.value = true
  envelopeExitTimer = window.setTimeout(growPage, ENVELOPE_EXIT_MS)
}

function onOpen() {
  if (opening.value || props.alreadyOpened) return
  opening.value = true
  window.clearTimeout(hintTimer)
  showHint.value = false

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishReveal()
    return
  }

  open.value = true
  handoffTimer = window.setTimeout(() => {
    flapOnTop.value = false
  }, FLAP_HANDOFF_MS)
  growTimer = window.setTimeout(startEnvelopeExit, REVEAL_DELAY_MS)
}

onMounted(() => {
  if (props.alreadyOpened) return
  hintTimer = window.setTimeout(() => {
    showHint.value = true
  }, 5000)
})

onUnmounted(() => {
  window.clearTimeout(hintTimer)
  window.clearTimeout(handoffTimer)
  window.clearTimeout(envelopeExitTimer)
  window.clearTimeout(growTimer)
})
</script>

<template>
  <div
    ref="siteWrap"
    class="site-wrap"
    :class="{ 'site-wrap--growing': pageGrowing, 'site-wrap--revealed': revealed }"
  >
    <slot />
  </div>

  <div v-if="!revealed" class="envelope-gate">
    <!-- Клик-обработчик висит на САМОЙ внешней обёртке (как role=button в
         референсе) и оборачивает вообще всё — панель/карман/флап/письмо.
         Так клик по любому из них всплывает наверх независимо от того,
         кто из них визуально "поверх" по z-index (z-index решает только
         покраску, не bubbling). -->
    <div
      class="envelope-frame"
      role="button"
      tabindex="0"
      :aria-disabled="opening"
      aria-label="Открыть конверт"
      :style="gateStyle"
      @click="onOpen"
      @keydown.enter.prevent="onOpen"
      @keydown.space.prevent="onOpen"
    >
      <span v-if="!open" class="envelope__hint-text">Откройте письмо</span>

      <!-- Конверт (панель, стенка, флап) + лежащее в нём письмо — одна
           группа, и уезжает вниз она целиком. Письмо ОБЯЗАНО лежать здесь,
           а не снаружи: .envelope-visual формирует стековый контекст
           (perspective), поэтому z-index передней стенки виден только
           изнутри. Только так стенка — реальный непрозрачный элемент —
           физически заслоняет письмо, вместо имитации масками. -->
      <div class="envelope-visual" :class="{ 'envelope-visual--leaving': envelopeLeaving }">
        <div class="envelope__panel" />

        <!-- Письмо: z=3 — выше задней панели (1), НИЖЕ передней стенки (4),
             которая его и закрывает. Само оно не двигается никогда: при
             отъезде конверта гасит сдвиг родителя встречным transform'ом
             (--counter), поэтому стоит в центре экрана, а стенка сползает
             с него вниз. -->
        <div class="letter-clip" :class="{ 'letter-clip--counter': envelopeLeaving }">
          <div v-if="!pageGrowing" ref="peekCard" class="peek-card">
            <p class="peek-card__eyebrow">Приглашение</p>
            <h3 class="peek-card__title">{{ wedding.groom }} и {{ wedding.bride }}</h3>
          </div>
        </div>

        <!-- Передняя стенка конверта. Два уровня не для красоты: скругление
             углов и вырез под крышку нельзя повесить на один элемент —
             clip-path отменяет border-radius. Внешний скругляет и обрезает,
             внутренний делает вырез. -->
        <div class="envelope__front">
          <div class="envelope__pocket" />
        </div>

        <!-- Пульс-подсказка — отдельный неклипованный элемент. На самих
             осколках печати кольцо жило бы под их clip-path и показывалось
             бы обрезанным куском. -->
        <div v-if="showHint && !open" class="envelope__seal-halo" />

        <!-- Печать рвётся на два осколка по линии края крышки. Оба —
             один и тот же круг в одной и той же точке экрана (вершина
             крышки), с ВЗАИМНО ДОПОЛНЯЮЩИМИ clip-path по общей ломаной:
             пока конверт закрыт, они стыкуются в цельный оттиск, а при
             открытии крышка уносит свой клин — на корпусе остаётся
             вырванный уголок. -->
        <div class="envelope__seal envelope__seal--body">✦</div>

        <div class="envelope__flap" :class="{ 'envelope__flap--open': open }" :style="{ zIndex: flapOnTop ? 10 : 0 }">
          <div class="envelope__flap-face envelope__flap-face--front" />
          <div class="envelope__flap-face envelope__flap-face--back" />

          <!-- Ребёнок флапа, но НЕ его грани: грань обрезана треугольником
               и срезала бы зубцы разрыва, которые заходят за её край. -->
          <div class="envelope__seal envelope__seal--flap">✦</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.site-wrap {
  position: fixed;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  will-change: transform;
}

.site-wrap--growing {
  z-index: 20;
  opacity: 1;
}

.site-wrap--revealed {
  position: static;
  inset: auto;
  z-index: auto;
  overflow: visible;
  opacity: 1;
  pointer-events: auto;
  transform: none;
}

.envelope-gate {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--linen);
  padding: 24px;
  /* Конверт уезжает на +140% своей высоты и должен уйти за нижний край
     экрана, не растягивая страницу. */
  overflow: hidden;
}

.envelope-frame {
  position: relative;
  width: 100%;
  max-width: clamp(300px, 62vw, 460px);
  aspect-ratio: 1.56;
  cursor: pointer;
  font-family: var(--serif);
  -webkit-tap-highlight-color: transparent;
}

.envelope-frame[aria-disabled='true'] {
  cursor: default;
}

/* perspective нужен флапу и попутно делает этот узел стековым контекстом —
   именно поэтому письмо лежит ВНУТРИ него (см. .letter-clip).
   Без opacity-перехода: письмо — его потомок, прозрачность родителя гасила
   бы и письмо тоже. Конверт просто съезжает за нижний край экрана. */
.envelope-visual {
  position: absolute;
  inset: 0;
  perspective: 1800px;
  transition: transform var(--envelope-exit) cubic-bezier(0.55, 0, 0.55, 1);
}

/* 100vh, а не проценты от своей высоты: конверт не растворяется, поэтому
   обязан именно уехать ЗА край экрана — на процентах от собственной высоты
   его низ оставался бы в кадре полосой. */
.envelope-visual--leaving {
  transform: translateY(100vh);
  pointer-events: none;
}

.envelope__hint-text {
  position: absolute;
  left: 50%;
  top: -36px;
  transform: translateX(-50%);
  white-space: nowrap;
  font-style: italic;
  font-size: 14px;
  color: var(--ink-soft);
  animation: envelope-breathe 3.4s ease-in-out infinite;
}

/* Дыхание подсказки — только прозрачность. transform не трогаем: он держит
   центровку (translateX(-50%)), а keyframes переопределяют его целиком. */
@keyframes envelope-breathe {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}

.envelope__panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 6px;
  background: var(--paper);
  border: 1px solid var(--rule);
  box-shadow: 0 12px 32px rgba(54, 59, 50, 0.22);
}

/* Скругляет и обрезает; вырез — на вложенном .envelope__pocket, потому что
   clip-path на том же элементе отменил бы border-radius. */
.envelope__front {
  position: absolute;
  inset: 0;
  z-index: 4;
  border-radius: 6px;
  overflow: hidden;
}

/* Передняя стенка — вся рамка МИНУС треугольный вырез под крышку.
   Полигон: обход по контуру (левый верх → низ → правый верх), затем от
   правого верхнего угла к вершине крышки (50% 48%) и обратно в левый —
   это и вырезает треугольник сверху.
   Координаты выреза 1-в-1 совпадают с clip-path грани флапа (та же
   вершина 50%/48%), поэтому закрытая крышка садится в вырез без зазора и
   белая задняя панель не просвечивает по бокам от неё. */
.envelope__pocket {
  position: absolute;
  inset: 0;
  background: var(--linen-deep);
  clip-path: polygon(0 0, 0 100%, 100% 100%, 100% 0, 50% 48%);
}

/* Общая часть обоих осколков. Оба — одинаковый круг, центром ровно в
   вершину крышки, и различаются ТОЛЬКО системой отсчёта (--body считает
   от рамки, --flap от флапа) и взаимно дополняющим clip-path. Значок ✦
   есть в обоих: разрыв проходит через центр, поэтому он тоже рвётся
   пополам и половинки складываются обратно, пока конверт закрыт. */
.envelope__seal {
  position: absolute;
  left: 50%;
  width: 15%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sage);
  color: var(--paper);
  font-size: clamp(14px, 3.4vw, 20px);
}

/* Линия разрыва — не прямой срез, а ломаная, идущая примерно по краям
   крышки: от боков круга вниз к его центру (вершина крышки лежит ровно
   в центре печати). Зубцы намеренно неровные — рвущийся воск. Обе
   половины перечисляют ОДНИ И ТЕ ЖЕ точки ломаной, поэтому стыкуются
   без зазора; менять их надо только парой. */

/* Больший осколок — остаётся на корпусе. Круг МИНУС клин сверху: тот
   самый "вырванный уголок". */
.envelope__seal--body {
  top: 48%;
  z-index: 6;
  clip-path: polygon(
    0 19%, 9% 27%, 18% 29%, 27% 36%, 36% 40%, 44% 47%, 50% 50%,
    56% 47%, 64% 40%, 73% 36%, 82% 29%, 91% 27%, 100% 19%,
    100% 100%, 0 100%
  );
}

/* Меньший осколок — клин, который крышка уносит с собой.
   top:100% флапа = те же 48% рамки.
   Ломаная СДВИНУТА на 2.5% вниз относительно --body, то есть клин заходит
   за линию разрыва внахлёст. Без нахлёста встречные clip-path дают по
   светлой полоске сглаживания каждый, и на закрытом конверте по стыку
   видна щель. Клин рисуется поверх (z флапа 10 против 6), поэтому нахлёст
   не виден, а форму рваного края на корпусе задаёт только --body. */
.envelope__seal--flap {
  top: 100%;
  clip-path: polygon(
    50% 52.5%, 44% 49.5%, 36% 42.5%, 27% 38.5%, 18% 31.5%, 9% 29.5%, 0 21.5%,
    0 0, 100% 0, 100% 21.5%,
    91% 29.5%, 82% 31.5%, 73% 38.5%, 64% 42.5%, 56% 49.5%
  );
}

/* Кольцо-подсказка вокруг целой печати, вне обоих clip-path.
   z=11 — ВЫШЕ закрытой крышки (10): кольцо расходится далеко за пределы
   печати, и на любом z ниже крышка срезала бы ему всю верхнюю половину.
   Живёт только пока конверт закрыт (v-if), поверх ничего не мешает.
   Сам элемент — только позиционирование, кольцо рисует ::after. */
.envelope__seal-halo {
  position: absolute;
  left: 50%;
  top: 48%;
  z-index: 11;
  width: 15%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
}

/* Флап крепится верхним краем (неподвижная линия сгиба), вершина снизу —
   свободный конец. Двухслойный: лицевая грань + заранее перевёрнутая на
   180° задняя, обе backface-hidden — в любой момент поворота видна
   хотя бы одна, флап не пропадает на полпути. Пока flapOnTop=true —
   флап (10) перебивает всё, включая письмо (3) и переднюю стенку (4):
   закрытый конверт цельный. Как только падает до 0 — письмо видно поверх
   уже откинутой крышки. */
.envelope__flap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 48%;
  transform-style: preserve-3d;
  transform-origin: 50% 0%;
  transition: transform var(--speed) cubic-bezier(0.65, 0, 0.35, 1), filter var(--speed) ease;
  transform: rotateX(0deg);
  /* Закрытая крышка лежит в одной плоскости с конвертом — падать тени
     неоткуда. Прозрачная drop-shadow, а не none: обе стадии должны быть
     одинаковым набором filter-функций, иначе переход не интерполируется. */
  filter: drop-shadow(0 0 0 rgba(54, 59, 50, 0));
}

/* Тень появляется, только когда крышка реально поднялась над конвертом. */
.envelope__flap--open {
  transform: rotateX(178deg);
  filter: drop-shadow(0 6px 12px rgba(54, 59, 50, 0.22));
}

/* border-radius и clip-path не конфликтуют, а складываются: фон рисуется
   по скруглённой коробке, потом всё это режется треугольником. Так у
   крышки скругляются верхние углы — те же 6px, что у корпуса, — и в
   закрытом состоянии углы конверта выглядят одинаково по всем четырём. */
.envelope__flap-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 6px 6px 0 0;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.envelope__flap-face--front {
  background: var(--paper);
}

.envelope__flap-face--back {
  background: var(--wheat);
  transform: rotateX(180deg);
}

/* Анимация висит на ::after, а не на самом .envelope__seal-halo: тот
   центрируется через transform, а keyframes задают transform:scale и
   затёрли бы центровку. */
.envelope__seal-halo::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: var(--sage);
  opacity: 0.5;
  animation: envelope-pulse 1.6s ease-in-out infinite;
}

@keyframes envelope-pulse {
  0%   { transform: scale(0.7); opacity: 0.6; }
  60%  { transform: scale(1.7); opacity: 0; }
  100% { transform: scale(1.7); opacity: 0; }
}

/* z=3 — выше задней панели (1), ниже передней стенки (4): стенка сама
   заслоняет письмо, пока оно внутри. Никаких масок. Коробка совпадает с
   рамкой: письмо целиком помещается внутри и наружу не выходит. */
.letter-clip {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  transition: transform var(--envelope-exit) cubic-bezier(0.55, 0, 0.55, 1);
}

/* Встречный сдвиг, гасящий отъезд конверта. Длительность и кривая ОБЯЗАНЫ
   совпадать с .envelope-visual, а величина — быть той же с обратным знаком
   (обе в vh, поэтому сравнимы буквально): тогда +100vh родителя и -100vh
   потомка компенсируются на КАЖДОМ кадре, а не только в конце. Письмо
   стоит неподвижно, стенка сползает с него вниз и открывает его. */
.letter-clip--counter {
  transform: translateY(-100vh);
}

.peek-card {
  position: absolute;
  left: 11%;
  top: 6%;
  width: 78%;
  height: 88%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 9% 10%;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 6px;
  box-shadow: 0 3px 10px rgba(54, 59, 50, 0.16);
}

.peek-card__eyebrow {
  margin: 0;
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--sage);
}

.peek-card__title {
  margin: 0;
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
  font-size: clamp(15px, 4vw, 19px);
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .envelope__seal-halo::after {
    display: none;
  }

  .envelope__hint-text {
    animation: none;
  }
}
</style>
