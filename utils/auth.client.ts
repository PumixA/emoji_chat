const STORAGE_KEY = 'emoji_chat_user'

export function saveAuthUser(user: Record<string, any>) {
  if (!process.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch (err) {
    console.error('Impossible de sauvegarder l’utilisateur', err)
  }
}

export function getAuthUser<T = Record<string, any>>(): T | null {
  if (!process.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (err) {
    console.error('Impossible de récupérer l’utilisateur', err)
    return null
  }
}

export function clearAuthUser() {
  if (!process.client) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('Impossible de supprimer l’utilisateur', err)
  }
}

export function isLoggedIn(): boolean {
  if (!process.client) return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return !!raw
  } catch (err) {
    console.error('Impossible de vérifier la connexion', err)
    return false
  }
}
