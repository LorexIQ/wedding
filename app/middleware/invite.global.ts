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
    const guest = await requestFetch(`/api/invite/${inviteCode.value}`)
    useState('inviteGuest', () => guest)
  } catch {
    return navigateTo('/not-invited')
  }
})
