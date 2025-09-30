import { defineNuxtPlugin } from '#app'

const WS_PATH = '/_ws'
const STORAGE_KEY = 'emoji_chat_passphrase'
const DEBUG = true

let encryptText!: (text: string, pass: string) => Promise<string>
let decryptText!: (emojis: string, pass: string) => Promise<string>

type MessagePayload = {
  type?: string
  room?: string
  username?: string
  content?: string
  enc?: boolean
  [k: string]: any
}

function getPassphrase(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
function deriveRoomKey(base: string, room?: string | null) {
  return room ? `${base}::${room}` : base
}
function makeMessageEvent(originalEvt: MessageEvent, newData: any) {
  return new MessageEvent('message', {
    data: typeof newData === 'string' ? newData : JSON.stringify(newData),
    origin: (originalEvt as any).origin ?? window.location.origin,
    lastEventId: originalEvt.lastEventId,
    source: originalEvt.source as any,
    ports: originalEvt.ports as any,
  })
}
function shouldAttemptDecrypt(payload: any): boolean {
  // On ne touche qu’aux messages utilisateur
  if (payload?.type !== 'message') return false
  // Tente si enc === true ... ou si enc est absent mais content est une string
  return typeof payload?.content === 'string'
}
async function tryMultiDecrypt(
  content: string,
  pass: string,
  candidateRooms: Array<string | null | undefined>
): Promise<{ ok: boolean; plain?: string; key?: string }> {
  const tried = new Set<string>()
  for (const r of candidateRooms) {
    const key = r ? `${pass}::${r}` : pass
    if (tried.has(key)) continue
    tried.add(key)
    try {
      const plain = await decryptText(content, key)
      return { ok: true, plain, key }
    } catch {/* continue */}
  }
  return { ok: false }
}

export default defineNuxtPlugin(async () => {
  const mod = await import('~/utils/crypto.client')
  encryptText = mod.encrypt
  decryptText = mod.decrypt

  const NativeWS = window.WebSocket
  const currentRoomMap = new WeakMap<WebSocket, string | null>()
  const onMessageWrapped = new WeakMap<WebSocket, (ev: MessageEvent) => void>()

  class CryptoWS extends NativeWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url as any, protocols as any)

      const isTarget =
        typeof url === 'string' ? url.includes(WS_PATH) : (url as URL).pathname.endsWith(WS_PATH)
      if (!isTarget) return

      currentRoomMap.set(this, null)

      // --- addEventListener('message', handler) ---
      const nativeAdd = this.addEventListener.bind(this)
      this.addEventListener = (type: string, handler: any, options?: any) => {
        if (type !== 'message') return nativeAdd(type, handler, options)

        const wrapped = async (evt: MessageEvent) => {
          const pass = getPassphrase()
          if (!pass) return handler(evt)

          let payload: MessagePayload
          try { payload = JSON.parse(evt.data as any) } catch { return handler(evt) }

          if (payload?.type === 'joined' && typeof payload?.room === 'string') {
            currentRoomMap.set(this, payload.room)
            if (DEBUG) console.debug('[crypto-ws] joined room =', payload.room)
          }

          if (!shouldAttemptDecrypt(payload)) return handler(evt)

          const candidates = [payload?.room, currentRoomMap.get(this), null]
          const res = await tryMultiDecrypt(payload.content as string, pass, candidates)

          if (res.ok) {
            payload.content = res.plain
            payload.enc = false
            if (DEBUG) {
              console.log(`🔑 [crypto-ws] Déchiffrement OK avec clé : "${res.key}"`)
              console.log('✅ [crypto-ws] Message déchiffré :', payload.content)
            }
            return handler(makeMessageEvent(evt, payload))
          }
          return handler(evt) // silencieux si échec (message non chiffré ou mauvaise clé)
        }

        return nativeAdd(type, wrapped as EventListener, options)
      }

      // --- onmessage = handler ---
      Object.defineProperty(this, 'onmessage', {
        configurable: true,
        enumerable: true,
        get: () => (this as any).__crypto_onmessage_original ?? null,
        set: (handler: ((this: WebSocket, ev: MessageEvent) => any) | null) => {
          const prev = onMessageWrapped.get(this)
          if (prev) {
            this.removeEventListener('message', prev as EventListener)
            onMessageWrapped.delete(this)
          }
          ;(this as any).__crypto_onmessage_original = handler
          if (!handler) return

          const wrapped = async (evt: MessageEvent) => {
            const pass = getPassphrase()
            if (!pass) return handler.call(this, evt)

            let payload: MessagePayload
            try { payload = JSON.parse(evt.data as any) } catch { return handler.call(this, evt) }

            if (payload?.type === 'joined' && typeof payload?.room === 'string') {
              currentRoomMap.set(this, payload.room)
              if (DEBUG) console.debug('[crypto-ws] joined room =', payload.room)
            }

            if (!shouldAttemptDecrypt(payload)) return handler.call(this, evt)

            const candidates = [payload?.room, currentRoomMap.get(this), null]
            const res = await tryMultiDecrypt(payload.content as string, pass, candidates)

            if (res.ok) {
              payload.content = res.plain
              payload.enc = false
              if (DEBUG) {
                console.log(`🔑 [crypto-ws] Déchiffrement OK avec clé : "${res.key}"`)
                console.log('✅ [crypto-ws] Message déchiffré :', payload.content)
              }
              return handler.call(this, makeMessageEvent(evt, payload))
            }
            return handler.call(this, evt)
          }

          onMessageWrapped.set(this, wrapped)
          this.addEventListener('message', wrapped as EventListener)
        },
      })

      // --- send() ---
      const nativeSend = this.send.bind(this)
      this.send = async (data: any) => {
        const pass = getPassphrase()
        if (!pass) return nativeSend(data)
        if (typeof data !== 'string') return nativeSend(data)

        let payload: MessagePayload
        try { payload = JSON.parse(data) } catch { return nativeSend(data) }

        if (payload?.type === 'join' && typeof payload?.room === 'string') {
          currentRoomMap.set(this, payload.room)
        }

        if (payload?.type === 'message' && typeof payload?.content === 'string' && !payload?.enc) {
          try {
            const room = currentRoomMap.get(this) ?? payload.room
            const roomKey = deriveRoomKey(pass, room)
            if (DEBUG) console.log(`🔐 [crypto-ws] Chiffrement avec clé : "${roomKey}"`)
            payload.content = await encryptText(payload.content, roomKey)
            payload.enc = true
            return nativeSend(JSON.stringify(payload))
          } catch {
            return nativeSend(data)
          }
        }
        return nativeSend(data)
      }
    }
  }

  ;(window as any).WebSocket = CryptoWS
})
