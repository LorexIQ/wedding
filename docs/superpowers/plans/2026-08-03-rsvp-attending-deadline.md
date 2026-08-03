# RSVP Attending/Deadline/Invite-Types/Phone-Env Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let guests answer "приду/не приду", lock RSVP editing after a global admin-set deadline (with a live countdown in the form), support two invite types (with/without companions), and source the footer phone number from `.env`.

**Architecture:** Extends the existing `guests` table with `attending` (nullable bool) and `allowCompanions` (bool); adds a single-row `settings` table for the global RSVP deadline. `submitRsvp` drops its one-shot 409 lock in favor of a deadline check that applies to every submission. The invite GET endpoint becomes the single source of guest+deadline+companions data the form needs. Admin gets two small additions: a deadline field and a per-guest invite-type/attending control.

**Tech Stack:** Nuxt 4 / Vue 3, Drizzle ORM + better-sqlite3, Zod, Vitest.

## Global Constraints

- Deadline check: "не включительно" — editing is allowed while `Date.now() < rsvpDeadlineAt`, closed at and after `rsvpDeadlineAt`.
- Deadline is global (one row in `settings`, `id = 1`), not per-guest. `null` = never closes.
- Existing guests migrate with `allowCompanions = true` (no behavior change for them).
- "Не приду" hides drinks/companions in the form entirely (not just disables) and the server force-clears both fields server-side regardless of what the client sent.
- The "spent thanks" screen never dumps the saved answer back at the guest — only a short attending-conditional message.
- Follow the existing pattern everywhere: server logic exported separately from `defineEventHandler` default export, accepting an injectable `dbInstance` (see `server/api/rsvp.post.ts`).
- Every new/changed piece of server logic and every schema needs a Vitest test in the matching `tests/` subfolder, following the file's existing test style (Russian test names OK, matches surrounding tests).

---

### Task 1: Schema — `attending`, `allowCompanions`, `settings` table

**Files:**

- Modify: `server/database/schema.ts`
- Modify: `tests/helpers/testDb.ts`
- Modify: `tests/database/schema.test.ts`
- Modify: `tests/database/migration.test.ts`
- Create: `server/database/migrations/000X_*.sql` (generated, not hand-written)

**Interfaces:**

- Produces: `guests.attending: boolean | null`, `guests.allowCompanions: boolean` (default `true`), new table `settings` with `id: number`, `rsvpDeadlineAt: Date | null`. Every later task that touches `guests` or needs the deadline relies on these exact names.

- [ ] **Step 1: Add the columns and the `settings` table to the schema**

Edit `server/database/schema.ts`. Add `attending` and `allowCompanions` to the `guests` table definition, and a new `settings` table at the end of the file:

```ts
export const guests = sqliteTable("guests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fio: text("fio"),
  phone: text("phone"),
  comment: text("comment"),
  drinks: text("drinks", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  inviteCode: text("invite_code").unique(),
  submitted: integer("submitted", { mode: "boolean" }).notNull().default(false),
  envelopeOpened: integer("envelope_opened", { mode: "boolean" })
    .notNull()
    .default(false),
  attending: integer("attending", { mode: "boolean" }),
  allowCompanions: integer("allow_companions", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

```ts
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rsvpDeadlineAt: integer("rsvp_deadline_at", { mode: "timestamp" }),
});
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`

Expected: a new file appears under `server/database/migrations/`, e.g.
`0002_<random-name>.sql`. Open it and confirm it contains `ALTER TABLE guests ADD COLUMN attending ...`,
`ALTER TABLE guests ADD COLUMN allow_companions ... DEFAULT true NOT NULL`, and
`CREATE TABLE settings (...)`. Adding nullable/defaulted columns doesn't require drizzle-kit's
table-recreate strategy, so this migration should NOT contain a `__new_guests` dance — if it does,
re-check the schema edit (a table recreate here would need the same FK-off wrapping migration 0001
needed, so simple `ALTER TABLE ADD COLUMN` is the expected, simpler outcome).

- [ ] **Step 3: Update the hand-written test DB schema to match**

Edit `tests/helpers/testDb.ts` — add the two columns to `guests` and a `settings` table:

```ts
sqlite.exec(`
    CREATE TABLE guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fio TEXT,
      phone TEXT,
      comment TEXT,
      drinks TEXT NOT NULL DEFAULT '[]',
      invite_code TEXT UNIQUE,
      submitted INTEGER NOT NULL DEFAULT 0,
      envelope_opened INTEGER NOT NULL DEFAULT 0,
      attending INTEGER,
      allow_companions INTEGER NOT NULL DEFAULT 1,
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

    CREATE TABLE settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rsvp_deadline_at INTEGER
    );
  `);
