# Лендинг-приглашение: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить `app/pages/index.vue` из трёхстрочной заглушки в готовое приглашение на свадьбу Дмитрия и Александры по спеке [2026-07-30-invitation-landing-design.md](../specs/2026-07-30-invitation-landing-design.md).

**Architecture:** Все тексты и данные торжества лежат в одном файле `app/content/wedding.ts`; семь презентационных компонентов читают оттуда и не содержат текста в разметке. Логика, которую можно проверить без браузера (нормализация напитков, разбивка обратного отсчёта, маска телефона), вынесена в чистые функции — под них пишутся тесты. Сами компоненты тестами не покрываются: окружение Vitest здесь `node`, DOM нет, а компоненты — статичная разметка поверх файла контента.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, zod, Vitest.

**Стартовое состояние:** 47 тестов проходят (`npm test`). Бэкенд RSVP, админка и БД готовы — не трогаем.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `shared/constants/drinks.ts` | **изменить** — новый список из восьми напитков, `NO_DRINK`, `isDrinkSetValid`, `normalizeDrinks` |
| `shared/schemas/rsvp.ts` | **изменить** — `.refine()` на наборах напитков в трёх схемах |
| `app/content/wedding.ts` | **создать** — все тексты и данные торжества |
| `app/utils/countdown.ts` | **создать** — `splitRemaining()` |
| `app/utils/phone.ts` | **создать** — `formatPhone()`, `maskPhone()` |
| `app/assets/css/main.css` | **создать** — токены палитры, типографика, базовые стили |
| `app/components/TheHero.vue` | **создать** — обложка |
| `app/components/OurStory.vue` | **создать** — история пары |
| `app/components/TheVenue.vue` | **создать** — место, карта по клику |
| `app/components/GuestNotes.vue` | **создать** — просьбы к гостям |
| `app/components/TheCountdown.vue` | **создать** — обратный отсчёт |
| `app/components/RsvpForm.vue` | **изменить** — переверстать целиком |
| `app/components/TheFooter.vue` | **создать** — подвал, раскрытие телефона |
| `app/composables/useRsvpForm.ts` | **изменить** — `toggleDrink()`, инлайновые ошибки полей |
| `app/pages/index.vue` | **изменить** — сборка секций, SEO/OG |
| `nuxt.config.ts` | **изменить** — подключить CSS |

---

### Task 1: Новый список напитков

Ключи `wine` / `beer` / `spirits` / `non_alcoholic` заменяются на восемь позиций из спеки. Они зашиты в фикстуры шести тестов — их правим здесь же, иначе набор упадёт.

**Files:**
- Modify: `shared/constants/drinks.ts`
- Modify: `tests/shared/rsvp-schema.test.ts:10-11`
- Modify: `tests/database/schema.test.ts:15,23,30`
- Modify: `tests/server/csv.test.ts:16-17,25`
- Modify: `tests/server/api/rsvp.test.ts:13-14`
- Modify: `tests/server/api/admin-guests.test.ts:14,16,79,92`
- Modify: `tests/composables/useAdminGuests.test.ts:7`

- [ ] **Step 1: Заменить содержимое `shared/constants/drinks.ts`**

```ts
export const DRINK_OPTIONS = [
  'red_dry',
  'red_semi',
  'white_dry',
  'white_semi',
  'sparkling',
  'brandy',
  'vodka',
  'none'
] as const

export type DrinkOption = typeof DRINK_OPTIONS[number]

export const DRINK_LABELS: Record<DrinkOption, string> = {
  red_dry: 'Красное сухое',
  red_semi: 'Красное полусладкое',
  white_dry: 'Белое сухое',
  white_semi: 'Белое полусладкое',
  sparkling: 'Шампанское',
  brandy: 'Коньяк',
  vodka: 'Водка',
  none: 'Не пью'
}

/** Вариант «не пью» — не сочетается ни с чем остальным. */
export const NO_DRINK: DrinkOption = 'none'
```

- [ ] **Step 2: Запустить тесты и увидеть падение**

Run: `npm test`
Expected: FAIL — тесты с `drinks: ['wine']` и `['beer']` не проходят zod-валидацию, `tests/server/csv.test.ts` ждёт строку `wine; beer`.

- [ ] **Step 3: Заменить старые ключи в фикстурах**

Соответствие для замены: `'wine'` → `'red_dry'`, `'beer'` → `'sparkling'`.

В `tests/shared/rsvp-schema.test.ts` строки 10–11:

```ts
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
```

В `tests/database/schema.test.ts` строки 15, 23, 30:

```ts
      drinks: ['red_dry'],
```
```ts
      drinks: ['sparkling']
```
```ts
    expect(savedGuest?.drinks).toEqual(['red_dry'])
```

В `tests/server/csv.test.ts` строки 16–17 и 25:

```ts
      drinks: ['red_dry', 'sparkling'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }]
```
```ts
    expect(lines[1]).toBe('1,Иванов Иван,+79990000000,,red_dry; sparkling,Петров Пётр (sparkling)')
```

