"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { cn } from "@/lib/utils"
import { Provenance, ProvenanceTracking } from "@/components/provenance"
import type { TextOrigin } from "@/lib/config/provenance"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react"

interface RichEditorProps {
  content: string
  onChange?: (html: string) => void
  editable?: boolean
  placeholder?: string
  className?: string
  showToolbar?: boolean
  dense?: boolean
  /** Model-output editors tag every insert as AI. Document editors tag human inserts and human edits of existing text. */
  trackAs?: "human" | "ai"
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => {
    editor.on("selectionUpdate", force)
    editor.on("transaction", force)
    return () => {
      editor.off("selectionUpdate", force)
      editor.off("transaction", force)
    }
  }, [editor])

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 2 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 3 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <Heading3 className="size-4" />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <List className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered list"
      >
        <ListOrdered className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("blockquote")}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Quote"
      >
        <Quote className="size-4" />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} aria-label="Undo">
        <Undo2 className="size-4" />
      </Toggle>
      <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} aria-label="Redo">
        <Redo2 className="size-4" />
      </Toggle>
    </div>
  )
}

export function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder,
  className,
  showToolbar = true,
  dense = false,
  trackAs = "human",
}: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      Provenance,
      ProvenanceTracking.configure({ trackAs }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          "prose-editor text-sm leading-relaxed text-foreground focus:outline-none",
          dense ? "min-h-24 px-3 py-3" : "min-h-[120px] px-6 py-5",
        ),
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  })

  // Sync external content changes (e.g. section switches) into the editor.
  const lastContent = React.useRef(content)
  React.useEffect(() => {
    if (editor && content !== lastContent.current && content !== editor.getHTML()) {
      lastContent.current = content
      editor.chain().command(({ tr }) => {
        tr.setMeta("provenance-source", "program")
        return true
      }).setContent(content, { emitUpdate: false }).run()
    }
  }, [content, editor])

  React.useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  if (!editor) return null

  return (
    <div className={cn("flex flex-col", className)}>
      {editable && showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {editable ? <ProvenanceLegend editor={editor} /> : null}
    </div>
  )
}

function ProvenanceLegend({ editor }: { editor: Editor }) {
  const [counts, setCounts] = React.useState({ ai: 0, "human-added": 0, "human-modified": 0 })
  React.useEffect(() => {
    const update = () => setCounts(countOrigins(editor))
    update()
    editor.on("transaction", update)
    return () => {
      editor.off("transaction", update)
    }
  }, [editor])
  return (
    <div className="flex flex-wrap gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
      <LegendItem origin="ai" label="AI generated" count={counts.ai} />
      <LegendItem origin="human-added" label="Human added" count={counts["human-added"]} />
      <LegendItem origin="human-modified" label="Human modified" count={counts["human-modified"]} />
    </div>
  )
}

function LegendItem({ origin, label, count }: { origin: TextOrigin; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("provenance inline-block h-2.5 w-2.5 rounded-sm", `provenance-${origin}`)} />
      {label}
      {count ? <span className="font-mono">{count}</span> : null}
    </span>
  )
}

function countOrigins(editor: Editor) {
  const counts = { ai: 0, "human-added": 0, "human-modified": 0 }
  editor.state.doc.descendants((node) => {
    if (!node.isText) return
    const mark = node.marks.find((item) => item.type.name === "provenance")
    const origin = mark?.attrs.origin
    if (origin === "ai" || origin === "human-added" || origin === "human-modified") counts[origin] += node.text?.length ?? 0
  })
  return counts
}
