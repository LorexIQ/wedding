# Система приглашений — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести RSVP с анонимной формы на систему именных приглашений: админ заранее создаёт
запись гостя с кодом-ссылкой, гость проходит по ссылке и дальше весь сайт (гейт, форма, статус)
работает через эту личность, а не через анонимную вставку.

**Architecture:** Инвайт — это сама строка `guests` (без отдельной таблицы), с уникальным
`invite_code`, `submitted`, `envelope_opened`. Код гостя хранится в cookie (не localStorage —
единственный способ гейтить сайт и на SSR), читается сервером напрямую из запроса. Форма RSVP
не `INSERT`ит, а находит гостя по коду и `UPDATE`ит.

**Tech Stack:** Nuxt 4, H3/Nitro, Drizzle ORM (better-sqlite3), Zod, Vitest.

## Global Constraints

- Cookie: имя `invite_code`, `sameSite: 'lax'`, `path: '/'`, `maxAge` — максимум, что примет
  браузер (ставим большое число; Chromium всё равно обрежет реальное хранение ~400 днями).
- Код приглашения: 10 символов, алфавит `A-Za-z0-9` (base62), `crypto.randomBytes`. Коллизия
  уникального индекса — до 3 повторных генераций, затем ошибка 500.
- Все поля при создании инвайта в админке — опциональны (`fio?`, `phone?`, `comment?`, `drinks?`).
- Спутников создаёт только гость через форму — без своего кода, без предзаполнения админом.
  На повторной отправке формы старые `companions` гостя удаляются и вставляются заново из тела
  запроса (не merge).
- `/api/rsvp` берёт код гостя из cookie запроса на сервере — никогда из тела запроса.
- ФИ форматируется мягко (trim, схлоп пробелов, заглавные по словам/дефисам) по `blur`; жёсткой
  regex-валидации формата не вводим.
- Гейт (`app/middleware/invite.global.ts`) не применяется к `/admin/**`, `/invite/**`,
  `/not-invited`.
- Массового/CSV создания приглашений нет — только по одному через живую строку в таблице.
- Стиль кода — как в остальном проекте: без точек с запятой, одинарные кавычки, 2 пробела отступ.

---

## Task 1: Схема БД — код приглашения, флаги, nullable ФИО

**Files:**
- Modify: `server/database/schema.ts`
- Modify: `tests/helpers/testDb.ts`
- Modify: `tests/database/schema.test.ts`
- Modify: `server/utils/csv.ts`
- Create: `server/database/migrations/0001_*.sql` (генерируется `drizzle-kit generate`, имя
  подбирает сама drizzle-kit)

**Interfaces:**
- Produces: `guests.inviteCode: string | null` (уникальный индекс), `guests.submitted: boolean`
  (default `false`), `guests.envelopeOpened: boolean` (default `false`), `guests.fio: string | null`
  (было `NOT NULL`). Эти три новых столбца и ослабленное `fio` использует весь остальной план.

- [ ] **Step 1: Изменить схему**

Открыть `server/database/schema.ts`. Заменить таблицу `guests` целиком:

```ts
export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fio: text('fio'),
  phone: text('phone'),
  comment: text('comment'),
  drinks: text('drinks', { mode: 'json' }).$type<string[]>().notNull().default([]),
  inviteCode: text('invite_code').unique(),
  submitted: integer('submitted', { mode: 'boolean' }).notNull().default(false),
  envelopeOpened: integer('envelope_opened', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})
```

`fio` больше не `.notNull()`: до отправки формы гость может ещё не иметь имени, если админ создал
инвайт пустым. `companions` и `adminUsers` не трогаем.

- [ ] **Step 2: Обновить тестовую БД**

Открыть `tests/helpers/testDb.ts`. Заменить `CREATE TABLE guests`:

```sql
    CREATE TABLE guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fio TEXT,
      phone TEXT,
      comment TEXT,
      drinks TEXT NOT NULL DEFAULT '[]',
      invite_code TEXT UNIQUE,
      submitted INTEGER NOT NULL DEFAULT 0,
      envelope_opened INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
```

- [ ] **Step 3: Написать падающий тест на новые столбцы**

Добавить в конец `describe('schema', ...)` в `tests/database/schema.test.ts` (внутрь существующего
блока, после текущих двух `it`):

```ts
  it('invite_code уникален, submitted/envelopeOpened по умолчанию false', () => {
    const db = createTestDb()
    const now = new Date()

    const guest = db.insert(guests).values({
      fio: null,
      phone: null,
      comment: null,
      drinks: [],
      inviteCode: 'ABC1234567',
      createdAt: now,
      updatedAt: now
    }).returning().get()

    expect(guest.submitted).toBe(false)
    expect(guest.envelopeOpened).toBe(false)
    expect(guest.fio).toBeNull()

    expect(() =>
      db.insert(guests).values({
        fio: null, phone: null, comment: null, drinks: [],
        inviteCode: 'ABC1234567', createdAt: now, updatedAt: now
      }).run()
    ).toThrow()
  })
```

- [ ] **Step 4: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/database/schema.test.ts`
Expected: FAIL — до Step 1/2 колонок `invite_code`/`submitted`/`envelope_opened` не существует.

(Если Step 1–2 уже сделаны к этому моменту — тест сразу пройдёт: в TDD-цикле это нормально, когда
шаг «падает» и шаг «реализация» физически объединены правкой схемы. Главное — прогнать один раз
и увидеть зелёный результат на Step 5, а не поверить на слово.)

- [ ] **Step 5: Прогнать тест, убедиться что проходит**

Run: `npm test -- tests/database/schema.test.ts`
Expected: PASS, 3 теста (2 старых + 1 новый).

- [ ] **Step 6: Сгенерировать миграцию**

Run: `npm run db:generate`
Expected: создаётся новый файл `server/database/migrations/0001_<случайное_имя>.sql`. Открыть его
и проверить, что там есть `ALTER TABLE guests ADD invite_code text;` (или пересоздание таблицы —
drizzle-kit сам решает, как ослабить `fio` на SQLite), `submitted integer DEFAULT 0 NOT NULL`,
`envelope_opened integer DEFAULT 0 NOT NULL`, уникальный индекс на `invite_code`. Если
drizzle-kit в интерактивном режиме спросит про переименование колонки — ответить «нет, это новая
таблица/колонка», он не должен путать `fio` с чем-то другим, т.к. остальные колонки не менялись.

- [ ] **Step 7: Починить `csv.ts` под nullable `fio`**

`server/utils/csv.ts` получает гостей из `listGuests()`, чей тип теперь `fio: string | null`.
Изменить интерфейс и вызов:

```ts
interface GuestRow {
  id: number
  fio: string | null
  phone: string | null
  comment: string | null
  drinks: string[]
  companions: { fio: string, drinks: string[] }[]
}
```

и внутри `guestsToCsv`, строку

```ts
      neutralizeFormulaInjection(guest.fio),
