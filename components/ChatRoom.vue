<template>
  <div class="chat-container">
    <div v-if="!username" class="auth">
      <input v-model="tempUsername" @keyup.enter="setUsername" placeholder="Votre pseudo" />
      <button @click="setUsername">Rejoindre</button>
    </div>

    <div v-else class="chat-room">
      <div class="topbar">
        <input v-model="roomInput" placeholder="Room (ex: general)" @keyup.enter="changeRoom" />
        <button @click="changeRoom">Rejoindre #{{ roomInput || 'general' }}</button>
      </div>

      <div class="topbar">
        <input v-model="passphraseInput" type="password" placeholder="Passphrase E2E" @keyup.enter="applyPassphrase" />
        <button @click="applyPassphrase">Appliquer</button>
        <span :class="['badge', passphraseActive ? 'ok' : 'nok']">
          <template v-if="passphraseActive">🔒 Passphrase active</template>
          <template v-else>🔓 Aucune passphrase</template>
        </span>
        <button class="btn ghost" @click="openModal">Changer via modale</button>
      </div>

      <h2>Room : #{{ currentRoom || '—' }}</h2>

      <div class="messages" ref="messagesContainer">
        <div v-for="(msg, i) in messages" :key="i" class="message" :class="msg.type">
          <template v-if="msg.type === 'system'"><em>🛈 {{ msg.content }}</em></template>
          <template v-else><strong>{{ msg.username }}:</strong> {{ msg.content }}</template>
        </div>
      </div>

      <div class="input-area" v-if="currentRoom">
        <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Message..." />
        <button @click="sendMessage">Envoyer</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
type ChatMsg = { type: 'system' | 'message'; username?: string; content: string; room?: string; enc?: boolean; [k: string]: any }

const username = ref(''); const tempUsername = ref(''); const roomInput = ref('general')
const currentRoom = ref(''); const messages = ref<ChatMsg[]>([]); const newMessage = ref('')
const socket = ref<WebSocket | null>(null); const messagesContainer = ref<HTMLDivElement | null>(null)

const STORAGE_KEY = 'emoji_chat_passphrase'
const passphraseInput = ref(''); const passphraseActive = ref(false)

onMounted(() => {
  try { const v = localStorage.getItem(STORAGE_KEY) || ''; passphraseInput.value = v; passphraseActive.value = !!v } catch {}
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) { const v = e.newValue || ''; passphraseInput.value = v; passphraseActive.value = !!v }
  })
  window.addEventListener('e2e:passphrase-set', (e: any) => { const v = e.detail?.pass || ''; passphraseInput.value = v; passphraseActive.value = !!v })
  window.addEventListener('e2e:passphrase-cleared', () => { passphraseInput.value = ''; passphraseActive.value = false })
})

function openModal() { window.dispatchEvent(new CustomEvent('e2e:open-passphrase-modal')) }

function applyPassphrase() {
  const v = passphraseInput.value || ''
  localStorage.setItem(STORAGE_KEY, v)
  passphraseActive.value = !!v
  window.dispatchEvent(new CustomEvent('e2e:passphrase-set', { detail: { pass: v } }))
  console.log('[UI] Passphrase appliquée.')
}

const setUsername = () => { const name = (tempUsername.value || '').trim(); if (!name) return; username.value = name; connectWebSocket() }

const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  socket.value = new WebSocket(`${protocol}//${host}/_ws`)
  socket.value.onopen = () => changeRoom()
  socket.value.onmessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data) as ChatMsg
    if (data.type === 'joined') { currentRoom.value = (data as any).room || ''; messages.value = []; return }
    if ((data as any).room && (data as any).room !== currentRoom.value) return
    messages.value.push(data); scrollToBottom()
  }
}
const changeRoom = () => {
  const room = (roomInput.value || '').trim()
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN || !room) return
  socket.value.send(JSON.stringify({ type: 'join', room, username: username.value }))
}
const sendMessage = () => {
  const message = newMessage.value.trim()
  if (!message || socket.value?.readyState !== WebSocket.OPEN || !currentRoom.value) return
  socket.value.send(JSON.stringify({ type: 'message', room: currentRoom.value, username: username.value, content: message }))
  newMessage.value = ''
}
const scrollToBottom = () => nextTick(() => { if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight })
onBeforeUnmount(() => { socket.value?.close() })
</script>

<style scoped>
.chat-container { max-width: 700px; margin: 0 auto; padding: 20px; }
.auth, .input-area, .topbar { display: flex; gap: 10px; margin: 10px 0; }
input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
button { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn.ghost { background:#eee; color:#222; }
.messages { height: 400px; overflow-y: auto; border: 1px solid #eee; padding: 10px; margin: 10px 0; background: #fafafa; }
.message { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
.message.system { color: #666; font-size: 0.9em; border-bottom: none; }
.badge { align-self: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; line-height: 1; border: 1px solid #ddd; white-space: nowrap; }
.badge.ok  { background: #e8f6ec; color: #0a7f3f; border-color: #bfe7cf; }
.badge.nok { background: #fff3f0; color: #a73a1a; border-color: #ffd6cc; }
</style>
