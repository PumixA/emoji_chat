<template>
    <div class="chat-container">
      <div v-if="!username" class="auth">
        <input v-model="tempUsername" @keyup.enter="setUsername" placeholder="Votre pseudo" />
        <button @click="setUsername">Rejoindre</button>
      </div>
  
      <div v-else class="chat-room">
        <div class="topbar">
          <input v-model="roomInput" placeholder="Nom de la room (ex: general)" @keyup.enter="changeRoom" />
          <button @click="changeRoom">Rejoindre #{{ roomInput || 'general' }}</button>
        </div>
  
        <h2>Room : #{{ currentRoom || '—' }}</h2>
  
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
  import { ref, nextTick, onBeforeUnmount } from 'vue'
  
  const username = ref('')
  const tempUsername = ref('')
  const roomInput = ref('general')       // room saisie par l'utilisateur
  const currentRoom = ref('')             // room effectivement rejointe
  const messages = ref([])
  const newMessage = ref('')
  const socket = ref(null)
  const messagesContainer = ref(null)
  
  const setUsername = () => {
    const name = (tempUsername.value || '').trim()
    if (!name) return
    username.value = name
    connectWebSocket()
  }
  
  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    socket.value = new WebSocket(`${protocol}//${host}/_ws`)
  
    socket.value.onopen = () => {
      // Rejoindre automatiquement la room saisie
      changeRoom()
    }
  
    socket.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
  
      if (data.type === 'joined') {
        currentRoom.value = data.room
        messages.value = [] // reset à l'entrée d'une room (optionnel)
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
  
  onBeforeUnmount(() => {
    if (socket.value) socket.value.close()
  })
  </script>
  
  <style scoped>
  .chat-container { max-width: 700px; margin: 0 auto; padding: 20px; }
  .auth, .input-area, .topbar { display: flex; gap: 10px; margin: 10px 0; }
  input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
  button { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .messages { height: 400px; overflow-y: auto; border: 1px solid #eee; padding: 10px; margin: 10px 0; background: #fafafa; }
  .message { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .message.system { color: #666; font-size: 0.9em; border-bottom: none; }
  </style>
  