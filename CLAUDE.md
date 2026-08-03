# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-event wedding invitation site (Nuxt 4 / Vue 3, SSR). Guests get a personal `/invite/<code>` link, gated by an invite-code cookie; an admin panel manages the guest list and RSVP export. Site is `noindex`d (private, not for search engines). Deployed via Docker Compose + Caddy to `wedding.liq.su`.

## Commands

```
npm run dev              # nuxt dev --host
npm run build             # nuxt build
npm test                  # vitest run (all tests, single pass)
npx vitest run path/to/file.test.ts   # single test file
npx vitest path/to/file.test.ts       # watch mode for one file
npm run db:generate        # drizzle-kit generate — after editing server/database/schema.ts
npm run seed:admin -- <login> <password>   # create/update an admin user in the DB
```

No lint script is configured. Type-checking runs via `vue-tsc` (devDependency) but is not wired into an npm script.

## Architecture

**Stack**: Nuxt 4 (Nuxt 4 app-dir layout: `app/` holds pages/components/composables), better-sqlite3 + Drizzle ORM, Zod validation, h3 sessions (nuxt-auth-utils style `useSession`), Vitest.

**Data model** (`server/database/schema.ts`): `guests` (one row per invite, has `inviteCode`, `submitted`, `envelopeOpened`, `attending`, `allowCompanions`), `settings` (single global row, currently just `rsvpDeadlineAt` — the RSVP editing cutoff, admin-configurable via `/api/admin/settings`), `companions` (guest's plus-ones, cascade-deleted with guest), `adminUsers`. Migrations are drizzle-kit generated SQL in `server/database/migrations/`, applied automatically on boot by `server/plugins/00.migrate.ts`. That plugin toggles `PRAGMA foreign_keys` off/on around the migration run — required because drizzle-kit's table-recreate strategy would otherwise cascade-delete rows via FK triggers mid-migration (see comment in the file before changing this).

**Invite gating flow**:
1. Guest opens `/invite/<code>` (`app/pages/invite/[code].vue`) → validates via `GET /api/invite/[code]`, on success stores the code in a long-lived cookie (`useInviteCode`, `app/composables/useInviteCode.ts`) and redirects to `/`.
2. `app/middleware/invite.global.ts` runs on every route: allows `/admin*`, `/invite/*`, `/not-invited` through; everywhere else it requires the cookie and re-validates it server-side via `useRequestFetch` (SSR-safe), stashing the guest in `useState('inviteGuest')`. No cookie or a failed lookup → redirect to `/not-invited`.
3. First visit to `/` shows `TheEnvelope` (open animation); opening it POSTs `/api/invite/[code]/open` to flip `envelopeOpened` server-side (fire-and-forget — a failed request does not roll back the local animation state, since the guest has already seen the invite).

**RSVP flow**: `RsvpForm.vue` + `useRsvpForm` composable build/validate a payload against `shared/schemas/rsvp.ts` (Zod, shared between client and server) and POST to `/api/rsvp`. The handler (`server/api/rsvp.post.ts`) exports `submitRsvp()` separately from the `defineEventHandler` wrapper specifically so tests can call it directly with an injected test DB (`opts.dbInstance`) instead of going through HTTP. RSVP submissions are allowed until the global deadline in `settings.rsvpDeadlineAt` (checked in `submitRsvp`, `server/api/rsvp.post.ts`) — before it, a guest can resubmit freely to change their answer; at and after it, every submission (first or repeat) gets a 403. A `null` deadline never closes RSVP. `attending: boolean | null` on `guests` records the guest's приду/не приду choice; `attending: false` forces `drinks`/`companions` to be cleared server-side regardless of what the client sent. `allowCompanions` on `guests` gates whether that guest's invite can add companions at all (checked both in the form and server-side in `submitRsvp`). The `website` field is a honeypot — a filled value silently short-circuits to a fake success.

**Admin**: `/admin/*` is gated by `app/middleware/admin.ts` (checks `GET /api/admin/session`), separate from the invite-code gate. Session cookie logic lives in `server/utils/session.ts` (`getAdminSession` / `requireAdminSession`); `server/plugins/01.validate-config.ts` fails startup if `SESSION_SECRET` is missing or under 32 chars. Guest CRUD + CSV export live under `server/api/admin/guests/`.

**Path aliases**: `#shared/*` maps to `shared/` (used for schemas/constants shared between `app/` and `server/`) — configured for both Nuxt and Vitest (`vitest.config.ts`).

**Content**: all copy/dates/venue info is centralized in `app/content/wedding.ts` — components read from there rather than hardcoding text, so content edits shouldn't require touching component markup.

## Testing notes

- `tests/setup.ts` stubs `useRuntimeConfig` (dbPath `:memory:`) and `useRequestFetch` globally, since Vitest runs outside Nitro's build pipeline and those Nuxt auto-imports don't otherwise exist.
- `tests/helpers/testDb.ts`'s `createTestDb()` spins up an in-memory SQLite DB with the schema hand-written (not migrated) — keep it in sync with `server/database/schema.ts` when the schema changes.
- Server API handlers that need DB access in tests should follow the `rsvp.post.ts` pattern: export the core logic function separately from the `defineEventHandler` default export, accepting an injectable DB instance.

## Environment

Required at runtime: `SESSION_SECRET` (32+ char hex, generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `DB_PATH` (defaults to `./data/wedding.db`), `METRIKA_ID` (Yandex Metrika, defaults to a hardcoded ID). In Docker these are passed as `NUXT_DB_PATH` / `NUXT_SESSION_SECRET` (Nuxt's runtime-config env override convention).

`CONTACT_PHONE` (footer contact number, digits only, e.g. `79001234567`; falls back to the placeholder in `app/content/wedding.ts`'s `contactDigits` if unset). Same convention as `METRIKA_ID`: read via a plain `process.env.CONTACT_PHONE` at `nuxt.config.ts` eval time (not through Nuxt's automatic `NUXT_`/`NUXT_PUBLIC_`-prefixed runtime-config override), so it's set as plain `CONTACT_PHONE` in Docker too, not `NUXT_PUBLIC_CONTACT_PHONE`. Optional — `docker-compose.yml` doesn't currently set `METRIKA_ID` either and relies on its hardcoded fallback; `CONTACT_PHONE` can be added to its `environment:` list the same way if/when the real number needs to differ from the fallback.
