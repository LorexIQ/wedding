# Админ-панель: рефакторинг на Nuxt UI — дизайн

Дата: 2026-08-05

## Цель

Админ-панель (`app/pages/admin/index.vue`, `login.vue`) сейчас — голый HTML без стилей: `alert()`
вместо ошибок и подтверждений, удаление гостя без confirm, нет client-side валидации форм, широкая
11-колоночная таблица без адаптации под мобильные экраны. Нужно перевести UI на компонентную
библиотеку Nuxt UI, сохранив текущий функционал и текущий паттерн inline-редактирования строк, и
добавить то, чего не хватает: валидацию форм, toast-уведомления, confirm на удаление, mobile-вид
таблицы гостей.

Скоуп — только 2 существующие страницы (`/admin`, `/admin/login`). Новых разделов/вкладок/функций
не добавляется.

## Установка и базовая интеграция

- `npm install @nuxt/ui`.
- `nuxt.config.ts`: `modules: ['@nuxt/ui']`, `ui: { colorMode: false }` — сайт принципиально
  light-only (см. комментарий в начале `main.css` про то, что тёмная тема не делается сознательно),
  дефолтный `@nuxtjs/color-mode`, который иначе тянет `@nuxt/ui`, отключается, чтобы не трогал
  `color-scheme` и не добавлял класс/скрипт переключения темы.
- `app/assets/css/main.css`: в начало файла добавляются:
  ```css
  @import "tailwindcss";
  @import "@nuxt/ui";

  @theme static {
    --color-sage-50: #F4F6F1;
    --color-sage-100: #E7ECDF;
    --color-sage-200: #D2DBC3;
    --color-sage-300: #B7C6A2;
    --color-sage-400: #A3B78D;
    --color-sage-500: #93A47F; /* текущий --sage — базовый тон */
    --color-sage-600: #7C8D6A;
    --color-sage-700: #647256;
    --color-sage-800: #4E5943;
    --color-sage-900: #3B4333;
    --color-sage-950: #262B21;

    --color-wheat-50: #EEF0E9;
    --color-wheat-100: #DCE0D0;
    --color-wheat-200: #BDC5AB;
    --color-wheat-300: #9CAA85;
    --color-wheat-400: #83916A;
    --color-wheat-500: #6F7D5A; /* текущий --wheat — базовый тон */
    --color-wheat-600: #5C6849;
    --color-wheat-700: #49523A;
    --color-wheat-800: #383F2D;
    --color-wheat-900: #2A2F22;
    --color-wheat-950: #1B1E16;
  }
  ```
  Промежуточные оттенки — линейная интерполяция к белому (выше 500) и к тёмному ink-тону (ниже 500)
  от базового hex; при реализации допустима точная подгонка по глазу, критично только что 500-й
  оттенок каждой шкалы совпадает с текущей CSS-переменной. Остальной существующий `main.css`
  (кастомные переменные, `.band`, `.reveal` и т.д.) не трогается.
- `app/app.config.ts` (новый файл):
  ```ts
  export default defineAppConfig({
    ui: {
      colors: {
        primary: 'sage',
        neutral: 'stone',
        error: 'red' // ближе всего к --alarm (#A6503F) среди готовых шкал Tailwind
      }
    }
  })
  ```
- `app/app.vue`: `<NuxtPage/>` оборачивается в `<UApp>` — обязательный контейнер для `useToast`,
  `UModal` и прочих overlay-компонентов Nuxt UI (монтирует `Toaster`/провайдеры).

### Риск: глобальный Tailwind preflight

Nuxt UI не грузится scoped — импорт Tailwind в `main.css` применяется ко всему сайту, не только к
`/admin`. У `RsvpForm.vue` и других компонентов инвайта стили заданы явными селекторами
(`input[type="text"]`, `.submit`, scoped CSS) — специфичность выше, чем у Tailwind preflight,
конфликтов по правилам каскада быть не должно. Тем не менее после установки обязательна ручная
проверка в браузере: `/`, `/invite/<code>`, RSVP-форма — до и после — визуально идентичны.

## Структура файлов