В `tests/server/api/rsvp.test.ts` строки 13–14:

```ts
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
```

В `tests/server/api/admin-guests.test.ts` строки 14, 16, 79, 92:

```ts
    fio: 'Иванов Иван', phone: null, comment: null, drinks: ['red_dry'], createdAt: now, updatedAt: now
```
```ts
  testDb.insert(companions).values({ guestId: guest.id, fio: 'Петров Пётр', drinks: ['sparkling'] }).run()
```
```ts
    const parsed = guestPatchSchema.safeParse({ drinks: 'red_dry' })
```
```ts
      body: { drinks: 'red_dry' },
```

В `tests/composables/useAdminGuests.test.ts` строка 7:

```ts
      { id: 1, fio: 'Иванов Иван', phone: null, comment: null, drinks: ['red_dry'], companions: [] }
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS, 47 tests.

- [ ] **Step 5: Коммит**

```bash
git add shared/constants/drinks.ts tests/
git commit -m "feat(rsvp): восемь напитков вместо четырёх обобщённых"
```

---

### Task 2: «Не пью» не сочетается с алкоголем — валидация

Правило нужно на сервере, а не только в интерфейсе: запрос может прийти мимо формы, а админ — собрать невозможный набор через правку гостя.

**Files:**
- Modify: `shared/constants/drinks.ts`
- Modify: `shared/schemas/rsvp.ts`
- Test: `tests/shared/rsvp-schema.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/shared/rsvp-schema.test.ts`:

```ts
import { isDrinkSetValid } from '#shared/constants/drinks'

describe('взаимоисключение «Не пью»', () => {
  it('isDrinkSetValid пропускает только алкоголь', () => {
    expect(isDrinkSetValid(['red_dry', 'vodka'])).toBe(true)
  })

  it('isDrinkSetValid пропускает одинокое «не пью»', () => {
    expect(isDrinkSetValid(['none'])).toBe(true)
  })

  it('isDrinkSetValid пропускает пустой набор', () => {
    expect(isDrinkSetValid([])).toBe(true)
  })

  it('isDrinkSetValid отклоняет «не пью» вместе с алкоголем', () => {
    expect(isDrinkSetValid(['none', 'vodka'])).toBe(false)
  })

  it('rsvpSchema отклоняет «не пью» вместе с алкоголем у гостя', () => {
    const parsed = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      drinks: ['none', 'red_dry'],
      companions: [],
      website: ''
    })
    expect(parsed.success).toBe(false)
  })

  it('rsvpSchema отклоняет такой набор и у спутника', () => {
    const parsed = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      drinks: [],
      companions: [{ fio: 'Петров Пётр', drinks: ['none', 'vodka'] }],
      website: ''
    })
    expect(parsed.success).toBe(false)
  })

  it('guestPatchSchema отклоняет такой набор при правке из админки', () => {
    const parsed = guestPatchSchema.safeParse({ drinks: ['none', 'brandy'] })
    expect(parsed.success).toBe(false)
  })
})
```

Проверить, что `rsvpSchema` и `guestPatchSchema` есть в импортах файла — если нет, добавить в существующий `import { ... } from '#shared/schemas/rsvp'`.

- [ ] **Step 2: Запустить тесты и увидеть падение**

Run: `npm test -- tests/shared/rsvp-schema.test.ts`
Expected: FAIL — `isDrinkSetValid is not a function`.

- [ ] **Step 3: Добавить `isDrinkSetValid` в `shared/constants/drinks.ts`**

Дописать в конец файла:

```ts
/**
 * Набор напитков корректен, если «не пью» стоит либо в одиночестве,
 * либо не стоит вовсе. Проверяется и на клиенте, и на сервере.
 */
export function isDrinkSetValid(drinks: readonly string[]): boolean {
  return !drinks.includes(NO_DRINK) || drinks.length === 1
}
```

- [ ] **Step 4: Навесить проверку на схемы в `shared/schemas/rsvp.ts`**

Заменить содержимое файла:

```ts
import { z } from 'zod'
import { DRINK_OPTIONS, isDrinkSetValid } from '../constants/drinks'

const DRINK_CLASH = '«Не пью» нельзя совместить с другими напитками'

const drinksField = z
  .array(z.enum(DRINK_OPTIONS))
  .refine(isDrinkSetValid, DRINK_CLASH)

export const companionSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО сопровождающего').max(200),
  drinks: drinksField.default([])
})

export const rsvpSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО').max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  drinks: drinksField.default([]),
  companions: z.array(companionSchema).max(3, 'Не больше 3 сопровождающих').default([]),
  website: z.string().optional().default('')
})

export type RsvpInput = z.infer<typeof rsvpSchema>

export const guestPatchSchema = z.object({
  fio: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  comment: z.string().trim().max(1000).optional(),
  drinks: drinksField.optional()
}).strict()