```

заменить на

```ts
      neutralizeFormulaInjection(guest.fio ?? ''),
```

- [ ] **Step 8: Прогнать все тесты**

Run: `npm test`
Expected: PASS, ничего не сломано (тесты `csv.test.ts` передают `fio` строкой — поведение не
меняется, меняется только тип).

- [ ] **Step 9: Commit**

```bash
git add server/database/schema.ts server/database/migrations server/utils/csv.ts tests/helpers/testDb.ts tests/database/schema.test.ts
git commit -m "feat(db): add invite_code/submitted/envelopeOpened, relax fio to nullable"
```

---

## Task 2: Генератор кода приглашения

**Files:**
- Create: `server/utils/inviteCode.ts`
- Test: `tests/server/inviteCode.test.ts`

**Interfaces:**
- Produces: `generateInviteCode(length = 10): string` — используется в Task 4.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/server/inviteCode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateInviteCode } from '../../server/utils/inviteCode'

describe('generateInviteCode', () => {
  it('возвращает 10-символьный код из латиницы и цифр', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[A-Za-z0-9]{10}$/)
  })

  it('генерирует разные коды при повторных вызовах', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()))
    expect(codes.size).toBe(200)
  })
})
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/server/inviteCode.test.ts`
Expected: FAIL — `server/utils/inviteCode.ts` не существует.

- [ ] **Step 3: Реализовать генератор**

Создать `server/utils/inviteCode.ts`:

```ts
import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Секрет в ссылке /invite/<код>. Гость его не выбирает, только видит. */
export function generateInviteCode(length = 10): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return code
}
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `npm test -- tests/server/inviteCode.test.ts`
Expected: PASS, 2 теста.

- [ ] **Step 5: Commit**

```bash
git add server/utils/inviteCode.ts tests/server/inviteCode.test.ts
git commit -m "feat(server): add invite code generator"
```

---

## Task 3: Zod-схемы — создание инвайта, расширение патча

**Files:**
- Modify: `shared/schemas/rsvp.ts`
- Modify: `tests/shared/rsvp-schema.test.ts`

**Interfaces:**
- Consumes: `drinksField` (уже существует в файле).
- Produces: `guestCreateSchema`, `type GuestCreateInput` — использует Task 4.
  `guestPatchSchema` расширяется полями `fio?`, `submitted?`, `envelopeOpened?` — использует
  существующий `PATCH /api/admin/guests/[id]` без изменений в самом хендлере.

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `tests/shared/rsvp-schema.test.ts`:

```ts
describe('guestCreateSchema (POST /api/admin/guests — создание инвайта)', () => {
  it('принимает полностью пустой объект — все поля опциональны', () => {
    const result = guestCreateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('принимает частичное заполнение', () => {
    const result = guestCreateSchema.safeParse({ fio: 'Иванов Иван' })
    expect(result.success).toBe(true)
  })

  it('отклоняет несовместимый набор напитков', () => {
    const result = guestCreateSchema.safeParse({ drinks: ['none', 'vodka'] })
    expect(result.success).toBe(false)
  })

  it('отклоняет неизвестный ключ', () => {
    const result = guestCreateSchema.safeParse({ id: 999 })
    expect(result.success).toBe(false)
  })
})

describe('guestPatchSchema — новые поля fio/submitted/envelopeOpened', () => {
  it('принимает fio отдельно от остальных полей', () => {
    const result = guestPatchSchema.safeParse({ fio: 'Иванов Иван' })
    expect(result.success).toBe(true)
  })

  it('принимает submitted и envelopeOpened как булевы флаги', () => {
    const result = guestPatchSchema.safeParse({ submitted: true, envelopeOpened: false })
    expect(result.success).toBe(true)
  })

  it('отклоняет submitted не булевого типа', () => {
    const result = guestPatchSchema.safeParse({ submitted: 'true' })
    expect(result.success).toBe(false)
  })
})
```

И обновить импорт в начале файла:

```ts
import { rsvpSchema, guestPatchSchema, guestCreateSchema } from '../../shared/schemas/rsvp'
```

- [ ] **Step 2: Прогнать тесты, убедиться что падают**

Run: `npm test -- tests/shared/rsvp-schema.test.ts`
Expected: FAIL — `guestCreateSchema` не существует, импорт падает.

- [ ] **Step 3: Реализовать схемы**

В `shared/schemas/rsvp.ts` добавить после `export const guestPatchSchema = ...` (перед этим —
расширить сам `guestPatchSchema`). Полностью заменить блок `guestPatchSchema` и всё, что после
него:

```ts
export const guestPatchSchema = z.object({
  fio: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  comment: z.string().trim().max(1000).optional(),
  drinks: drinksField.optional(),
  submitted: z.boolean().optional(),
  envelopeOpened: z.boolean().optional()
}).strict()

export type GuestPatchInput = z.infer<typeof guestPatchSchema>

export const guestCreateSchema = z.object({
  fio: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  comment: z.string().trim().max(1000).optional(),
  drinks: drinksField.optional()
}).strict()

export type GuestCreateInput = z.infer<typeof guestCreateSchema>
```

- [ ] **Step 4: Прогнать тесты, убедиться что проходят**

Run: `npm test -- tests/shared/rsvp-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Прогнать весь набор (guestPatchSchema используется в других тестах)**

Run: `npm test`
Expected: PASS — существующие тесты `guestPatchSchema` (например, отклонение `id` как лишнего
ключа) не задеты, т.к. `.strict()` сохранён, только добавлены новые опциональные ключи.

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/rsvp.ts tests/shared/rsvp-schema.test.ts
git commit -m "feat(schema): add guestCreateSchema, extend guestPatchSchema with fio/flags"
```

---

## Task 4: Создание приглашения в админке (`POST /api/admin/guests`)

**Files:**
- Create: `server/api/admin/guests/index.post.ts`
- Modify: `tests/server/api/admin-guests.test.ts`
- Modify: `tests/server/api/admin-guards.test.ts`

**Interfaces:**
- Consumes: `generateInviteCode()` (Task 2), `guestCreateSchema` (Task 3), `requireAdminSession`
  (существует, `server/utils/session.ts`).
- Produces: `createUniqueInviteCode(dbInstance?): string`, `createGuestInvite(input, dbInstance?)`
  — используются только тестами и самим хендлером в этой задаче.

- [ ] **Step 1: Написать падающие тесты создания инвайта**

Добавить в `tests/server/api/admin-guests.test.ts`, в конец файла:

```ts
describe('createGuestInvite (POST /api/admin/guests)', () => {
  it('создаёт гостя с пустыми полями и сгенерированным кодом', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({}, testDb)

    expect(created.fio).toBeNull()
    expect(created.submitted).toBe(false)
    expect(created.envelopeOpened).toBe(false)
    expect(created.inviteCode).toMatch(/^[A-Za-z0-9]{10}$/)
  })

  it('создаёт гостя с частичным предзаполнением', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({ fio: 'Иванов Иван', drinks: ['red_dry'] }, testDb)

    expect(created.fio).toBe('Иванов Иван')
    expect(created.drinks).toEqual(['red_dry'])
    expect(created.phone).toBeNull()
  })
})

