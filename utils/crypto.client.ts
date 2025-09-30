// utils/crypto.client.ts
const emojiArray = [
  "😀","😃","😄","😁","😆","😅","🤣","😂",
  "🙂","🙃","🫠","😉","😇","🥰","😍","🤩",
  "😘","😗","😚","😙","🥲","😋","😛","😈",
  "💀","🤠","💩","🤡","👹","👺","👻","👽",
  "👾","🤖","🐴","😸","🐵","🐒","🦍","🦧",
  "🐶","🐯","🦁","🐩","🐺","🦊","🦝","👜",
  "🦄","🦓","🦌","🦬","🐮","🐂","🐃","🐄",
  "🐷","🎓","🐗","🐽","🐏","🐑","🐐","🐪",
  "🐻","🐨","🐼","🐧","🐸","🐊","🐢","🐲",
  "🪴","🌲","🌳","🌴","🌵","🌾","🌿","🍀",
  "🍁","🍂","🍃","🪹","🍇","🍈","🍉","🍊",
  "🍋","🍌","🍍","🥭","🍎","🎩","🍐","🍑",
  "🍒","🍓","🫐","🥝","🍅","🫒","🥥","🥑",
  "🍆","🥔","🥕","🌽","🌶️","🫑","🥒","🥬",
  "🥦","🧄","🧅","🍄","🥜","🫘","🌰","🍞",
  "🧀","🍔","🍟","🍕","🍘","🍙","🍚","🍜",
  "🍣","🍤","🍥","🥮","🍡","🥟","🥠","🥡",
  "🦀","🦞","🦐","🦑","🦪","🍦","🍧","🍨",
  "🍭","🍮","🍯","🍼","🥛","☕","🫖","🍵",
  "🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖",
  "🏘️","🥤","🧉","🥢","🏢","🏣","🏤","🏥",
  "🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯",
  "🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍",
  "⛩️","🕋","⛲","⛺","🌁","🎃","🎄","🎆",
  "🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍",
  "🎎","🎏","🎐","🎑","🧧","🎀","🎁","🎗️",
  "🎟️","🎖️","🏆","🏅","⚽","🥎","🏀","🏉",
  "🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸",
  "🥊","🥋","🥅","⛳","⛸️","🎣","🤿","🎽",
  "🎿","👓","🕶️","🥽","🥼","🦺","👔","👘",
  "🩱","🩲","🩳","👙","👚","👛","👑","👝",
  "🪖","⛑️","💄","💎","🔇","📣","📯","🏁",
];

const emojiBackref: { [key: string]: number } = emojiArray.reduce((acc, cur, i) => {
  acc[cur] = i; return acc;
}, {} as Record<string, number>);

const SALT_LEN = 16;

export async function encrypt(plaintext: string, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(password, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const result = new Uint8Array(SALT_LEN + iv.length + ciphertext.byteLength);
  result.set(salt);
  result.set(iv, SALT_LEN);
  result.set(new Uint8Array(ciphertext), SALT_LEN + iv.length);

  return Array.from(result).map(b => emojiArray[b]).join('');
}

export async function decrypt(emojiString: string, password: string) {
  const seg = new Intl.Segmenter('en', { granularity: "grapheme" });
  const bytes = new Uint8Array([...seg.segment(emojiString)].map(g => emojiBackref[g.segment] ?? 0));

  const salt = bytes.slice(0, SALT_LEN);
  const iv = bytes.slice(SALT_LEN, SALT_LEN + 12);
  const data = bytes.slice(SALT_LEN + 12);

  const key = await deriveKey(password, salt);

  const plainBuf = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(plainBuf);
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
