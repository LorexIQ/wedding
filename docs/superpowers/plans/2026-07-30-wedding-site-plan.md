# Свадебный сайт-приглашение Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одностраничный сайт-приглашение на Nuxt 4 (SSR) с формой RSVP, админ-панелью (просмотр/экспорт/правка/удаление гостей), OG-превью для соцсетей, деплоем через Docker на VPS за Cloudflare.

**Architecture:** Монолит — Nuxt 4 + Nitro API-роуты в одном проекте. SQLite-файл через Drizzle ORM. Сессионная авторизация одного admin-аккаунта через h3 `useSession`. Валидация — общая zod-схема из `shared/`, используется и сервером, и клиентом.

**Tech Stack:** Nuxt 4, TypeScript, better-sqlite3, drizzle-orm + drizzle-kit, zod, Vitest, Docker + docker-compose.

## Global Constraints

- Одна landing-страница для гостей (без отдельных URL под программу/место).
- SQLite как БД (не Postgres) — файл на volume.
- Один admin-аккаунт, логин+пароль, сессионная кука.
- RSVP-поля: ФИО, телефон, комментарий, +1..+3 сопровождающих (у каждого своё ФИО), напитки чекбоксами для каждого (основной гость + каждый сопровождающий). Без вопроса про еду.
- Rate-limit: `/api/rsvp` — 5 запросов/мин на IP; `/api/admin/login` — 5 попыток/15 мин на IP.
- Honeypot-поле в форме RSVP — при заполнении заявка тихо отбрасывается (без ошибки для бота, без записи в БД).
- Без e2e-тестов (Playwright и т.п.) — ручной прогон перед деплоем.
- Деплой — Docker + docker-compose, идентично на Linux и Windows локально и на VPS. Cloudflare proxy перед доменом. Без CI/CD-пайплайна.
- Без публичного FAQ/вики, без нескольких admin-аккаунтов — вне рамок.

---

### Task 1: Scaffold проекта Nuxt 4 + Vitest

**Files:**
- Create: `package.json`
- Create: `nuxt.config.ts`
- Create: `tsconfig.json`
- Create: `app/app.vue`
- Create: `app/pages/index.vue`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: рабочий Nuxt 4 dev-сервер, рабочий `npm test` (Vitest), базовая структура `app/` (Nuxt 4 новая директория для frontend-кода) и `server/` (для будущих API).

- [ ] **Step 1: Написать package.json**

```json
{
  "name": "wedding-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "seed:admin": "tsx scripts/seed-admin.ts"
  },
  "dependencies": {
    "nuxt": "^4.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0",
    "better-sqlite3": "^11.3.0",
    "drizzle-orm": "^0.36.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "@types/better-sqlite3": "^7.6.11",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Написать nuxt.config.ts**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-07-30',
  devtools: { enabled: true },
  runtimeConfig: {
    dbPath: process.env.DB_PATH || './data/wedding.db',
    sessionSecret: process.env.SESSION_SECRET || '',
    public: {}
  }
})
```

- [ ] **Step 3: Написать tsconfig.json**

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 4: Написать app/app.vue**

```vue
<template>
  <NuxtPage />
</template>
```

- [ ] **Step 5: Написать app/pages/index.vue (заглушка, полный контент в Task 9)**

```vue
<template>
  <div>Свадебный сайт</div>
</template>
```

- [ ] **Step 6: Написать vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node'
  }
})
```

- [ ] **Step 7: Написать tests/smoke.test.ts**

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('sanity check', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 8: Написать .gitignore**

```
node_modules
.nuxt
.output
data
.env
*.db
```

- [ ] **Step 9: Установить зависимости**

Run: `npm install`
Expected: установка без ошибок, создан `node_modules/` и `package-lock.json`.

- [ ] **Step 10: Проверить Vitest**

Run: `npm test`
Expected: `1 passed` (smoke test).

- [ ] **Step 11: Проверить dev-сервер**

Run: `npm run dev` (запустить, дождаться "Nuxt ready", затем остановить Ctrl+C)
Expected: сервер стартует на `http://localhost:3000` без ошибок, `.nuxt/` создаётся.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json nuxt.config.ts tsconfig.json app/ vitest.config.ts tests/smoke.test.ts .gitignore
git commit -m "chore: scaffold Nuxt 4 project with Vitest"
```

---

### Task 2: Drizzle-схема, DB-клиент, миграции

**Files:**
- Create: `server/database/schema.ts`
- Create: `server/database/client.ts`
- Create: `drizzle.config.ts`
- Create: `server/plugins/00.migrate.ts`
- Create: `tests/helpers/testDb.ts`
- Create: `tests/database/schema.test.ts`

**Interfaces:**
- Produces: `guests`, `companions`, `adminUsers` (таблицы Drizzle) из `server/database/schema.ts`; `db` (Drizzle instance) из `server/database/client.ts`; `createTestDb(): DrizzleDatabase` из `tests/helpers/testDb.ts` (in-memory SQLite с той же структурой, для юнит-тестов последующих задач).

- [ ] **Step 1: Написать tests/helpers/testDb.ts**

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/database/schema'

export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fio TEXT NOT NULL,
      phone TEXT,
      comment TEXT,
      drinks TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE companions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
      fio TEXT NOT NULL,
      drinks TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
  `)

  return drizzle(sqlite, { schema })
}
```

- [ ] **Step 2: Написать tests/database/schema.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../helpers/testDb'
import { guests, companions, adminUsers } from '../../server/database/schema'

describe('schema', () => {
  it('inserts a guest with a companion and reads them back', () => {
    const db = createTestDb()
    const now = new Date()

    const guest = db.insert(guests).values({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: null,
      drinks: ['wine'],
      createdAt: now,
      updatedAt: now
    }).returning({ id: guests.id }).get()

    db.insert(companions).values({
      guestId: guest.id,
      fio: 'Петров Пётр',
      drinks: ['beer']
    }).run()

    const savedGuest = db.select().from(guests).where(eq(guests.id, guest.id)).get()
    const savedCompanions = db.select().from(companions).where(eq(companions.guestId, guest.id)).all()

    expect(savedGuest?.fio).toBe('Иванов Иван Иванович')
    expect(savedGuest?.drinks).toEqual(['wine'])
    expect(savedCompanions).toHaveLength(1)
    expect(savedCompanions[0].fio).toBe('Петров Пётр')
  })

  it('enforces unique admin login', () => {
    const db = createTestDb()
    db.insert(adminUsers).values({ login: 'bride', passwordHash: 'x' }).run()

    expect(() =>
      db.insert(adminUsers).values({ login: 'bride', passwordHash: 'y' }).run()
    ).toThrow()
  })
})
```