export type GuestPatchInput = z.infer<typeof guestPatchSchema>
```

- [ ] **Step 5: Запустить весь набор**

Run: `npm test`
Expected: PASS, 54 tests.

- [ ] **Step 6: Коммит**

```bash
git add shared/ tests/shared/rsvp-schema.test.ts
git commit -m "feat(rsvp): «не пью» несовместимо с алкоголем в схемах"
```

---

### Task 3: Нормализация напитков в форме

Гость не должен получать ошибку за то, что кликнул «Не пью» поверх выбранного вина — набор чинится молча, в момент клика.

**Files:**
- Modify: `shared/constants/drinks.ts`
- Modify: `app/composables/useRsvpForm.ts`
- Test: `tests/composables/useRsvpForm.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/composables/useRsvpForm.test.ts` внутрь существующего `describe`:

```ts
  it('выбор «не пью» снимает ранее выбранный алкоголь', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'red_dry')
    toggleDrink(form, 'vodka')
    toggleDrink(form, 'none')
    expect(form.drinks).toEqual(['none'])
  })

  it('выбор алкоголя снимает ранее выбранное «не пью»', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'none')
    toggleDrink(form, 'brandy')
    expect(form.drinks).toEqual(['brandy'])
  })

  it('повторный клик снимает выбор', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'red_dry')
    toggleDrink(form, 'red_dry')
    expect(form.drinks).toEqual([])
  })

  it('наборы спутников не влияют друг на друга', () => {
    const { form, addCompanion, toggleDrink } = useRsvpForm()
    addCompanion()
    addCompanion()
    toggleDrink(form.companions[0]!, 'none')
    toggleDrink(form.companions[1]!, 'vodka')
    expect(form.companions[0]!.drinks).toEqual(['none'])
    expect(form.companions[1]!.drinks).toEqual(['vodka'])
  })
```

- [ ] **Step 2: Запустить тесты и увидеть падение**

Run: `npm test -- tests/composables/useRsvpForm.test.ts`
Expected: FAIL — `toggleDrink is not a function`.

- [ ] **Step 3: Добавить `normalizeDrinks` в `shared/constants/drinks.ts`**

Дописать в конец файла:

```ts
/**
 * Возвращает новый набор после клика по варианту `toggled`:
 * повторный клик снимает выбор, «не пью» вытесняет алкоголь и наоборот.
 */
export function normalizeDrinks(current: readonly string[], toggled: string): string[] {
  if (current.includes(toggled)) {
    return current.filter(drink => drink !== toggled)
  }
  if (toggled === NO_DRINK) {
    return [NO_DRINK]
  }
  return [...current.filter(drink => drink !== NO_DRINK), toggled]
}
```

- [ ] **Step 4: Подключить в `app/composables/useRsvpForm.ts`**

В импортах заменить строку 3 на:

```ts
import { DRINK_OPTIONS, normalizeDrinks } from '#shared/constants/drinks'
```

Перед `function buildPayload()` добавить:

```ts
  function toggleDrink(target: { drinks: string[] }, option: string) {
    target.drinks = normalizeDrinks(target.drinks, option)
  }
```

В `return` (строка 59) добавить `toggleDrink`:

```ts
  return { form, errors, submitted, addCompanion, removeCompanion, toggleDrink, buildPayload, submit, DRINK_OPTIONS }
```

- [ ] **Step 5: Запустить весь набор**

Run: `npm test`
Expected: PASS, 58 tests.

- [ ] **Step 6: Коммит**

```bash
git add shared/constants/drinks.ts app/composables/useRsvpForm.ts tests/composables/useRsvpForm.test.ts
git commit -m "feat(rsvp): клик по «не пью» чинит набор напитков молча"
```

---

### Task 4: Файл контента

Дата используется таймером, заголовком страницы и OG-описанием одновременно — она обязана лежать в одном месте.

**Files:**
- Create: `app/content/wedding.ts`

- [ ] **Step 1: Создать `app/content/wedding.ts`**

```ts
/**
 * Все тексты и данные торжества. Компоненты секций читают отсюда и не
 * содержат текста внутри разметки — правки вносятся здесь, вёрстку
 * трогать не нужно.
 */
