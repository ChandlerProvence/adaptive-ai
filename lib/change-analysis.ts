import { paragraphs, plainText } from "./section-state"

export const CHANGE_CLASSES = ["Editorial", "Clarifying", "Contextual", "Semantic", "Structural", "Conflicting"] as const
export type ChangeClass = (typeof CHANGE_CLASSES)[number]

export const CLASS_HELP: Record<ChangeClass, string> = {
  Editorial: "Grammar, formatting, wording",
  Clarifying: "Improves clarity without changing meaning",
  Contextual: "Adds relevant context",
  Semantic: "Changes meaning or conclusions",
  Structural: "Adds, removes, or reorganizes sections",
  Conflicting: "Introduces a contradiction",
}

export interface DeterministicDiff {
  added: number
  removed: number
  paragraphsAdded: number
  paragraphsModified: number
  paragraphsRemoved: number
  baseHtml: string
  candidateHtml: string
}

function words(s: string) {
  return plainText(s).split(" ").filter(Boolean)
}

// Paragraph-level structural diff with suffix highlighting for appended sentences.
export function deterministicDiff(base: string, candidate: string): DeterministicDiff {
  const bp = paragraphs(base)
  const cp = paragraphs(candidate)
  const baseText = bp.map(plainText)
  let added = 0
  let removed = 0
  let paragraphsAdded = 0
  let paragraphsModified = 0

  const matchedBase = new Set<number>()
  const candOut = cp.map((p) => {
    const t = plainText(p)
    const exact = baseText.indexOf(t)
    if (exact >= 0) {
      matchedBase.add(exact)
      return p
    }
    const prefix = baseText.findIndex((b, i) => !matchedBase.has(i) && b.length > 20 && t.startsWith(b))
    if (prefix >= 0) {
      matchedBase.add(prefix)
      paragraphsModified++
      const suffix = t.slice(baseText[prefix].length).trim()
      added += words(suffix).length
      const tag = p.match(/^<(\w+)/)?.[1] ?? "p"
      return `<${tag}>${baseText[prefix]} <span class="diff-add">${suffix}</span></${tag}>`
    }
    paragraphsAdded++
    added += words(t).length
    return p.replace(/^<(\w+)([^>]*)>/, '<$1$2 class="diff-add">')
  })

  const baseOut = bp.map((p, i) => {
    if (matchedBase.has(i)) return p
    removed += words(p).length
    return p.replace(/^<(\w+)([^>]*)>/, '<$1$2 class="diff-del">')
  })
  const paragraphsRemoved = bp.length - matchedBase.size

  return {
    added,
    removed,
    paragraphsAdded,
    paragraphsModified,
    paragraphsRemoved,
    baseHtml: baseOut.join(""),
    candidateHtml: candOut.join(""),
  }
}

export interface AiAnalysis {
  classes: ChangeClass[]
  material: { text: string; cls: ChangeClass; confidence: number }[]
  editorial: string[]
  conflicts: string[]
  downstream: { section: string; reason: string }[]
  summary: string
}

const CANNED: Record<string, AiAnalysis> = {
  "sec-narrative": {
    summary: "Adds decision-relevance framing, an evidence caveat, and a new data residency dependency.",
    classes: ["Clarifying", "Contextual", "Semantic", "Editorial"],
    material: [
      { text: "Identifies source disagreement as the single most decision-relevant point of contention.", cls: "Semantic", confidence: 0.86 },
      { text: "Introduces an under-evidenced regulatory-friction claim resting on a single source.", cls: "Contextual", confidence: 0.81 },
      { text: "Adds customer data residency as a constraint on any entry approach.", cls: "Semantic", confidence: 0.92 },
    ],
    editorial: ['"buyer" → "customer" for terminology consistency.'],
    conflicts: [],
    downstream: [
      { section: "Recommendation", reason: "Data residency may change the viability of Alternative B." },
      { section: "Executive Summary", reason: "The decision-relevance framing should be reflected in the summary." },
    ],
  },
  "sec-constraints": {
    summary: "Adds a regulatory approval lead time that tightens any parallel-entry timeline.",
    classes: ["Contextual", "Semantic"],
    material: [
      { text: "Secondary-market regulatory approval carries an estimated six-month lead time.", cls: "Semantic", confidence: 0.9 },
    ],
    editorial: [],
    conflicts: ["May conflict with Alternatives V3, which assumes parallel launch in month 4."],
    downstream: [
      { section: "Alternatives", reason: "Alternative B timing assumes no regulatory lead time." },
      { section: "Risk Assessment", reason: "Execution risk for parallel entry likely increases." },
      { section: "Recommendation", reason: "Could further weaken the case for Alternative B." },
    ],
  },
}

export function aiAnalysis(sectionId: string, diff: DeterministicDiff, dependents: string[]): AiAnalysis {
  if (CANNED[sectionId]) return CANNED[sectionId]
  const big = diff.added + diff.removed > 25
  return {
    summary: big ? "Substantive content revision." : "Minor wording revision.",
    classes: big ? ["Contextual", "Semantic"] : ["Editorial"],
    material: big ? [{ text: "Content added that may change the section's conclusions.", cls: "Semantic", confidence: 0.64 }] : [],
    editorial: big ? [] : ["Wording changes with no expected impact on meaning."],
    conflicts: [],
    downstream: dependents.map((d) => ({ section: d, reason: big ? "Consumes this section's conclusions." : "Low expected impact." })),
  }
}
