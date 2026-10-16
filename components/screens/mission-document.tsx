"use client"

import * as React from "react"
import { getRecord, materialize, resolveNode, versionLabel, workflowBody, type ArtifactSchemaBody, type Catalog, type ContextBody, type TaskBody, type VersionRef, type WorkflowNode } from "@/lib/config"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RichEditor } from "@/components/rich-editor"
import { Textarea } from "@/components/ui/textarea"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"

export function MissionDocument() {
  const { catalog, instanceId, runs, stepRuns, runSteps, checkArtifact } = useStore()
  const run = runs.find((item) => item.id === instanceId)
  const body = run ? workflowBody(catalog, run.workflow) : undefined
  const sections = run && body ? sectionsFor(catalog, run.workflow, body.nodes) : []
  const [phaseId, setPhaseId] = React.useState(sections[0]?.id ?? "")
  const activePhase = sections.find((item) => item.id === phaseId) ?? sections[0]

  if (!run || !body) return <p className="p-6 text-sm text-muted-foreground">Open a mission from its situation.</p>
  const context = materialize<ContextBody>(catalog, run.context)
  const titleOf = titlesFor(catalog, sections)
  const ran = stepRuns.filter((item) => item.runId === run.id && item.status === "prepared")
  const finishedPhases = sections.filter((phase) => phase.steps.length > 0 && phase.steps.every((step) => ran.some((item) => item.workflow.id === phase.workflow.id && item.nodeId === step.id))).length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <p className="text-xs text-muted-foreground">Mission</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{run.name}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{context.statement}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {finishedPhases} of {sections.length} phases run
          </p>
        </div>
      </div>
      <Tabs value={activePhase?.id} onValueChange={(value) => setPhaseId(value)} className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 overflow-x-auto border-b border-border bg-card px-4">
          <TabsList variant="line" className="h-auto w-max justify-start">
            {sections.map((phase, index) => {
              const done = phase.steps.filter((step) => ran.some((item) => item.workflow.id === phase.workflow.id && item.nodeId === step.id)).length
              return (
                <TabsTrigger key={phase.id} value={phase.id} className="h-10 flex-none gap-2 px-3">
                  <span className={cn("size-1.5 rounded-full", done === 0 ? "bg-muted-foreground/40" : done === phase.steps.length ? "bg-primary" : "bg-amber-500")} />
                  {index + 1}. {phase.title}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
        {sections.map((phase) => (
          <TabsContent key={phase.id} value={phase.id} className="min-h-0 overflow-y-auto">
            <PhasePanel
              phase={phase}
              catalog={catalog}
              context={run.context}
              titleOf={titleOf}
              ran={ran}
              onRunStep={(nodeId) => runSteps(run.id, phase.workflow, [nodeId])}
              onRunPhase={() => runSteps(run.id, phase.workflow, phase.steps.map((step) => step.id))}
              onCheck={(nodeId, artifact) => checkArtifact(run.id, phase.workflow, nodeId, artifact)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function PhasePanel({
  phase,
  catalog,
  context,
  titleOf,
  ran,
  onRunStep,
  onRunPhase,
  onCheck,
}: {
  phase: PhaseSection
  catalog: Catalog
  context: VersionRef
  titleOf: Map<string, string>
  ran: { workflow: VersionRef; nodeId: string; output: string; objective: string; artifact?: string; validation?: { valid: boolean; errors: { path: string; message: string }[] } }[]
  onRunStep: (nodeId: string) => void
  onRunPhase: () => void
  onCheck: (nodeId: string, artifact: string) => void
}) {
  const remaining = phase.steps.filter((step) => !ran.some((item) => item.workflow.id === phase.workflow.id && item.nodeId === step.id)).length
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{phase.title}</h2>
          <p className="text-sm text-muted-foreground">Run the steps in order. A step waits until the ones it depends on have been triggered.</p>
        </div>
        <Button onClick={onRunPhase} disabled={remaining === 0}>
          <Play data-icon="inline-start" />
          {remaining === 0 ? "Phase complete" : "Run phase"}
        </Button>
      </div>
      <ol className="flex flex-col gap-3">
        {phase.steps.map((step, index) => {
          const resolved = resolveNode({ catalog, workflow: phase.workflow, nodeId: step.id, context })
          const task = getRecord(catalog, resolved.task)
          const schema = materialize<ArtifactSchemaBody>(catalog, resolved.artifactSchema)
          const execution = ran.find((item) => item.workflow.id === phase.workflow.id && item.nodeId === step.id)
          const waiting = unmet(step, phase.workflow, ran, titleOf)
          return (
            <li key={step.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{materialize<TaskBody>(catalog, resolved.task).summary}</p>
                </div>
                <Button size="sm" variant={execution ? "outline" : "default"} disabled={waiting.length > 0} onClick={() => onRunStep(step.id)}>
                  <Play data-icon="inline-start" />
                  {execution ? "Run again" : "Run"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {task.name}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {getRecord(catalog, resolved.purpose).name} {versionLabel(resolved.purpose.version)}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{waiting.length ? `Waiting on ${waiting.join(", ")}` : `Depends on ${dependencyLabel(step, titleOf)}`}</p>
              {schema.requiredSections.length ? <p className="mt-1 text-xs text-muted-foreground">Produces {schema.requiredSections.join(", ")}</p> : null}
              {execution ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-sm">{execution.output}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{execution.objective}</p>
                  </div>
                  <ArtifactCheck initial={execution.artifact} validation={execution.validation} onCheck={(artifact) => onCheck(step.id, artifact)} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ArtifactCheck({
  initial,
  validation,
  onCheck,
}: {
  initial?: string
  validation?: { valid: boolean; errors: { path: string; message: string }[] }
  onCheck: (artifact: string) => void
}) {
  const [narrative, setNarrative] = React.useState("")
  const [text, setText] = React.useState(initial ?? "")
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Briefing</p>
        <RichEditor dense content={narrative} onChange={setNarrative} placeholder="Write the briefing for this step. It becomes display_text." />
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Structured fields
        <Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-28 font-mono text-xs" placeholder='{"artifact_type": "..."}' />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!text.trim() && !narrativeText(narrative)} onClick={() => onCheck(artifactWithNarrative(text, narrative))}>
          Validate
        </Button>
        {validation ? (
          <Badge variant="outline" className={validation.valid ? "text-emerald-700" : "text-destructive"}>
            {validation.valid ? "Matches the schema" : "Does not match the schema"}
          </Badge>
        ) : null}
      </div>
      {validation && !validation.valid ? (
        <ul className="flex flex-col gap-1 text-xs text-destructive">
          {validation.errors.map((error) => (
            <li key={`${error.path}:${error.message}`}>
              <span className="font-mono">{error.path}</span> {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function narrativeText(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
}

function artifactWithNarrative(text: string, narrative: string) {
  const briefing = narrativeText(narrative) ? narrative : ""
  if (!text.trim()) return JSON.stringify({ display_text: briefing })
  try {
    const parsed = JSON.parse(text) as unknown
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, display_text: briefing })
    }
  } catch {
    return text
  }
  return text
}

interface PhaseSection {
  id: string
  title: string
  workflow: VersionRef
  steps: WorkflowNode[]
}

function sectionsFor(catalog: Catalog, workflow: VersionRef, nodes: WorkflowNode[]): PhaseSection[] {
  const active = nodes.filter((node) => node.enabled !== false)
  const composed = active.filter((node) => node.workflow)
  if (composed.length) {
    return composed.map((node) => ({
      id: node.id,
      title: node.title,
      workflow: node.workflow ?? workflow,
      steps: workflowBody(catalog, node.workflow ?? workflow).nodes.filter((step) => step.enabled !== false && step.executable),
    }))
  }
  return [
    {
      id: workflow.id,
      title: getRecord(catalog, workflow).name,
      workflow,
      steps: active.filter((node) => node.executable),
    },
  ]
}

function titlesFor(catalog: Catalog, sections: PhaseSection[]) {
  const titleOf = new Map<string, string>()
  for (const section of sections) {
    for (const step of section.steps) {
      titleOf.set(`${section.workflow.id}:${step.id}`, step.title)
      for (const item of step.upstream ?? []) {
        const match = workflowBody(catalog, item.workflow).nodes.find((node) => node.id === item.nodeId)
        if (match) titleOf.set(`${item.workflow.id}:${match.id}`, match.title)
      }
    }
  }
  return titleOf
}

function unmet(step: WorkflowNode, workflow: VersionRef, ran: { workflow: VersionRef; nodeId: string }[], titleOf: Map<string, string>) {
  const names: string[] = []
  for (const id of step.dependencies ?? []) {
    if (!ran.some((item) => item.workflow.id === workflow.id && item.nodeId === id)) names.push(titleOf.get(`${workflow.id}:${id}`) ?? id)
  }
  for (const item of step.upstream ?? []) {
    if (!ran.some((done) => done.workflow.id === item.workflow.id && done.nodeId === item.nodeId)) names.push(titleOf.get(`${item.workflow.id}:${item.nodeId}`) ?? item.nodeId)
  }
  return names
}

function dependencyLabel(step: WorkflowNode, titleOf: Map<string, string>) {
  const internal = (step.dependencies ?? []).map((id) => [...titleOf.entries()].find((entry) => entry[0].endsWith(`:${id}`))?.[1] ?? id)
  const external = (step.upstream ?? []).map((item) => titleOf.get(`${item.workflow.id}:${item.nodeId}`) ?? item.nodeId)
  const names = [...internal, ...external]
  return names.length ? names.join(", ") : "nothing else in this phase"
}
