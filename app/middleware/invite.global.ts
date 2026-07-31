export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/admin')) return
  if (to.path.startsWith('/invite/')) return
  if (to.path === '/not-invited') return

  const inviteCode = useInviteCode()
  if (!inviteCode.value) {
    return navigateTo('/not-invited')
  }

  const requestFetch = useRequestFetch()
  try {
    const guest = await requestFetch(`/api/invite/${encodeURIComponent(inviteCode.value)}`)
    // Assign explicitly on every run, not just the first. useState()'s initializer only
    // runs once per key, so a second client-side visit (a different invite link opened
    // in the same session) would otherwise keep the first guest's stale data even though
    // the cookie and /api/rsvp now point at a different guest.
    useState('inviteGuest').value = guest
  } catch {
    return navigateTo('/not-invited')
  }
})
