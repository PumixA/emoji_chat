<template>
  <div class="chat-container">
    <div v-if="!username" class="auth">
      <input v-model="tempUsername" @keyup.enter="setUsername" placeholder="Votre pseudo" />
      <button @click="setUsername">Rejoindre</button>
    </div>

    <div v-else class="chat-room">
      <!-- Topbar: choix de la room (depuis main) -->
      <div class="topbar">
        <ClientOnly>
          <select name="room-select" id="room-select" v-model="roomInput" @change="changeRoom">
            <option v-for="room in defaultRooms" :key="room.id" :value="room.name">
              {{ room.emoji }} {{ room.name }}
            </option>
          </select>
        </ClientOnly>
      </div>

      <!-- Topbar: passphrase E2E (depuis features/chiffrement) -->
      <div class="topbar">
        <input
          v-model="passphraseInput"
          type="password"
          placeholder="Passphrase E2E"
          @keyup.enter="applyPassphrase"
        />
        <button @click="applyPassphrase">Appliquer</button>
        <span :class="['badge', passphraseActive ? 'ok' : 'nok']">
          <template v-if="passphraseActive">🔒 Passphrase active</template>
          <template v-else>🔓 Aucune passphrase</template>
        </span>
        <button class="btn ghost" @click="openModal">Changer via modale</button>
      </div>

      <h2>
        Room : {{ currentRoom || '—' }}
        <span class="room-status">(2/2 places)</span>
      </h2>

      <div class="messages" ref="messagesContainer">
        <div v-for="(msg, i) in messages" :key="i" class="message" :class="msg.type">
          <template v-if="msg.type === 'system'">
            <em>🛈 {{ msg.content }}</em>
          </template>
          <template v-else-if="msg.type === 'message'">
            <strong>{{ msg.username }}:</strong> {{ msg.content }}
          </template>
        </div>
      </div>

      <div class="input-area" v-if="currentRoom">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          placeholder="Tapez votre message..."
        />
        <button @click="sendMessage">Envoyer</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount, onMounted } from 'vue'

const username = ref('')
const tempUsername = ref('')

// Rooms (depuis main)
const roomInput = ref('Général')
const currentRoom = ref('Général')
const defaultRooms = ref([])

// Messages / socket
const messages = ref([])
const newMessage = ref('')
const socket = ref(null)
const messagesContainer = ref(null)

// Passphrase (depuis features/chiffrement)
const STORAGE_KEY = 'emoji_chat_passphrase'
const passphraseInput = ref('')
const passphraseActive = ref(false)

// ---- API Rooms (main)
const getRooms = async () => {
  try {
    const response = await $fetch('/api/rooms')
    if (response.success) {
      defaultRooms.value = response.rooms
      // Sélectionner "Général" par défaut si dispo
      const generalRoom = response.rooms.find(room => room.name === 'Général')
      if (generalRoom) {
        roomInput.value = generalRoom.name
        currentRoom.value = generalRoom.name
      }
    } else {
      console.error('Erreur lors de la récupération des rooms:', response.error)
    }
  } catch (error) {
    console.error('Erreur API:', error)
  }
}

// ---- Auth
const setUsername = () => {
  const name = (tempUsername.value || '').trim()
  if (!name) return
  username.value = name
  connectWebSocket()
}

// ---- WebSocket
const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  socket.value = new WebSocket(`${protocol}//${host}/_ws`)

  socket.value.onopen = () => {
    changeRoom()
  }

  socket.value.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === 'joined') {
      // Sur confirmation, on peut mettre à jour la room si le serveur la renvoie
      if (data.room) currentRoom.value = data.room
      messages.value = [] // reset à l'entrée d'une room (optionnel)
      return
    }

    if (data.type === 'error') {
      // Afficher l'erreur (room pleine, etc.)
      messages.value.push({
        type: 'system',
        content: `❌ ${data.message}`,
        timestamp: data.timestamp
      })
      scrollToBottom()
      return
    }

    // N'afficher que les messages de la room courante
    if (data.room && data.room !== currentRoom.value) return

    messages.value.push(data)
    scrollToBottom()
  }

  socket.value.onclose = () => {
    // (Optionnel) tentative de reconnexion simple
    // setTimeout(connectWebSocket, 1000)
  }
}

const changeRoom = () => {
  const room = (roomInput.value || '').trim()
  currentRoom.value = room
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) return
  if (!room) return
  socket.value.send(JSON.stringify({
    type: 'join',
    room,
    username: username.value
  }))
}

const sendMessage = () => {
  const message = newMessage.value.trim()
  if (!message || socket.value?.readyState !== WebSocket.OPEN || !currentRoom.value) return
  socket.value.send(JSON.stringify({
    type: 'message',
    room: currentRoom.value,
    username: username.value,
    content: message
  }))
  newMessage.value = ''
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

onMounted(() => {
  // Rooms (main)
  getRooms()
  // Passphrase (features)
  try {
    const v = localStorage.getItem(STORAGE_KEY) || ''
    passphraseInput.value = v
    passphraseActive.value = !!v
  } catch {
    // rien
  }
  // sync cross-onglets & events app
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const v = e.newValue || ''
      passphraseInput.value = v
      passphraseActive.value = !!v
    }
  })
  window.addEventListener('e2e:passphrase-set', (e) => {
    const v = e?.detail?.pass || ''
    passphraseInput.value = v
    passphraseActive.value = !!v
  })
  window.addEventListener('e2e:passphrase-cleared', () => {
    passphraseInput.value = ''
    passphraseActive.value = false
  })
})

onBeforeUnmount(() => {
  if (socket.value) socket.value.close()
})

// ---- Passphrase UI
function applyPassphrase() {
  const v = passphraseInput.value || ''
  localStorage.setItem(STORAGE_KEY, v)
  passphraseActive.value = !!v
  window.dispatchEvent(new CustomEvent('e2e:passphrase-set', { detail: { pass: v } }))
  console.log('[UI] Passphrase appliquée.')
}

function openModal() {
  window.dispatchEvent(new CustomEvent('e2e:open-passphrase-modal'))
}
</script>

<style scoped>
.chat-container { max-width: 700px; margin: 0 auto; padding: 20px; }
.auth, .input-area, .topbar { display: flex; gap: 10px; margin: 10px 0; }
input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }

select {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  background: white;
  font-size: 16px;
  font-weight: 500;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

select:hover {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

select:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

select option {
  padding: 10px 16px;
  font-size: 16px;
  font-weight: 500;
}

button { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn.ghost { background:#eee; color:#222; }

.messages {
  height: 400px;
  overflow-y: auto;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: #fafafa;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
}
.message {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 15px;
  line-height: 1.4;
}
.message.system {
  color: #666;
  font-size: 0.9em;
  border-bottom: none;
  font-style: italic;
}

h2 {
  color: #2d3748;
  margin: 16px 0;
  font-size: 1.4em;
  font-weight: 600;
}
.room-status {
  color: #666;
  font-size: 0.8em;
  font-weight: 400;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
}

/* Badge état passphrase */
.badge { align-self: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; line-height: 1; border: 1px solid #ddd; white-space: nowrap; }
.badge.ok  { background: #e8f6ec; color: #0a7f3f; border-color: #bfe7cf; }
.badge.nok { background: #fff3f0; color: #a73a1a; border-color: #ffd6cc; }
</style>

