import { wedding } from './app/content/wedding'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-30',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      meta: [
        // Запрещаем индексацию сайта поисковыми системами.
        { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' }
      ],
      // Пиксель для тех, у кого выключен JavaScript: плагин Метрики
      // у них не отработает, а этот запрос уйдёт.
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
      // Deliberately NOT read via process.env here (unlike metrikaId) — this key needs to
      // change without a rebuild, so it relies on Nuxt's own NUXT_PUBLIC_CONTACT_PHONE env
      // override, which Nitro re-reads at container *startup*, not at `nuxt build` time.
      // A raw process.env read here would bake in whatever was set during the Docker build
      // step and ignore the value docker-compose injects at runtime.
      contactPhone: wedding.contactDigits
    }
  }
})
