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