export const wedding = {
  groom: 'Дмитрий',
  bride: 'Александра',
  groomFull: 'Дмитрий Мурашко',
  brideFull: 'Александра Мадбоева',

  /** Начало торжества. Часовой пояс зафиксирован: гость из другого
   *  пояса должен видеть тот же остаток, что и местный. */
  startsAt: '2026-08-26T16:00:00+03:00',
  dateLabel: 'среда, 26 августа 2026',
  timeLabel: '16:00',

  venue: {
    name: 'Inside',
    subtitle: 'На опушке',
    address: 'Магистральная улица, 18А',
    settlement: 'посёлок Мичуринский',
    mapUrl: 'https://yandex.ru/navi/org/na_opushke/163948598644',
    /** Идентификатор организации для встроенного виджета Яндекс.Карт. */
    orgId: '163948598644'
  },

  /** Телефон для вопросов гостей. Только цифры: маску и человекочитаемый
   *  вид собирает app/utils/phone.ts. */
  contactDigits: '79066951293',

  rsvpDeadline: '10 августа 2026',

  hero: {
    lede: 'Мы будем рады разделить с вами радость этого дня и просим вас украсить его своим присутствием.'
  },

  // TODO: текст от молодожёнов
  story: {
    heading: 'Как всё начиналось',
    text: 'Здесь будет ваш рассказ: где и когда познакомились, что было дальше, как дошли до этого дня. Обычно хватает трёх-четырёх предложений — гости читают эту часть первой и охотнее всего.',
    photo: '/story.jpg',
    photoAlt: 'Дмитрий и Александра'
  },

  // TODO: текст от молодожёнов
  notes: [
    'Первая просьба — например, про крики «горько»: поцелуй хочется оставить искренним, а не по расписанию.',
    'Вторая — например, про цветы: вместо букетов приятнее получить бутылку вина в домашнюю коллекцию.',
    'Третья — организационная: трансфер, парковка, во сколько заканчиваем.'
  ],

  footer: {
    sign: 'Будем рады видеть вас на нашем празднике.'
  }
} as const
```

- [ ] **Step 2: Проверить, что TypeScript доволен**

Run: `npx nuxt typecheck`
Expected: ошибок нет. Если команда недоступна (пакет `vue-tsc` не установлен) — пропустить шаг, тип проверится на сборке в Task 14.

- [ ] **Step 3: Коммит**

```bash
git add app/content/wedding.ts
git commit -m "feat(content): данные торжества одним файлом"
```

---

### Task 5: Чистые функции для таймера и телефона

Обе вещи легко ломаются в мелочах (отрицательный остаток, ведущий ноль) и обе проверяются без браузера.

**Files:**
- Create: `app/utils/countdown.ts`
- Create: `app/utils/phone.ts`
- Test: `tests/utils/countdown.test.ts`
- Test: `tests/utils/phone.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/utils/countdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { splitRemaining } from '../../app/utils/countdown'