describe('updateGuest — переключение флагов submitted/envelopeOpened', () => {
  it('обновляет submitted и envelopeOpened через updateGuest', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { submitted: true, envelopeOpened: true }, testDb)
    expect(updated?.submitted).toBe(true)
    expect(updated?.envelopeOpened).toBe(true)

    const reverted = await updateGuest(id, { submitted: false }, testDb)
    expect(reverted?.submitted).toBe(false)
    expect(reverted?.envelopeOpened).toBe(true)
  })
})

describe('createUniqueInviteCode — коллизия кода', () => {
  it('повторяет генерацию, если код уже занят', () => {
    const testDb = createTestDb()
    const now = new Date()
    testDb.insert(guests).values({
      fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'DUPLICATE1', createdAt: now, updatedAt: now
    }).run()

    vi.mocked(generateInviteCode)
      .mockReturnValueOnce('DUPLICATE1')
      .mockReturnValueOnce('FRESHCODE1')

    const code = createUniqueInviteCode(testDb)
    expect(code).toBe('FRESHCODE1')
  })

  it('падает после исчерпания всех попыток', () => {
    const testDb = createTestDb()
    const now = new Date()
    testDb.insert(guests).values({
      fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'ALWAYSSAME', createdAt: now, updatedAt: now
    }).run()

    vi.mocked(generateInviteCode).mockReturnValue('ALWAYSSAME')

    expect(() => createUniqueInviteCode(testDb)).toThrow()
  })
})
```

В начало файла добавить моки и импорты (после уже существующих импортов, перед первым `describe`):

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../server/utils/inviteCode', () => ({ generateInviteCode: vi.fn(() => 'STATICCODE1') }))

import { generateInviteCode } from '../../../server/utils/inviteCode'
import { createGuestInvite, createUniqueInviteCode } from '../../../server/api/admin/guests/index.post'
```

(Заменить существующую строку `import { describe, it, expect } from 'vitest'` на строку с `vi`
выше — не дублировать импорт.)

- [ ] **Step 2: Написать падающий тест guard'а**

Добавить в `tests/server/api/admin-guards.test.ts`:

```ts
import createGuestHandler from '../../../server/api/admin/guests/index.post'
```

и в `describe('admin route auth guards', ...)`:

```ts
  it('POST /api/admin/guests rejects an unauthenticated request with 401', async () => {
    const event = createMockEvent({ method: 'POST', body: {} })
    await expect(createGuestHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })
```

- [ ] **Step 3: Прогнать тесты, убедиться что падают**

Run: `npm test -- tests/server/api/admin-guests.test.ts tests/server/api/admin-guards.test.ts`
Expected: FAIL — `server/api/admin/guests/index.post.ts` не существует.

- [ ] **Step 4: Реализовать хендлер**

Создать `server/api/admin/guests/index.post.ts`:

```ts
import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'
import { generateInviteCode } from '../../../utils/inviteCode'
import { guestCreateSchema, type GuestCreateInput } from '#shared/schemas/rsvp'

const MAX_CODE_ATTEMPTS = 3

export function createUniqueInviteCode(dbInstance: typeof db = db): string {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const existing = dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get()
    if (!existing) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Не удалось сгенерировать код приглашения' })
}

export async function createGuestInvite(input: GuestCreateInput, dbInstance: typeof db = db) {
  const now = new Date()
  const inviteCode = createUniqueInviteCode(dbInstance)

  return dbInstance.insert(guests).values({
    fio: input.fio || null,
    phone: input.phone || null,
    comment: input.comment || null,
    drinks: input.drinks ?? [],
    inviteCode,
    submitted: false,
    envelopeOpened: false,
    createdAt: now,
    updatedAt: now
  }).returning().get()
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readBody(event)
  const parsed = guestCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
  }

  return createGuestInvite(parsed.data)
})
```

- [ ] **Step 5: Прогнать тесты, убедиться что проходят**

Run: `npm test -- tests/server/api/admin-guests.test.ts tests/server/api/admin-guards.test.ts`
Expected: PASS.

