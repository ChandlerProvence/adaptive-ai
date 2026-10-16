"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"

export interface ManifestData {
  generation: string
  workflow: string
  workflowSchema: string
  parent: string
  context: string
  node: string
  task: string
  purpose: string
  prompt: string
  artifactSchema: string
  customInserts: string[]
  dependencies: string[]
  inheritedSettings: string[]
  dependencyFingerprint: string
  contentHash: string
  generatedAt: string
  model: string
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export function RuntimeManifestDrawer({
  open,
  onOpenChange,
  data,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  data: ManifestData
}) {
  const [mode, setMode] = React.useState<"human" | "json">("human")

  const json = {
    generation: data.generation,
    workflow: data.workflow,
    workflow_schema: data.workflowSchema,
    parent_schema: data.parent,
    context: data.context,
    node: data.node,
    resolved: {
      task: data.task,
      purpose: data.purpose,
      prompt: data.prompt,
      artifact_schema: data.artifactSchema,
      custom_inserts: data.customInserts,
      dependencies: data.dependencies,
      inherited_settings: data.inheritedSettings,
    },
    provenance: {
      dependency_fingerprint: data.dependencyFingerprint,
      content_hash: data.contentHash,
      generated_at: data.generatedAt,
      model: data.model,
    },
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Runtime Manifest</SheetTitle>
          <SheetDescription>
            Fully resolved configuration used for generation <span className="font-mono">{data.generation}</span>.
          </SheetDescription>
          <div className="pt-2">
            <ToggleGroup
              value={[mode]}
              onValueChange={(v) => v[0] && setMode(v[0] as "human" | "json")}
              spacing={2}
            >
              <ToggleGroupItem value="human" className="text-xs">
                Human Readable
              </ToggleGroupItem>
              <ToggleGroupItem value="json" className="text-xs">
                JSON
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {mode === "human" ? (
            <div className="p-6">
              <div className="mb-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity</p>
                <Row label="Generation" value={<span className="font-mono">{data.generation}</span>} />
                <Row label="Workflow" value={data.workflow} />
                <Row label="Workflow Schema" value={data.workflowSchema} />
                <Row label="Parent" value={data.parent} />
                <Row label="Context" value={data.context} />
                <Row label="Node" value={data.node} />
              </div>
              <Separator />
              <div className="my-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resolved Configuration
                </p>
                <Row label="Task" value={data.task} />
                <Row label="Purpose" value={data.purpose} />
                <Row label="Prompt" value={data.prompt} />
                <Row label="Artifact Schema" value={data.artifactSchema} />
                <Row
                  label="Custom Inserts"
                  value={
                    <span className="flex flex-col">
                      {data.customInserts.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </span>
                  }
                />
                <Row
                  label="Dependencies"
                  value={
                    <span className="flex flex-col">
                      {data.dependencies.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </span>
                  }
                />
                <Row
                  label="Inherited Settings"
                  value={
                    <span className="flex flex-col">
                      {data.inheritedSettings.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </span>
                  }
                />
              </div>
              <Separator />
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provenance</p>
                <Row label="Dependency FP" value={<span className="font-mono">{data.dependencyFingerprint}</span>} />
                <Row label="Content Hash" value={<span className="font-mono">{data.contentHash}</span>} />
                <Row label="Generated" value={data.generatedAt} />
                <Row label="Model / Provider" value={data.model} />
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed text-foreground">
              {JSON.stringify(json, null, 2)}
            </pre>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export function manifestFor(overrides: Partial<ManifestData>): ManifestData {
  return {
    generation: "GEN-842",
    workflow: "Strategic Assessment",
    workflowSchema: "Strategic Assessment — Narrative Focus V3",
    parent: "Strategic Assessment V4",
    context: "Market Expansion Initiative V3",
    node: "Narrative Assessment",
    task: "Narrative Analysis V2",
    purpose: "Executive Decision Support V3",
    prompt: "Narrative Analysis V5",
    artifactSchema: "Narrative Findings V2",
    customInserts: ["Source Comparison V1", "Contradiction Detection V2"],
    dependencies: ["Environment V4", "Actor Assessment V3"],
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    dependencyFingerprint: "dfp:7c1a9e0b4d",
    contentHash: "sha256:40bd…9c2",
    generatedAt: "2026-09-08 14:22 UTC",
    model: "mock-provider / analyst-xl (temp 0.2)",
    ...overrides,
  }
}
