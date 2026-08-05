# Admin Panel Nuxt UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstyled raw-HTML admin panel (`/admin`, `/admin/login`) with Nuxt UI components — validated forms, toasts, delete confirmation, and a mobile card view for the guest table — without touching server-side logic.

**Architecture:** Install `@nuxt/ui` (Tailwind v4-based) as a Nuxt module, theme it with the site's existing sage/wheat/ink palette, then incrementally replace markup in `login.vue` and `index.vue`. The guest table's create/edit logic moves out of `index.vue` into new focused components (`SettingsPanel.vue`, `GuestFormFields.vue`, `DeleteGuestModal.vue`, `GuestsTable.vue`); `index.vue` becomes a thin orchestrator.

**Tech Stack:** Nuxt 4, Vue 3.5, `@nuxt/ui` v4, Tailwind CSS v4 (bundled with `@nuxt/ui`), Zod (existing `#shared/schemas/rsvp`), `vue-imask` (existing, unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-admin-nuxt-ui-design.md`. Scope is only `app/pages/admin/index.vue` and `app/pages/admin/login.vue` and their support files — no server-side changes, no new routes.
- Dark mode is never enabled anywhere on this site (see `app/assets/css/main.css:1-3`) — `ui.colorMode: false` in `nuxt.config.ts` is mandatory, not optional.
- **Deviation from spec, discovered while mapping files:** the spec proposed a new `shared/schemas/adminGuest.ts`. `#shared/schemas/rsvp.ts` already exports `guestCreateSchema` and `guestPatchSchema` covering exactly the admin form fields (`fio`, `phone`, `comment`, `drinks`, `attending`, `allowCompanions`) — creating a second schema would duplicate validation rules. Tasks below reuse the existing schemas directly.
- **Deviation from spec, discovered while mapping files:** the spec said "UForm + Zod + toast" for guest create/edit. The desktop table keeps guests editable inline as a `<tr>`, and HTML forbids `<form>` as a descendant of `<tr>`/`<td>` — wrapping an editable row in `<UForm>` would produce invalid, browser-mangled HTML. Guest create/edit (both desktop row and mobile card) instead call `guestCreateSchema.safeParse()` / `guestPatchSchema.safeParse()` manually on save-click, and pass the resulting field errors into `<UFormField :error="...">` (which Nuxt UI supports standalone, without an ambient `<UForm>`). Toasts on success/failure are unchanged from the spec. The **login form** and the **settings deadline field** are not inside a table, so they use real `<UForm>`/`<UFormField>` as the spec describes.
- Nuxt UI auto-imports its components (`UButton`, `UCard`, `UInput`, `UFormField`, `USelect`, `UCheckboxGroup`, `UCheckbox`, `UTextarea`, `UBadge`, `UAlert`, `UModal`) and composables (`useToast`) once the module is registered — do not add explicit imports for these.
- No new automated tests: `tests/` in this project only covers server-side logic (see `CLAUDE.md`), and this refactor touches no server code. Every task instead ends with `npx vue-tsc --noEmit` (must show no new errors) and a manual browser check against `npm run dev`.
- Desktop and mobile guest views both render at all times; visibility toggles via Tailwind's `hidden md:block` / `md:hidden` classes only — never `v-if`/`matchMedia` — so SSR and client always agree (no hydration mismatch).

---

### Task 1: Install and configure Nuxt UI (foundation, no markup changes yet)

**Files:**
- Modify: `nuxt.config.ts`
- Modify: `app/assets/css/main.css:1` (top of file, before the existing `:root` block)
- Modify: `app/app.vue`
- Create: `app/app.config.ts`

**Interfaces:**
- Produces: global Tailwind + Nuxt UI CSS pipeline, `sage`/`wheat` custom color scales usable as `primary`/future accents, `<UApp>` root wrapper required by `useToast`/`UModal` in later tasks.

- [ ] **Step 1: Install the dependency**

Run: `npm install @nuxt/ui`

- [ ] **Step 2: Register the module and disable color mode**

Edit `nuxt.config.ts` — add `modules` and `ui` keys (keep everything else in the file unchanged):

```ts
import { wedding } from './app/content/wedding'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-30',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  ui: {
    // Site is permanently light-only (see app/assets/css/main.css) — never let
    // Nuxt UI's bundled @nuxtjs/color-mode module touch color-scheme or inject
    // a theme toggle.
    colorMode: false
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' }
      ],
      noscript: [
        {
          innerHTML: '<div><img src="https://mc.yandex.ru/watch/111173886" style="position:absolute; left:-9999px;" alt="" /></div>'
        }
      ]
    }
  },
  runtimeConfig: {
    dbPath: process.env.DB_PATH || './data/wedding.db',
    sessionSecret: process.env.SESSION_SECRET || '',
    public: {
      metrikaId: process.env.METRIKA_ID || '111173886',
      contactPhone: wedding.contactDigits
    }
  }
})
```

- [ ] **Step 3: Add Tailwind/Nuxt UI imports and the custom color scales to `main.css`**

Insert this block as the very first thing in `app/assets/css/main.css`, above the existing `:root { color-scheme: light; ... }` block (do not modify anything below it):

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --color-sage-50: #F4F6F1;
  --color-sage-100: #E7ECDF;
  --color-sage-200: #D2DBC3;
  --color-sage-300: #B7C6A2;
  --color-sage-400: #A3B78D;
  --color-sage-500: #93A47F;
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
  --color-wheat-500: #6F7D5A;
  --color-wheat-600: #5C6849;
  --color-wheat-700: #49523A;
  --color-wheat-800: #383F2D;
  --color-wheat-900: #2A2F22;
  --color-wheat-950: #1B1E16;
}
```

- [ ] **Step 4: Create `app/app.config.ts`**

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sage',
      neutral: 'stone',
      error: 'red'
    }
  }
})
```