- [ ] **Step 6: Прогнать весь набор**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/api/admin/guests/index.post.ts tests/server/api/admin-guests.test.ts tests/server/api/admin-guards.test.ts
git commit -m "feat(admin): add POST /api/admin/guests to create invites"
```

---

## Task 5: Резолв кода приглашения (`GET /api/invite/[code]`)

**Files:**
- Create: `server/api/invite/[code].get.ts`
- Test: `tests/server/api/invite.test.ts`

**Interfaces:**
- Produces: `resolveInvite(code, dbInstance?)` — переиспользуется в Task 6.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/server/api/invite.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { guests } from '../../../server/database/schema'
import { resolveInvite } from '../../../server/api/invite/[code].get'

function seedInvite(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: '+79990000000', comment: null, drinks: ['red_dry'],
    inviteCode: 'ABC1234567', submitted: false, envelopeOpened: false,
    createdAt: now, updatedAt: now
  }).run()
}

describe('resolveInvite', () => {
  it('находит гостя по коду', () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const guest = resolveInvite('ABC1234567', testDb)
    expect(guest?.fio).toBe('Иванов Иван')
    expect(guest?.submitted).toBe(false)
  })

  it('возвращает null для неизвестного кода', () => {
    const testDb = createTestDb()
    const guest = resolveInvite('NOPE000000', testDb)
    expect(guest).toBeNull()
  })
})
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/server/api/invite.test.ts`
Expected: FAIL — файл `server/api/invite/[code].get.ts` не существует.

- [ ] **Step 3: Реализовать эндпоинт**

Создать `server/api/invite/[code].get.ts`:

```ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { guests } from '../../database/schema'

export function resolveInvite(code: string, dbInstance: typeof db = db) {
  return dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get() ?? null
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Код не указан' })
  }

  const guest = resolveInvite(code)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: 'Приглашение не найдено' })
  }

  return {
    fio: guest.fio,
    phone: guest.phone,
    comment: guest.comment,
    drinks: guest.drinks,
    submitted: guest.submitted,
    envelopeOpened: guest.envelopeOpened
  }
})
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `npm test -- tests/server/api/invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/invite/[code].get.ts tests/server/api/invite.test.ts
git commit -m "feat(invite): add GET /api/invite/[code] to resolve invite codes"
```

---

## Task 6: Открытие конверта (`POST /api/invite/[code]/open`)

**Files:**
- Create: `server/api/invite/[code]/open.post.ts`
- Modify: `tests/server/api/invite.test.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач напрямую (свой независимый лукап), но пишет в те же
  столбцы, что и Task 5 читает.
- Produces: `markEnvelopeOpened(code, dbInstance?): boolean | null` — понадобится будущему
  саб-проекту C (конверт), сюда только сам эндпоинт и данные.

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `tests/server/api/invite.test.ts`:

```ts
import { markEnvelopeOpened } from '../../../server/api/invite/[code]/open.post'

describe('markEnvelopeOpened', () => {
  it('проставляет envelopeOpened=true по коду', () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const ok = markEnvelopeOpened('ABC1234567', testDb)
    expect(ok).toBe(true)

    const guest = resolveInvite('ABC1234567', testDb)
    expect(guest?.envelopeOpened).toBe(true)
  })

  it('возвращает null для неизвестного кода, ничего не меняя', () => {
    const testDb = createTestDb()
    const ok = markEnvelopeOpened('NOPE000000', testDb)
    expect(ok).toBeNull()
  })
})
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/server/api/invite.test.ts`
Expected: FAIL — `server/api/invite/[code]/open.post.ts` не существует.

- [ ] **Step 3: Реализовать эндпоинт**

Создать `server/api/invite/[code]/open.post.ts`:

```ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'

export function markEnvelopeOpened(code: string, dbInstance: typeof db = db) {
  const guest = dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get()
  if (!guest) return null

  dbInstance.update(guests)
    .set({ envelopeOpened: true, updatedAt: new Date() })
    .where(eq(guests.id, guest.id))
    .run()

  return true
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Код не указан' })
  }

  const ok = markEnvelopeOpened(code)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Приглашение не найдено' })
  }

  return { ok: true }
})
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `npm test -- tests/server/api/invite.test.ts`
Expected: PASS, 4 теста в файле.

- [ ] **Step 5: Commit**

```bash
git add server/api/invite/\[code\]/open.post.ts tests/server/api/invite.test.ts
git commit -m "feat(invite): add POST /api/invite/[code]/open to mark envelope opened"
```

---

## Task 7: Переписать `POST /api/rsvp` под код приглашения

**Files:**
- Modify: `server/api/rsvp.post.ts`
- Modify: `tests/server/api/rsvp.test.ts`

**Interfaces:**
- Consumes: `guests.inviteCode` (Task 1).
- Produces: новая сигнатура `submitRsvp(rawInput, inviteCode, opts?)` — ломает старую сигнатуру
  `submitRsvp(rawInput, opts?)`; единственный вызывающий код — сам хендлер в этом же файле и тесты,
  правятся вместе.

- [ ] **Step 1: Переписать тесты под новую сигнатуру**

Полностью заменить содержимое `tests/server/api/rsvp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { submitRsvp } from '../../../server/api/rsvp.post'
import { guests, companions } from '../../../server/database/schema'
import { eq } from 'drizzle-orm'

function seedInvite(testDb: ReturnType<typeof createTestDb>, code = 'ABC1234567') {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: null, phone: null, comment: null, drinks: [],
    inviteCode: code, submitted: false, envelopeOpened: false,
    createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  return guest.id
}

