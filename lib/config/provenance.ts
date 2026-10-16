/** How a span of document text was produced. Untagged text has not been edited in this session. */
export type TextOrigin = "ai" | "human-added" | "human-modified"
export type SpanOrigin = TextOrigin | "untagged"

export interface ProvenanceTally {
  ai: number
  humanAdded: number
  humanModified: number
}

/**
 * A human insert with nothing before it is human-added.
 * A human change to AI text, already modified text, or untagged text is human-modified.
 * An editor that is recording model output marks every insert as AI.
 */
export function originForEdit(trackAs: "human" | "ai", affected: SpanOrigin[]): TextOrigin {
  if (trackAs === "ai") return "ai"
  if (affected.length === 0 || affected.every((origin) => origin === "human-added")) return "human-added"
  return "human-modified"
}

/** Counts characters inside provenance spans. Untagged text is omitted. */
export function tallyProvenance(content: string): ProvenanceTally {
  const tally: ProvenanceTally = { ai: 0, humanAdded: 0, humanModified: 0 }
  const pattern = /<span\b[^>]*\bdata-origin="(ai|human-added|human-modified)"[^>]*>([\s\S]*?)<\/span>/g
  for (const match of content.matchAll(pattern)) {
    const text = match[2].replace(/<[^>]+>/g, "")
    if (match[1] === "ai") tally.ai += text.length
    else if (match[1] === "human-added") tally.humanAdded += text.length
    else tally.humanModified += text.length
  }
  return tally
}