describe('splitRemaining', () => {
  it('разбивает остаток на дни, часы, минуты и секунды', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000
    expect(splitRemaining(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })

  it('отдаёт нули, когда дата уже прошла', () => {
    expect(splitRemaining(-100000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })

  it('отдаёт нули ровно в момент события', () => {
    expect(splitRemaining(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
```

Создать `tests/utils/phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatPhone, maskPhone } from '../../app/utils/phone'

describe('телефон в подвале', () => {
  it('форматирует номер по-человечески', () => {
    expect(formatPhone('79066951293')).toBe('+7 906 695-12-93')
  })

  it('прячет всё, кроме кода оператора', () => {
    expect(maskPhone('79066951293')).toBe('+7 906 •••-••-••')
  })

  it('собирает ссылку для звонка', () => {
    expect(formatPhone('79066951293').replace(/[^\d+]/g, '')).toBe('+79066951293')
  })
})
```

- [ ] **Step 2: Запустить тесты и увидеть падение**

Run: `npm test -- tests/utils`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Создать `app/utils/countdown.ts`**

```ts
export interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Разбивает остаток в миллисекундах на части. Прошедшая дата даёт нули. */
export function splitRemaining(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60
  }
}
```

- [ ] **Step 4: Создать `app/utils/phone.ts`**

```ts
/** Человекочитаемый вид: 79066951293 → +7 906 695-12-93 */
export function formatPhone(digits: string): string {
  return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

/** Маска до клика: 79066951293 → +7 906 •••-••-•• */
export function maskPhone(digits: string): string {
  return `+${digits[0]} ${digits.slice(1, 4)} •••-••-••`
}
```

- [ ] **Step 5: Запустить весь набор**

Run: `npm test`
Expected: PASS, 64 tests.

- [ ] **Step 6: Коммит**

```bash
git add app/utils tests/utils
git commit -m "feat(landing): чистые функции таймера и маски телефона"
```

---

### Task 6: Токены палитры и базовая типографика

**Files:**
- Create: `app/assets/css/main.css`
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Создать `app/assets/css/main.css`**

```css
/* Приглашение живёт в одном визуальном мире — тёплой льняной печати.
   Тёмная тема сознательно не делается: приглашение должно выглядеть
   одинаково у всех, а переключатель темы ломает бумажную метафору. */
:root {
  color-scheme: light;

  --linen: #EFE9DF;
  --linen-deep: #E5DDD0;
  --paper: #F7F3EC;
  --ink: #38322B;
  --ink-soft: #6E6255;
  --ink-faint: #A2957F;
  --wheat: #B99A62;
  --sage: #8B9880;
  --rule: #D6CBB8;
  --alarm: #9A4A34;

  /* Веб-шрифт не подключаем: приличная кириллическая антиква весит
     сотни килобайт, а Georgia есть на всех устройствах. */
  --serif: Georgia, "Times New Roman", serif;
  --sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif;

  --measure: 34rem;
  --band: clamp(3.5rem, 9vw, 6.5rem);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--linen);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.72;
  -webkit-font-smoothing: antialiased;
}

h1,
h2 {
  margin: 0;
  font-weight: 400;
  text-wrap: balance;
}

h2 {
  font-size: clamp(1.55rem, 4vw, 2rem);
  font-style: italic;
  letter-spacing: 0.01em;
}

p {
  margin: 0;
}

.band {
  padding: var(--band) 24px;
}

.band--paper {
  background: var(--paper);
}

.band--deep {
  background: var(--linen-deep);
}

.inner {
  max-width: var(--measure);
  margin: 0 auto;
}

.inner--wide {
  max-width: 46rem;
}

.eyebrow {
  margin: 0;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.19em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

:where(a, button, input, textarea):focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 2: Подключить в `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-07-30',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    dbPath: process.env.DB_PATH || './data/wedding.db',
    sessionSecret: process.env.SESSION_SECRET || '',
    public: {}
  }
})
```

- [ ] **Step 3: Коммит**

```bash
git add app/assets/css/main.css nuxt.config.ts
git commit -m "feat(landing): палитра и базовая типографика"
```

---

### Task 7: Обложка

**Files:**
- Create: `app/components/TheHero.vue`

- [ ] **Step 1: Создать `app/components/TheHero.vue`**

```vue
<script setup lang="ts">
import { wedding } from '../content/wedding'
</script>

<template>
  <header class="hero">
    <p class="eyebrow">Приглашение на свадьбу</p>

    <h1 class="hero__names">
      {{ wedding.groom }}
      <span class="hero__amp">&amp;</span>
      {{ wedding.bride }}
    </h1>

    <div class="sprig" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M11 20V5" />
        <path d="M11 9c-3 0-4.5-1.5-4.5-4C9.5 5 11 6.5 11 9Z" />
        <path d="M11 9c3 0 4.5-1.5 4.5-4C12.5 5 11 6.5 11 9Z" />
        <path d="M11 15c-2.4 0-3.6-1.2-3.6-3.2C10 11.8 11 13 11 15Z" />
        <path d="M11 15c2.4 0 3.6-1.2 3.6-3.2C12 11.8 11 13 11 15Z" />
      </svg>
    </div>

    <p class="hero__when">
      <span>{{ wedding.dateLabel }}</span>
      <span>{{ wedding.timeLabel }}</span>
    </p>

    <p class="hero__lede">{{ wedding.hero.lede }}</p>
  </header>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.9rem;
  padding: clamp(4rem, 12vw, 7.5rem) 24px clamp(3rem, 8vw, 5rem);
  background: var(--paper);
  text-align: center;
}

.hero__names {
  font-size: clamp(2.9rem, 11vw, 5.1rem);
  font-style: italic;
  line-height: 1.06;
}

.hero__amp {
  display: block;
  margin: 0.24em 0;
  font-size: 0.42em;
  font-style: normal;
  color: var(--wheat);
}

.hero__when {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-family: var(--sans);
  font-size: 13px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.hero__lede {
  max-width: 27rem;
  font-style: italic;
  color: var(--ink-soft);
}

.sprig {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--wheat);
}

.sprig::before,
.sprig::after {
  content: "";
  width: clamp(40px, 14vw, 88px);
  height: 1px;
  background: linear-gradient(to right, transparent, var(--rule), transparent);
}
</style>
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/TheHero.vue
git commit -m "feat(landing): секция обложки"
```

---

### Task 8: История пары

Фото ещё нет. Пока файла нет на диске, показываем размеченную заглушку, а не битую картинку.

**Files:**
- Create: `app/components/OurStory.vue`

- [ ] **Step 1: Создать `app/components/OurStory.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { wedding } from '../content/wedding'

// Фото пары ещё не прислали. Пока файла нет, показываем размеченную
// заглушку вместо иконки битой картинки.
const photoBroken = ref(false)
</script>

<template>
  <section class="band band--deep">
    <div class="inner inner--wide story">
      <img
        v-if="!photoBroken"
        class="story__photo"
        :src="wedding.story.photo"
        :alt="wedding.story.photoAlt"
        width="480"
        height="640"
        @error="photoBroken = true"
      >
      <div v-else class="story__stub">
        Фото
        <span>вертикальное, 3:4</span>
      </div>

      <div class="story__body">
        <p class="eyebrow">Наша история</p>
        <h2>{{ wedding.story.heading }}</h2>
        <p class="story__text">{{ wedding.story.text }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.story {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(1.6rem, 4vw, 2.4rem);
  align-items: center;
}

@media (min-width: 720px) {
  .story {
    grid-template-columns: 15rem 1fr;
  }
}

.story__photo {
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}

.story__stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  aspect-ratio: 3 / 4;
  padding: 12px;
  border: 1px dashed var(--ink-faint);
  background: repeating-linear-gradient(45deg, transparent 0 11px, rgba(162, 149, 127, 0.09) 11px 22px);
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  color: var(--ink-faint);
}

.story__stub span {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: none;
}

.story__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.story__text {
  color: var(--ink-soft);
}
</style>
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/OurStory.vue
git commit -m "feat(landing): секция истории пары"
```

---

### Task 9: Место проведения и карта по клику

Виджет Яндекса ставит сторонние куки всем, кто открыл страницу. Грузим его только после явного клика гостя.

**Files:**
- Create: `app/components/TheVenue.vue`

- [ ] **Step 1: Создать `app/components/TheVenue.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { wedding } from '../content/wedding'

// Виджет Яндекса ставит сторонние куки каждому, кто открыл страницу.
// Поэтому до клика гостя показываем нарисованную подложку и не
// обращаемся к внешним доменам вовсе.
const mapShown = ref(false)
</script>

<template>
  <section class="band band--paper">
    <div class="inner venue">
      <p class="eyebrow">Место проведения</p>
      <h2>{{ wedding.venue.name }}</h2>
      <p class="venue__sub">{{ wedding.venue.subtitle }}</p>
      <p class="venue__addr">{{ wedding.venue.address }}</p>
      <p class="venue__sub">{{ wedding.venue.settlement }}</p>

      <div class="map">
        <iframe
          v-if="mapShown"
          class="map__frame"
          :src="`https://yandex.ru/map-widget/v1/org/${wedding.venue.orgId}/`"
          title="Карта проезда"
          loading="lazy"
          allowfullscreen
        />
        <template v-else>
          <svg class="map__art" viewBox="0 0 320 200" aria-hidden="true">
            <rect width="320" height="200" fill="#E5DDD0" />
            <path d="M0 138h320M0 74h320M96 0v200M226 0v200" stroke="#D6CBB8" stroke-width="1.5" />
            <path d="M0 30C70 30 70 170 150 170S300 96 320 96" stroke="#C9BCA6" stroke-width="7" fill="none" />
            <rect x="118" y="86" width="34" height="26" fill="#D9CFBC" />
            <rect x="240" y="42" width="30" height="22" fill="#D9CFBC" />
            <rect x="30" y="150" width="38" height="24" fill="#D9CFBC" />
            <circle cx="199" cy="120" r="7" fill="#B99A62" />
            <circle cx="199" cy="120" r="15" fill="none" stroke="#B99A62" stroke-width="1.5" opacity="0.55" />
          </svg>
          <button class="map__cta" type="button" @click="mapShown = true">
            Показать на карте
          </button>
        </template>
      </div>

      <p v-if="!mapShown" class="map__hint">
        Карта подгрузится только после нажатия — до этого страница не обращается к сторонним сервисам.
      </p>
      <a v-else class="map__link" :href="wedding.venue.mapUrl" target="_blank" rel="noopener noreferrer">
        Открыть в Яндекс.Картах
      </a>
    </div>
  </section>
</template>

<style scoped>
.venue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

.venue__addr {
  font-size: clamp(1.15rem, 3vw, 1.4rem);
  font-style: italic;
}

.venue__sub {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.map {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--rule);
  background: var(--linen-deep);
}

.map__art,
.map__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.map__cta {
  position: relative;
  padding: 11px 22px;
  border: 1px solid var(--wheat);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 11.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.map__cta:hover {
  background: var(--wheat);
  color: var(--paper);
}

.map__hint {
  font-family: var(--sans);
  font-size: 11px;
  color: var(--ink-faint);
}

.map__link {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
</style>
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/TheVenue.vue
git commit -m "feat(landing): место проведения, карта грузится по клику"
```

---

### Task 10: Просьбы к гостям

**Files:**
- Create: `app/components/GuestNotes.vue`

- [ ] **Step 1: Создать `app/components/GuestNotes.vue`**

```vue
<script setup lang="ts">
import { wedding } from '../content/wedding'
</script>

<template>
  <section class="band band--deep">
    <div class="inner notes">
      <div class="notes__head">
        <p class="eyebrow">Несколько просьб</p>
        <h2>Дорогие гости</h2>
      </div>

      <div v-for="(note, index) in wedding.notes" :key="index" class="note">
        <span class="note__mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M7 1v12M1 7h12" />
          </svg>
        </span>
        <p class="note__text">{{ note }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: clamp(1.6rem, 4vw, 2.2rem);
}

.notes__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  text-align: center;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.note__mark {
  flex: 0 0 auto;
  margin-top: 5px;
  color: var(--sage);
}

.note__text {
  color: var(--ink-soft);
}
</style>
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/GuestNotes.vue
git commit -m "feat(landing): секция просьб к гостям"
```

---

### Task 11: Обратный отсчёт

Таймер стартует только на клиенте: на сервере он отрендерил бы остаток на момент сборки страницы, и первый кадр разошёлся бы с реальностью.

**Files:**
- Create: `app/components/TheCountdown.vue`

- [ ] **Step 1: Создать `app/components/TheCountdown.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { wedding } from '../content/wedding'
import { splitRemaining, type Remaining } from '../utils/countdown'

const target = new Date(wedding.startsAt).getTime()
const left = ref<Remaining | null>(null)

let timer: ReturnType<typeof setInterval> | undefined

function tick() {
  left.value = splitRemaining(target - Date.now())
}

// Только на клиенте: на сервере остаток застынет на момент рендера.
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <section class="band band--paper">
    <div class="inner count">
      <p class="eyebrow">До торжества осталось</p>

      <div class="clock" role="timer">
        <div class="clock__cell">
          <b>{{ left ? left.days : '—' }}</b>
          <small>дней</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.hours) : '—' }}</b>
          <small>часов</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.minutes) : '—' }}</b>
          <small>минут</small>
        </div>
        <div class="clock__cell">
          <b>{{ left ? pad(left.seconds) : '—' }}</b>
          <small>секунд</small>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.8rem;
  text-align: center;
}

.clock {
  display: flex;
  gap: clamp(14px, 5vw, 34px);
  font-variant-numeric: tabular-nums;
}

.clock__cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 3.4rem;
}

.clock__cell b {
  font-size: clamp(2.1rem, 7vw, 3.1rem);
  font-weight: 400;
  line-height: 1;
}

.clock__cell small {
  font-family: var(--sans);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
</style>
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/TheCountdown.vue
git commit -m "feat(landing): обратный отсчёт до торжества"
```

---

### Task 12: Подвал с раскрытием телефона

**Files:**
- Create: `app/components/TheFooter.vue`

- [ ] **Step 1: Создать `app/components/TheFooter.vue`**

```vue
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
```

- [ ] **Step 2: Коммит**

```bash
git add app/components/TheFooter.vue
git commit -m "feat(landing): подвал, телефон раскрывается по клику"
```

---

### Task 13: Форма RSVP

Переверстать существующий компонент: напитки столбиком, спутников изначально нет, ошибки — под полями, а не одной строкой внизу.

**Files:**
- Modify: `app/components/RsvpForm.vue`
- Modify: `app/composables/useRsvpForm.ts`
- Test: `tests/composables/useRsvpForm.test.ts`

- [ ] **Step 1: Написать падающий тест на ошибки по полям**

Дописать в `tests/composables/useRsvpForm.test.ts`:

```ts
  it('пустое ФИО даёт ошибку именно у поля fio', () => {
    const { buildPayload, errors } = useRsvpForm()
    buildPayload()
    expect(errors.fields.fio).toBeTruthy()
  })

  it('ошибка поля гаснет после исправления', () => {
    const { form, buildPayload, errors } = useRsvpForm()
    buildPayload()
    form.fio = 'Иванов Иван'
    buildPayload()
    expect(errors.fields.fio).toBeUndefined()
  })

  it('несовместимый набор напитков даёт ошибку у поля drinks', () => {
    const { form, buildPayload, errors } = useRsvpForm()
    form.fio = 'Иванов Иван'
    form.drinks = ['none', 'vodka']
    buildPayload()
    expect(errors.fields.drinks).toBeTruthy()
  })
```

- [ ] **Step 2: Запустить тесты и увидеть падение**

Run: `npm test -- tests/composables/useRsvpForm.test.ts`
Expected: FAIL — `errors.fields` не существует.

- [ ] **Step 3: Разложить ошибки по полям в `app/composables/useRsvpForm.ts`**

Заменить строку 20:

```ts
  const errors = reactive<{ message?: string, fields: Record<string, string> }>({ fields: {} })
```

Заменить тело `buildPayload` (строки 32–40):

```ts
  function buildPayload(): RsvpInput | null {
    const parsed = rsvpSchema.safeParse(form)

    // Zod отдаёт путь до поля (['companions', 0, 'fio']) — склеиваем его
    // в ключ, по которому шаблон найдёт свою подпись под инпутом.
    const fields: Record<string, string> = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!fields[key]) fields[key] = issue.message
      }
      errors.fields = fields
      errors.message = 'Проверьте отмеченные поля'
      return null
    }

    errors.fields = {}
    errors.message = undefined
    return parsed.data
  }
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS, 67 tests.

