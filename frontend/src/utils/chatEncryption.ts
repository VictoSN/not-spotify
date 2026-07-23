/**
 * ─────────────────────────────────────────────────────────────────────────────
 * END-TO-END CHAT ENCRYPTION — REFERENCE IMPLEMENTATION (NOT ACTIVE YET)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chat currently does not use END-TO-END encryption. HTTPS/WSS protects bodies
 * in transit, and the API uses AES-256-GCM encryption at rest in PostgreSQL.
 * The API can still read plaintext. This file documents a possible future E2E
 * design (WhatsApp-style, simplified). Everything below is intentionally
 * commented out; the matching server-side shape is sketched in
 * backend Models/ChatMessage.cs.
 *
 * Design (ECDH + AES-GCM via the browser WebCrypto API — no extra npm needed):
 *
 *  1. Key pairs    — each user generates an ECDH P-256 (or X25519) key pair on
 *                    first login. Private key stays on-device (IndexedDB,
 *                    non-extractable). Public key is published to the server.
 *  2. Shared key   — for a conversation A↔B, both sides derive the SAME secret:
 *                    ECDH(myPrivate, theirPublic) → HKDF → AES-256-GCM key.
 *  3. Encrypt      — per message: fresh random 12-byte IV, AES-GCM encrypt,
 *                    send { ciphertext, iv, authTag } instead of plaintext.
 *  4. Decrypt      — recipient derives the same key and reverses it.
 *  5. Server role  — stores/routes opaque ciphertext only; cannot read bodies.
 *
 * Caveats to handle when implementing for real:
 *  - Multi-device: per-device keys or encrypted key backup.
 *  - Key change / re-install: re-keying + "safety number changed" warnings.
 *  - History: old ciphertext can't be read by new devices without key transfer.
 */

// ── 1. Key pair generation (once per user/device) ───────────────────────────
//
// export async function generateKeyPair(): Promise<CryptoKeyPair> {
//   return crypto.subtle.generateKey(
//     { name: 'ECDH', namedCurve: 'P-256' },
//     false, // non-extractable private key — cannot leave the device
//     ['deriveKey'],
//   )
// }
//
// export async function exportPublicKey(pair: CryptoKeyPair): Promise<string> {
//   const raw = await crypto.subtle.exportKey('raw', pair.publicKey)
//   return btoa(String.fromCharCode(...new Uint8Array(raw)))
//   // → POST /me/chat-keys { publicKey } so friends can fetch it
// }

// ── 2. Shared conversation key (ECDH → AES-GCM) ─────────────────────────────
//
// export async function deriveSharedKey(
//   myPrivateKey: CryptoKey,
//   theirPublicKeyB64: string,
// ): Promise<CryptoKey> {
//   const theirRaw = Uint8Array.from(atob(theirPublicKeyB64), (c) => c.charCodeAt(0))
//   const theirPublicKey = await crypto.subtle.importKey(
//     'raw', theirRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
//   )
//   return crypto.subtle.deriveKey(
//     { name: 'ECDH', public: theirPublicKey },
//     myPrivateKey,
//     { name: 'AES-GCM', length: 256 },
//     false,
//     ['encrypt', 'decrypt'],
//   )
// }

// ── 3. Encrypt before sending (chatService.send) ────────────────────────────
//
// export async function encryptMessage(
//   sharedKey: CryptoKey,
//   plaintext: string,
// ): Promise<{ cipherTextB64: string; ivB64: string }> {
//   const iv = crypto.getRandomValues(new Uint8Array(12)) // NEVER reuse an IV per key
//   const encoded = new TextEncoder().encode(plaintext)
//   const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded)
//   return {
//     cipherTextB64: btoa(String.fromCharCode(...new Uint8Array(cipher))), // includes GCM auth tag
//     ivB64: btoa(String.fromCharCode(...iv)),
//   }
// }

// ── 4. Decrypt after receiving (socket handler / thread load) ───────────────
//
// export async function decryptMessage(
//   sharedKey: CryptoKey,
//   cipherTextB64: string,
//   ivB64: string,
// ): Promise<string> {
//   const cipher = Uint8Array.from(atob(cipherTextB64), (c) => c.charCodeAt(0))
//   const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
//   const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, cipher)
//   return new TextDecoder().decode(plain)
// }

// Placeholder export so the module is valid while everything is commented out.
export const CHAT_ENCRYPTION_ENABLED = false
