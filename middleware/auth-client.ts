import { isLoggedIn } from '~/utils/auth.client'

export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  if (!isLoggedIn()) {
    return navigateTo('/login')
  }
})