- [ ] **Step 5: Переписать `app/components/RsvpForm.vue`**

```vue
<script setup lang="ts">
import { useRsvpForm } from '../composables/useRsvpForm'
import { wedding } from '../content/wedding'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'

const { form, errors, submitted, addCompanion, removeCompanion, toggleDrink, submit } = useRsvpForm()
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
  background: #F1EDE4;
}

.drink:has(input:checked) {
  background: #EAEDE4;
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
  background: #4B4238;
}
</style>
```

- [ ] **Step 6: Запустить весь набор**

Run: `npm test`
Expected: PASS, 67 tests.

- [ ] **Step 7: Коммит**

```bash
git add app/components/RsvpForm.vue app/composables/useRsvpForm.ts tests/composables/useRsvpForm.test.ts
git commit -m "feat(rsvp): форма в стиле приглашения, ошибки под полями"
```

---

### Task 14: Сборка страницы и OG-превью

**Files:**
- Modify: `app/pages/index.vue`

- [ ] **Step 1: Заменить содержимое `app/pages/index.vue`**

```vue
<script setup lang="ts">
import { wedding } from '../content/wedding'

const title = `${wedding.groom} и ${wedding.bride} — ${wedding.dateLabel.replace('среда, ', '')}`
const description = `Приглашаем вас на нашу свадьбу ${wedding.dateLabel}, ${wedding.timeLabel}. `
  + `${wedding.venue.name} («${wedding.venue.subtitle}»), ${wedding.venue.address}, ${wedding.venue.settlement}.`

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogImage: '/og-image.jpg',
  ogType: 'website'
})

useHead({
  htmlAttrs: { lang: 'ru' }
})
</script>

<template>
  <main>
    <TheHero />
    <OurStory />
    <TheVenue />
    <GuestNotes />
    <TheCountdown />
    <RsvpForm />
    <TheFooter />
  </main>
</template>
```

