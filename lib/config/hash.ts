/** Stable fingerprint for manifests and content. Not a cryptographic digest. */
export function fingerprint(value: unknown): string {
  const input = typeof value === "string" ? value : JSON.stringify(value)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822507) >>> 0
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 12)
}

export function contentHash(content: string): string {
  return `fp:${fingerprint(content)}`
}
