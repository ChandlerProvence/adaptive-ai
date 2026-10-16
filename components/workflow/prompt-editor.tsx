"use client"

import * as React from "react"
import type { WorkflowNodeConfig, PromptComponent } from "@/lib/mock-data"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { RotateCcw, GitCompare, Save } from "lucide-react"

export function PromptEditorSheet({
  open,
  onOpenChange,
  section,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  section: WorkflowNodeConfig
  onSave: (components: PromptComponent[]) => void
}) {
  const [draft, setDraft] = React.useState<PromptComponent[]>(section.promptComponents)

  React.useEffect(() => {
    if (open) setDraft(section.promptComponents.map((c) => ({ ...c })))
  }, [open, section.promptComponents])

  const update = (key: string, content: string) =>
    setDraft((prev) =>
      prev.map((c) => (c.key === key ? { ...c, content, overridden: content.trim() !== c.baseContent.trim() } : c)),
    )

  const resetSection = (key: string) =>
    setDraft((prev) => prev.map((c) => (c.key === key ? { ...c, content: c.baseContent, overridden: false } : c)))

  const resolved = React.useMemo(() => {
    const parts = [
      `# Context\nMarket Expansion Initiative V3`,
      `# Purpose\n${section.purpose} — ${section.purposeSummary}`,
      `# Task\n${section.task}`,
      "# Prompt Template",
      ...draft.map((c) => `## ${c.label}\n${c.content}`),
      `# Dependencies\n${section.dependencies.map((d) => `${d.name} ${d.version}`).join(", ")}`,
      `# Custom Inserts\n${section.analyticalEnhancements.join(", ")}`,
      `# User Instructions\n(none — using inherited defaults)`,
    ]
    return parts.join("\n\n")
  }, [draft, section])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Edit Prompt</SheetTitle>
          <SheetDescription className="flex flex-col gap-0.5">
            <span>
              Base Prompt: <span className="font-medium text-foreground">{section.basePrompt}</span>
            </span>
            <span>
              Current Custom Prompt: <span className="font-medium text-foreground">{section.prompt}</span>
            </span>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="compose" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b border-border px-4 py-2">
            <TabsList>
              <TabsTrigger value="compose">Components</TabsTrigger>
              <TabsTrigger value="resolved">Resolved Prompt</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="compose" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
                {draft.map((c) => (
                  <div key={c.key} className="rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.label}</span>
                        {c.overridden && (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]"
                          >
                            Overridden
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!c.overridden}
                        onClick={() => resetSection(c.key)}
                      >
                        <RotateCcw data-icon="inline-start" />
                        Reset
                      </Button>
                    </div>
                    <div className="p-3">
                      <Textarea
                        value={c.content}
                        onChange={(e) => update(c.key, e.target.value)}
                        className="min-h-[72px] resize-y text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="resolved" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  Read-only approximation of the final prompt after Context, Purpose, Task, Template, Dependencies,
                  Inserts, and User Instructions are resolved.
                </p>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
                  {resolved}
                </pre>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex-row items-center justify-between border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast("Comparison uses the base prompt shown per component above.")}
          >
            <GitCompare data-icon="inline-start" />
            Compare to Base
          </Button>
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-5" />
            <Button
              onClick={() => {
                onSave(draft)
                toast.success("Saved as new prompt version", {
                  description: "Narrative Analysis V5 updated.",
                })
                onOpenChange(false)
              }}
            >
              <Save data-icon="inline-start" />
              Save as New Prompt Version
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