- [ ] **Step 2: Запустить весь набор**

Run: `npm test`
Expected: PASS, 67 tests.

- [ ] **Step 3: Коммит**

```bash
git add app/pages/index.vue
git commit -m "feat(landing): сборка страницы и OG-превью"
```

---

### Task 15: Ручной прогон в браузере

Компоненты тестами не покрыты — это единственная проверка того, что страница действительно работает.

**Files:**
- Create: `.claude/launch.json`

- [ ] **Step 1: Создать `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "wedding",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 2: Поднять дев-сервер и открыть страницу**

Запустить конфигурацию `wedding` через preview_start, открыть `http://localhost:3000`.

- [ ] **Step 3: Пройти чек-лист**

- [ ] Консоль браузера чистая, ошибок сборки нет.
- [ ] Все семь секций на месте и идут в порядке: обложка, история, место, просьбы, таймер, форма, подвал.
- [ ] Таймер показывает ненулевой остаток и тикает.
- [ ] Кнопка «Показать на карте» подгружает карту; до клика запросов к `yandex.ru` в сетевой панели нет.
- [ ] Клик по замаскированному номеру раскрывает `+7 906 695-12-93`.
- [ ] Отправка пустой формы подсвечивает поле ФИО и показывает подпись под ним.
- [ ] Выбор «Не пью» поверх выбранного вина снимает вино; выбор вина поверх «Не пью» снимает «Не пью».
- [ ] Кнопка «Добавить спутника» доводит до трёх и исчезает; «убрать» удаляет нужного.
- [ ] Успешная отправка показывает благодарность, запись видна в админке на `/admin`.
- [ ] На ширине 375px страница не едет вбок.