```

- [ ] **Step 4: Add schema tests**

Add to `tests/database/schema.test.ts` (inside the existing `describe('schema', ...)` block):

```ts
it("attending по умолчанию null, allowCompanions по умолчанию true", () => {
  const db = createTestDb();
  const now = new Date();

  const guest = db
    .insert(guests)
    .values({
      fio: null,
      phone: null,
      comment: null,
      drinks: [],
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  expect(guest.attending).toBeNull();
  expect(guest.allowCompanions).toBe(true);
});

it("settings хранит и возвращает дедлайн, по умолчанию таблица пуста", () => {
  const db = createTestDb();
  expect(db.select().from(settings).all()).toHaveLength(0);

  const deadline = new Date("2026-08-10T21:00:00+03:00");
  db.insert(settings).values({ id: 1, rsvpDeadlineAt: deadline }).run();

  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  expect(row?.rsvpDeadlineAt?.getTime()).toBe(deadline.getTime());
});
```

Add `settings` to the existing import line at the top of the file:
`import { guests, companions, adminUsers, settings } from '../../server/database/schema'`.

- [ ] **Step 5: Update the migration verification test**

Edit `tests/database/migration.test.ts` — the existing test inserts a `guests` row after running
all migrations and asserts on fields; add assertions for the new columns' defaults right after the
existing `expect(guests[0].envelopeOpened).toBe(false)` line:

```ts
expect(guests[0].attending).toBeNull();
expect(guests[0].allowCompanions).toBe(true);
```

Also update the test's `it(...)` title from `'migrations 0000 and 0001 apply successfully and create correct schema'`
to `'migrations 0000, 0001 and 0002 apply successfully and create correct schema'`.

- [ ] **Step 6: Run the test suite**

Run: `npx vitest run tests/database`
Expected: PASS (all schema + migration tests green).

- [ ] **Step 7: Commit**

```bash
git add server/database/schema.ts server/database/migrations tests/helpers/testDb.ts tests/database/schema.test.ts tests/database/migration.test.ts
git commit -m "feat: add guests.attending/allowCompanions and settings table"
```

---

### Task 2: Zod schemas — `attending`, `allowCompanions`, deadline patch

**Files:**

- Modify: `shared/schemas/rsvp.ts`
- Create: `shared/schemas/settings.ts`
- Test: `tests/shared/rsvp-schema.test.ts`
- Create: `tests/shared/settings-schema.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `rsvpSchema` now requires `attending: boolean`. `guestPatchSchema`/`guestCreateSchema` gain
  optional `attending: boolean | null` and `allowCompanions: boolean`. New `settingsPatchSchema` with
  shape `{ rsvpDeadlineAt: string | null }`, exported `SettingsPatchInput` type.

- [ ] **Step 1: Extend `rsvpSchema`, `guestPatchSchema`, `guestCreateSchema`**

Edit `shared/schemas/rsvp.ts`:

```ts
export const rsvpSchema = z.object({
  fio: z.string().trim().min(1, "Укажите ФИО").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  attending: z.boolean({ required_error: "Укажите, придёте ли вы" }),
  drinks: drinksField.default([]),
  companions: z
    .array(companionSchema)
    .max(3, "Не больше 3 сопровождающих")
    .default([]),
  website: z.string().optional().default(""),
});
```

```ts
export const guestPatchSchema = z
  .object({
    fio: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
    comment: z.string().trim().max(1000).optional(),
    drinks: drinksField.optional(),
    submitted: z.boolean().optional(),
    envelopeOpened: z.boolean().optional(),
    attending: z.boolean().nullable().optional(),
    allowCompanions: z.boolean().optional(),
  })
  .strict();
```

```ts
export const guestCreateSchema = z
  .object({
    fio: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
    comment: z.string().trim().max(1000).optional(),
    drinks: drinksField.optional(),
    attending: z.boolean().nullable().optional(),
    allowCompanions: z.boolean().optional(),
  })
  .strict();
```

- [ ] **Step 2: Write the settings schema**

Create `shared/schemas/settings.ts`:

```ts
import { z } from "zod";

export const settingsPatchSchema = z
  .object({
    rsvpDeadlineAt: z.string().min(1).nullable(),
  })
  .strict();

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
```

- [ ] **Step 3: Write the failing schema tests**

Add to `tests/shared/rsvp-schema.test.ts`, inside the existing `describe('rsvpSchema', ...)` block,
and update the two payloads already in that file (`accepts a valid payload`, `allows website field...`)
to include `attending: true` so they keep passing under the new required field:

```ts
it("requires attending", () => {
  const result = rsvpSchema.safeParse({
    fio: "Тест",
    drinks: [],
    companions: [],
    website: "",
  });
  expect(result.success).toBe(false);
});

it("accepts attending: false with empty drinks/companions", () => {
  const result = rsvpSchema.safeParse({
    fio: "Тест",
    attending: false,
    drinks: [],
    companions: [],
    website: "",
  });
  expect(result.success).toBe(true);
});
```

Add a new describe block in the same file for the new optional fields:

```ts
describe("guestPatchSchema / guestCreateSchema — attending и allowCompanions", () => {
  it("guestPatchSchema принимает attending: null (сброс ответа)", () => {
    const result = guestPatchSchema.safeParse({ attending: null });
    expect(result.success).toBe(true);
  });

  it("guestPatchSchema принимает allowCompanions", () => {
    const result = guestPatchSchema.safeParse({ allowCompanions: false });
    expect(result.success).toBe(true);
  });

  it("guestCreateSchema принимает allowCompanions при создании", () => {
    const result = guestCreateSchema.safeParse({ allowCompanions: false });
    expect(result.success).toBe(true);
  });
});
```

Create `tests/shared/settings-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { settingsPatchSchema } from "../../shared/schemas/settings";

describe("settingsPatchSchema", () => {
  it("принимает ISO-строку дедлайна", () => {
    const result = settingsPatchSchema.safeParse({
      rsvpDeadlineAt: "2026-08-10T21:00",
    });
    expect(result.success).toBe(true);
  });

  it("принимает null (снять дедлайн)", () => {
    const result = settingsPatchSchema.safeParse({ rsvpDeadlineAt: null });
    expect(result.success).toBe(true);
  });

  it("отклоняет пустую строку", () => {
    const result = settingsPatchSchema.safeParse({ rsvpDeadlineAt: "" });
    expect(result.success).toBe(false);
  });

  it("отклоняет отсутствие поля", () => {
    const result = settingsPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/rsvp.ts shared/schemas/settings.ts tests/shared/rsvp-schema.test.ts tests/shared/settings-schema.test.ts
git commit -m "feat: add attending/allowCompanions and settings validation schemas"
```

---

### Task 3: `server/utils/settings.ts` — deadline read/write helper

**Files:**

- Create: `server/utils/settings.ts`
- Create: `tests/server/settings.test.ts`

**Interfaces:**

- Consumes: `db` from `server/database/client.ts`, `settings` table from Task 1.
- Produces: `getRsvpDeadline(dbInstance?: typeof db): Date | null`,
  `setRsvpDeadline(value: Date | null, dbInstance?: typeof db): void`. `server/api/rsvp.post.ts`,
  `server/api/invite/[code].get.ts`, and the new admin settings endpoints all call these — do not
  rename them.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/settings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../helpers/testDb";
import { getRsvpDeadline, setRsvpDeadline } from "../../server/utils/settings";

describe("getRsvpDeadline / setRsvpDeadline", () => {
  it("возвращает null, если строка настроек ещё не создана", () => {
    const testDb = createTestDb();
    expect(getRsvpDeadline(testDb)).toBeNull();
  });

  it("сохраняет и возвращает дедлайн", () => {
    const testDb = createTestDb();
    const deadline = new Date("2026-08-10T21:00:00+03:00");

    setRsvpDeadline(deadline, testDb);

    expect(getRsvpDeadline(testDb)?.getTime()).toBe(deadline.getTime());
  });

  it("повторный вызов setRsvpDeadline обновляет значение, а не создаёт вторую строку", () => {
    const testDb = createTestDb();
    setRsvpDeadline(new Date("2026-08-10T21:00:00+03:00"), testDb);
    setRsvpDeadline(new Date("2026-08-12T21:00:00+03:00"), testDb);

    expect(getRsvpDeadline(testDb)?.toISOString()).toBe(
      new Date("2026-08-12T21:00:00+03:00").toISOString(),
    );
  });

  it("setRsvpDeadline(null) снимает ограничение", () => {
    const testDb = createTestDb();
    setRsvpDeadline(new Date("2026-08-10T21:00:00+03:00"), testDb);
    setRsvpDeadline(null, testDb);

    expect(getRsvpDeadline(testDb)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/settings.test.ts`
Expected: FAIL — `Cannot find module '../../server/utils/settings'`.

- [ ] **Step 3: Implement**

Create `server/utils/settings.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { settings } from "../database/schema";

const SETTINGS_ROW_ID = 1;

export function getRsvpDeadline(dbInstance: typeof db = db): Date | null {
  const row = dbInstance
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ROW_ID))
    .get();
  return row?.rsvpDeadlineAt ?? null;
}

export function setRsvpDeadline(
  value: Date | null,
  dbInstance: typeof db = db,
): void {
  dbInstance
    .insert(settings)
    .values({ id: SETTINGS_ROW_ID, rsvpDeadlineAt: value })
    .onConflictDoUpdate({ target: settings.id, set: { rsvpDeadlineAt: value } })
    .run();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/settings.ts tests/server/settings.test.ts
git commit -m "feat: add getRsvpDeadline/setRsvpDeadline settings helper"
```

---

### Task 4: `submitRsvp` — drop the one-shot lock, add deadline + attending + invite-type rules

**Files:**

- Modify: `server/api/rsvp.post.ts`
- Modify: `tests/server/api/rsvp.test.ts`

**Interfaces:**

- Consumes: `getRsvpDeadline` from Task 3, `rsvpSchema` from Task 2 (now requires `attending`).
- Produces: `submitRsvp` unchanged signature; new failure mode `{ ok: false, status: 403, message:
'Редактирование ответа закрыто' }` when the deadline has passed; new failure mode `{ ok: false,
status: 400, message: 'Спутники недоступны для этого приглашения' }`.

- [ ] **Step 1: Update existing tests for the new required `attending` field and the removed 409**

Edit `tests/server/api/rsvp.test.ts`. Every existing payload in this file needs `attending: true`
added (they all currently omit it, and the schema will now reject that). Replace the whole file
with:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createTestDb } from "../../helpers/testDb";
import { submitRsvp } from "../../../server/api/rsvp.post";
import { guests, companions } from "../../../server/database/schema";
import { setRsvpDeadline } from "../../../server/utils/settings";
import { eq } from "drizzle-orm";

function seedInvite(
  testDb: ReturnType<typeof createTestDb>,
  code = "ABC1234567",
  overrides: Partial<typeof guests.$inferInsert> = {},
) {
  const now = new Date();
  const guest = testDb
    .insert(guests)
    .values({
      fio: null,
      phone: null,
      comment: null,
      drinks: [],
      inviteCode: code,
      submitted: false,
      envelopeOpened: false,
      allowCompanions: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning({ id: guests.id })
    .get();
  return guest.id;
}

describe("submitRsvp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("обновляет гостя по коду и проставляет submitted=true", async () => {
    const testDb = createTestDb();
    const guestId = seedInvite(testDb);

    const result = await submitRsvp(
      {
        fio: "Иванов Иван Иванович",
        phone: "+79990000000",
        comment: "",
        attending: true,
        drinks: ["red_dry"],
        companions: [{ fio: "Петров Пётр", drinks: ["sparkling"] }],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(true);

    const rows = testDb.select().from(guests).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(guestId);
    expect(rows[0].fio).toBe("Иванов Иван Иванович");
    expect(rows[0].attending).toBe(true);
    expect(rows[0].submitted).toBe(true);
  });

  it("позволяет отправить ответ повторно до дедлайна, заменяя спутников", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);

    await submitRsvp(
      {
        fio: "Иванов Иван",
        attending: true,
        drinks: [],
        companions: [{ fio: "Первый спутник", drinks: [] }],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    const second = await submitRsvp(
      {
        fio: "Иванов Иван",
        attending: true,
        drinks: [],
        companions: [{ fio: "Второй спутник", drinks: [] }],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(second.ok).toBe(true);

    const guest = testDb
      .select()
      .from(guests)
      .where(eq(guests.inviteCode, "ABC1234567"))
      .get()!;
    const rows = testDb
      .select()
      .from(companions)
      .where(eq(companions.guestId, guest.id))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].fio).toBe("Второй спутник");
  });

  it("attending: false принудительно очищает напитки и спутников, даже если клиент их прислал", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);

    const result = await submitRsvp(
      {
        fio: "Иванов Иван",
        attending: false,
        drinks: ["red_dry"],
        companions: [{ fio: "Спутник", drinks: [] }],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(true);

    const guest = testDb
      .select()
      .from(guests)
      .where(eq(guests.inviteCode, "ABC1234567"))
      .get()!;
    expect(guest.attending).toBe(false);
    expect(guest.drinks).toEqual([]);

    const savedCompanions = testDb
      .select()
      .from(companions)
      .where(eq(companions.guestId, guest.id))
      .all();
    expect(savedCompanions).toHaveLength(0);
  });

  it("400, если спутники присланы для приглашения с allowCompanions=false", async () => {
    const testDb = createTestDb();
    seedInvite(testDb, "ABC1234567", { allowCompanions: false });

    const result = await submitRsvp(
      {
        fio: "Иванов Иван",
        attending: true,
        drinks: [],
        companions: [{ fio: "Спутник", drinks: [] }],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("403 при первой отправке после дедлайна", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    setRsvpDeadline(new Date("2026-08-10T00:00:00Z"), testDb);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:01Z"));

    const result = await submitRsvp(
      {
        fio: "Тест",
        attending: true,
        drinks: [],
        companions: [],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("403 на повторную отправку после дедлайна, даже если раньше уже отвечал", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);

    await submitRsvp(
      { fio: "Тест", attending: true, drinks: [], companions: [], website: "" },
      "ABC1234567",
      { dbInstance: testDb },
    );

    setRsvpDeadline(new Date("2026-08-10T00:00:00Z"), testDb);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:01Z"));

    const result = await submitRsvp(
      {
        fio: "Тест",
        attending: false,
        drinks: [],
        companions: [],
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("разрешает отправку ровно перед дедлайном (не включительно)", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    setRsvpDeadline(new Date("2026-08-10T00:00:00Z"), testDb);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T23:59:59Z"));

    const result = await submitRsvp(
      { fio: "Тест", attending: true, drinks: [], companions: [], website: "" },
      "ABC1234567",
      { dbInstance: testDb },
    );

    expect(result.ok).toBe(true);
  });

  it("404 при отсутствии кода приглашения", async () => {
    const testDb = createTestDb();
    const result = await submitRsvp(
      { fio: "Тест", attending: true, drinks: [], companions: [], website: "" },
      undefined,
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("404 при несуществующем коде приглашения", async () => {
    const testDb = createTestDb();
    const result = await submitRsvp(
      { fio: "Тест", attending: true, drinks: [], companions: [], website: "" },
      "NOPE000000",
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("rejects missing fio", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    const result = await submitRsvp(
      { fio: "", attending: true, drinks: [], companions: [], website: "" },
      "ABC1234567",
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects missing attending", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    const result = await submitRsvp(
      { fio: "Тест", drinks: [], companions: [], website: "" },
      "ABC1234567",
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects more than 3 companions", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    const companionsList = Array.from({ length: 4 }, (_, i) => ({
      fio: `Гость ${i}`,
      drinks: [],
    }));
    const result = await submitRsvp(
      {
        fio: "Тест",
        attending: true,
        drinks: [],
        companions: companionsList,
        website: "",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(false);
  });

  it("silently drops honeypot submissions without touching the DB", async () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    const result = await submitRsvp(
      {
        fio: "Бот",
        attending: true,
        drinks: [],
        companions: [],
        website: "spam",
      },
      "ABC1234567",
      { dbInstance: testDb },
    );
    expect(result.ok).toBe(true);

    const guest = testDb
      .select()
      .from(guests)
      .where(eq(guests.inviteCode, "ABC1234567"))
      .get()!;
    expect(guest.submitted).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the new/changed tests fail**

Run: `npx vitest run tests/server/api/rsvp.test.ts`
Expected: FAIL — the 403/attending/allowCompanions tests fail because `submitRsvp` doesn't implement
them yet, and the "заменяет спутников" test now gets a 409 instead of `ok: true`.

- [ ] **Step 3: Implement the changes**

Edit `server/api/rsvp.post.ts`:

```ts
import {
  defineEventHandler,
  getRequestHeader,
  getRequestIP,
  getCookie,
  createError,
  readBody,
  setResponseStatus,
} from "h3";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { guests, companions } from "../database/schema";
import { rsvpSchema } from "#shared/schemas/rsvp";
import { checkRateLimit } from "../utils/rateLimit";
import { getRsvpDeadline } from "../utils/settings";

export async function submitRsvp(
  rawInput: unknown,
  inviteCode: string | undefined,
  opts: { dbInstance?: typeof db } = {},
) {
  const database = opts.dbInstance ?? db;
  const parsed = rsvpSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      message: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  if (parsed.data.website) {
    return { ok: true as const, guestId: 0 };
  }

  if (!inviteCode) {
    return {
      ok: false as const,
      status: 404,
      message: "Приглашение не найдено",
    };
  }

  const existing = database
    .select()
    .from(guests)
    .where(eq(guests.inviteCode, inviteCode))
    .get();
  if (!existing) {
    return {
      ok: false as const,
      status: 404,
      message: "Приглашение не найдено",
    };
  }

  const deadline = getRsvpDeadline(database);
  if (deadline && Date.now() >= deadline.getTime()) {
    return {
      ok: false as const,
      status: 403,
      message: "Редактирование ответа закрыто",
    };
  }

  const data = parsed.data;
  const attendingCompanions = data.attending ? data.companions : [];

  if (!existing.allowCompanions && attendingCompanions.length > 0) {
    return {
      ok: false as const,
      status: 400,
      message: "Спутники недоступны для этого приглашения",
    };
  }

  const now = new Date();

  database.transaction((tx) => {
    tx.update(guests)
      .set({
        fio: data.fio,
        phone: data.phone || null,
        comment: data.comment || null,
        attending: data.attending,
        drinks: data.attending ? data.drinks : [],
        submitted: true,
        updatedAt: now,
      })
      .where(eq(guests.id, existing.id))
      .run();

    tx.delete(companions).where(eq(companions.guestId, existing.id)).run();

    for (const companion of attendingCompanions) {
      tx.insert(companions)
        .values({
          guestId: existing.id,
          fio: companion.fio,
          drinks: companion.drinks,
        })
        .run();
    }
  });

  return { ok: true as const, guestId: existing.id };
}

export default defineEventHandler(async (event) => {
  const ip =
    getRequestHeader(event, "cf-connecting-ip") ||
    getRequestIP(event) ||
    "unknown";

  if (!checkRateLimit(`rsvp:${ip}`, 5, 60_000)) {
    throw createError({
      statusCode: 429,
      statusMessage: "Слишком много попыток, попробуйте позже",
    });
  }

  const inviteCode = getCookie(event, "invite_code");
  const body = await readBody(event);
  const result = await submitRsvp(body, inviteCode);

  if (!result.ok) {
    throw createError({
      statusCode: result.status,
      statusMessage: result.message,
    });
  }

  setResponseStatus(event, 201);
  return { ok: true };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api/rsvp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/rsvp.post.ts tests/server/api/rsvp.test.ts
git commit -m "feat: replace one-shot RSVP lock with global deadline, add attending/invite-type rules"
```

---

### Task 5: `GET /api/invite/[code]` — return `attending`, `allowCompanions`, `companions`, `rsvpDeadlineAt`

**Files:**

- Modify: `server/api/invite/[code].get.ts`
- Modify: `tests/server/api/invite.test.ts`

**Interfaces:**

- Consumes: `getRsvpDeadline` from Task 3.
- Produces: handler response gains `attending: boolean | null`, `allowCompanions: boolean`,
  `companions: { id: number, fio: string, drinks: string[] }[]`, `rsvpDeadlineAt: number | null`
  (epoch ms, JSON-safe). `resolveInvite`'s signature/behavior is unchanged (still just the guest row).

- [ ] **Step 1: Update the test file**

Edit `tests/server/api/invite.test.ts` — add a new describe block after the existing `resolveInvite`
block (leave `resolveInvite`'s own tests untouched, since that function's contract doesn't change).
This calls the exported `getInviteResponse` logic function directly (same pattern as `submitRsvp` —
pure function taking an injectable `dbInstance`, not the HTTP handler):

```ts
import { companions, settings } from "../../../server/database/schema";

describe("GET /api/invite/:code — форма ответа", () => {
  it("возвращает attending, allowCompanions, companions и rsvpDeadlineAt", () => {
    const testDb = createTestDb();
    seedInvite(testDb);
    testDb
      .insert(companions)
      .values({ guestId: 1, fio: "Петров Пётр", drinks: ["sparkling"] })
      .run();
    testDb
      .insert(settings)
      .values({ id: 1, rsvpDeadlineAt: new Date("2026-08-10T21:00:00+03:00") })
      .run();

    const response = getInviteResponse("ABC1234567", testDb)!;

    expect(response.allowCompanions).toBe(true);
    expect(response.attending).toBeNull();
    expect(response.companions).toEqual([
      { id: 1, guestId: 1, fio: "Петров Пётр", drinks: ["sparkling"] },
    ]);
    expect(response.rsvpDeadlineAt).toBe(
      new Date("2026-08-10T21:00:00+03:00").getTime(),
    );
  });

  it("rsvpDeadlineAt равен null, если дедлайн не задан", () => {
    const testDb = createTestDb();
    seedInvite(testDb);

    const response = getInviteResponse("ABC1234567", testDb)!;

    expect(response.rsvpDeadlineAt).toBeNull();
  });

  it("возвращает null для неизвестного кода", () => {
    const testDb = createTestDb();
    expect(getInviteResponse("NOPE000000", testDb)).toBeNull();
  });
});
```

Add `getInviteResponse` to the existing import line:
`import inviteGetHandler, { resolveInvite, getInviteResponse } from '../../../server/api/invite/[code].get'`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/api/invite.test.ts`
Expected: FAIL — `getInviteResponse` is not exported yet.

- [ ] **Step 3: Implement**

Edit `server/api/invite/[code].get.ts`:

```ts
import {
  defineEventHandler,
  getRouterParam,
  getRequestHeader,
  getRequestIP,
  createError,
} from "h3";
import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { guests, companions } from "../../database/schema";
import { checkRateLimit } from "../../utils/rateLimit";
import { getRsvpDeadline } from "../../utils/settings";

export function resolveInvite(code: string, dbInstance: typeof db = db) {
  return (
    dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get() ??
    null
  );
}

export function getInviteResponse(code: string, dbInstance: typeof db = db) {
  const guest = resolveInvite(code, dbInstance);
  if (!guest) return null;

  const guestCompanions = dbInstance
    .select()
    .from(companions)
    .where(eq(companions.guestId, guest.id))
    .all();
  const deadline = getRsvpDeadline(dbInstance);

  return {
    fio: guest.fio,
    phone: guest.phone,
    comment: guest.comment,
    drinks: guest.drinks,
    submitted: guest.submitted,
    envelopeOpened: guest.envelopeOpened,
    attending: guest.attending,
    allowCompanions: guest.allowCompanions,
    companions: guestCompanions,
    rsvpDeadlineAt: deadline ? deadline.getTime() : null,
  };
}

export default defineEventHandler(async (event) => {
  const ip =
    getRequestHeader(event, "cf-connecting-ip") ||
    getRequestIP(event) ||
    "unknown";
  if (!checkRateLimit(`invite:${ip}`, 20, 60_000)) {
    throw createError({
      statusCode: 429,
      statusMessage: "Слишком много попыток, попробуйте позже",
    });
  }

  const code = getRouterParam(event, "code");
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: "Код не указан" });
  }

  const response = getInviteResponse(code);
  if (!response) {
    throw createError({
      statusCode: 404,
      statusMessage: "Приглашение не найдено",
    });
  }

  return response;
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api/invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/invite/[code].get.ts tests/server/api/invite.test.ts
git commit -m "feat: return attending/allowCompanions/companions/rsvpDeadlineAt from invite lookup"
```

---

### Task 6: Admin settings endpoints (`GET`/`PATCH /api/admin/settings`)

**Files:**

- Create: `server/api/admin/settings.get.ts`
- Create: `server/api/admin/settings.patch.ts`
- Create: `tests/server/api/admin-settings.test.ts`
- Modify: `tests/server/api/admin-guards.test.ts`

**Interfaces:**

- Consumes: `requireAdminSession` (`server/utils/session.ts`), `getRsvpDeadline`/`setRsvpDeadline`
  (Task 3), `settingsPatchSchema` (Task 2).
- Produces: `GET /api/admin/settings` → `{ rsvpDeadlineAt: number | null }`. `PATCH
/api/admin/settings` → same shape, body `{ rsvpDeadlineAt: string | null }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/api/admin-settings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createMockEvent } from "../../helpers/mockEvent";
import { createTestDb } from "../../helpers/testDb";
import { getSettings } from "../../../server/api/admin/settings.get";
import { patchSettings } from "../../../server/api/admin/settings.patch";

describe("admin settings API", () => {
  it("getSettings возвращает null, если дедлайн не задан", () => {
    const testDb = createTestDb();
    expect(getSettings(testDb)).toEqual({ rsvpDeadlineAt: null });
  });

  it("patchSettings сохраняет дедлайн и возвращает его в ms", () => {
    const testDb = createTestDb();
    const result = patchSettings(
      { rsvpDeadlineAt: "2026-08-10T21:00" },
      testDb,
    );
    expect(result.rsvpDeadlineAt).toBe(new Date("2026-08-10T21:00").getTime());
    expect(getSettings(testDb)).toEqual(result);
  });

  it("patchSettings(null) снимает дедлайн", () => {
    const testDb = createTestDb();
    patchSettings({ rsvpDeadlineAt: "2026-08-10T21:00" }, testDb);
    const result = patchSettings({ rsvpDeadlineAt: null }, testDb);
    expect(result.rsvpDeadlineAt).toBeNull();
  });

  it("patchSettings бросает на некорректную дату", () => {
    const testDb = createTestDb();
    expect(() =>
      patchSettings({ rsvpDeadlineAt: "not-a-date" }, testDb),
    ).toThrow();
  });
});
```

Add to `tests/server/api/admin-guards.test.ts` (same file, same pattern as the other guard tests):

```ts
import getSettingsHandler from "../../../server/api/admin/settings.get";
import patchSettingsHandler from "../../../server/api/admin/settings.patch";
```

```ts
it("GET /api/admin/settings rejects an unauthenticated request with 401", async () => {
  const event = createMockEvent({ method: "GET" });
  await expect(getSettingsHandler(event)).rejects.toMatchObject({
    statusCode: 401,
  });
});

it("PATCH /api/admin/settings rejects an unauthenticated request with 401", async () => {
  const event = createMockEvent({
    method: "PATCH",
    body: { rsvpDeadlineAt: null },
  });
  await expect(patchSettingsHandler(event)).rejects.toMatchObject({
    statusCode: 401,
  });
});
```

(add these two `it` blocks inside the existing `describe('admin route auth guards', ...)` block, right
after the `POST /api/admin/guests` one).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/api/admin-settings.test.ts`
Expected: FAIL — the two files don't exist yet.

- [ ] **Step 3: Implement**

Create `server/api/admin/settings.get.ts`:

```ts
import { defineEventHandler } from "h3";
import { db } from "../../database/client";
import { requireAdminSession } from "../../utils/session";
import { getRsvpDeadline } from "../../utils/settings";

export function getSettings(dbInstance: typeof db = db) {
  const deadline = getRsvpDeadline(dbInstance);
  return { rsvpDeadlineAt: deadline ? deadline.getTime() : null };
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  return getSettings();
});
```

Create `server/api/admin/settings.patch.ts`:

```ts
import { defineEventHandler, readBody, createError } from "h3";
import { db } from "../../database/client";
import { requireAdminSession } from "../../utils/session";
import { setRsvpDeadline } from "../../utils/settings";
import { settingsPatchSchema } from "#shared/schemas/settings";

export function patchSettings(rawInput: unknown, dbInstance: typeof db = db) {
  const parsed = settingsPatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Некорректные данные",
    });
  }

  if (parsed.data.rsvpDeadlineAt === null) {
    setRsvpDeadline(null, dbInstance);
    return { rsvpDeadlineAt: null };
  }

  const date = new Date(parsed.data.rsvpDeadlineAt);
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "Некорректная дата" });
  }

  setRsvpDeadline(date, dbInstance);
  return { rsvpDeadlineAt: date.getTime() };
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const body = await readBody(event);
  return patchSettings(body);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api/admin-settings.test.ts tests/server/api/admin-guards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/admin/settings.get.ts server/api/admin/settings.patch.ts tests/server/api/admin-settings.test.ts tests/server/api/admin-guards.test.ts
git commit -m "feat: add admin endpoints to read/set the global RSVP deadline"
```

---

### Task 7: Wire `attending`/`allowCompanions` through admin guest create/patch

**Files:**

- Modify: `server/api/admin/guests/index.post.ts`
- Modify: `tests/server/api/admin-guests.test.ts`

**Interfaces:**

- Consumes: `guestCreateSchema` from Task 2 (already has the fields).
- Produces: `createGuestInvite` now accepts and persists `attending`/`allowCompanions`; returned
  shape gains those two keys (already matches `listGuests()`'s shape automatically, since that
  function does `...guest` spread over the full row).

`server/api/admin/guests/[id].patch.ts`'s `updateGuest` needs **no code change** — it does
`.set({ ...input, updatedAt: new Date() })`, so once `guestPatchSchema` (Task 2) allows
`attending`/`allowCompanions` through, they flow to the DB automatically.

- [ ] **Step 1: Write the failing tests**

Add to `tests/server/api/admin-guests.test.ts`, inside `describe('createGuestInvite (POST
/api/admin/guests)', ...)`:

```ts
it("создаёт фиксированное приглашение (allowCompanions: false)", async () => {
  const testDb = createTestDb();
  const created = await createGuestInvite({ allowCompanions: false }, testDb);
  expect(created.allowCompanions).toBe(false);
});

it("по умолчанию создаёт приглашение с allowCompanions: true", async () => {
  const testDb = createTestDb();
  const created = await createGuestInvite({}, testDb);
  expect(created.allowCompanions).toBe(true);
});
```

Add a new describe block for patching `attending`, next to the existing "updateGuest — переключение
флагов" block:

```ts
describe("updateGuest — attending и allowCompanions", () => {
  it("обновляет attending через updateGuest", async () => {
    const testDb = createTestDb();
    const id = seedGuest(testDb);

    const updated = await updateGuest(id, { attending: true }, testDb);
    expect(updated?.attending).toBe(true);
  });

  it("сбрасывает attending обратно в null", async () => {
    const testDb = createTestDb();
    const id = seedGuest(testDb);

    await updateGuest(id, { attending: false }, testDb);
    const reverted = await updateGuest(id, { attending: null }, testDb);
    expect(reverted?.attending).toBeNull();
  });

  it("переключает allowCompanions", async () => {
    const testDb = createTestDb();
    const id = seedGuest(testDb);

    const updated = await updateGuest(id, { allowCompanions: false }, testDb);
    expect(updated?.allowCompanions).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the create-invite tests fail**

Run: `npx vitest run tests/server/api/admin-guests.test.ts`
Expected: FAIL on the two new `createGuestInvite` tests (`allowCompanions` not passed through yet);
the `updateGuest` tests should already PASS since `updateGuest` needs no change.

- [ ] **Step 3: Implement**

Edit `server/api/admin/guests/index.post.ts` — add `attending`/`allowCompanions` to the insert values
in `createGuestInvite`:

```ts
export async function createGuestInvite(
  input: GuestCreateInput,
  dbInstance: typeof db = db,
) {
  const now = new Date();
  const inviteCode = createUniqueInviteCode(dbInstance);

  const created = dbInstance
    .insert(guests)
    .values({
      fio: input.fio || null,
      phone: input.phone || null,
      comment: input.comment || null,
      drinks: input.drinks ?? [],
      attending: input.attending ?? null,
      allowCompanions: input.allowCompanions ?? true,
      inviteCode,
      submitted: false,
      envelopeOpened: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return {
    ...created,
    companions: [] as { id: number; fio: string; drinks: string[] }[],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api/admin-guests.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/admin/guests/index.post.ts tests/server/api/admin-guests.test.ts
git commit -m "feat: persist attending/allowCompanions on guest create and patch"
```

---

### Task 8: Frontend admin composables — types + settings composable

**Files:**

- Modify: `app/composables/useAdminGuests.ts`
- Modify: `tests/composables/useAdminGuests.test.ts`
- Create: `app/composables/useAdminSettings.ts`
- Create: `tests/composables/useAdminSettings.test.ts`

**Interfaces:**

- Produces: `GuestRecord` and `GuestCreateInput` gain `attending: boolean | null` and
  `allowCompanions: boolean`. New composable `useAdminSettings()` returns `{ deadline: Ref<number |
null>, loading: Ref<boolean>, fetchSettings, patchSettings }` — `app/pages/admin/index.vue`
  (Task 11) consumes exactly these names.

- [ ] **Step 1: Add the new fields to `GuestRecord`/`GuestCreateInput`**

Edit `app/composables/useAdminGuests.ts`:

```ts
export interface GuestRecord {
  id: number;
  fio: string | null;
  phone: string | null;
  comment: string | null;
  drinks: string[];
  inviteCode: string | null;
  submitted: boolean;
  envelopeOpened: boolean;
  attending: boolean | null;
  allowCompanions: boolean;
  companions: { id: number; fio: string; drinks: string[] }[];
}

export interface GuestCreateInput {
  fio?: string;
  phone?: string;
  comment?: string;
  drinks?: string[];
  attending?: boolean | null;
  allowCompanions?: boolean;
}
```

(No other changes needed in this file — `fetchGuests`/`createGuestInvite`/`patchGuest`/`removeGuest`
already pass data through generically.)

- [ ] **Step 2: Write the failing test for `useAdminSettings`**

Create `tests/composables/useAdminSettings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAdminSettings } from "../../app/composables/useAdminSettings";

describe("useAdminSettings", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ rsvpDeadlineAt: 1786000000000 }),
    );
  });

  it("fetchSettings populates deadline", async () => {
    const { deadline, fetchSettings } = useAdminSettings();
    await fetchSettings();
    expect(deadline.value).toBe(1786000000000);
  });

  it("patchSettings updates deadline from the response", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ rsvpDeadlineAt: null }),
    );
    const { deadline, patchSettings } = useAdminSettings();
    await patchSettings(null);
    expect(deadline.value).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/composables/useAdminSettings.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