- [ ] **Step 3: Запустить тесты, убедиться, что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/database/schema'`.

- [ ] **Step 4: Написать server/database/schema.ts**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fio: text('fio').notNull(),
  phone: text('phone'),
  comment: text('comment'),
  drinks: text('drinks', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const companions = sqliteTable('companions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  fio: text('fio').notNull(),
  drinks: text('drinks', { mode: 'json' }).$type<string[]>().notNull().default([])
})

export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  login: text('login').notNull().unique(),
  passwordHash: text('password_hash').notNull()
})
```

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 2 passed (schema.test.ts).

- [ ] **Step 6: Написать server/database/client.ts**

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const config = useRuntimeConfig()
const sqlite = new Database(config.dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
```

- [ ] **Step 7: Написать drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'sqlite'
})
```

- [ ] **Step 8: Сгенерировать миграции**

Run: `npm run db:generate`
Expected: создана папка `server/database/migrations/` с одним `.sql`-файлом (CREATE TABLE для guests/companions/admin_users) и `meta/`.

- [ ] **Step 9: Написать server/plugins/00.migrate.ts**

```ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../database/client'

export default defineNitroPlugin(() => {
  migrate(db, { migrationsFolder: './server/database/migrations' })
})
```

- [ ] **Step 10: Commit**

```bash
git add server/database drizzle.config.ts tests/helpers tests/database
git commit -m "feat: add Drizzle schema, DB client and migrations"
```

---

### Task 3: Общие zod-схемы валидации и константы напитков

**Files:**
- Create: `shared/constants/drinks.ts`
- Create: `shared/schemas/rsvp.ts`
- Create: `tests/shared/rsvp-schema.test.ts`

**Interfaces:**
- Consumes: ничего (чистые модули).
- Produces: `DRINK_OPTIONS`, `DrinkOption`, `DRINK_LABELS` из `shared/constants/drinks.ts`; `rsvpSchema`, `companionSchema`, `RsvpInput` (тип) из `shared/schemas/rsvp.ts`. `rsvpSchema` включает поле `website` (honeypot, должно быть пустым при легитимной подаче, но НЕ валидируется как ошибка — используется downstream для тихого отбрасывания).

- [ ] **Step 1: Написать tests/shared/rsvp-schema.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { rsvpSchema } from '../../shared/schemas/rsvp'

describe('rsvpSchema', () => {
  it('accepts a valid payload', () => {
    const result = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: '',
      drinks: ['wine'],
      companions: [{ fio: 'Петров Пётр', drinks: ['beer'] }],
      website: ''
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty fio', () => {
    const result = rsvpSchema.safeParse({ fio: '', drinks: [], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 companions', () => {
    const companions = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = rsvpSchema.safeParse({ fio: 'Тест', drinks: [], companions, website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown drink option', () => {
    const result = rsvpSchema.safeParse({ fio: 'Тест', drinks: ['vodka-cocktail'], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('allows website field to be non-empty (honeypot handled downstream, not by schema)', () => {
    const result = rsvpSchema.safeParse({ fio: 'Бот', drinks: [], companions: [], website: 'spam' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../shared/schemas/rsvp'`.

- [ ] **Step 3: Написать shared/constants/drinks.ts**

```ts
export const DRINK_OPTIONS = ['wine', 'beer', 'spirits', 'non_alcoholic'] as const
export type DrinkOption = typeof DRINK_OPTIONS[number]

export const DRINK_LABELS: Record<DrinkOption, string> = {
  wine: 'Вино',
  beer: 'Пиво',
  spirits: 'Крепкое',
  non_alcoholic: 'Безалкогольное'
}
```

- [ ] **Step 4: Написать shared/schemas/rsvp.ts**

```ts
import { z } from 'zod'
import { DRINK_OPTIONS } from '../constants/drinks'

export const companionSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО сопровождающего').max(200),
  drinks: z.array(z.enum(DRINK_OPTIONS)).default([])
})

export const rsvpSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО').max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  drinks: z.array(z.enum(DRINK_OPTIONS)).default([]),
  companions: z.array(companionSchema).max(3, 'Не больше 3 сопровождающих').default([]),
  website: z.string().optional().default('')
})

export type RsvpInput = z.infer<typeof rsvpSchema>
```

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 5 passed (rsvp-schema.test.ts) + предыдущие.

- [ ] **Step 6: Commit**

```bash
git add shared tests/shared
git commit -m "feat: add shared RSVP validation schema and drink constants"
```

---

### Task 4: Rate-limit и хеширование пароля

