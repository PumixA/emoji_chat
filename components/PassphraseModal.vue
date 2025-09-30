<template>
  <div v-if="visible" class="pm-backdrop" @keydown.esc="close" tabindex="-1">
    <div class="pm-modal" role="dialog" aria-modal="true" aria-labelledby="pm-title">
      <h2 id="pm-title">Clé de chiffrement (E2E)</h2>
      <p class="hint">Entre la passphrase partagée pour déchiffrer les messages de la room.</p>

      <label class="label">
        <span>Passphrase</span>
        <input v-model="value" type="password" placeholder="Passphrase" />
      </label>

      <div class="actions">
        <button class="btn" @click="save">Appliquer</button>
        <button class="btn ghost" @click="clearAll">Effacer</button>
        <button class="btn link" @click="close">Fermer</button>
      </div>

      <p v-if="status" class="status">{{ status }}</p>
      <p class="small">Tu peux modifier/effacer la passphrase à tout moment.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
const STORAGE_KEY = 'emoji_chat_passphrase'

const visible = ref(false)
const value = ref('')
const status = ref('')

function open()  { visible.value = true }
function close() { visible.value = false }

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, value.value || '')
    window.dispatchEvent(new CustomEvent('e2e:passphrase-set', { detail: { pass: value.value } }))
    status.value = 'Passphrase appliquée ✔️'
    close()
  } catch {
    status.value = 'Impossible d’enregistrer.'
  }
}

function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    value.value = ''
    window.dispatchEvent(new CustomEvent('e2e:passphrase-cleared'))
    status.value = 'Passphrase effacée.'
  } catch {
    status.value = 'Impossible d’effacer.'
  }
}

function onOpen() { open() }

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) open()
    else value.value = stored
  } catch { open() }
  window.addEventListener('e2e:open-passphrase-modal', onOpen)
})

onBeforeUnmount(() => {
  window.removeEventListener('e2e:open-passphrase-modal', onOpen)
})
</script>

<style scoped>
.pm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1200}
.pm-modal{width:90%;max-width:420px;background:#fff;border-radius:10px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.2)}
.pm-modal h2{margin:0 0 8px;font-size:1.1rem}
.hint{margin:0 0 12px;color:#444;font-size:.95rem}
.label{display:block;margin-bottom:12px}
.label input{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px}
.actions{display:flex;gap:8px;margin-top:8px}
.btn{padding:8px 12px;border-radius:6px;border:none;background:#0b79ff;color:#fff;cursor:pointer}
.btn.ghost{background:#eee;color:#222}
.btn.link{background:transparent;color:#666}
.status{margin-top:8px;color:green;font-size:.9rem}
.small{margin-top:6px;color:#777;font-size:.85rem}
</style>