Create `app/composables/useAdminSettings.ts`:

```ts
import { ref } from "vue";

export function useAdminSettings() {
  const deadline = ref<number | null>(null);
  const loading = ref(false);

  async function fetchSettings() {
    const requestFetch = useRequestFetch();
    loading.value = true;
    try {
      const result = await requestFetch<{ rsvpDeadlineAt: number | null }>(
        "/api/admin/settings",
      );
      deadline.value = result.rsvpDeadlineAt;
    } finally {
      loading.value = false;
    }
  }

  async function patchSettings(rsvpDeadlineAt: string | null) {
    const requestFetch = useRequestFetch();
    const result = await requestFetch<{ rsvpDeadlineAt: number | null }>(
      "/api/admin/settings",
      {
        method: "PATCH",
        body: { rsvpDeadlineAt },
      },
    );
    deadline.value = result.rsvpDeadlineAt;
  }

  return { deadline, loading, fetchSettings, patchSettings };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/composables/useAdminSettings.test.ts tests/composables/useAdminGuests.test.ts`
Expected: PASS (the existing `useAdminGuests` tests keep passing unchanged — the new interface fields
are additive and its mocked responses in that test file don't need updating since TS interfaces don't
affect runtime behavior in Vitest).

- [ ] **Step 6: Commit**

