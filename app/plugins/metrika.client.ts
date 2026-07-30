/**
 * Яндекс.Метрика. Счётчик грузится только в браузере — на сервере ему
 * нечего считать, а `ssr: true` в настройках лишь сообщает Метрике, что
 * страница пришла отрендеренной.
 *
 * Идентификатор счётчика лежит в runtimeConfig.public, чтобы админка
 * могла обращаться к тому же значению, не дублируя число в коде.
 */
export default defineNuxtPlugin(() => {
  const counterId = useRuntimeConfig().public.metrikaId
  if (!counterId) return

  const src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`

  // Повторная вставка тега ломает счётчик — проверяем, не стоит ли он уже.
  for (const script of Array.from(document.scripts)) {
    if (script.src === src) return
  }

  const w = window as unknown as {
    ym?: { (...args: unknown[]): void, a?: unknown[][], l?: number }
  }

  // Очередь вызовов до загрузки тега: всё, что позвали раньше времени,
  // Метрика проигрывает сама, когда скрипт доедет.
  if (!w.ym) {
    const queue = ((...args: unknown[]) => {
      queue.a = queue.a || []
      queue.a.push(args)
    }) as { (...args: unknown[]): void, a?: unknown[][], l?: number }
    w.ym = queue
  }
  w.ym.l = Date.now()

  const tag = document.createElement('script')
  tag.async = true
  tag.src = src
  const first = document.getElementsByTagName('script')[0]
  first?.parentNode?.insertBefore(tag, first)

  w.ym(Number(counterId), 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  })
})
