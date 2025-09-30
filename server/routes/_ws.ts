// server/routes/_ws.ts
type Peer = any

const rooms = new Map<string, Set<Peer>>() // room -> clients
const peerRoom = new WeakMap<Peer, string>() // peer -> room
const clients = new Set<Peer>() // optionnel: suivi global

function joinRoom(peer: Peer, room: string) {
  // retirer d'une éventuelle ancienne room
  const old = peerRoom.get(peer)
  if (old && rooms.has(old)) {
    rooms.get(old)!.delete(peer)
    if (rooms.get(old)!.size === 0) rooms.delete(old)
  }

  // ajouter à la nouvelle room
  if (!rooms.has(room)) rooms.set(room, new Set())
  
  const roomClients = rooms.get(room)!
  
  // Vérifier la limite de 2 connexions
  if (roomClients.size >= 2) {
    // Envoyer une erreur au client
    peer.send(JSON.stringify({
      type: 'error',
      message: 'Room pleine (maximum 2 personnes)',
      room,
      timestamp: new Date().toISOString()
    }))
    return false
  }
  
  roomClients.add(peer)
  peerRoom.set(peer, room)
  return true
}

function broadcastToRoom(room: string, payload: any) {
  const set = rooms.get(room)
  if (!set) return
  const msg = JSON.stringify(payload)
  set.forEach(p => {
    try { p.send(msg) } catch {}
  })
}

export default defineWebSocketHandler({
  open(peer) {
    clients.add(peer)
    // Optionnel : ping/heartbeat si besoin
    // peer.subscribe?.('ping') ...
  },

  message(peer, message) {
    try {
      const data = JSON.parse(message.text().toString())

      // 1) Rejoindre / créer une room
      if (data.type === 'join' && typeof data.room === 'string' && data.username) {
        const room = data.room.trim()
        if (!room) return

        const success = joinRoom(peer, room)
        
        if (success) {
          // message système à la room
          broadcastToRoom(room, {
            type: 'system',
            content: `${data.username} a rejoint #${room}`,
            room,
            timestamp: new Date().toISOString()
          })

          // ack au peer
          peer.send(JSON.stringify({
            type: 'joined',
            room,
            timestamp: new Date().toISOString()
          }))
        }
        // Si échec, l'erreur est déjà envoyée par joinRoom()
        return
      }

      // 2) Message chat classique => diffuser dans la room du peer
      if (data.type === 'message' && data.content) {
        const room = peerRoom.get(peer)
        if (!room) {
          // si pas de room, ignorer ou renvoyer une erreur
          peer.send(JSON.stringify({ type: 'error', message: 'Join a room first' }))
          return
        }
        const chatMessage = {
          type: 'message',
          username: data.username ?? 'Anonyme',
          content: data.content,
          room,
          timestamp: new Date().toISOString()
        }
        broadcastToRoom(room, chatMessage)
      }

      // 3) (Optionnel) typing, etc.
      if (data.type === 'typing') {
        const room = peerRoom.get(peer)
        if (room) {
          broadcastToRoom(room, {
            type: 'typing',
            username: data.username,
            room,
            timestamp: new Date().toISOString()
          })
        }
      }
    } catch (err) {
      console.error('Erreur message WS:', err)
      try { peer.send(JSON.stringify({ type: 'error', message: 'Invalid payload' })) } catch {}
    }
  },

  close(peer) {
    clients.delete(peer)
    const room = peerRoom.get(peer)
    if (room && rooms.has(room)) {
      rooms.get(room)!.delete(peer)
      if (rooms.get(room)!.size === 0) rooms.delete(room)
      // On peut notifier la room si on a stocké le username côté peer (simple ici : non)
      // broadcastToRoom(room, { type: 'system', content: 'Un utilisateur a quitté', room, timestamp: new Date().toISOString() })
    }
    peerRoom.delete(peer)
  }
})
