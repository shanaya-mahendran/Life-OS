/**
 * Client-side locking for Diary entries.
 *
 * The passphrase never leaves the browser: an AES-GCM key is derived from it
 * with PBKDF2, and only the ciphertext is sent to the server. A locked entry is
 * therefore unreadable by the AI layer (and by anyone with the database).
 *
 * Losing the passphrase means losing the entry — that trade-off is stated in
 * Diary settings before locking is enabled.
 */

const PREFIX = "env:v1:";

export function looksEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(bytes);
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltB64) as unknown as BufferSource,
      iterations: 250_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBody(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

/** Returns the plaintext, or null when the passphrase is wrong. */
export async function decryptBody(key: CryptoKey, payload: string): Promise<string | null> {
  if (!looksEncrypted(payload)) return payload;
  const [, , ivPart, cipherPart] = payload.split(":");
  if (!ivPart || !cipherPart) return null;

  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivPart) as unknown as BufferSource },
      key,
      base64ToBytes(cipherPart) as unknown as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