- [ ] **Step 5: Wrap the app root in `<UApp>`**

Edit `app/app.vue`:

```vue
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

- [ ] **Step 6: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors (Nuxt UI ships its own types; `defineAppConfig`/`defineNuxtConfig` remain globally available).

- [ ] **Step 7: Manual browser check**

Run: `npm run dev`, then in a browser check:
- `/` — hero, RSVP form, footer all look pixel-identical to before (Tailwind preflight must not have changed fonts, spacing, or input/button chrome on the invitation pages).
- `/invite/<any existing code>` — same visual check, focus on `RsvpForm`'s inputs/buttons/checkboxes.
- `/admin/login` — page still renders (old raw markup), no console errors about unknown components.
- No console errors/warnings mentioning `color-mode`, `Toaster`, or `UApp`.

If any invitation-facing page changed visually, do not proceed — the preflight conflict noted in the spec's risk section has to be resolved (most likely by adding a targeted CSS override in `main.css` below the Tailwind import) before continuing to later tasks.

- [ ] **Step 8: Commit**

```bash
git add nuxt.config.ts app/assets/css/main.css app/app.vue app/app.config.ts package.json package-lock.json
git commit -m "feat: install and configure Nuxt UI"
```

---

### Task 2: Remove duplicate `GuestCreateInput` type from `useAdminGuests.ts`

**Files:**
- Modify: `app/composables/useAdminGuests.ts`

**Interfaces:**
- Produces: `GuestCreateInput` re-exported from `#shared/schemas/rsvp` (same name, same call sites, now a single source of truth for that shape).

- [ ] **Step 1: Replace the hand-rolled interface with a re-export**

In `app/composables/useAdminGuests.ts`, replace:

```ts
export interface GuestCreateInput {
  fio?: string
  phone?: string
  comment?: string
  drinks?: string[]
  attending?: boolean | null
  allowCompanions?: boolean
}
```

with:

```ts
export type { GuestCreateInput } from '#shared/schemas/rsvp'
```

Keep the rest of the file (`GuestRecord`, `useAdminGuests()`, etc.) untouched.

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors. (`createGuestInvite`'s parameter type now comes from the Zod schema; `app/pages/admin/index.vue`'s current usage — `createGuestInvite({ fio: ..., phone: ..., ... })` — is structurally identical so nothing else should break.)

- [ ] **Step 3: Commit**