**Files:**
- Create: `server/utils/rateLimit.ts`
- Create: `server/utils/password.ts`
- Create: `tests/server/rateLimit.test.ts`
- Create: `tests/server/password.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(key: string, limit: number, windowMs: number): boolean` и `resetRateLimit(key: string): void` из `server/utils/rateLimit.ts`; `hashPassword(plain: string): string` и `verifyPassword(plain: string, stored: string): boolean` из `server/utils/password.ts`.

- [ ] **Step 1: Написать tests/server/rateLimit.test.ts**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit } from '../../server/utils/rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('allows up to the limit then blocks', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true)
    }
    expect(checkRateLimit(key, 5, 60_000)).toBe(false)
  })

  it('resets after the window passes', () => {
    vi.useFakeTimers()
    const key = `test-window-${Math.random()}`
    expect(checkRateLimit(key, 1, 1000)).toBe(true)
    expect(checkRateLimit(key, 1, 1000)).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(checkRateLimit(key, 1, 1000)).toBe(true)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/utils/rateLimit'`.

- [ ] **Step 3: Написать server/utils/rateLimit.ts**

```ts
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) {
    return false
  }

  bucket.count += 1
  return true
}

export function resetRateLimit(key: string): void {
  buckets.delete(key)
}
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Написать tests/server/password.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/utils/password'

describe('password hashing', () => {
  it('verifies correct password', () => {
    const hash = hashPassword('supersecret123')
    expect(verifyPassword('supersecret123', hash)).toBe(true)
  })

  it('rejects wrong password', () => {
    const hash = hashPassword('supersecret123')
    expect(verifyPassword('wrongpass', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', () => {
    const hash1 = hashPassword('supersecret123')
    const hash2 = hashPassword('supersecret123')
    expect(hash1).not.toBe(hash2)
  })
})
```

- [ ] **Step 6: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/utils/password'`.

- [ ] **Step 7: Написать server/utils/password.ts**

```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(plain, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(':')
  if (!salt || !derivedHex) return false

  const derived = scryptSync(plain, salt, KEY_LENGTH)
  const storedBuf = Buffer.from(derivedHex, 'hex')
  if (storedBuf.length !== derived.length) return false

  return timingSafeEqual(derived, storedBuf)
}
```

- [ ] **Step 8: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — все тесты зелёные.

- [ ] **Step 9: Commit**

```bash
git add server/utils/rateLimit.ts server/utils/password.ts tests/server/rateLimit.test.ts tests/server/password.test.ts
git commit -m "feat: add rate limiting and password hashing utils"
```

---

### Task 5: POST /api/rsvp

**Files:**
- Create: `server/api/rsvp.post.ts`
- Create: `tests/server/api/rsvp.test.ts`

**Interfaces:**
- Consumes: `rsvpSchema` из `shared/schemas/rsvp.ts` (Task 3); `guests`, `companions` из `server/database/schema.ts` (Task 2); `db` из `server/database/client.ts` (Task 2); `checkRateLimit` из `server/utils/rateLimit.ts` (Task 4); `createTestDb` из `tests/helpers/testDb.ts` (Task 2).
- Produces: `submitRsvp(rawInput: unknown, opts?: { dbInstance?: typeof db }): Promise<{ ok: true, guestId: number } | { ok: false, status: number, message: string }>` — используется тестами и переиспользуемо, если понадобится другим кодом.

- [ ] **Step 1: Написать tests/server/api/rsvp.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { submitRsvp } from '../../../server/api/rsvp.post'
import { guests } from '../../../server/database/schema'

describe('submitRsvp', () => {
  it('inserts a guest with companions', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: '',
      drinks: ['wine'],
      companions: [{ fio: 'Петров Пётр', drinks: ['beer'] }],
      website: ''
    }, { dbInstance: testDb })

    expect(result.ok).toBe(true)
    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(1)
  })

  it('rejects missing fio', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: '', drinks: [], companions: [], website: '' }, { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects more than 3 companions', async () => {
    const testDb = createTestDb()
    const companionsList = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: companionsList, website: '' }, { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('silently drops honeypot submissions without inserting', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Бот', drinks: [], companions: [], website: 'spam' }, { dbInstance: testDb })
    expect(result.ok).toBe(true)
    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../../server/api/rsvp.post'`.

- [ ] **Step 3: Написать server/api/rsvp.post.ts**

```ts
import { db } from '../database/client'
import { guests, companions } from '../database/schema'
import { rsvpSchema } from '../../shared/schemas/rsvp'
import { checkRateLimit } from '../utils/rateLimit'

export async function submitRsvp(rawInput: unknown, opts: { dbInstance?: typeof db } = {}) {
  const database = opts.dbInstance ?? db
  const parsed = rsvpSchema.safeParse(rawInput)

  if (!parsed.success) {
    return { ok: false as const, status: 400, message: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  if (parsed.data.website) {
    return { ok: true as const, guestId: 0 }
  }

  const now = new Date()
  const inserted = database.insert(guests).values({
    fio: parsed.data.fio,
    phone: parsed.data.phone || null,
    comment: parsed.data.comment || null,
    drinks: parsed.data.drinks,
    createdAt: now,
    updatedAt: now
  }).returning({ id: guests.id }).get()

  for (const companion of parsed.data.companions) {
    database.insert(companions).values({
      guestId: inserted.id,
      fio: companion.fio,
      drinks: companion.drinks
    }).run()
  }

  return { ok: true as const, guestId: inserted.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  if (!checkRateLimit(`rsvp:${ip}`, 5, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const body = await readBody(event)
  const result = await submitRsvp(body)

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message })
  }

  setResponseStatus(event, 201)
  return { id: result.guestId }
})
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — все 4 теста rsvp.test.ts зелёные.

- [ ] **Step 5: Ручная проверка через dev-сервер**

Run: `npm run dev` (в отдельном терминале), затем:
```bash
curl -i -X POST http://localhost:3000/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"fio":"Тест Тестов","drinks":["wine"],"companions":[],"website":""}'
```
Expected: `HTTP/1.1 201` и тело `{"id":1}`.

Затем прогнать запрос 6 раз подряд:
```bash
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/rsvp -H "Content-Type: application/json" -d '{"fio":"Т","drinks":[],"companions":[],"website":""}'; done
```
Expected: первые 5 строк `201`, шестая — `429`.

- [ ] **Step 6: Commit**

```bash
git add server/api/rsvp.post.ts tests/server/api/rsvp.test.ts
git commit -m "feat: add POST /api/rsvp endpoint with rate limiting and honeypot"
```

---

### Task 6: Admin-авторизация (сессия, логин, логаут, seed-скрипт)

**Files:**
- Create: `server/utils/session.ts`
- Create: `server/api/admin/login.post.ts`
- Create: `server/api/admin/logout.post.ts`
- Create: `scripts/seed-admin.ts`
- Create: `tests/server/api/admin-login.test.ts`

**Interfaces:**
- Consumes: `adminUsers` из `server/database/schema.ts` (Task 2); `hashPassword`, `verifyPassword` из `server/utils/password.ts` (Task 4); `checkRateLimit` из `server/utils/rateLimit.ts` (Task 4); `createTestDb` (Task 2).
- Produces: `getAdminSession(event): Promise<Session<{adminId: number}>>` и `requireAdminSession(event): Promise<Session<{adminId: number}>>` из `server/utils/session.ts` (используются в Task 7, 8, 10); `authenticateAdmin(login: string, password: string, dbInstance?: typeof db): Promise<{id: number} | null>` из `server/api/admin/login.post.ts`.

- [ ] **Step 1: Написать server/utils/session.ts**

```ts
import type { H3Event } from 'h3'

interface AdminSessionData {
  adminId?: number
}

export function getAdminSession(event: H3Event) {
  const config = useRuntimeConfig()
  return useSession<AdminSessionData>(event, {
    password: config.sessionSecret,
    name: 'wedding_admin_session',
    maxAge: 60 * 60 * 24 * 7
  })
}

export async function requireAdminSession(event: H3Event) {
  const session = await getAdminSession(event)
  if (!session.data.adminId) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })
  }
  return session
}
```

- [ ] **Step 2: Написать tests/server/api/admin-login.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { adminUsers } from '../../../server/database/schema'
import { hashPassword } from '../../../server/utils/password'
import { authenticateAdmin } from '../../../server/api/admin/login.post'

describe('authenticateAdmin', () => {
  it('returns admin id for correct credentials', async () => {
    const testDb = createTestDb()
    testDb.insert(adminUsers).values({ login: 'bride', passwordHash: hashPassword('secret123') }).run()

    const result = await authenticateAdmin('bride', 'secret123', testDb)
    expect(result).toEqual({ id: 1 })
  })

  it('returns null for wrong password', async () => {
    const testDb = createTestDb()
    testDb.insert(adminUsers).values({ login: 'bride', passwordHash: hashPassword('secret123') }).run()

    const result = await authenticateAdmin('bride', 'wrongpass', testDb)
    expect(result).toBeNull()
  })

  it('returns null for unknown login', async () => {
    const testDb = createTestDb()
    const result = await authenticateAdmin('ghost', 'secret123', testDb)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../../server/api/admin/login.post'`.

