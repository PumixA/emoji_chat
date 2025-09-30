<template>
  <div class="auth-page">
    <h1>Créer un compte</h1>
    <form class="auth-form" @submit.prevent="onSubmit">
      <label>
        Email
        <input v-model="email" type="email" placeholder="email@example.com" required />
      </label>
      <label>
        Nom d’utilisateur
        <input v-model="username" type="text" placeholder="Votre pseudo" required />
      </label>
      <label>
        Mot de passe
        <input v-model="password" type="password" placeholder="Minimum 6 caractères" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Création en cours…' : 'Créer un compte' }}
      </button>
    </form>
    <p class="switch">Déjà inscrit ? <NuxtLink to="/login">Se connecter</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { saveAuthUser } from '~/utils/auth.client'

const email = ref('')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()

async function onSubmit() {
  if (loading.value) return
  error.value = ''

  if (!email.value || !username.value || !password.value) {
    error.value = 'Tous les champs sont requis.'
    return
  }

  loading.value = true
  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value,
        username: username.value,
        password: password.value
      }
    })

    if (!response.success) {
      error.value = response.error || 'Impossible de créer le compte.'
      return
    }

    saveAuthUser(response.user)
    await router.push('/')
  } catch (err) {
    console.error(err)
    error.value = 'Erreur inattendue. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  max-width: 420px;
  margin: 60px auto;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e1e5e9;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 18px;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.95rem;
  color: #334155;
  gap: 6px;
}

input {
  padding: 10px;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
  font-size: 1rem;
}

button {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  background: #1d4ed8;
}

.error {
  color: #b91c1c;
  font-size: 0.9rem;
}

.switch {
  margin-top: 16px;
  text-align: center;
}

.switch a {
  color: #2563eb;
}
</style>
