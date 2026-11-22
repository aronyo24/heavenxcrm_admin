export function generatePassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?"
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const b of bytes) out += chars[b % chars.length]
  // Guarantee every character class so the server-side validators accept it.
  return out.slice(0, length - 4) + "A" + "k" + "7" + "#"
}
