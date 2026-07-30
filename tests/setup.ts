// Vitest runs plain Node, outside Nitro's build pipeline, so Nuxt's
// `useRuntimeConfig` auto-import (injected by Nitro at build/dev time) does
// not exist here. server/database/client.ts calls it at module load time,
// so any test that transitively imports that module (e.g. via a server/api
// handler) needs a stub in place before the import happens.
//
// The stubbed dbPath is ':memory:' so importing server/database/client.ts
// in a test never touches the real database file — tests that need a DB
// use tests/helpers/testDb.ts's createTestDb() instead, and pass it in via
// dependency injection.
;(globalThis as any).useRuntimeConfig = () => ({
  dbPath: ':memory:',
  sessionSecret: 'test-session-secret-at-least-32-chars-long',
  public: {}
})

// Nuxt's `useRequestFetch` auto-import (a cookie-forwarding $fetch wrapper
// used for SSR requests) doesn't exist outside a running Nuxt app either.
// Composable tests stub the global `$fetch` per-test via vi.stubGlobal;
// this stub reads that same global at call time so it always proxies to
// whatever `$fetch` mock the current test has in place.
;(globalThis as any).useRequestFetch = () => (globalThis as any).$fetch
