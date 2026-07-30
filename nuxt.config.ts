export default defineNuxtConfig({
  compatibilityDate: '2026-07-30',
  devtools: { enabled: true },
  runtimeConfig: {
    dbPath: process.env.DB_PATH || './data/wedding.db',
    sessionSecret: process.env.SESSION_SECRET || '',
    public: {}
  }
})