```bash
git add app/composables/useAdminGuests.ts
git commit -m "refactor: reuse GuestCreateInput from shared rsvp schema"
```

---

### Task 3: Migrate `login.vue` to Nuxt UI

**Files:**
- Modify: `app/pages/admin/login.vue`

**Interfaces:**
- Consumes: `POST /api/admin/login` (existing, unchanged) — `{ login, password }` body, throws with `e.data.statusMessage` on failure.
- Produces: nothing consumed by other tasks (leaf page).

- [ ] **Step 1: Rewrite the file**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'

const state = reactive({ login: '', password: '' })
const error = ref('')

async function onSubmit() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { login: state.login, password: state.password } })
    await navigateTo('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Ошибка входа'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <UForm :state="state" class="flex flex-col gap-4" @submit="onSubmit">
        <h1 class="text-lg font-medium">
          Вход в админку
        </h1>
        <UFormField label="Логин" name="login">
          <UInput v-model="state.login" class="w-full" />
        </UFormField>
        <UFormField label="Пароль" name="password">
          <UInput v-model="state.password" type="password" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
        <UButton type="submit" block>
          Войти
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

`npm run dev`, visit `/admin/login`:
- Submit with wrong credentials → red `UAlert` with the server's error message appears.
- Submit with correct admin credentials (seed one first if needed: `npm run seed:admin -- <login> <password>`) → redirected to `/admin`.
- Layout is centered, card-styled, readable at both desktop and phone widths (resize devtools).

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/login.vue
git commit -m "feat: migrate admin login page to Nuxt UI"
```

---

### Task 4: Extract `SettingsPanel.vue` (RSVP deadline)

**Files:**
- Create: `app/components/admin/SettingsPanel.vue`
- Modify: `app/pages/admin/index.vue`

**Interfaces:**
- Consumes: `deadline: number | null` prop, `patchSettings: (iso: string | null) => Promise<void>` prop (this is `useAdminSettings().patchSettings`, signature unchanged).
- Produces: nothing consumed by later tasks (self-contained).

- [ ] **Step 1: Create `SettingsPanel.vue`**

```vue
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
```

- [ ] **Step 2: Wire it into `index.vue`, remove the old deadline block**

In `app/pages/admin/index.vue`, remove the `deadlineInput` ref, `saveDeadline`/`clearDeadline` functions, and the `<div>` block containing the `datetime-local` input and its two buttons (currently lines 15, 17-30, 156-163 of the file as it exists before this task). Add the import and replace that block with the component. The file's guest-table code (`editingId`, `editForm`, `draft`, `creating`, table markup, etc.) is untouched in this task — it is migrated in Task 5.

After this step, the top of `app/pages/admin/index.vue`'s `<script setup>` should read:

```ts
import { ref, reactive } from 'vue'
import { IMaskComponent } from 'vue-imask'
import { useAdminGuests, type GuestRecord } from '../../composables/useAdminGuests'
import { useAdminSettings } from '../../composables/useAdminSettings'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'
import SettingsPanel from '../../components/admin/SettingsPanel.vue'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest } = useAdminGuests()
const { deadline, fetchSettings, patchSettings } = useAdminSettings()
await Promise.all([fetchGuests(), fetchSettings()])
```

(`deadlineInput`, `saveDeadline`, `clearDeadline` deleted — everything else in the script, from `editingId` onward, stays exactly as it is for now.)

And the top of the `<template>`, replacing the old deadline `<div>`:

```vue
<template>
  <div>
    <button @click="onLogout">
      Выйти
    </button>
    <a href="/api/admin/guests/export">Экспорт CSV</a>

    <SettingsPanel :deadline="deadline" :patch-settings="patchSettings" />

    <p v-if="loading">
      Загрузка...
    </p>

    <table v-else>
      <!-- unchanged, migrated in Task 5 -->
```

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual browser check**

`/admin` (logged in): set a deadline, confirm it persists on reload; clear it, confirm it's gone; enter an invalid value in a way that makes `patchSettings` reject it (e.g. clear the deadline then immediately break by editing DB state — simplest real check is just confirming save/clear both show a success toast and the value round-trips). Rest of the page (guest table) still looks and behaves exactly as before this task.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/SettingsPanel.vue app/pages/admin/index.vue
git commit -m "feat: migrate RSVP deadline settings to Nuxt UI"
```