- [ ] **Step 4: Написать server/api/admin/login.post.ts**

```ts
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { adminUsers } from '../../database/schema'
import { verifyPassword } from '../../utils/password'
import { checkRateLimit } from '../../utils/rateLimit'
import { getAdminSession } from '../../utils/session'

export async function authenticateAdmin(login: string, password: string, dbInstance: typeof db = db) {
  const user = dbInstance.select().from(adminUsers).where(eq(adminUsers.login, login)).get()
  if (!user) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  return { id: user.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  if (!checkRateLimit(`admin-login:${ip}`, 5, 15 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const body = await readBody<{ login?: string, password?: string }>(event)

  if (!body.login || !body.password) {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные' })
  }

  const admin = await authenticateAdmin(body.login, body.password)

  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные' })
  }

  const session = await getAdminSession(event)
  await session.update({ adminId: admin.id })

  return { ok: true }
})
```

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 3 теста admin-login.test.ts зелёные.

- [ ] **Step 6: Написать server/api/admin/logout.post.ts**

```ts
import { getAdminSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event)
  await session.clear()
  return { ok: true }
})
```

- [ ] **Step 7: Написать scripts/seed-admin.ts**

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../server/database/schema'
import { hashPassword } from '../server/utils/password'

const [, , login, password] = process.argv

if (!login || !password) {
  console.error('Usage: npm run seed:admin -- <login> <password>')
  process.exit(1)
}

const sqlite = new Database(process.env.DB_PATH || './data/wedding.db')
const db = drizzle(sqlite, { schema })

db.insert(schema.adminUsers)
  .values({ login, passwordHash: hashPassword(password) })
  .onConflictDoUpdate({
    target: schema.adminUsers.login,
    set: { passwordHash: hashPassword(password) }
  })
  .run()