```bash
git add app/composables/useAdminGuests.ts app/composables/useAdminSettings.ts tests/composables/useAdminSettings.test.ts
git commit -m "feat: add useAdminSettings composable, extend GuestRecord with attending/allowCompanions"
```

---

### Task 9: `useRsvpForm` — attending field, companions prefill

**Files:**

- Modify: `app/composables/useRsvpForm.ts`
- Modify: `tests/composables/useRsvpForm.test.ts`

**Interfaces:**

- Produces: `RsvpPrefill` gains `attending?: boolean | null` and `companions?: { fio: string, drinks:
string[] }[]`. `form` gains `attending: boolean | null` (prefilled from `prefill.attending ??
null`). `form.companions` is now prefilled from `prefill.companions` when present (previously
  always `[]`). `buildPayload()`'s `rsvpSchema.safeParse(form)` naturally now validates `attending`
  since the schema requires it (Task 2) — no code change needed there, only the initial value.

- [ ] **Step 1: Update the existing prefill test and add new tests**

Edit `tests/composables/useRsvpForm.test.ts` — update the existing "предзаполняет форму данными
гостя, но не спутниками" test (its premise changes: companions ARE now prefilled when provided) and
add coverage for `attending`:

```ts
it("предзаполняет форму данными гостя, включая спутников, если они переданы", () => {
  const { form } = useRsvpForm({
    fio: "Иванов Иван",
    phone: "+79990000000",
    comment: "Без орехов",
    drinks: ["red_dry"],
    attending: true,
    companions: [{ fio: "Петров Пётр", drinks: ["sparkling"] }],
  });
  expect(form.fio).toBe("Иванов Иван");
  expect(form.attending).toBe(true);
  expect(form.companions).toEqual([
    { fio: "Петров Пётр", drinks: ["sparkling"] },
  ]);
});

it("без переданных спутников форма пустая по спутникам, как раньше", () => {
  const { form } = useRsvpForm({ fio: "Иванов Иван" });
  expect(form.companions).toEqual([]);
});

it("без префилла attending пустой (null)", () => {
  const { form } = useRsvpForm();
  expect(form.attending).toBeNull();
});

it("buildPayload требует выбранного attending", () => {
  const { form, buildPayload, errors } = useRsvpForm();
  form.fio = "Иванов Иван";
  const payload = buildPayload();
  expect(payload).toBeNull();
  expect(errors.fields.attending).toBeTruthy();
});

it("buildPayload проходит, когда attending выбран", () => {
  const { form, buildPayload } = useRsvpForm();
  form.fio = "Иванов Иван";
  form.attending = false;
  const payload = buildPayload();
  expect(payload?.attending).toBe(false);
});
```