---

### Task 5: Build the guest table (`GuestFormFields`, `DeleteGuestModal`, `GuestsTable`) and finish `index.vue`

This is the main task — it replaces the entire remaining raw-HTML guest table with Nuxt UI, adds desktop/mobile views, validation, and delete confirmation.

**Files:**
- Create: `app/components/admin/GuestFormFields.vue`
- Create: `app/components/admin/DeleteGuestModal.vue`
- Create: `app/components/admin/GuestsTable.vue`
- Modify: `app/pages/admin/index.vue`

**Interfaces:**
- `GuestFormFields.vue` produces: `export interface GuestFormState { fio: string; phone: string; comment: string; drinks: DrinkOption[]; attending: boolean | null; allowCompanions: boolean }`. Props: `layout: 'row' | 'stack'`, `errors: Record<string, string>`. Model: `v-model:state` (a reactive `GuestFormState`).
- `DeleteGuestModal.vue` produces: nothing consumed elsewhere. Props: `guest: GuestRecord | null`. Model: `v-model:open` (boolean). Emits: `confirm` (no payload).
- `GuestsTable.vue` consumes: `guests: GuestRecord[]`, `loading: boolean`, `createGuestInvite`, `patchGuest`, `removeGuest` (all three straight from `useAdminGuests()`, signatures unchanged).

- [ ] **Step 1: Create `GuestFormFields.vue`**

```vue
<script setup lang="ts">
import { IMaskComponent } from 'vue-imask'
import { DRINK_OPTIONS, DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'

export interface GuestFormState {
  fio: string
  phone: string
  comment: string
  drinks: DrinkOption[]
  attending: boolean | null
  allowCompanions: boolean
}

defineProps<{
  layout: 'row' | 'stack'
  errors: Record<string, string>
}>()

const state = defineModel<GuestFormState>('state', { required: true })

const drinkItems = DRINK_OPTIONS.map((opt) => ({ label: DRINK_LABELS[opt], value: opt }))

const attendingItems = [
  { label: '—', value: null },
  { label: 'Да', value: true },
  { label: 'Нет', value: false }
]

const allowCompanionsItems = [
  { label: 'Со спутниками', value: true },
  { label: 'Фиксированное', value: false }
]

function onFioBlur() {
  state.value.fio = formatFio(state.value.fio)
}
</script>

<template>
  <template v-if="layout === 'row'">
    <td class="px-3 py-2 align-top">
      <UFormField name="fio" :error="errors.fio">
        <UInput v-model="state.fio" placeholder="ФИО" @blur="onFioBlur" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="phone" :error="errors.phone">
        <IMaskComponent
          v-model="state.phone"
          mask="+7 000 000-00-00"
          type="tel"
          placeholder="Телефон"
          class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-transparent"
        />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="drinks" :error="errors.drinks">
        <UCheckboxGroup v-model="state.drinks" :items="drinkItems" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="comment" :error="errors.comment">
        <UTextarea v-model="state.comment" placeholder="Комментарий" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="attending" :error="errors.attending">
        <USelect v-model="state.attending" :items="attendingItems" />
      </UFormField>
    </td>
    <td class="px-3 py-2 align-top">
      <UFormField name="allowCompanions" :error="errors.allowCompanions">
        <USelect v-model="state.allowCompanions" :items="allowCompanionsItems" />
      </UFormField>
    </td>
  </template>

  <div v-else class="flex flex-col gap-3">
    <UFormField label="ФИО" name="fio" :error="errors.fio">
      <UInput v-model="state.fio" placeholder="ФИО" class="w-full" @blur="onFioBlur" />
    </UFormField>
    <UFormField label="Телефон" name="phone" :error="errors.phone">
      <IMaskComponent
        v-model="state.phone"
        mask="+7 000 000-00-00"
        type="tel"
        placeholder="Телефон"
        class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-transparent"
      />
    </UFormField>
    <UFormField label="Напитки" name="drinks" :error="errors.drinks">
      <UCheckboxGroup v-model="state.drinks" :items="drinkItems" />
    </UFormField>
    <UFormField label="Комментарий" name="comment" :error="errors.comment">
      <UTextarea v-model="state.comment" placeholder="Комментарий" class="w-full" />
    </UFormField>
    <UFormField label="Придёт" name="attending" :error="errors.attending">
      <USelect v-model="state.attending" :items="attendingItems" class="w-full" />
    </UFormField>
    <UFormField label="Тип приглашения" name="allowCompanions" :error="errors.allowCompanions">
      <USelect v-model="state.allowCompanions" :items="allowCompanionsItems" class="w-full" />
    </UFormField>
  </div>
</template>
```

