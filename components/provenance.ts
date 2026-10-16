import { Extension, Mark, mergeAttributes } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { originForEdit, type SpanOrigin, type TextOrigin } from "../lib/config/provenance.ts"

export const Provenance = Mark.create({
  name: "provenance",
  inclusive: false,
  addAttributes() {
    return {
      origin: {
        default: "human-added",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-origin"),
        renderHTML: (attributes: { origin?: string }) => ({ "data-origin": attributes.origin }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-origin]" }]
  },
  renderHTML({ HTMLAttributes }) {
    const origin = HTMLAttributes["data-origin"]
    return ["span", mergeAttributes(HTMLAttributes, { class: `provenance provenance-${origin}` }), 0]
  },
})

export const ProvenanceTracking = Extension.create<{ trackAs: "human" | "ai" }>({
  name: "provenanceTracking",
  addOptions() {
    return { trackAs: "human" }
  },
  addProseMirrorPlugins() {
    const trackAs = this.options.trackAs
    return [
      new Plugin({
        key: new PluginKey("provenanceTracking"),
        appendTransaction(transactions, _oldState, newState) {
          const markType = newState.schema.marks.provenance
          if (!markType) return null
          const tr = newState.tr
          let changed = false
          transactions.forEach((transaction, transactionIndex) => {
            if (!transaction.docChanged || transaction.getMeta("provenance-source") === "program") return
            transaction.steps.forEach((step, stepIndex) => {
              const before = transaction.docs[stepIndex]
              if (!before) return
              step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
                if (newEnd <= newStart) return
                const affected = affectedOrigins(before, markType, oldStart, oldEnd)
                const origin = originForEdit(trackAs, affected)
                let from = newStart
                let to = newEnd
                for (let later = stepIndex + 1; later < transaction.mapping.maps.length; later += 1) {
                  const laterMap = transaction.mapping.maps[later]
                  from = laterMap.map(from, 1)
                  to = laterMap.map(to, -1)
                }
                for (let laterTransaction = transactionIndex + 1; laterTransaction < transactions.length; laterTransaction += 1) {
                  transactions[laterTransaction].mapping.maps.forEach((laterMap) => {
                    from = laterMap.map(from, 1)
                    to = laterMap.map(to, -1)
                  })
                }
                if (to <= from) return
                tr.removeMark(from, to, markType)
                tr.addMark(from, to, markType.create({ origin }))
                changed = true
              })
            })
          })
          return changed ? tr.setMeta("provenance-source", "program") : null
        },
      }),
    ]
  },
})

function affectedOrigins(doc: ProseMirrorNode, markType: { name: string }, from: number, to: number): SpanOrigin[] {
  if (to > from) {
    const origins: SpanOrigin[] = []
    doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return
      const mark = node.marks.find((item) => item.type.name === markType.name)
      origins.push((mark?.attrs.origin as SpanOrigin | undefined) ?? "untagged")
    })
    return origins
  }
  const mark = doc.resolve(Math.min(from, doc.content.size)).marks().find((item) => item.type.name === markType.name)
  return mark ? [mark.attrs.origin as SpanOrigin] : []
}