describe('submitRsvp', () => {
  it('обновляет гостя по коду и проставляет submitted=true', async () => {
    const testDb = createTestDb()
    const guestId = seedInvite(testDb)

    const result = await submitRsvp({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: '',
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(true)

    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(guestId)
    expect(rows[0].fio).toBe('Иванов Иван Иванович')
    expect(rows[0].submitted).toBe(true)
  })

  it('заменяет спутников при повторной отправке', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Первый спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Второй спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    const rows = testDb.select().from(companions).where(eq(companions.guestId, guest.id)).all()

    expect(rows).toHaveLength(1)
    expect(rows[0].fio).toBe('Второй спутник')
  })

  it('404 при отсутствии кода приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: [], website: '' }, undefined, { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('404 при несуществующем коде приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: [], website: '' }, 'NOPE000000', { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('rejects missing fio', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: '', drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects more than 3 companions', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const companionsList = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: companionsList, website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('silently drops honeypot submissions without touching the DB', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: 'Бот', drinks: [], companions: [], website: 'spam' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(true)

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    expect(guest.submitted).toBe(false)
  })
})
```

- [ ] **Step 2: Прогнать тесты, убедиться что падают**

Run: `npm test -- tests/server/api/rsvp.test.ts`
Expected: FAIL — старая `submitRsvp` ещё не принимает `inviteCode` вторым аргументом, обновление
вместо вставки не реализовано.

- [ ] **Step 3: Переписать хендлер**

Полностью заменить содержимое `server/api/rsvp.post.ts`:

```ts
import { defineEventHandler, getRequestHeader, getRequestIP, getCookie, createError, readBody, setResponseStatus } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { guests, companions } from '../database/schema'
import { rsvpSchema } from '#shared/schemas/rsvp'
import { checkRateLimit } from '../utils/rateLimit'

export async function submitRsvp(rawInput: unknown, inviteCode: string | undefined, opts: { dbInstance?: typeof db } = {}) {
  const database = opts.dbInstance ?? db
  const parsed = rsvpSchema.safeParse(rawInput)

  if (!parsed.success) {
    return { ok: false as const, status: 400, message: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  if (parsed.data.website) {
    return { ok: true as const, guestId: 0 }
  }

  if (!inviteCode) {
    return { ok: false as const, status: 404, message: 'Приглашение не найдено' }
  }

  const existing = database.select().from(guests).where(eq(guests.inviteCode, inviteCode)).get()
  if (!existing) {
    return { ok: false as const, status: 404, message: 'Приглашение не найдено' }
  }

  const now = new Date()
  const data = parsed.data

  database.transaction((tx) => {
    tx.update(guests).set({
      fio: data.fio,
      phone: data.phone || null,
      comment: data.comment || null,
      drinks: data.drinks,
      submitted: true,
      updatedAt: now
    }).where(eq(guests.id, existing.id)).run()

    tx.delete(companions).where(eq(companions.guestId, existing.id)).run()

    for (const companion of data.companions) {
      tx.insert(companions).values({
        guestId: existing.id,
        fio: companion.fio,
        drinks: companion.drinks
      }).run()
    }
  })

  return { ok: true as const, guestId: existing.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'

  if (!checkRateLimit(`rsvp:${ip}`, 5, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const inviteCode = getCookie(event, 'invite_code')
  const body = await readBody(event)
  const result = await submitRsvp(body, inviteCode)

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message })
  }

  setResponseStatus(event, 201)
  return { id: result.guestId }
})
```

- [ ] **Step 4: Прогнать тесты, убедиться что проходят**

Run: `npm test -- tests/server/api/rsvp.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Прогнать весь набор**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/api/rsvp.post.ts tests/server/api/rsvp.test.ts
git commit -m "feat(rsvp): resolve guest by invite code cookie, update instead of insert"
```

---

## Task 8: Форматирование ФИ по blur

**Files:**
- Create: `app/utils/formatFio.ts`
- Test: `tests/utils/formatFio.test.ts`

**Interfaces:**
- Produces: `formatFio(value: string): string` — используется в Task 10 (форма гостя) и Task 11
  (админка).

- [ ] **Step 1: Написать падающий тест**

Создать `tests/utils/formatFio.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatFio } from '../../app/utils/formatFio'

describe('formatFio', () => {
  it('обрезает края и схлопывает повторные пробелы', () => {
    expect(formatFio('  Иванов   Иван  ')).toBe('Иванов Иван')
  })

  it('приводит каждое слово к заглавной букве', () => {
    expect(formatFio('иванов иван')).toBe('Иванов Иван')
  })

  it('приводит к заглавной букве обе части дефисного имени', () => {
    expect(formatFio('петрова-сидорова анна-мария')).toBe('Петрова-Сидорова Анна-Мария')
  })

  it('не падает на пустой строке', () => {
    expect(formatFio('')).toBe('')
  })

  it('не портит уже корректно оформленное имя', () => {
    expect(formatFio('Иванов Иван')).toBe('Иванов Иван')
  })
})
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/utils/formatFio.test.ts`
Expected: FAIL — файл `app/utils/formatFio.ts` не существует.

- [ ] **Step 3: Реализовать утилиту**

Создать `app/utils/formatFio.ts`:

```ts
/** «  иванов   иван » → «Иванов Иван»: схлопывает пробелы, каждое слово
 *  (и часть после дефиса) — с заглавной буквы. Вызывается по blur поля. */
export function formatFio(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.split('-').map(capitalize).join('-'))
    .join(' ')
}

function capitalize(word: string): string {
  if (!word) return word
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase()
}
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `npm test -- tests/utils/formatFio.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Commit**

```bash
git add app/utils/formatFio.ts tests/utils/formatFio.test.ts
git commit -m "feat(ui): add formatFio blur-formatting utility"
```

---

## Task 9: Гейт сайта — cookie, мидлварь, страницы входа/отказа

**Files:**
- Create: `app/composables/useInviteCode.ts`
- Create: `app/middleware/invite.global.ts`
- Create: `app/pages/invite/[code].vue`
- Create: `app/pages/not-invited.vue`

**Interfaces:**
- Consumes: `GET /api/invite/[code]` (Task 5).
- Produces: `useInviteCode()` — используется в Task 10 нигде напрямую (форма работает через
  cookie на сервере), но нужен самой мидлвари и странице входа. `useState('inviteGuest')` —
  используется в Task 10 (`RsvpForm.vue`).

Ручной прогон вместо unit-тестов: у проекта нет `@nuxt/test-utils` и Vitest настроен на `node`
environment без DOM/Nuxt-рантайма (`vitest.config.ts`), а `useCookie`/`useState`/`navigateTo` —
рантайм-композаблы Nuxt. Остальные Vue-компоненты в проекте (секции лендинга) тоже не покрыты
unit-тестами по той же причине — см. `docs/superpowers/specs/2026-07-30-invitation-landing-design.md`,
раздел «Тестирование».

- [ ] **Step 1: Composable для cookie**

Создать `app/composables/useInviteCode.ts`:

```ts
// Хранит код приглашения гостя. Раньше рассматривался localStorage,
// но cookie нужен, чтобы app/middleware/invite.global.ts мог гейтить
// сайт и при SSR — localStorage на сервере недоступен.
const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400 // ~400 дней — потолок, который всё равно ставит Chromium