- [ ] **Step 2: Create `DeleteGuestModal.vue`**

```vue
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
```

- [ ] **Step 3: Create `GuestsTable.vue`**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { ZodIssue } from 'zod'
import { guestCreateSchema, guestPatchSchema } from '#shared/schemas/rsvp'
import { DRINK_LABELS, type DrinkOption } from '#shared/constants/drinks'
import type { GuestRecord, GuestCreateInput } from '../../composables/useAdminGuests'
import GuestFormFields, { type GuestFormState } from './GuestFormFields.vue'
import DeleteGuestModal from './DeleteGuestModal.vue'

const props = defineProps<{
  guests: GuestRecord[]
  loading: boolean
  createGuestInvite: (input: GuestCreateInput) => Promise<GuestRecord>
  patchGuest: (id: number, patch: Partial<GuestRecord>) => Promise<void>
  removeGuest: (id: number) => Promise<void>
}>()

const toast = useToast()

function emptyForm(): GuestFormState {
  return { fio: '', phone: '', comment: '', drinks: [], attending: null, allowCompanions: true }
}

function zodIssuesToErrors(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

const editingId = ref<number | null>(null)
const editForm = reactive<GuestFormState>(emptyForm())
const editErrors = ref<Record<string, string>>({})

const creating = ref(false)
const draft = reactive<GuestFormState>(emptyForm())
const createErrors = ref<Record<string, string>>({})

const guestPendingDelete = ref<GuestRecord | null>(null)
const isDeleteModalOpen = ref(false)

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id
  editErrors.value = {}
  editForm.fio = guest.fio ?? ''
  editForm.phone = guest.phone ?? ''
  editForm.comment = guest.comment ?? ''
  editForm.drinks = [...guest.drinks] as DrinkOption[]
  editForm.attending = guest.attending
  editForm.allowCompanions = guest.allowCompanions
}

function cancelEdit() {
  editingId.value = null
}

