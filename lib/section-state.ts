import type { DocSection, SectionState } from "./mock-data"

// Per the versioning architecture, each section carries five independent states.
// They are derived from source fields rather than stored in one overloaded status.
export type DependencyHealth = "Current" | "Potentially Stale" | "Regeneration Available"

export interface SectionStateModel {
  canonical: string
  working: "Clean" | "Modified"
  review: string | null
  generation: string
  dependencyHealth: DependencyHealth
  staleReasons: string[]
}

export function sectionStateModel(s: DocSection): SectionStateModel {
  const changed = s.dependencies.filter((d) => d.state === "Changed")
  return {
    canonical: s.canonicalVersion,
    working: s.workingState === "Modified" ? "Modified" : "Clean",
    review: s.changeSet,
    generation: s.generation,
    dependencyHealth: changed.length ? (s.proposalReady ? "Regeneration Available" : "Potentially Stale") : "Current",
    staleReasons: changed.map((d) => `${d.name} changed from ${d.generatedWith} → ${d.current} after this content was generated.`),
  }
}

// Compact summary used only for the outline dot; the full model is shown in the State panel.
export function primaryState(s: DocSection): SectionState {
  if (s.dependencies.some((d) => d.state === "Changed")) return "Potentially Stale"
  if (s.changeSet) return "Change Set Open"
  if (s.workingState === "Modified") return "Working Changes"
  return "Current"
}

// Deterministic, non-cryptographic stand-in for SHA-256 so fingerprints are stable across renders.
export function shortHash(input: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822507) >>> 0
  }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 12)
  return `${hex.slice(0, 4)}…${hex.slice(-3)}`
}

export function dependencyFingerprint(deps: { name: string; version: string }[]) {
  const canonical = deps
    .map((d) => `${d.name.toLowerCase().replace(/\s+/g, "_")}:${d.version.replace("V", "")}`)
    .sort()
    .join("|")
  return { input: canonical || "(no dependencies)", hash: `sha256:${shortHash(canonical)}` }
}

export function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function paragraphs(html: string): string[] {
  const matches = html.match(/<(p|h[1-6])[^>]*>[\s\S]*?<\/\1>/g)
  return matches ?? (html.trim() ? [html] : [])
}