export function useInviteCode() {
  return useCookie<string | null>('invite_code', {
    maxAge: INVITE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/'
  })
}
```

- [ ] **Step 2: Глобальная мидлварь-гейт**

Создать `app/middleware/invite.global.ts`:

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/admin')) return
  if (to.path.startsWith('/invite/')) return
  if (to.path === '/not-invited') return

  const inviteCode = useInviteCode()
  if (!inviteCode.value) {
    return navigateTo('/not-invited')
  }

  const requestFetch = useRequestFetch()
  try {
    const guest = await requestFetch(`/api/invite/${inviteCode.value}`)
    useState('inviteGuest', () => guest)
  } catch {
    return navigateTo('/not-invited')
  }
})
```

- [ ] **Step 3: Страница входа по ссылке**

Создать `app/pages/invite/[code].vue`:

```vue
<script setup lang="ts">
const route = useRoute()
const code = String(route.params.code)
const inviteCode = useInviteCode()

try {
  await $fetch(`/api/invite/${code}`)
  inviteCode.value = code
  await navigateTo('/')
} catch {
  await navigateTo('/not-invited')
}
</script>

<template>
  <p>Открываем приглашение…</p>
</template>
```

- [ ] **Step 4: Страница-заглушка «не приглашены»**

Создать `app/pages/not-invited.vue`:

```vue
<template>
  <main class="band band--paper stub">
    <div class="inner stub__body">
      <p class="eyebrow">Дмитрий и Александра</p>
      <h1>Вы не приглашены на мероприятие, извините :(</h1>
    </div>
  </main>
</template>

<style scoped>
.stub {
  display: flex;
  align-items: center;
  min-height: 100vh;
}

.stub__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  text-align: center;
}

.stub__body h1 {
  font-size: clamp(1.5rem, 5vw, 2.1rem);
  font-style: italic;
  color: var(--ink-soft);
}
</style>
```

- [ ] **Step 5: Прогнать полный набор автотестов (регрессии по типам)**

Run: `npm test`
Expected: PASS — эти файлы не задевают существующие тесты, но `npm test` заодно гоняет
типозависимые файлы через vite-node и поймает опечатки импортов.

- [ ] **Step 6: Ручной прогон**

Run: `npm run dev`

1. В админке (см. Task 11 — на этом шаге плана ещё нет UI создания инвайта, поэтому для ручной
   проверки вставить временную строку через `sqlite3` или через `POST /api/admin/guests` curl'ом
   с авторизованной cookie) создать гостя, получить `inviteCode` из ответа.
2. Открыть `http://localhost:3000/invite/<inviteCode>` — должен установиться cookie и произойти
   редирект на `/`.
3. Открыть `http://localhost:3000/` в приватном окне (без cookie) — должен быть редирект на
   `/not-invited` с текстом заглушки.
4. Удалить cookie `invite_code` в DevTools на текущей вкладке, обновить `/` — снова редирект на
   `/not-invited`.

- [ ] **Step 7: Commit**

```bash
git add app/composables/useInviteCode.ts app/middleware/invite.global.ts app/pages/invite app/pages/not-invited.vue
git commit -m "feat(gate): add invite cookie, global gate middleware, entry/stub pages"
```

---

## Task 10: Форма RSVP — префилл, пропуск при `submitted`, форматирование ФИ

**Files:**
- Modify: `app/composables/useRsvpForm.ts`
- Modify: `app/components/RsvpForm.vue`
- Modify: `tests/composables/useRsvpForm.test.ts`

**Interfaces:**
- Consumes: `formatFio` (Task 8), `useState('inviteGuest')` (Task 9, только в компоненте, не в
  композабле — композабл остаётся тестируемым без Nuxt-рантайма).
- Produces: `useRsvpForm(prefill?, initiallySubmitted?)` — старая сигнатура `useRsvpForm()` без
  аргументов продолжает работать (оба параметра опциональны), существующие вызовы не ломаются.

- [ ] **Step 1: Написать падающие тесты префилла**

Добавить в конец `describe('useRsvpForm', ...)` в `tests/composables/useRsvpForm.test.ts`:

```ts
  it('предзаполняет форму данными гостя, но не спутниками', () => {
    const { form } = useRsvpForm({ fio: 'Иванов Иван', phone: '+79990000000', comment: 'Без орехов', drinks: ['red_dry'] })
    expect(form.fio).toBe('Иванов Иван')
    expect(form.phone).toBe('+79990000000')
    expect(form.comment).toBe('Без орехов')
    expect(form.drinks).toEqual(['red_dry'])
    expect(form.companions).toEqual([])
  })

  it('без префилла форма пустая, как раньше', () => {
    const { form } = useRsvpForm()
    expect(form.fio).toBe('')
    expect(form.drinks).toEqual([])
  })

  it('initiallySubmitted=true сразу показывает состояние «отправлено»', () => {
    const { submitted } = useRsvpForm(undefined, true)
    expect(submitted.success).toBe(true)
  })
```

- [ ] **Step 2: Прогнать тесты, убедиться что падают**

Run: `npm test -- tests/composables/useRsvpForm.test.ts`
Expected: FAIL — `useRsvpForm` пока не принимает аргументы.

- [ ] **Step 3: Реализовать префилл в композабле**

В `app/composables/useRsvpForm.ts` заменить сигнатуру и инициализацию `form`/`submitted`:

```ts
export interface RsvpPrefill {
  fio?: string | null
  phone?: string | null
  comment?: string | null
  drinks?: string[]
}

export function useRsvpForm(prefill?: RsvpPrefill, initiallySubmitted = false) {
  const form = reactive({
    fio: prefill?.fio ?? '',
    phone: prefill?.phone ?? '',
    comment: prefill?.comment ?? '',
    drinks: prefill?.drinks ? [...prefill.drinks] : [],
    companions: [] as CompanionForm[],
    website: ''
  })

  const errors = reactive<{ message?: string, fields: Record<string, string> }>({ fields: {} })
  const submitted = reactive({ success: initiallySubmitted, pending: false })
```

