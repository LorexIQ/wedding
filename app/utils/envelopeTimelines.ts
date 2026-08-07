import gsap from 'gsap'
import Physics2DPlugin from 'gsap/Physics2DPlugin'

gsap.registerPlugin(Physics2DPlugin)

/**
 * Хореография открытия конверта. Живёт отдельно от `TheEnvelope.vue`,
 * потому что компонент и без неё крупный (разметка конверта + ~300 строк
 * стилей с clip-path'ами), а тайминги правятся чаще всего остального.
 *
 * Вариант выбран сравнением трёх на временной демо-странице; два
 * отвергнутых («живая бумага» — замах крышки и инерция листа,
 * «кинематографично» — медленный наезд камеры) удалены вместе с ней.
 */

export interface EnvelopeElements {
  /** Крышка конверта, вращается по X. */
  flap: HTMLElement
  /** Конверт целиком: панель, стенка, крышка, письмо внутри. */
  envelope: HTMLElement
  /** Обёртка письма, гасящая отъезд конверта встречным сдвигом. */
  letterClip: HTMLElement
  /** Отдельный узел вторичного движения письма — не трогает компенсацию. */
  letterWobble: HTMLElement
  /** Осколок печати, остающийся на корпусе. */
  sealBody: HTMLElement
  /** Осколок печати, который уносит крышка. */
  sealFlap: HTMLElement
  /** Контент, в который разворачивается письмо. */
  siteWrap: HTMLElement
}

export interface EnvelopeHooks {
  /** Крышка перестаёт быть «поверх» — письмо видно над откинутым флапом. */
  onFlapHandoff: () => void
  /** Конверт тронулся: снимаем с него события мыши. */
  onEnvelopeExit: () => void
  /** Замерить координаты письма и показать контент под FLIP. */
  onFlipStart: () => void
  /** Прочитать замер лениво: на момент сборки timeline ректа ещё нет. */
  flipFrom: () => { x: number, y: number, scaleX: number, scaleY: number }
  /** Сцена доиграла — гейт снимается. */
  onComplete: () => void
}

/** Доля длительности флапа, после которой крышка уходит под письмо. */
const FLAP_HANDOFF_RATIO = 0.48

const FLAP_AT = 0.18
const FLAP_DUR = 0.6
const EXIT_AT = 0.92
const EXIT_DUR = 0.5
/** Письмо осталось одно в кадре — держим паузу, прежде чем тряхнуть его. */
const SHAKE_AT = EXIT_AT + EXIT_DUR + 0.2
const SHAKE_DUR = 0.62
/** Вторая пауза: тряска затихла, кадр замер — и только потом разворот. */
const FLIP_AT = SHAKE_AT + SHAKE_DUR + 0.26
const FLIP_DUR = 0.55

/**
 * Сургуч ломается первым: осколки разлетаются по баллистике и падают,
 * крышка открывается следом, конверт уезжает вниз — и письмо остаётся
 * одно в кадре.
 *
 * Ритм намеренно с паузами: конверт уехал → письмо потряхивает → кадр
 * замирает → и только тогда письмо разворачивается во весь экран. Без
 * этих остановок разворот наезжал на отъезд конверта и кульминация была
 * смазана.
 */
export function buildEnvelopeTimeline(els: EnvelopeElements, hooks: EnvelopeHooks): gsap.core.Timeline {
  const tl = gsap.timeline()

  // Осколки уходят в разные стороны: угол, скорость и вращение — зеркальные.
  tl.to(els.sealFlap, {
    duration: 1.1,
    physics2D: { velocity: 420, angle: -108, gravity: 1100 },
    rotation: -220,
    opacity: 0,
    ease: 'none'
  }, 0)
  tl.to(els.sealBody, {
    duration: 1.1,
    physics2D: { velocity: 360, angle: -66, gravity: 1100 },
    rotation: 190,
    opacity: 0,
    ease: 'none'
  }, 0.04)

  // Крышка идёт следом за разрывом, а не одновременно — иначе разлёт не читается.
  tl.to(els.flap, { rotateX: 178, duration: FLAP_DUR, ease: 'back.out(1.4)' }, FLAP_AT)
  tl.call(hooks.onFlapHandoff, [], FLAP_AT + FLAP_DUR * FLAP_HANDOFF_RATIO)

  // Конверт уезжает вниз, письмо тем же duration/ease гасит сдвиг встречным
  // translateY и остаётся неподвижным: стенка сползает с него сверху вниз.
  tl.to(els.envelope, { y: '100vh', duration: EXIT_DUR, ease: 'power2.in', onStart: hooks.onEnvelopeExit }, EXIT_AT)
  tl.to(els.letterClip, { y: '-100vh', duration: EXIT_DUR, ease: 'power2.in' }, EXIT_AT)

  // Тряска — затухающие колебания по обеим осям сразу: keyframes, а не
  // elastic-возврат из одной точки, потому что качание в одну сторону
  // читается как «отпустили пружину», а не как дрожь листа в воздухе.
  tl.to(els.letterWobble, {
    keyframes: {
      rotate: [0, -2.4, 1.9, -1.3, 0.8, -0.35, 0],
      x: [0, 6, -5, 3.2, -1.8, 0.7, 0],
      easeEach: 'sine.inOut'
    },
    duration: SHAKE_DUR
  }, SHAKE_AT)

  // FLIP: письмо уступает место настоящей странице, снятой на его координаты.
  tl.call(hooks.onFlipStart, [], FLIP_AT)
  tl.fromTo(els.siteWrap,
    {
      x: () => hooks.flipFrom().x,
      y: () => hooks.flipFrom().y,
      scaleX: () => hooks.flipFrom().scaleX,
      scaleY: () => hooks.flipFrom().scaleY
    },
    {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: FLIP_DUR,
      ease: 'back.out(1.4)',
      onComplete: hooks.onComplete
    },
    FLIP_AT)

  return tl
}