console.log(`Admin "${login}" сохранён.`)
```

- [ ] **Step 8: Commit**

```bash
git add server/utils/session.ts server/api/admin/login.post.ts server/api/admin/logout.post.ts scripts/seed-admin.ts tests/server/api/admin-login.test.ts
git commit -m "feat: add admin session auth, login/logout endpoints and seed script"
```

---

### Task 7: Admin API для списка гостей (list/patch/delete)

**Files:**
- Create: `server/api/admin/guests/index.get.ts`
- Create: `server/api/admin/guests/[id].patch.ts`
- Create: `server/api/admin/guests/[id].delete.ts`
- Create: `tests/server/api/admin-guests.test.ts`

**Interfaces:**
- Consumes: `guests`, `companions` из `server/database/schema.ts` (Task 2); `requireAdminSession` из `server/utils/session.ts` (Task 6); `createTestDb` (Task 2).
- Produces: `listGuests(dbInstance?: typeof db): Promise<GuestWithCompanions[]>` (используется также Task 8 для экспорта); `updateGuest(id: number, input: GuestPatchInput, dbInstance?: typeof db): Promise<Guest | null>`; `deleteGuest(id: number, dbInstance?: typeof db): Promise<boolean>`.

- [ ] **Step 1: Написать tests/server/api/admin-guests.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { guests, companions } from '../../../server/database/schema'
import { listGuests } from '../../../server/api/admin/guests/index.get'
import { updateGuest } from '../../../server/api/admin/guests/[id].patch'
import { deleteGuest } from '../../../server/api/admin/guests/[id].delete'

function seedGuest(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: null, comment: null, drinks: ['wine'], createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  testDb.insert(companions).values({ guestId: guest.id, fio: 'Петров Пётр', drinks: ['beer'] }).run()
  return guest.id
}

describe('admin guests API', () => {
  it('listGuests nests companions under each guest', async () => {
    const testDb = createTestDb()
    seedGuest(testDb)

    const result = await listGuests(testDb)
    expect(result).toHaveLength(1)
    expect(result[0].companions).toHaveLength(1)
    expect(result[0].companions[0].fio).toBe('Петров Пётр')
  })

  it('updateGuest updates fields and returns the row', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { comment: 'Аллергия на орехи' }, testDb)
    expect(updated?.comment).toBe('Аллергия на орехи')
  })

  it('updateGuest returns null for missing id', async () => {
    const testDb = createTestDb()
    const updated = await updateGuest(999, { comment: 'x' }, testDb)
    expect(updated).toBeNull()
  })

  it('deleteGuest removes the row and cascades companions', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const deleted = await deleteGuest(id, testDb)
    expect(deleted).toBe(true)

    const remaining = await listGuests(testDb)
    expect(remaining).toHaveLength(0)
  })

  it('deleteGuest returns false for missing id', async () => {
    const testDb = createTestDb()
    const deleted = await deleteGuest(999, testDb)
    expect(deleted).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — модули `index.get`, `[id].patch`, `[id].delete` не найдены.

- [ ] **Step 3: Написать server/api/admin/guests/index.get.ts**

```ts
import { db } from '../../../database/client'
import { guests, companions } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

export async function listGuests(dbInstance: typeof db = db) {
  const allGuests = dbInstance.select().from(guests).all()
  const allCompanions = dbInstance.select().from(companions).all()

  return allGuests.map((guest) => ({
    ...guest,
    companions: allCompanions.filter((companion) => companion.guestId === guest.id)
  }))
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return listGuests()
})
```

- [ ] **Step 4: Написать server/api/admin/guests/[id].patch.ts**

```ts
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

interface GuestPatchInput {
  fio?: string
  phone?: string
  comment?: string
  drinks?: string[]
}

export async function updateGuest(id: number, input: GuestPatchInput, dbInstance: typeof db = db) {
  const existing = dbInstance.select().from(guests).where(eq(guests.id, id)).get()
  if (!existing) return null

  dbInstance.update(guests)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(guests.id, id))
    .run()

  return dbInstance.select().from(guests).where(eq(guests.id, id)).get() ?? null
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<GuestPatchInput>(event)
  const updated = await updateGuest(id, body)

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Гость не найден' })
  }

  return updated
})
```

- [ ] **Step 5: Написать server/api/admin/guests/[id].delete.ts**

```ts
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

export async function deleteGuest(id: number, dbInstance: typeof db = db) {
  const existing = dbInstance.select().from(guests).where(eq(guests.id, id)).get()
  if (!existing) return false

  dbInstance.delete(guests).where(eq(guests.id, id)).run()
  return true
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const deleted = await deleteGuest(id)

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Гость не найден' })
  }

  return { ok: true }
})
```

- [ ] **Step 6: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 5 тестов admin-guests.test.ts зелёные.

- [ ] **Step 7: Commit**

```bash
git add server/api/admin/guests tests/server/api/admin-guests.test.ts
git commit -m "feat: add admin guests list/patch/delete endpoints"
```

---

### Task 8: CSV-экспорт гостей

**Files:**
- Create: `server/utils/csv.ts`
- Create: `server/api/admin/guests/export.get.ts`
- Create: `tests/server/csv.test.ts`

**Interfaces:**
- Consumes: `listGuests` из `server/api/admin/guests/index.get.ts` (Task 7); `requireAdminSession` из `server/utils/session.ts` (Task 6).
- Produces: `guestsToCsv(guestRows: GuestRow[]): string` из `server/utils/csv.ts`.

- [ ] **Step 1: Написать tests/server/csv.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { guestsToCsv } from '../../server/utils/csv'

describe('guestsToCsv', () => {
  it('returns only the header for an empty list', () => {
    const csv = guestsToCsv([])
    expect(csv).toBe('ID,ФИО,Телефон,Комментарий,Напитки,Сопровождающие')
  })

  it('formats a guest row with companions', () => {
    const csv = guestsToCsv([{
      id: 1,
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: null,
      drinks: ['wine', 'beer'],
      companions: [{ fio: 'Петров Пётр', drinks: ['beer'] }]
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe('1,Иванов Иван,+79990000000,,wine; beer,Петров Пётр (beer)')
  })

  it('escapes commas and quotes in comment field', () => {
    const csv = guestsToCsv([{
      id: 2,
      fio: 'Тест',
      phone: null,
      comment: 'Без орехов, пожалуйста "спасибо"',
      drinks: [],
      companions: []
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe('2,Тест,,"Без орехов, пожалуйста ""спасибо""",,')
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/utils/csv'`.