async function onEditSubmit(guest: GuestRecord) {
  const parsed = guestPatchSchema.safeParse(editForm)
  if (!parsed.success) {
    editErrors.value = zodIssuesToErrors(parsed.error.issues)
    return
  }
  editErrors.value = {}
  try {
    await props.patchGuest(guest.id, parsed.data as Partial<GuestRecord>)
    editingId.value = null
    toast.add({ title: 'Сохранено', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить гостя', color: 'error' })
  }
}

function startCreate() {
  creating.value = true
  createErrors.value = {}
  Object.assign(draft, emptyForm())
}

function cancelCreate() {
  creating.value = false
}

async function onCreateSubmit() {
  const parsed = guestCreateSchema.safeParse(draft)
  if (!parsed.success) {
    createErrors.value = zodIssuesToErrors(parsed.error.issues)
    return
  }
  createErrors.value = {}
  try {
    await props.createGuestInvite(parsed.data)
    creating.value = false
    toast.add({ title: 'Приглашение создано', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось создать', description: 'Не получилось создать приглашение', color: 'error' })
  }
}

async function toggleSubmitted(guest: GuestRecord, value: boolean) {
  try {
    await props.patchGuest(guest.id, { submitted: value })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить статус ответа', color: 'error' })
  }
}

async function toggleEnvelopeOpened(guest: GuestRecord, value: boolean) {
  try {
    await props.patchGuest(guest.id, { envelopeOpened: value })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось сохранить', description: 'Не получилось обновить статус конверта', color: 'error' })
  }
}

async function copyLink(guest: GuestRecord) {
  try {
    await navigator.clipboard.writeText(`${location.origin}/invite/${guest.inviteCode}`)
    toast.add({ title: 'Ссылка скопирована', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось скопировать', description: 'Не получилось скопировать ссылку', color: 'error' })
  }
}

function requestDelete(guest: GuestRecord) {
  guestPendingDelete.value = guest
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  const guest = guestPendingDelete.value
  if (!guest) return
  try {
    await props.removeGuest(guest.id)
    toast.add({ title: 'Гость удалён', color: 'success' })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Не удалось удалить', description: 'Не получилось удалить гостя', color: 'error' })
  } finally {
    guestPendingDelete.value = null
  }
}

function attendingLabel(attending: boolean | null) {
  if (attending === true) return 'Да'
  if (attending === false) return 'Нет'
  return '—'
}

function attendingColor(attending: boolean | null): 'success' | 'error' | 'neutral' {
  if (attending === true) return 'success'
  if (attending === false) return 'error'
  return 'neutral'
}
</script>

<template>
  <div>
    <p v-if="loading" class="text-sm text-gray-500">
      Загрузка...
    </p>

    <template v-else>
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left">
              <th class="px-3 py-2">ФИО</th>
              <th class="px-3 py-2">Телефон</th>
              <th class="px-3 py-2">Напитки</th>
              <th class="px-3 py-2">Комментарий</th>
              <th class="px-3 py-2">Придёт</th>
              <th class="px-3 py-2">Тип</th>
              <th class="px-3 py-2">Сопровождающие</th>
              <th class="px-3 py-2">Ответил</th>
              <th class="px-3 py-2">Открыл конверт</th>
              <th class="px-3 py-2">Ссылка</th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="guest in guests" :key="guest.id" class="border-b border-gray-100 align-top">
              <template v-if="editingId === guest.id">
                <GuestFormFields v-model:state="editForm" layout="row" :errors="editErrors" />
                <td class="px-3 py-2">{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
                <td colspan="3" />
                <td class="px-3 py-2">
                  <div class="flex gap-2">
                    <UButton size="xs" @click="onEditSubmit(guest)">
                      Сохранить
                    </UButton>
                    <UButton size="xs" color="neutral" variant="ghost" @click="cancelEdit">
                      Отмена
                    </UButton>
                  </div>
                </td>
              </template>

              <template v-else>
                <td class="px-3 py-2">{{ guest.fio }}</td>
                <td class="px-3 py-2">{{ guest.phone }}</td>
                <td class="px-3 py-2">{{ guest.drinks.map((d) => DRINK_LABELS[d as DrinkOption]).join(', ') }}</td>
                <td class="px-3 py-2">{{ guest.comment }}</td>
                <td class="px-3 py-2">
                  <UBadge :color="attendingColor(guest.attending)" variant="subtle">
                    {{ attendingLabel(guest.attending) }}
                  </UBadge>
                </td>
                <td class="px-3 py-2">{{ guest.allowCompanions ? 'Со спутниками' : 'Фиксированное' }}</td>
                <td class="px-3 py-2">{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
                <td class="px-3 py-2">
                  <UCheckbox
                    :model-value="guest.submitted"
                    @update:model-value="(v) => toggleSubmitted(guest, Boolean(v))"
                  />
                </td>
                <td class="px-3 py-2">
                  <UCheckbox
                    :model-value="guest.envelopeOpened"
                    @update:model-value="(v) => toggleEnvelopeOpened(guest, Boolean(v))"
                  />
                </td>
                <td class="px-3 py-2">
                  <UButton size="xs" variant="soft" :disabled="!guest.inviteCode" @click="copyLink(guest)">
                    Скопировать
                  </UButton>
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-2">
                    <UButton size="xs" variant="soft" @click="startEdit(guest)">
                      Изменить
                    </UButton>
                    <UButton size="xs" color="error" variant="soft" @click="requestDelete(guest)">
                      Удалить
                    </UButton>
                  </div>
                </td>
              </template>
            </tr>

            <tr v-if="creating" class="border-b border-gray-100 align-top">
              <GuestFormFields v-model:state="draft" layout="row" :errors="createErrors" />
              <td />
              <td colspan="3" />
              <td class="px-3 py-2">
                <div class="flex gap-2">
                  <UButton size="xs" @click="onCreateSubmit">
                    ✓
                  </UButton>
                  <UButton size="xs" color="neutral" variant="ghost" @click="cancelCreate">
                    ✗
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <UButton v-if="!creating" class="mt-3" variant="soft" :disabled="creating" @click="startCreate">
          + Создать приглашение
        </UButton>
      </div>

      <div class="md:hidden flex flex-col gap-3">
        <UCard v-for="guest in guests" :key="guest.id">
          <template v-if="editingId === guest.id">
            <GuestFormFields v-model:state="editForm" layout="stack" :errors="editErrors" />
            <div class="flex gap-2 mt-3">
              <UButton size="xs" @click="onEditSubmit(guest)">
                Сохранить
              </UButton>
              <UButton size="xs" color="neutral" variant="ghost" @click="cancelEdit">
                Отмена
              </UButton>
            </div>
          </template>

          <template v-else>
            <p class="font-medium">{{ guest.fio || 'Без имени' }}</p>
            <p class="text-sm text-gray-500">{{ guest.phone }}</p>
            <p class="text-sm">Напитки: {{ guest.drinks.map((d) => DRINK_LABELS[d as DrinkOption]).join(', ') || '—' }}</p>
            <p class="text-sm">Сопровождающие: {{ guest.companions.map((c) => c.fio).join(', ') || '—' }}</p>
            <p class="text-sm">Комментарий: {{ guest.comment || '—' }}</p>
            <div class="flex items-center gap-2 mt-1">
              <UBadge :color="attendingColor(guest.attending)" variant="subtle">
                {{ attendingLabel(guest.attending) }}
              </UBadge>
              <span class="text-sm text-gray-500">{{ guest.allowCompanions ? 'Со спутниками' : 'Фиксированное' }}</span>
            </div>
            <div class="flex items-center gap-3 mt-2">
              <label class="flex items-center gap-1 text-sm">
                <UCheckbox
                  :model-value="guest.submitted"
                  @update:model-value="(v) => toggleSubmitted(guest, Boolean(v))"
                />
                Ответил
              </label>
              <label class="flex items-center gap-1 text-sm">
                <UCheckbox
                  :model-value="guest.envelopeOpened"
                  @update:model-value="(v) => toggleEnvelopeOpened(guest, Boolean(v))"
                />
                Открыл конверт
              </label>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              <UButton size="xs" variant="soft" :disabled="!guest.inviteCode" @click="copyLink(guest)">
                Скопировать ссылку
              </UButton>
              <UButton size="xs" variant="soft" @click="startEdit(guest)">
                Изменить
              </UButton>
              <UButton size="xs" color="error" variant="soft" @click="requestDelete(guest)">
                Удалить
              </UButton>
            </div>
          </template>
        </UCard>

        <UCard v-if="creating">
          <GuestFormFields v-model:state="draft" layout="stack" :errors="createErrors" />
          <div class="flex gap-2 mt-3">
            <UButton size="xs" @click="onCreateSubmit">
              Создать
            </UButton>
            <UButton size="xs" color="neutral" variant="ghost" @click="cancelCreate">
              Отмена
            </UButton>
          </div>
        </UCard>
        <UButton v-else variant="soft" :disabled="creating" @click="startCreate">
          + Создать приглашение
        </UButton>
      </div>
    </template>

    <DeleteGuestModal v-model:open="isDeleteModalOpen" :guest="guestPendingDelete" @confirm="confirmDelete" />
  </div>
</template>
```

- [ ] **Step 4: Rewrite `index.vue` to orchestrate only**

Replace the entire file with:

```vue
<script setup lang="ts">
import { useAdminGuests } from '../../composables/useAdminGuests'
import { useAdminSettings } from '../../composables/useAdminSettings'
import GuestsTable from '../../components/admin/GuestsTable.vue'
import SettingsPanel from '../../components/admin/SettingsPanel.vue'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest } = useAdminGuests()
const { deadline, fetchSettings, patchSettings } = useAdminSettings()
await Promise.all([fetchGuests(), fetchSettings()])

async function onLogout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-medium">
        Гости
      </h1>
      <div class="flex items-center gap-4">
        <a href="/api/admin/guests/export" class="text-sm underline underline-offset-2 text-[var(--wheat)]">
          Экспорт CSV
        </a>
        <UButton color="neutral" variant="ghost" @click="onLogout">
          Выйти
        </UButton>
      </div>
    </div>

    <SettingsPanel :deadline="deadline" :patch-settings="patchSettings" />

    <GuestsTable
      :guests="guestsList"
      :loading="loading"
      :create-guest-invite="createGuestInvite"
      :patch-guest="patchGuest"
      :remove-guest="removeGuest"
    />
  </div>
</template>
```

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Pay particular attention to `GuestFormFields`' exported `GuestFormState` type resolving correctly through the `.vue` import in `GuestsTable.vue`.

- [ ] **Step 6: Manual browser check — desktop (`npm run dev`, window ≥ 768px wide)**

On `/admin`:
- Click **+ Создать приглашение** → row with empty fields appears; leaving ФИО too long (>200 chars) or an incomplete phone and clicking **✓** shows inline field errors, no toast, no guest created.
- Fill valid data, click **✓** → success toast, new guest appears in the table (respecting the current no-fio/no-phone-required behavior — an empty submission with no errors should also succeed, matching the old admin form).
- Click **Изменить** on an existing guest → row becomes editable, prefilled correctly (including drinks checkboxes and Придёт/Тип selects).
- Change a field to something invalid (e.g. malformed phone) → **Сохранить** shows the field error, does not save.
- Fix it, **Сохранить** → success toast, row returns to read mode with new values, "Сопровождающие" and "Ссылка" columns untouched throughout.
- Toggle **Ответил** and **Открыл конверт** checkboxes → persist after page reload.
- Click **Скопировать** → toast confirms, clipboard has the right `/invite/<code>` URL.
- Click **Удалить** → `UModal` appears with the guest's name; **Отмена** closes it with no change; **Удалить** removes the guest and shows a toast.
- **Экспорт CSV** link still downloads a file (not a client-side navigation/404).

- [ ] **Step 7: Manual browser check — mobile (devtools responsive mode, width < 768px)**

Same checklist as Step 6, but the table is replaced by a stacked list of `UCard`s — verify every action (create, edit, delete, toggles, copy link) works identically through the card UI.

- [ ] **Step 8: Commit**

```bash
git add app/components/admin/GuestFormFields.vue app/components/admin/DeleteGuestModal.vue app/components/admin/GuestsTable.vue app/pages/admin/index.vue
git commit -m "feat: migrate guest table to Nuxt UI with mobile card view"
```

---

### Task 6: Final regression pass

**Files:** none (verification only; fix forward in the relevant file from Tasks 1-5 if something fails).

- [ ] **Step 1: Full type-check**

Run: `npx vue-tsc --noEmit`
Expected: zero errors project-wide.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds with no errors (this also catches SSR-only issues the dev server can mask, e.g. `location`/`navigator` used outside client-only guards — none are introduced by this plan, but confirm).

- [ ] **Step 3: Existing test suite**

Run: `npm test`
Expected: all passing, unchanged — this refactor touches no server code, so no test should be affected.

- [ ] **Step 4: Full manual regression, both viewport sizes**

Using `npm run dev`:
- `/` and `/invite/<code>` — unchanged visually and functionally (RSVP submit still works end-to-end).
- `/admin/login` — login/logout cycle.
- `/admin` — every action from Task 5 Steps 6-7, once more, end to end, at both desktop and mobile widths, in one sitting, to catch anything that only breaks when actions are combined (e.g. start editing one guest while another is mid-delete-confirm).

- [ ] **Step 5: Commit (only if Step 4 surfaced fixes)**

```bash
git add -A
git commit -m "fix: address issues found in admin Nuxt UI regression pass"
```

If Step 4 found nothing to fix, skip this step — there is nothing to commit.