(Остальное тело функции — `addCompanion`, `removeCompanion`, `toggleDrink`, `buildPayload`,
`submit`, `return` — не меняется.)

- [ ] **Step 4: Прогнать тесты, убедиться что проходят**

Run: `npm test -- tests/composables/useRsvpForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Прогнать весь набор**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Подключить форму к состоянию гостя и добавить форматирование ФИ**

В `app/components/RsvpForm.vue` заменить `<script setup>`:

```vue
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
```

В `<template>`, у основного поля ФИ, добавить обработчик:

```html
          <input
            id="fio"
            v-model="form.fio"
            type="text"
            autocomplete="name"
            placeholder="Иван Петров"
            :aria-invalid="Boolean(errors.fields.fio)"
            @blur="onFioBlur"
          >
```

И у поля ФИ спутника:

```html
            <input
              :id="`companion-${index}`"
              v-model="companion.fio"
              type="text"
              placeholder="Мария Петрова"
              :aria-invalid="Boolean(errors.fields[`companions.${index}.fio`])"
              @blur="onCompanionFioBlur(index)"
            >
```

- [ ] **Step 7: Ручной прогон**

Run: `npm run dev`. Пройти по валидной пригласительной ссылке (см. Task 9, шаг 6) с
предзаполненными на сервере `fio`/`phone`/`drinks` — форма должна показать эти значения при
открытии. Ввести в поле ФИ `"  иванов иван "`, увести фокус — поле должно стать
`"Иванов Иван"`. Проставить гостю `submitted=true` (через `PATCH`, curl) и обновить страницу —
вместо формы должен появиться экран «Спасибо, ждём вас».

- [ ] **Step 8: Commit**

```bash
git add app/composables/useRsvpForm.ts app/components/RsvpForm.vue tests/composables/useRsvpForm.test.ts
git commit -m "feat(rsvp-form): prefill from invite state, skip form when already submitted"
```

---

## Task 11: Админка — создание приглашения, флаги, ссылка

**Files:**
- Modify: `app/composables/useAdminGuests.ts`
- Modify: `app/pages/admin/index.vue`
- Modify: `tests/composables/useAdminGuests.test.ts`

**Interfaces:**
- Consumes: `POST /api/admin/guests` (Task 4), `formatFio` (Task 8).
- Produces: `useAdminGuests().createGuestInvite(input)` — используется только компонентом
  `admin/index.vue` в этой же задаче.

- [ ] **Step 1: Написать падающий тест композабла**

Добавить в конец `tests/composables/useAdminGuests.test.ts`:

```ts
  it('createGuestInvite добавляет созданного гостя в список', async () => {
    const { guestsList, createGuestInvite } = useAdminGuests()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      id: 2, fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'ABC1234567', submitted: false, envelopeOpened: false, companions: []
    }))

    const created = await createGuestInvite({})
    expect(created.inviteCode).toBe('ABC1234567')
    expect(guestsList.value).toHaveLength(1)
    expect(guestsList.value[0].inviteCode).toBe('ABC1234567')
  })
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `npm test -- tests/composables/useAdminGuests.test.ts`
Expected: FAIL — `createGuestInvite` не существует.

- [ ] **Step 3: Обновить тип и добавить метод в композабл**

Полностью заменить `app/composables/useAdminGuests.ts`:

```ts
import { ref } from 'vue'

export interface GuestRecord {
  id: number
  fio: string | null
  phone: string | null
  comment: string | null
  drinks: string[]
  inviteCode: string | null
  submitted: boolean
  envelopeOpened: boolean
  companions: { id: number, fio: string, drinks: string[] }[]
}

export interface GuestCreateInput {
  fio?: string
  phone?: string
  comment?: string
  drinks?: string[]
}

export function useAdminGuests() {
  const guestsList = ref<GuestRecord[]>([])
  const loading = ref(false)

  async function fetchGuests() {
    const requestFetch = useRequestFetch()
    loading.value = true
    try {
      guestsList.value = await requestFetch<GuestRecord[]>('/api/admin/guests')
    } finally {
      loading.value = false
    }
  }

  async function createGuestInvite(input: GuestCreateInput) {
    const requestFetch = useRequestFetch()
    const created = await requestFetch<GuestRecord>('/api/admin/guests', { method: 'POST', body: input })
    guestsList.value.push(created)
    return created
  }

  async function patchGuest(id: number, patch: Partial<GuestRecord>) {
    const requestFetch = useRequestFetch()
    const updated = await requestFetch(`/api/admin/guests/${id}`, { method: 'PATCH', body: patch })
    const index = guestsList.value.findIndex((guest) => guest.id === id)
    if (index !== -1) guestsList.value[index] = { ...guestsList.value[index], ...updated }
  }

  async function removeGuest(id: number) {
    const requestFetch = useRequestFetch()
    await requestFetch(`/api/admin/guests/${id}`, { method: 'DELETE' })
    guestsList.value = guestsList.value.filter((guest) => guest.id !== id)
  }

  return { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest }
}
```

- [ ] **Step 4: Прогнать тесты, убедиться что проходят**

Run: `npm test -- tests/composables/useAdminGuests.test.ts`
Expected: PASS.

- [ ] **Step 5: Прогнать весь набор**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Переписать страницу админки**

Полностью заменить `app/pages/admin/index.vue`:

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAdminGuests, type GuestRecord } from '../../composables/useAdminGuests'
import { DRINK_OPTIONS, DRINK_LABELS } from '#shared/constants/drinks'
import { formatFio } from '../../utils/formatFio'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest } = useAdminGuests()
await fetchGuests()

const editingId = ref<number | null>(null)
const editForm = reactive({ fio: '', phone: '', comment: '', drinks: [] as string[] })

const creating = ref(false)
const draft = reactive({ fio: '', phone: '', comment: '', drinks: [] as string[] })

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id
  editForm.fio = guest.fio ?? ''
  editForm.phone = guest.phone ?? ''
  editForm.comment = guest.comment ?? ''
  editForm.drinks = [...guest.drinks]
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  await patchGuest(id, {
    fio: formatFio(editForm.fio),
    phone: editForm.phone,
    comment: editForm.comment,
    drinks: editForm.drinks
  })
  editingId.value = null
}