```
app/pages/admin/
  index.vue              — orchestration: fetch данных, layout, top-level actions
  login.vue              — форма логина

app/components/admin/
  GuestsTable.vue         — desktop <table> + mobile card-список гостей
  GuestFormFields.vue     — общие поля fio/phone/drinks/comment/attending/allowCompanions
                             (переиспользуется в create-строке и в inline-edit, и в desktop,
                             и в mobile-варианте — разметка полей не дублируется)
  SettingsPanel.vue       — дедлайн RSVP (получение/сохранение/сброс)
  DeleteGuestModal.vue    — confirm-модалка удаления гостя
```

`index.vue` перестаёт быть монолитом — оркестрирует композаблы и компоненты, сам не содержит
разметки таблицы/форм.

## Формы и валидация

- Новая Zod-схема `shared/schemas/adminGuest.ts` для полей гостя, редактируемых в админке
  (`fio`, `phone`, `comment`, `drinks`, `allowCompanions`) — переиспользует enum напитков и т.п. из
  `shared/schemas/rsvp.ts` там, где пересекается, а не дублирует правила валидации заново.
- Create- и edit-формы гостя — `UForm :schema="adminGuestSchema"` + `UFormField` на каждое поле;
  ошибки валидации показываются под конкретным полем, а не через `alert()`.
- Форма логина (`login.vue`) — `UForm` (без Zod-схемы, 2 обязательных текстовых поля), серверная
  ошибка входа — `UAlert` цвета `error`, как сейчас через `error.value`, просто другой компонент
  вывода.
- Дедлайн RSVP — `UFormField` + `UInput type="datetime-local"`, без отдельного date-picker
  компонента (Nuxt UI не даёт готового datetime-picker из коробки, а городить его поверх
  `UCalendar`/`UPopover` ради одного поля — избыточно для этой задачи).

## Обратная связь пользователю

- Все `alert(...)` в текущем `index.vue` (создание/редактирование/удаление гостя, toggle
  submitted/envelopeOpened, копирование ссылки, сохранение дедлайна — 10 мест) заменяются на
  `useToast().add({ color: 'success' | 'error', title, description })`.
- Удаление гостя — `DeleteGuestModal.vue` (`UModal`), текст подтверждения включает ФИО гостя,
  кнопка удаления — `color="error"`. Удаление без подтверждения (как сейчас) убирается.
- Чекбоксы «Ответил»/«Открыл конверт» остаются мгновенным toggle без подтверждения (как сейчас),
  на `UCheckbox`; при ошибке отката значения — toast с причиной вместо молчаливого возврата назад.

## Таблица гостей: desktop и mobile

- Desktop (`≥ md`, класс `hidden md:table` на контейнере): собственная `<table>`/`<tr>`/`<td>`
  разметка (не `UTable`/TanStack — column-based рендер плохо совмещается с inline-редактированием
  через чекбокс-группы и разными полями формы в ячейках). Внутри ячеек — `UInput`, `USelect`,
  `UCheckbox`, `UButton`, `UBadge` (для статусов «Ответил»/«Открыл конверт» — нагляднее голого
  чекбокса в read-режиме).
- Mobile (`< md`, класс `md:hidden`): `UCard` на каждого гостя, те же поля вертикально. И
  desktop-строка, и mobile-карточка в режиме редактирования рендерят один и тот же
  `GuestFormFields.vue` — компонент не завязан на table-разметку.
- Оба варианта (desktop-таблица и mobile-список карточек) рендерятся одновременно, переключение —
  чисто CSS-классами по брейкпоинту (без JS/`matchMedia`) — исключает hydration mismatch между SSR
  и клиентом.
- Кнопки «Выйти», «Экспорт CSV», «Создать приглашение» — `UButton`.

## Тестирование

- Юнит-тестов на UI сейчас нет (`tests/` покрывает только серверную логику: `rsvp.post.ts` и
  подобное) — новых тестов на Nuxt UI компоненты не заводим, это не соответствует текущей конвенции
  проекта.
- После реализации — обязательная ручная проверка в браузере (`npm run dev`):
  - `/admin/login` — успешный и неуспешный вход;
  - `/admin` на desktop-ширине — создание, inline-редактирование, удаление гостя (с confirm),
    toggle submitted/envelopeOpened, копирование ссылки, сохранение/сброс дедлайна, CSV-экспорт;
  - `/admin` на mobile-ширине — те же действия через card-вид;
  - `/`, `/invite/<code>`, `RsvpForm` — без визуальных регрессий от глобального Tailwind preflight.