- [ ] **Step 4: Коммит**

```bash
git add .claude/launch.json
git commit -m "chore: конфигурация дев-сервера для превью"
```

---

## Изменения после выполнения плана

План выполнен целиком, затем заказчик попросил два отступления от него — они внесены прямо
в код, задачи выше их не описывают:

1. **Карта грузится сразу.** Task 9 описывал подложку с кнопкой «Показать на карте» и ленивый
   виджет. Кнопка и подсказка убраны, `iframe` рендерится вместе со страницей.
2. **Подключена Яндекс.Метрика** (счётчик `111173886`, вебвизор, карта кликов) — плагин
   `app/plugins/metrika.client.ts`, `noscript`-пиксель в `app.head`, идентификатор
   в `runtimeConfig.public.metrikaId`.

Оба изменения означают, что сторонние куки теперь ставятся при открытии страницы. Раздел
«Аналитика» в спеке описывает актуальное состояние.

## Самопроверка плана

**Покрытие спеки:**

| Требование спеки | Задача |
|---|---|
| Данные торжества в одном месте | Task 4 |
| Семь секций в заданном порядке | Tasks 7–14 |
| Палитра и типографика | Task 6 |
| Только светлая тема | Task 6 (`color-scheme: light`, отсутствие тёмных токенов) |
| Карта по клику | Task 9 |
| Маскированный телефон | Tasks 5, 12 |
| Восемь напитков | Task 1 |
| «Не пью» взаимоисключающее (клиент) | Task 3 |
| «Не пью» взаимоисключающее (`rsvpSchema`, `guestPatchSchema`) | Task 2 |
| Валидация с подписями под полями | Task 13 |
| Спутники до трёх, изначально ноль | Task 13 |
| Таймер по фиксированному поясу | Tasks 5, 11 |
| OG-превью | Task 14 |
| Ручной прогон | Task 15 |

**Заглушки:** в плане нет «TBD» и «сделать по аналогии» — код приведён целиком в каждом шаге. Тексты истории и просьб помечены `// TODO: текст от молодожёнов` осознанно: это ожидаемый контент от заказчика, а не пробел плана.

**Согласованность имён:** `normalizeDrinks`/`isDrinkSetValid`/`NO_DRINK` определены в Task 1–3 и используются под теми же именами в Tasks 2, 3, 13. `splitRemaining`/`Remaining` — Task 5, использование в Task 11. `formatPhone`/`maskPhone` — Task 5, использование в Task 12. `toggleDrink` — Task 3, использование в Task 13. `errors.fields` — Task 13, шаги 3 и 5.