function startCreate() {
  creating.value = true
  draft.fio = ''
  draft.phone = ''
  draft.comment = ''
  draft.drinks = []
}

function cancelCreate() {
  creating.value = false
}

async function confirmCreate() {
  await createGuestInvite({
    fio: formatFio(draft.fio) || undefined,
    phone: draft.phone || undefined,
    comment: draft.comment || undefined,
    drinks: draft.drinks
  })
  creating.value = false
}

async function toggleSubmitted(guest: GuestRecord) {
  await patchGuest(guest.id, { submitted: !guest.submitted })
}

async function toggleEnvelopeOpened(guest: GuestRecord) {
  await patchGuest(guest.id, { envelopeOpened: !guest.envelopeOpened })
}

async function copyLink(guest: GuestRecord) {
  await navigator.clipboard.writeText(`${location.origin}/invite/${guest.inviteCode}`)
}

async function onLogout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <div>
    <button @click="onLogout">Выйти</button>
    <a href="/api/admin/guests/export">Экспорт CSV</a>

    <p v-if="loading">Загрузка...</p>

    <table v-else>
      <thead>
        <tr>
          <th>ФИО</th><th>Телефон</th><th>Напитки</th><th>Сопровождающие</th><th>Комментарий</th>
          <th>Ответил</th><th>Открыл конверт</th><th>Ссылка</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="guest in guestsList" :key="guest.id">
          <template v-if="editingId === guest.id">
            <td><input v-model="editForm.fio" type="text"></td>
            <td><input v-model="editForm.phone" type="tel"></td>
            <td>
              <label v-for="opt in DRINK_OPTIONS" :key="opt">
                <input v-model="editForm.drinks" type="checkbox" :value="opt">
                {{ DRINK_LABELS[opt] }}
              </label>
            </td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td><textarea v-model="editForm.comment" /></td>
            <td colspan="3"></td>
            <td>
              <button @click="saveEdit(guest.id)">Сохранить</button>
              <button @click="cancelEdit">Отмена</button>
            </td>
          </template>

          <template v-else>
            <td>{{ guest.fio }}</td>
            <td>{{ guest.phone }}</td>
            <td>{{ guest.drinks.join(', ') }}</td>
            <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
            <td>{{ guest.comment }}</td>
            <td><input type="checkbox" :checked="guest.submitted" @change="toggleSubmitted(guest)"></td>
            <td><input type="checkbox" :checked="guest.envelopeOpened" @change="toggleEnvelopeOpened(guest)"></td>
            <td><button @click="copyLink(guest)">Скопировать ссылку</button></td>
            <td>
              <button @click="startEdit(guest)">Изменить</button>
              <button @click="removeGuest(guest.id)">Удалить</button>
            </td>
          </template>
        </tr>

        <tr v-if="creating">
          <td><input v-model="draft.fio" type="text" placeholder="ФИО"></td>
          <td><input v-model="draft.phone" type="tel" placeholder="Телефон"></td>
          <td>
            <label v-for="opt in DRINK_OPTIONS" :key="opt">
              <input v-model="draft.drinks" type="checkbox" :value="opt">
              {{ DRINK_LABELS[opt] }}
            </label>
          </td>
          <td></td>
          <td><textarea v-model="draft.comment" placeholder="Комментарий" /></td>
          <td colspan="2"></td>
          <td>
            <button @click="confirmCreate">✓</button>
            <button @click="cancelCreate">✗</button>
          </td>
        </tr>

        <tr v-else>
          <td colspan="9">
            <button :disabled="creating" @click="startCreate">+ Создать приглашение</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 7: Ручной прогон**

Run: `npm run dev`. Зайти в `/admin`, залогиниться. Нажать «+ Создать приглашение» — появляется
живая строка, кнопка «+ Создать приглашение» пропадает/недоступна. Заполнить ФИО с лишними
пробелами и в нижнем регистре, нажать ✓ — гость появляется в таблице с отформатированным именем
и кодом. Нажать «Скопировать ссылку», вставить куда-нибудь — должен быть `.../invite/<код>`.
Проставить/снять чекбоксы «Ответил» и «Открыл конверт» — значения сохраняются после перезагрузки
страницы.

- [ ] **Step 8: Commit**

```bash
git add app/composables/useAdminGuests.ts app/pages/admin/index.vue tests/composables/useAdminGuests.test.ts
git commit -m "feat(admin): inline invite creation, submitted/envelope flags, copy link"
```

---

## Task 12: Итоговая проверка

**Files:** нет изменений — только верификация.

- [ ] **Step 1: Полный прогон тестов**

Run: `npm test`
Expected: PASS, все файлы зелёные.

- [ ] **Step 2: Проверка типов**

Run: `npx nuxi typecheck`
Expected: без ошибок. Если Nuxt ругается на типы `useState('inviteGuest')` в разных файлах
(middleware задаёт форму объекта, компонент её же читает) — привести к одному общему интерфейсу,
например экспортировать `InviteGuestState` из `app/composables/useInviteCode.ts` и использовать
его в обоих местах.

- [ ] **Step 3: Полный ручной прогон сквозного сценария**

Run: `npm run dev`

1. Создать инвайт в админке без единого заполненного поля → получить ссылку.
2. Открыть ссылку в чистом браузерном профиле (или приватном окне) → редирект на `/`, сайт
   открывается.
3. Открыть `/` в другом приватном окне без перехода по ссылке → `/not-invited`.
4. Заполнить и отправить RSVP-форму → появляется «Спасибо, ждём вас».
5. В админке: `submitted` для этого гостя стало `true` без ручного клика. Снять чекбокс
   `submitted` → обновить страницу гостя по той же ссылке → форма возвращается, предзаполненная
   тем, что гость вводил.
6. Повторно отправить форму с другим составом спутников → в админке колонка «Сопровождающие»
   показывает новый состав, не старый.

- [ ] **Step 4: Commit (если Step 2 потребовал правок)**

```bash
git add -A
git commit -m "fix: align inviteGuest state typing across middleware and components"
```

(Пропустить, если правок не было.)