- [ ] **Step 3: Написать server/utils/csv.ts**

```ts
interface GuestRow {
  id: number
  fio: string
  phone: string | null
  comment: string | null
  drinks: string[]
  companions: { fio: string, drinks: string[] }[]
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function guestsToCsv(guestRows: GuestRow[]): string {
  const header = ['ID', 'ФИО', 'Телефон', 'Комментарий', 'Напитки', 'Сопровождающие']
  const lines = [header.join(',')]

  for (const guest of guestRows) {
    const companionsText = guest.companions.map((c) => `${c.fio} (${c.drinks.join('; ')})`).join(' | ')
    const row = [
      String(guest.id),
      guest.fio,
      guest.phone ?? '',
      guest.comment ?? '',
      guest.drinks.join('; '),
      companionsText
    ].map(escapeCsvField)
    lines.push(row.join(','))
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 3 теста csv.test.ts зелёные.

- [ ] **Step 5: Написать server/api/admin/guests/export.get.ts**

```ts
import { requireAdminSession } from '../../../utils/session'
import { listGuests } from './index.get'
import { guestsToCsv } from '../../../utils/csv'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const guestRows = await listGuests()
  const csv = guestsToCsv(guestRows)

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="guests.csv"')
  return csv
})
```

- [ ] **Step 6: Commit**

```bash
git add server/utils/csv.ts server/api/admin/guests/export.get.ts tests/server/csv.test.ts
git commit -m "feat: add CSV export endpoint for admin guest list"
```

---

### Task 9: Landing-страница, форма RSVP, OG-метатеги

**Files:**
- Create: `app/composables/useRsvpForm.ts`
- Create: `app/components/RsvpForm.vue`
- Modify: `app/pages/index.vue`
- Create: `tests/composables/useRsvpForm.test.ts`

**Interfaces:**
- Consumes: `rsvpSchema`, `RsvpInput` из `shared/schemas/rsvp.ts` (Task 3); `DRINK_OPTIONS`, `DRINK_LABELS` из `shared/constants/drinks.ts` (Task 3); эндпоинт `POST /api/rsvp` (Task 5).
- Produces: `useRsvpForm()` возвращает `{ form, errors, submitted, addCompanion, removeCompanion, buildPayload, submit, DRINK_OPTIONS }` — используется компонентом `RsvpForm.vue`.

- [ ] **Step 1: Написать tests/composables/useRsvpForm.test.ts**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRsvpForm } from '../../app/composables/useRsvpForm'

describe('useRsvpForm', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1 }))
  })

  it('adds companions up to a maximum of 3', () => {
    const { form, addCompanion } = useRsvpForm()
    addCompanion(); addCompanion(); addCompanion(); addCompanion()
    expect(form.companions).toHaveLength(3)
  })

  it('removes a companion by index', () => {
    const { form, addCompanion, removeCompanion } = useRsvpForm()
    addCompanion(); addCompanion()
    removeCompanion(0)
    expect(form.companions).toHaveLength(1)
  })

  it('buildPayload returns null and sets an error when fio is missing', () => {
    const { buildPayload, errors } = useRsvpForm()
    const payload = buildPayload()
    expect(payload).toBeNull()
    expect(errors.message).toBeTruthy()
  })

  it('submit calls $fetch with a valid payload', async () => {
    const { form, submit } = useRsvpForm()
    form.fio = 'Иванов Иван'
    const ok = await submit()
    expect(ok).toBe(true)
    expect($fetch).toHaveBeenCalledWith('/api/rsvp', expect.objectContaining({ method: 'POST' }))
  })
})
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../app/composables/useRsvpForm'`.

- [ ] **Step 3: Написать app/composables/useRsvpForm.ts**

```ts
import { reactive } from 'vue'
import { rsvpSchema, type RsvpInput } from '../../shared/schemas/rsvp'
import { DRINK_OPTIONS } from '../../shared/constants/drinks'

export interface CompanionForm {
  fio: string
  drinks: string[]
}

export function useRsvpForm() {
  const form = reactive({
    fio: '',
    phone: '',
    comment: '',
    drinks: [] as string[],
    companions: [] as CompanionForm[],
    website: ''
  })

  const errors = reactive<{ message?: string }>({})
  const submitted = reactive({ success: false, pending: false })

  function addCompanion() {
    if (form.companions.length >= 3) return
    form.companions.push({ fio: '', drinks: [] })
  }

  function removeCompanion(index: number) {
    form.companions.splice(index, 1)
  }

  function buildPayload(): RsvpInput | null {
    const parsed = rsvpSchema.safeParse(form)
    if (!parsed.success) {
      errors.message = parsed.error.issues[0]?.message
      return null
    }
    errors.message = undefined
    return parsed.data
  }

  async function submit() {
    const payload = buildPayload()
    if (!payload) return false

    submitted.pending = true
    try {
      await $fetch('/api/rsvp', { method: 'POST', body: payload })
      submitted.success = true
      return true
    } catch (e: any) {
      errors.message = e?.data?.statusMessage ?? 'Что-то пошло не так, попробуйте ещё раз'
      return false
    } finally {
      submitted.pending = false
    }
  }

  return { form, errors, submitted, addCompanion, removeCompanion, buildPayload, submit, DRINK_OPTIONS }
}
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 4 теста useRsvpForm.test.ts зелёные.

- [ ] **Step 5: Написать app/components/RsvpForm.vue**

```vue
<script setup lang="ts">
import { useRsvpForm } from '../composables/useRsvpForm'
import { DRINK_OPTIONS, DRINK_LABELS } from '../../shared/constants/drinks'

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
```

- [ ] **Step 6: Переписать app/pages/index.vue**

```vue
<script setup lang="ts">
useSeoMeta({
  title: 'Приглашение на свадьбу',
  ogTitle: 'Приглашение на свадьбу',
  description: 'Приглашаем вас на нашу свадьбу — подтвердите участие',
  ogDescription: 'Приглашаем вас на нашу свадьбу — подтвердите участие',
  ogImage: '/og-image.jpg',
  ogType: 'website'
})
</script>