Remove the old test `'предзаполняет форму данными гостя, но не спутниками'` (replaced by the two
tests above — same assertions minus the outdated "not companions" premise).

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/composables/useRsvpForm.test.ts`
Expected: FAIL — `form.attending` doesn't exist, companions aren't prefilled.

- [ ] **Step 3: Implement**

Edit `app/composables/useRsvpForm.ts`:

```ts
import { reactive } from "vue";
import { rsvpSchema, type RsvpInput } from "#shared/schemas/rsvp";
import { DRINK_OPTIONS, normalizeDrinks } from "#shared/constants/drinks";

export interface CompanionForm {
  fio: string;
  drinks: string[];
}

export interface RsvpPrefill {
  fio?: string | null;
  phone?: string | null;
  comment?: string | null;
  drinks?: string[];
  attending?: boolean | null;
  companions?: CompanionForm[];
}

export function useRsvpForm(prefill?: RsvpPrefill, initiallySubmitted = false) {
  const form = reactive({
    fio: prefill?.fio ?? "",
    phone: prefill?.phone ?? "",
    comment: prefill?.comment ?? "",
    attending: prefill?.attending ?? (null as boolean | null),
    drinks: prefill?.drinks ? [...prefill.drinks] : [],
    companions: prefill?.companions
      ? prefill.companions.map((c) => ({ fio: c.fio, drinks: [...c.drinks] }))
      : ([] as CompanionForm[]),
    website: "",
  });

  const errors = reactive<{ message?: string; fields: Record<string, string> }>(
    { fields: {} },
  );
  const submitted = reactive({ success: initiallySubmitted, pending: false });

  function addCompanion() {
    if (form.companions.length >= 3) return;
    form.companions.push({ fio: "", drinks: [] });
  }

  function removeCompanion(index: number) {
    form.companions.splice(index, 1);
  }

  function toggleDrink(target: { drinks: string[] }, option: string) {
    target.drinks = normalizeDrinks(target.drinks, option);
  }

  function buildPayload(): RsvpInput | null {
    const parsed = rsvpSchema.safeParse(form);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fields[key]) fields[key] = issue.message;
      }
      errors.fields = fields;
      errors.message = "Проверьте отмеченные поля";
      return null;
    }

    errors.fields = {};
    errors.message = undefined;
    return parsed.data;
  }

  async function submit() {
    const payload = buildPayload();
    if (!payload) return false;

    submitted.pending = true;
    try {
      await $fetch("/api/rsvp", { method: "POST", body: payload });
      submitted.success = true;
      return true;
    } catch (e: any) {
      errors.message =
        e?.data?.statusMessage ?? "Что-то пошло не так, попробуйте ещё раз";
      return false;
    } finally {
      submitted.pending = false;
    }
  }

  return {
    form,
    errors,
    submitted,
    addCompanion,
    removeCompanion,
    toggleDrink,
    buildPayload,
    submit,
    DRINK_OPTIONS,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/composables/useRsvpForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useRsvpForm.ts tests/composables/useRsvpForm.test.ts
git commit -m "feat: add attending field and companion prefill to useRsvpForm"
```

---

### Task 10: `RsvpForm.vue` — attending toggle, invite-type copy, deadline countdown, edit flow

**Files:**

- Modify: `app/components/RsvpForm.vue`
- Modify: `app/middleware/invite.global.ts` (type comment only, see Step 1)
- Modify: `app/content/wedding.ts` (remove the now-unused `rsvpDeadline` field)

No automated test in this repo exercises `.vue` templates directly (only composables have Vitest
coverage). This task is verified manually in Step 6 via the dev server.

- [ ] **Step 1: Remove the now-dead static deadline label**

Edit `app/content/wedding.ts` — delete the line:

```ts
  rsvpDeadline: '10 августа 2026',
```

(The real deadline now comes from `settings.rsvpDeadlineAt` via `/api/invite/[code]`, Task 5. This
was its only reader, in `RsvpForm.vue`.)

- [ ] **Step 2: Rewrite `RsvpForm.vue`'s script block**

Edit `app/components/RsvpForm.vue`, replacing the `<script setup>` block:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRsvpForm } from "../composables/useRsvpForm";
import { DRINK_OPTIONS, DRINK_LABELS } from "#shared/constants/drinks";
import { formatFio } from "../utils/formatFio";
import { splitRemaining, type Remaining } from "../utils/countdown";

interface InviteGuest {
  fio: string | null;
  phone: string | null;
  comment: string | null;
  drinks: string[];
  submitted: boolean;
  attending: boolean | null;
  allowCompanions: boolean;
  companions: { id: number; fio: string; drinks: string[] }[];
  rsvpDeadlineAt: number | null;
}

const inviteGuest = useState<InviteGuest | undefined>("inviteGuest");

const {
  form,
  errors,
  submitted,
  addCompanion,
  removeCompanion,
  toggleDrink,
  submit,
} = useRsvpForm(
  inviteGuest.value ?? undefined,
  inviteGuest.value?.submitted ?? false,
);

const editing = ref(false);
const allowCompanions = computed(
  () => inviteGuest.value?.allowCompanions ?? true,
);
const deadlineAt = inviteGuest.value?.rsvpDeadlineAt ?? null;

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (!deadlineAt) return;
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const deadlinePassed = computed(
  () => deadlineAt !== null && now.value >= deadlineAt,
);
const deadlineLeft = computed<Remaining | null>(() =>
  deadlineAt === null ? null : splitRemaining(deadlineAt - now.value),
);
const deadlineLabel = computed(() =>
  deadlineAt === null
    ? null
    : new Intl.DateTimeFormat("ru", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(deadlineAt),
);

const lockedNoAnswer = computed(
  () => deadlinePassed.value && !submitted.success,
);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function onFioBlur() {
  form.fio = formatFio(form.fio);
}

function onCompanionFioBlur(index: number) {
  form.companions[index]!.fio = formatFio(form.companions[index]!.fio);
}

async function onSubmit() {
  const ok = await submit();
  if (ok) editing.value = false;
}
</script>
```

- [ ] **Step 3: Rewrite the template**

Replace the `<template>` block:

```vue
<template>
  <section class="band band--deep">
    <div class="inner">
      <div v-if="lockedNoAnswer" class="thanks">
        <p class="eyebrow">Приём ответов завершён</p>
        <h2>Редактирование закрыто</h2>
        <p class="form__lede">
          Если нужно что-то сообщить — позвоните нам, номер внизу страницы.
        </p>
      </div>

      <div v-else-if="submitted.success && !editing" class="thanks">
        <p class="eyebrow">Ответ получен</p>
        <h2>
          {{
            form.attending ? "Спасибо, ждём вас" : "Жаль, что не будете с нами"
          }}
        </h2>
        <p class="form__lede">
          {{
            form.attending
              ? "Если что-то изменится — позвоните нам или измените ответ."
              : "Спасибо, что сообщили — если планы изменятся, позвоните нам или измените ответ."
          }}
        </p>
        <button
          v-if="!deadlinePassed"
          class="submit"
          type="button"
          @click="editing = true"
        >
          Изменить ответ
        </button>
      </div>

      <form v-else class="form" @submit.prevent="onSubmit">
        <div class="form__head">
          <p class="eyebrow">Подтверждение</p>
          <h2>Будете ли вы с нами?</h2>
          <p v-if="deadlineLabel" class="form__deadline">
            Ждём ответа до {{ deadlineLabel }}
          </p>
          <div v-if="deadlineLeft" class="form__countdown" role="timer">
            <span
              ><b>{{ deadlineLeft.days }}</b
              >д</span
            >
            <span
              ><b>{{ pad(deadlineLeft.hours) }}</b
              >ч</span
            >
            <span
              ><b>{{ pad(deadlineLeft.minutes) }}</b
              >м</span
            >
            <span
              ><b>{{ pad(deadlineLeft.seconds) }}</b
              >с</span
            >
          </div>
          <p class="form__lede">
            Заполните форму, чтобы мы знали, кого ждать.<template
              v-if="allowCompanions"
            >
              Если придёте не один — добавьте спутников, одной анкеты на всех
              достаточно.</template
            >
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
        />

        <p v-if="errors.message" class="summary">{{ errors.message }}</p>

        <div class="field">
          <label id="attendingLabel">Придёте?</label>
          <div
            class="attending"
            role="radiogroup"
            aria-labelledby="attendingLabel"
          >
            <label class="attending__opt">
              <input
                type="radio"
                name="attending"
                :checked="form.attending === true"
                @change="form.attending = true"
              />
              Приду
            </label>
            <label class="attending__opt">
              <input
                type="radio"
                name="attending"
                :checked="form.attending === false"
                @change="form.attending = false"
              />
              Не приду
            </label>
          </div>
          <p v-if="errors.fields.attending" class="error">
            {{ errors.fields.attending }}
          </p>
        </div>

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
          />
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
          />
          <p v-if="errors.fields.phone" class="error">
            {{ errors.fields.phone }}
          </p>
        </div>

        <template v-if="form.attending">
          <div class="field">
            <label id="drinksLabel">Что предпочитаете из напитков</label>
            <div class="drinks" role="group" aria-labelledby="drinksLabel">
              <label v-for="opt in DRINK_OPTIONS" :key="opt" class="drink">
                <input
                  type="checkbox"
                  :checked="form.drinks.includes(opt)"
                  @change="toggleDrink(form, opt)"
                />
                {{ DRINK_LABELS[opt] }}
              </label>
            </div>
            <p v-if="errors.fields.drinks" class="error">
              {{ errors.fields.drinks }}
            </p>
          </div>

          <template v-if="allowCompanions">
            <div
              v-for="(companion, index) in form.companions"
              :key="index"
              class="companion"
            >
              <div class="companion__head">
                <p class="companion__title">Спутник {{ index + 1 }}</p>
                <button
                  class="companion__drop"
                  type="button"
                  @click="removeCompanion(index)"
                >
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
                  :aria-invalid="
                    Boolean(errors.fields[`companions.${index}.fio`])
                  "
                  @blur="onCompanionFioBlur(index)"
                />
                <p
                  v-if="errors.fields[`companions.${index}.fio`]"
                  class="error"
                >
                  {{ errors.fields[`companions.${index}.fio`] }}
                </p>
              </div>

              <div class="field">
                <label :id="`companion-${index}-drinks`">Напитки</label>
                <div
                  class="drinks"
                  role="group"
                  :aria-labelledby="`companion-${index}-drinks`"
                >
                  <label v-for="opt in DRINK_OPTIONS" :key="opt" class="drink">
                    <input
                      type="checkbox"
                      :checked="companion.drinks.includes(opt)"
                      @change="toggleDrink(companion, opt)"
                    />
                    {{ DRINK_LABELS[opt] }}
                  </label>
                </div>
                <p
                  v-if="errors.fields[`companions.${index}.drinks`]"
                  class="error"
                >
                  {{ errors.fields[`companions.${index}.drinks`] }}
                </p>
              </div>
            </div>

            <button
              v-if="form.companions.length < 3"
              class="addmore"
              type="button"
              @click="addCompanion"
            >
              {{
                form.companions.length
                  ? "+ Добавить ещё спутника"
                  : "+ Я буду не один — добавить спутника"
              }}
            </button>
          </template>
        </template>

        <div class="field">
          <label for="comment">Что-то важное для нас</label>
          <textarea
            id="comment"
            v-model="form.comment"
            placeholder="Аллергия, приеду позже — что угодно"
          />
        </div>

        <button class="submit" type="submit" :disabled="submitted.pending">
          {{ submitted.pending ? "Отправляем…" : "Отправить" }}
        </button>
      </form>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Add styles for the attending toggle and countdown**

Add to the existing `<style scoped>` block (right after the `.form__deadline` rule):

```css
.form__countdown {
  display: flex;
  gap: 14px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.form__countdown b {
  font-size: 15px;
  color: var(--ink);
}

.attending {
  display: flex;
  border: 1px solid var(--rule);
  background: var(--paper);
}

.attending__opt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 14px;
  font-family: var(--sans);
  font-size: 14px;
  cursor: pointer;
}

.attending__opt + .attending__opt {
  border-left: 1px solid var(--rule);
}

.attending__opt:has(input:checked) {
  background: #e3e8d8;
}
```

- [ ] **Step 5: Update `RsvpPrefill` consumer note in the middleware**

`app/middleware/invite.global.ts` needs no code change — `useState('inviteGuest')` is untyped there
and just forwards whatever `/api/invite/[code]` returns (Task 5 already extended that shape). Skip
this step; it exists only to confirm no action is needed here.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`

In the browser, open an invite link (`/invite/<code>` for a seeded test guest — use
`npm run seed:admin -- test testpass123` plus the admin UI at `/admin` to create one, or insert a row
directly), then:

- Confirm the "Приду/Не приду" toggle is required (submit with neither selected shows a field error).
- Confirm choosing "Не приду" hides drinks/companions and the lede's companion sentence.
- Confirm the thanks screen text differs by attending choice, and "Изменить ответ" reopens the form
  prefilled (including previously entered companions).
- Set a deadline in the admin panel (Task 11) a minute in the future, confirm the countdown ticks
  down and the form locks with "Приём ответов завершён" / the locked thanks-screen variant once it
  passes.

- [ ] **Step 7: Commit**

```bash
git add app/components/RsvpForm.vue app/content/wedding.ts
git commit -m "feat: attending toggle, deadline countdown and edit flow in RsvpForm"
```

---

### Task 11: Admin UI — deadline control + invite-type/attending controls

**Files:**

- Modify: `app/pages/admin/index.vue`

No automated test — this page has no existing Vitest coverage (its composables are tested, not the
`.vue` file). Verified manually in Step 3.

- [ ] **Step 1: Add the deadline control and invite-type/attending fields**

Edit `app/pages/admin/index.vue`:

```vue
<script setup lang="ts">
import { ref, reactive } from "vue";
import {
  useAdminGuests,
  type GuestRecord,
} from "../../composables/useAdminGuests";
import { useAdminSettings } from "../../composables/useAdminSettings";
import { DRINK_OPTIONS, DRINK_LABELS } from "#shared/constants/drinks";
import { formatFio } from "../../utils/formatFio";

definePageMeta({ middleware: "admin" });

const {
  guestsList,
  loading,
  fetchGuests,
  createGuestInvite,
  patchGuest,
  removeGuest,
} = useAdminGuests();
const { deadline, fetchSettings, patchSettings } = useAdminSettings();
await Promise.all([fetchGuests(), fetchSettings()]);

const deadlineInput = ref(
  deadline.value
    ? new Date(
        deadline.value - new Date(deadline.value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "",
);

async function saveDeadline() {
  try {
    await patchSettings(deadlineInput.value || null);
  } catch (e) {
    console.error(e);
    alert("Не удалось сохранить: некорректная дата дедлайна");
  }
}

async function clearDeadline() {
  deadlineInput.value = "";
  await saveDeadline();
}

const editingId = ref<number | null>(null);
const editForm = reactive({
  fio: "",
  phone: "",
  comment: "",
  drinks: [] as string[],
  attending: null as boolean | null,
  allowCompanions: true,
});

const creating = ref(false);
const draft = reactive({
  fio: "",
  phone: "",
  comment: "",
  drinks: [] as string[],
  allowCompanions: true,
});

function startEdit(guest: GuestRecord) {
  editingId.value = guest.id;
  editForm.fio = guest.fio ?? "";
  editForm.phone = guest.phone ?? "";
  editForm.comment = guest.comment ?? "";
  editForm.drinks = [...guest.drinks];
  editForm.attending = guest.attending;
  editForm.allowCompanions = guest.allowCompanions;
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  try {
    await patchGuest(id, {
      fio: formatFio(editForm.fio),
      phone: editForm.phone,
      comment: editForm.comment,
      drinks: editForm.drinks,
      attending: editForm.attending,
      allowCompanions: editForm.allowCompanions,
    });
    editingId.value = null;
  } catch (e) {
    console.error(e);
    alert("Не удалось сохранить: не получилось обновить гостя");
  }
}

function startCreate() {
  creating.value = true;
  draft.fio = "";
  draft.phone = "";
  draft.comment = "";
  draft.drinks = [];
  draft.allowCompanions = true;
}

function cancelCreate() {
  creating.value = false;
}

async function confirmCreate() {
  try {
    await createGuestInvite({
      fio: formatFio(draft.fio) || undefined,
      phone: draft.phone || undefined,
      comment: draft.comment || undefined,
      drinks: draft.drinks,
      allowCompanions: draft.allowCompanions,
    });
    creating.value = false;
  } catch (e) {
    console.error(e);
    alert("Не удалось сохранить: не получилось создать приглашение");
  }
}

async function toggleSubmitted(guest: GuestRecord, event: Event) {
  try {
    await patchGuest(guest.id, { submitted: !guest.submitted });
  } catch (e) {
    console.error(e);
    const input = event.target as HTMLInputElement;
    input.checked = guest.submitted;
    alert("Не удалось сохранить: не получилось обновить статус ответа");
  }
}

async function toggleEnvelopeOpened(guest: GuestRecord, event: Event) {
  try {
    await patchGuest(guest.id, { envelopeOpened: !guest.envelopeOpened });
  } catch (e) {
    console.error(e);
    const input = event.target as HTMLInputElement;
    input.checked = guest.envelopeOpened;
    alert("Не удалось сохранить: не получилось обновить статус конверта");
  }
}

async function copyLink(guest: GuestRecord) {
  try {
    await navigator.clipboard.writeText(
      `${location.origin}/invite/${guest.inviteCode}`,
    );
    alert("Ссылка скопирована");
  } catch (e) {
    console.error(e);
    alert("Не удалось сохранить: не получилось скопировать ссылку");
  }
}

async function removeGuestSafe(id: number) {
  try {
    await removeGuest(id);
  } catch (e) {
    console.error(e);
    alert("Не удалось сохранить: не получилось удалить гостя");
  }
}

async function onLogout() {
  await $fetch("/api/admin/logout", { method: "POST" });
  await navigateTo("/admin/login");
}

function attendingLabel(attending: boolean | null) {
  if (attending === true) return "Да";
  if (attending === false) return "Нет";
  return "—";
}
</script>
```

- [ ] **Step 2: Update the template**

Replace the `<template>` block:

```vue
<template>
  <div>
    <button @click="onLogout">Выйти</button>
    <a href="/api/admin/guests/export">Экспорт CSV</a>

    <div>
      <label>
        Дедлайн ответа:
        <input v-model="deadlineInput" type="datetime-local" />
      </label>
      <button @click="saveDeadline">Сохранить дедлайн</button>
      <button v-if="deadline" @click="clearDeadline">Снять дедлайн</button>
    </div>

    <p v-if="loading">Загрузка...</p>

    <table v-else>
      <thead>
        <tr>
          <th>ФИО</th>
          <th>Телефон</th>
          <th>Напитки</th>
          <th>Сопровождающие</th>
          <th>Комментарий</th>
          <th>Придёт</th>
          <th>Тип</th>
          <th>Ответил</th>
          <th>Открыл конверт</th>
          <th>Ссылка</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="guest in guestsList" :key="guest.id">
          <template v-if="editingId === guest.id">
            <td><input v-model="editForm.fio" type="text" /></td>
            <td><input v-model="editForm.phone" type="tel" /></td>
            <td>
              <label v-for="opt in DRINK_OPTIONS" :key="opt">
                <input v-model="editForm.drinks" type="checkbox" :value="opt" />
                {{ DRINK_LABELS[opt] }}
              </label>
            </td>
            <td>{{ guest.companions.map((c) => c.fio).join(", ") }}</td>
            <td><textarea v-model="editForm.comment" /></td>
            <td>
              <select v-model="editForm.attending">
                <option :value="null">—</option>
                <option :value="true">Да</option>
                <option :value="false">Нет</option>
              </select>
            </td>
            <td>
              <select v-model="editForm.allowCompanions">
                <option :value="true">Со спутниками</option>
                <option :value="false">Фиксированное</option>
              </select>
            </td>
            <td colspan="2"></td>
            <td>
              <button @click="saveEdit(guest.id)">Сохранить</button>
              <button @click="cancelEdit">Отмена</button>
            </td>
          </template>

          <template v-else>
            <td>{{ guest.fio }}</td>
            <td>{{ guest.phone }}</td>
            <td>{{ guest.drinks.join(", ") }}</td>
            <td>{{ guest.companions.map((c) => c.fio).join(", ") }}</td>
            <td>{{ guest.comment }}</td>
            <td>{{ attendingLabel(guest.attending) }}</td>
            <td>
              {{ guest.allowCompanions ? "Со спутниками" : "Фиксированное" }}
            </td>
            <td>
              <input
                type="checkbox"
                :checked="guest.submitted"
                @change="toggleSubmitted(guest, $event)"
              />
            </td>
            <td>
              <input
                type="checkbox"
                :checked="guest.envelopeOpened"
                @change="toggleEnvelopeOpened(guest, $event)"
              />
            </td>
            <td>
              <button :disabled="!guest.inviteCode" @click="copyLink(guest)">
                Скопировать ссылку
              </button>
            </td>
            <td>
              <button @click="startEdit(guest)">Изменить</button>
              <button @click="removeGuestSafe(guest.id)">Удалить</button>
            </td>
          </template>
        </tr>

        <tr v-if="creating">
          <td><input v-model="draft.fio" type="text" placeholder="ФИО" /></td>
          <td>
            <input v-model="draft.phone" type="tel" placeholder="Телефон" />
          </td>
          <td>
            <label v-for="opt in DRINK_OPTIONS" :key="opt">
              <input v-model="draft.drinks" type="checkbox" :value="opt" />
              {{ DRINK_LABELS[opt] }}
            </label>
          </td>
          <td></td>
          <td>
            <textarea v-model="draft.comment" placeholder="Комментарий" />
          </td>
          <td></td>
          <td>
            <select v-model="draft.allowCompanions">
              <option :value="true">Со спутниками</option>
              <option :value="false">Фиксированное</option>
            </select>
          </td>
          <td colspan="2"></td>
          <td>
            <button @click="confirmCreate">✓</button>
            <button @click="cancelCreate">✗</button>
          </td>
        </tr>

        <tr v-else>
          <td colspan="10">
            <button :disabled="creating" @click="startCreate">
              + Создать приглашение
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log into `/admin`, confirm:

- Setting a deadline and reloading the page keeps it (persisted via `PATCH /api/admin/settings`).
- "Снять дедлайн" clears it and only shows once a deadline is set.
- Creating a guest with "Фиксированное" persists `allowCompanions: false` (check via the table or
  CSV export column order didn't shift — CSV export is intentionally unchanged by this plan).
- Editing a guest's "Придёт" select persists and displays correctly after reload.

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/index.vue
git commit -m "feat: admin controls for RSVP deadline and invite type/attending"
```

---

### Task 12: Footer phone number from `.env`

**Files:**

- Modify: `nuxt.config.ts`
- Modify: `app/components/TheFooter.vue`

- [ ] **Step 1: Add the runtime config entry**

Edit `nuxt.config.ts`:

```ts
  runtimeConfig: {
    dbPath: process.env.DB_PATH || './data/wedding.db',
    sessionSecret: process.env.SESSION_SECRET || '',
    public: {
      metrikaId: process.env.METRIKA_ID || '111173886',
      contactPhone: process.env.CONTACT_PHONE || wedding.contactDigits
    }
  }
```

This requires importing `wedding` at the top of `nuxt.config.ts`:

```ts
import { wedding } from "./app/content/wedding";
```

- [ ] **Step 2: Read it from the footer**

Edit `app/components/TheFooter.vue` — replace `wedding.contactDigits` with the runtime config value:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { wedding } from "../content/wedding";
import { formatPhone, maskPhone } from "../utils/phone";

const contactDigits = useRuntimeConfig().public.contactPhone;
const revealed = ref(false);
</script>

<template>
  <footer class="foot">
    <p class="eyebrow">Остались вопросы</p>

    <a v-if="revealed" class="foot__phone" :href="`tel:+${contactDigits}`">{{
      formatPhone(contactDigits)
    }}</a>

    <button
      v-else
      class="foot__phone foot__phone--masked"
      type="button"
      @click="revealed = true"
    >
      {{ maskPhone(contactDigits) }}
    </button>

    <p v-if="!revealed" class="foot__hint">Нажмите, чтобы показать номер</p>

    <p class="foot__sign">{{ wedding.footer.sign }}</p>
  </footer>
</template>
```

(`wedding` import stays — `wedding.footer.sign` still uses it. `wedding.contactDigits` stays defined
in `app/content/wedding.ts` unchanged — it's now only read from `nuxt.config.ts` as the fallback.)

- [ ] **Step 3: Manual verification**

Run: `CONTACT_PHONE=79111234567 npm run dev` (or set it in a local `.env` file), open `/`, click the
footer's masked phone, confirm it reveals `+7 911 123-45-67`-style formatting from the env value.
Then unset the variable and confirm it falls back to `wedding.contactDigits`'s value unchanged.

- [ ] **Step 4: Commit**

```bash
git add nuxt.config.ts app/components/TheFooter.vue
git commit -m "feat: source footer phone number from CONTACT_PHONE env var"
```

---

### Task 13: Docs + full verification pass

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the **Data model** paragraph, change:

> `guests` (one row per invite, has `inviteCode`, `submitted`, `envelopeOpened`)

to:

> `guests` (one row per invite, has `inviteCode`, `submitted`, `envelopeOpened`, `attending`,
> `allowCompanions`), `settings` (single global row, currently just `rsvpDeadlineAt` — the RSVP
> editing cutoff, admin-configurable via `/api/admin/settings`)

In the **RSVP flow** paragraph, update the sentence starting "RSVP is one-shot" — it's no longer
one-shot:

> RSVP submissions are allowed until the global deadline in `settings.rsvpDeadlineAt` (checked in
> `submitRsvp`, `server/api/rsvp.post.ts`) — before it, a guest can resubmit freely to change their
> answer; at and after it, every submission (first or repeat) gets a 403. A `null` deadline never
> closes RSVP. `attending: boolean | null` on `guests` records the guest's приду/не приду choice;
> `attending: false` forces `drinks`/`companions` to be cleared server-side regardless of what the
> client sent. `allowCompanions` on `guests` gates whether that guest's invite can add companions at
> all (checked both in the form and server-side in `submitRsvp`).

In the **Environment** section, add `CONTACT_PHONE` to the list, next to `METRIKA_ID`:

> `CONTACT_PHONE` (footer contact number, digits only, e.g. `79001234567`; falls back to the
> placeholder in `app/content/wedding.ts`'s `contactDigits` if unset). Same convention as
> `METRIKA_ID`: read via a plain `process.env.CONTACT_PHONE` at `nuxt.config.ts` eval time (not
> through Nuxt's automatic `NUXT_`/`NUXT_PUBLIC_`-prefixed runtime-config override), so it's set as
> plain `CONTACT_PHONE` in Docker too, not `NUXT_PUBLIC_CONTACT_PHONE`. Optional — `docker-compose.yml`
> doesn't currently set `METRIKA_ID` either and relies on its hardcoded fallback; `CONTACT_PHONE` can
> be added to its `environment:` list the same way if/when the real number needs to differ from the
> fallback.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file touched across Tasks 1–9, plus the untouched ones, all green.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: builds successfully with no type errors.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document attending/deadline/invite-type fields and CONTACT_PHONE"
```
