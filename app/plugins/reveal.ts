/**
 * Директива `v-reveal`: секция всплывает, когда доезжает до экрана.
 *
 * Ключевое требование — содержимое обязано появиться при любом раскладе.
 * Скрытие делается только тогда, когда есть чем его снять: без
 * IntersectionObserver и при `prefers-reduced-motion` класс не вешается
 * вовсе, а если наблюдатель почему-то молчит, срабатывает страховка.
 * Пустая страница хуже страницы без анимации.
 */

interface RevealElement extends HTMLElement {
  _revealCleanup?: () => void
}

const GUARD_MS = 1500

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    // Без этого Vue ругается на неизвестную директиву при рендере на сервере.
    getSSRProps: () => ({}),

    mounted(el: RevealElement, binding) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced || typeof IntersectionObserver === 'undefined') return

      el.classList.add('reveal')

      if (typeof binding.value === 'number') {
        el.style.setProperty('--reveal-delay', `${binding.value}ms`)
      }

      let shown = false
      let observerResponded = false
      let guard: ReturnType<typeof setTimeout> | undefined

      function show() {
        if (shown) return
        shown = true
        el.classList.add('is-revealed')
        cleanup()
      }

      const observer = new IntersectionObserver((entries) => {
        // Наблюдатель отзывается сразу после observe(), даже если
        // элемент за экраном. Этот первый вызов и подтверждает, что он жив.
        observerResponded = true
        for (const entry of entries) {
          if (entry.isIntersecting) show()
        }
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -70px 0px'
      })

      observer.observe(el)

      function armGuard() {
        guard = setTimeout(() => {
          if (!observerResponded) show()
        }, GUARD_MS)
      }

      // В фоновой вкладке наблюдатель не отзывается, пока на неё не
      // переключатся, — а ссылку из мессенджера открывают именно так.
      // Ждём переключения, чтобы гость всё-таки увидел анимацию.
      function onVisible() {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVisible)
          armGuard()
        }
      }

      if (document.visibilityState === 'visible') {
        armGuard()
      } else {
        document.addEventListener('visibilitychange', onVisible)
      }

      function cleanup() {
        observer.disconnect()
        if (guard) clearTimeout(guard)
        document.removeEventListener('visibilitychange', onVisible)
      }

      el._revealCleanup = cleanup
    },

    unmounted(el: RevealElement) {
      el._revealCleanup?.()
    }
  })
})