<template>
  <main>
    <h1>Мы женимся!</h1>
    <p>Дата и место проведения — здесь.</p>
    <RsvpForm />
  </main>
</template>
```

- [ ] **Step 7: Добавить og-изображение (ручной шаг)**

Положить реальное фото (рекомендуемо 1200×630) в `public/og-image.jpg` — это контент, не код, готовится вручную перед деплоем.

- [ ] **Step 8: Ручная проверка в браузере**

Run: `npm run dev`, открыть `http://localhost:3000`
Expected: страница рендерится, форма показывает поля ФИО/телефон/напитки, кнопка "+ Добавить сопровождающего" добавляет поле (до 3), отправка формы с пустым ФИО показывает ошибку, с валидными данными — показывает "Спасибо!".

- [ ] **Step 9: Commit**

```bash
git add app/composables/useRsvpForm.ts app/components/RsvpForm.vue app/pages/index.vue tests/composables
git commit -m "feat: add landing page with RSVP form and OG meta tags"
```

---

### Task 10: Admin frontend (логин, дашборд, guard)

**Files:**
- Create: `server/api/admin/session.get.ts`
- Create: `app/composables/useAdminGuests.ts`
- Create: `app/middleware/admin.ts`
- Create: `app/pages/admin/login.vue`
- Create: `app/pages/admin/index.vue`
- Create: `tests/composables/useAdminGuests.test.ts`

**Interfaces:**
- Consumes: `getAdminSession` из `server/utils/session.ts` (Task 6); эндпоинты `/api/admin/guests`, `/api/admin/guests/:id` (Task 7), `/api/admin/guests/export` (Task 8), `/api/admin/login`, `/api/admin/logout` (Task 6).
- Produces: `GET /api/admin/session` → `{ authenticated: boolean }`; `useAdminGuests()` возвращает `{ guestsList, loading, fetchGuests, patchGuest, removeGuest }`.

- [ ] **Step 1: Написать server/api/admin/session.get.ts**

```ts
import { getAdminSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event)
  return { authenticated: Boolean(session.data.adminId) }
})
```

- [ ] **Step 2: Написать tests/composables/useAdminGuests.test.ts**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminGuests } from '../../app/composables/useAdminGuests'

describe('useAdminGuests', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([
      { id: 1, fio: 'Иванов Иван', phone: null, comment: null, drinks: ['wine'], companions: [] }
    ]))
  })

  it('fetchGuests populates the list', async () => {
    const { guestsList, fetchGuests } = useAdminGuests()
    await fetchGuests()
    expect(guestsList.value).toHaveLength(1)
    expect(guestsList.value[0].fio).toBe('Иванов Иван')
  })

  it('removeGuest removes the item from the local list', async () => {
    const { guestsList, fetchGuests, removeGuest } = useAdminGuests()
    await fetchGuests()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ ok: true }))
    await removeGuest(1)
    expect(guestsList.value).toHaveLength(0)
  })

  it('patchGuest merges the update into the local list', async () => {
    const { guestsList, fetchGuests, patchGuest } = useAdminGuests()
    await fetchGuests()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1, comment: 'Аллергия' }))
    await patchGuest(1, { comment: 'Аллергия' })
    expect(guestsList.value[0].comment).toBe('Аллергия')
  })
})
```

- [ ] **Step 3: Запустить тесты, убедиться что падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../app/composables/useAdminGuests'`.

- [ ] **Step 4: Написать app/composables/useAdminGuests.ts**

```ts
import { ref } from 'vue'

export interface GuestRecord {
  id: number
  fio: string
  phone: string | null
  comment: string | null
  drinks: string[]
  companions: { id: number, fio: string, drinks: string[] }[]
}

export function useAdminGuests() {
  const guestsList = ref<GuestRecord[]>([])
  const loading = ref(false)

  async function fetchGuests() {
    loading.value = true
    try {
      guestsList.value = await $fetch<GuestRecord[]>('/api/admin/guests')
    } finally {
      loading.value = false
    }
  }

  async function patchGuest(id: number, patch: Partial<GuestRecord>) {
    const updated = await $fetch(`/api/admin/guests/${id}`, { method: 'PATCH', body: patch })
    const index = guestsList.value.findIndex((guest) => guest.id === id)
    if (index !== -1) guestsList.value[index] = { ...guestsList.value[index], ...updated }
  }

  async function removeGuest(id: number) {
    await $fetch(`/api/admin/guests/${id}`, { method: 'DELETE' })
    guestsList.value = guestsList.value.filter((guest) => guest.id !== id)
  }

  return { guestsList, loading, fetchGuests, patchGuest, removeGuest }
}
```

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `npm test`
Expected: PASS — 3 теста useAdminGuests.test.ts зелёные.

