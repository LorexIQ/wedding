export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  const requestFetch = useRequestFetch()
  const { authenticated } = await requestFetch('/api/admin/session')
  if (!authenticated) {
    return navigateTo('/admin/login')
  }
})