- [ ] **Step 6: Написать app/middleware/admin.ts**

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  const { authenticated } = await $fetch('/api/admin/session')
  if (!authenticated) {
    return navigateTo('/admin/login')
  }
})
```

- [ ] **Step 7: Написать app/pages/admin/login.vue**

```vue
<script setup lang="ts">
const login = ref('')
const password = ref('')
const error = ref('')

async function onSubmit() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { login: login.value, password: password.value } })
    await navigateTo('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Ошибка входа'
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <label>Логин <input v-model="login" type="text"></label>
    <label>Пароль <input v-model="password" type="password"></label>
    <p v-if="error" class="error">{{ error }}</p>
    <button type="submit">Войти</button>
  </form>
</template>
```

- [ ] **Step 8: Написать app/pages/admin/index.vue**

```vue
<script setup lang="ts">
import { useAdminGuests } from '../../composables/useAdminGuests'

definePageMeta({ middleware: 'admin' })

const { guestsList, loading, fetchGuests, removeGuest } = useAdminGuests()
await fetchGuests()

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
        <tr><th>ФИО</th><th>Телефон</th><th>Напитки</th><th>Сопровождающие</th><th>Комментарий</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="guest in guestsList" :key="guest.id">
          <td>{{ guest.fio }}</td>
          <td>{{ guest.phone }}</td>
          <td>{{ guest.drinks.join(', ') }}</td>
          <td>{{ guest.companions.map((c) => c.fio).join(', ') }}</td>
          <td>{{ guest.comment }}</td>
          <td><button @click="removeGuest(guest.id)">Удалить</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 9: Ручная проверка в браузере**

Run: `npm run dev`, посадить admin-запись через `npm run seed:admin -- bride supersecret` (см. Task 6), открыть `http://localhost:3000/admin`
Expected: редирект на `/admin/login`; после входа с `bride`/`supersecret` — редирект на `/admin`, видна таблица (пустая или с тестовыми RSVP), кнопка "Экспорт CSV" скачивает файл, "Удалить" убирает строку.

- [ ] **Step 10: Commit**

```bash
git add server/api/admin/session.get.ts app/composables/useAdminGuests.ts app/middleware/admin.ts app/pages/admin tests/composables/useAdminGuests.test.ts
git commit -m "feat: add admin dashboard, login page and auth guard middleware"
```

---

### Task 11: Docker-деплой (Linux + Windows локально, VPS)

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: весь проект (build output `.output/`, `server/database/migrations/`).
- Produces: работающий контейнер, слушающий порт 3000, с SQLite-файлом на volume `./data`.

- [ ] **Step 1: Написать Dockerfile**

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/server/database/migrations ./server/database/migrations
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Написать docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_PATH=/app/data/wedding.db
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 3: Написать .dockerignore**

```
node_modules
.output
.nuxt
data
.env
```

- [ ] **Step 4: Написать .env.example**

```
SESSION_SECRET=change-me-to-a-long-random-string
```

- [ ] **Step 5: Подготовить локальный .env**

Run: `cp .env.example .env`, затем сгенерировать секрет и вписать в `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Expected: строка из 64 hex-символов — вставить как значение `SESSION_SECRET` в `.env`.

- [ ] **Step 6: Собрать образ**

Run: `docker compose build`
Expected: сборка завершается без ошибок (обе стадии build и runtime).

- [ ] **Step 7: Запустить контейнер**

Run: `docker compose up -d`
Expected: `docker compose ps` показывает `app` в статусе `running`/`healthy`.

- [ ] **Step 8: Проверить, что сайт отвечает**

Run: `curl -s http://localhost:3000 | grep -o "Мы женимся"`
Expected: вывод `Мы женимся`.

- [ ] **Step 9: Засеять admin-аккаунт против volume-файла**

Run (с хоста, не в контейнере — `data/` уже смонтирована из volume):
```bash
DB_PATH=./data/wedding.db npm run seed:admin -- bride supersecret
```
Expected: `Admin "bride" сохранён.`

- [ ] **Step 10: Проверить RSVP и admin-логин через контейнер**

```bash
curl -i -X POST http://localhost:3000/api/rsvp -H "Content-Type: application/json" -d '{"fio":"Тест","drinks":[],"companions":[],"website":""}'
curl -i -X POST http://localhost:3000/api/admin/login -H "Content-Type: application/json" -d '{"login":"bride","password":"supersecret"}'
```
Expected: первый запрос — `201`; второй — `200` с заголовком `Set-Cookie: wedding_admin_session=...`.

- [ ] **Step 11: Повторить шаги 6-10 на Windows (Docker Desktop)**

Run: те же команды `docker compose build` / `docker compose up -d` / curl-проверки в PowerShell (curl доступен как алиас `Invoke-WebRequest`, либо использовать `curl.exe`)
Expected: идентичное поведение, что и на Linux.

- [ ] **Step 12: Настроить Cloudflare + reverse-proxy на VPS (ручной инфраструктурный шаг)**

На VPS поставить Caddy (авто-HTTPS) с конфигом `/etc/caddy/Caddyfile`:
```
your-domain.com {
  reverse_proxy localhost:3000
}
```
В Cloudflare DNS — A-запись на IP VPS с включённым проксированием ("оранжевое облако").

- [ ] **Step 13: Настроить бэкап SQLite по cron на VPS (ручной шаг)**

Run (добавить в `crontab -e` на VPS):
```
0 3 * * * cp /path/to/wedding/data/wedding.db /path/to/backups/wedding-$(date +\%F).db
```

- [ ] **Step 14: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore .env.example
git commit -m "chore: add Docker deploy setup for local and VPS environments"
```

---

## Порядок выполнения задач

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 (строго последовательно, каждая задача опирается на файлы предыдущих).
