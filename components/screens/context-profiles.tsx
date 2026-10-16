"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  familyContexts,
  getRecord,
  materialize,
  missionsForFamily,
  versionLabel,
  type CatalogRecord,
  type ContextBody,
  type VersionRef,
} from "@/lib/config"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { TimeWindowPicker } from "@/components/time-window-picker"
import { AreaPicker, EMPTY_AREA, type AreaDraft } from "@/components/area-picker"
import { ArrowRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

function refKey(ref: VersionRef): string {
  return `${ref.id}@${ref.version}`
}

function parseRef(value: string): VersionRef | undefined {
  const [id, version] = value.split("@")
  if (!id || version === undefined) return undefined
  return { id, version: Number(version) }
}

export function ContextProfiles() {
  const { catalog, view, navigate, runs, openRun, createContext, saveContext, createMission, startRun } = useStore()
  const [creating, setCreating] = React.useState(false)
  const [effortOpen, setEffortOpen] = React.useState(false)
  const families = React.useMemo(() => familyContexts(catalog.records), [catalog.records])
  const requested = view.params?.context
  const family = families.find((item) => item.id === requested) ?? families[0]

  React.useEffect(() => {
    if (creating || !family || requested === family.id) return
    navigate("contexts", { context: family.id })
  }, [creating, family, navigate, requested])

  const body = family && family.kind === "context" ? materialize<ContextBody>(catalog, family) : undefined
  const missions = family ? missionsForFamily(catalog.records, family.id) : []
  const workflows = catalog.records.filter((record) => record.kind === "workflow" && record.status === "published")

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <h1 className="text-lg font-semibold">Contexts</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A context holds the standing statement, organization, guidance, evidence standard, and constraints. An effort adds the time window and geography. Workflows are added to the effort when you choose them.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
          <div className="shrink-0 p-3 pb-0">
            <Button size="sm" variant={creating ? "secondary" : "outline"} className="w-full" onClick={() => setCreating(true)}>
              New context
            </Button>
          </div>
          <ul className="flex flex-col gap-1 overflow-y-auto p-3">
            {families.map((item) => {
              const count = missionsForFamily(catalog.records, item.id).length
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setCreating(false)
                      setEffortOpen(false)
                      navigate("contexts", { context: item.id })
                    }}
                    className={cn("flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left", !creating && item.id === family?.id ? "bg-accent" : "hover:bg-accent/50")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{versionLabel(item.version)}</span>
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {item.kind === "context" ? materialize<ContextBody>(catalog, item).contextType : ""} · {count} {count === 1 ? "effort" : "efforts"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {creating ? (
            <div className="flex max-w-3xl flex-col gap-6 p-6">
              <NewContext
                onCancel={() => setCreating(false)}
                onCreate={(input) => {
                  try {
                    const ref = createContext(input)
                    setCreating(false)
                    navigate("contexts", { context: ref.id })
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "The context was not created.")
                  }
                }}
              />
            </div>
          ) : family && body ? (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card/95 px-6 py-3 backdrop-blur-sm">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{family.name}</h2>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {versionLabel(family.version)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {body.contextType}
                  </Badge>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => setEffortOpen(true)}>
                  <Plus data-icon="inline-start" />
                  New effort
                </Button>
              </div>
              <div className="flex max-w-3xl flex-col gap-6 p-6">
                <ContextEditor
                  key={`${family.id}@${family.version}`}
                  version={family.version}
                  name={family.name}
                  body={body}
                  onSave={(input) => {
                    try {
                      saveContext({ id: family.id, version: family.version }, input)
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "The context was not saved.")
                    }
                  }}
                />
                <section className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Efforts</h3>
                    <p className="mt-1 text-xs text-muted-foreground">An effort names the time window and geography. It starts without a workflow. Add one or more schemas when you are ready to plan.</p>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {missions.map((mission) => {
                      const facts = materialize<ContextBody>(catalog, mission)
                      const missionRuns = runs.filter((item) => item.context.id === mission.id && item.context.version === mission.version)
                      const own = [
                        facts.timeWindow && facts.timeWindow !== body.timeWindow ? facts.timeWindow : "",
                        facts.areaOfInterest ? facts.areaOfInterest : "",
                        facts.areaOfResponsibility && facts.areaOfResponsibility !== body.areaOfResponsibility ? facts.areaOfResponsibility : "",
                      ].filter(Boolean)
                      return (
                        <li key={mission.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold">{mission.name}</h4>
                              <p className="mt-1 text-xs text-muted-foreground">{own.length ? own.join(" · ") : "Uses this context’s time and place"}</p>
                              {facts.statement !== body.statement ? <p className="mt-1 text-sm text-muted-foreground">{facts.statement}</p> : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflows</h5>
                            {missionRuns.length ? (
                              <ul className="flex flex-col gap-2">
                                {missionRuns.map((run) => (
                                  <li key={run.id} className="flex items-center justify-between gap-3">
                                    <span className="text-sm">
                                      {getRecord(catalog, run.workflow).name}{" "}
                                      <span className="font-mono text-[10px] text-muted-foreground">{versionLabel(run.workflow.version)}</span>
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => openRun(run.id)}>
                                      Open
                                      <ArrowRight data-icon="inline-end" />
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">No workflow is attached.</p>
                            )}
                            <AddWorkflow
                              workflows={workflows}
                              attached={missionRuns.map((run) => run.workflow)}
                              onAdd={(workflow) => {
                                try {
                                  startRun({ id: mission.id, version: mission.version }, workflow)
                                } catch (error) {
                                  toast.error(error instanceof Error ? error.message : "The workflow was not added.")
                                }
                              }}
                            />
                          </div>
                        </li>
                      )
                    })}
                    {missions.length === 0 ? <li className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">No effort yet. New effort adds the time window and geography for this context.</li> : null}
                  </ul>
                </section>
              </div>
              <NewEffort
                key={family.id}
                open={effortOpen}
                contextName={family.name}
                onOpenChange={setEffortOpen}
                onCreate={(input) => createMission(family.id, input)}
              />
            </>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Create a context to hold the standing organization, guidance, and constraints.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function AddWorkflow({ workflows, attached, onAdd }: { workflows: CatalogRecord[]; attached: VersionRef[]; onAdd: (workflow: VersionRef) => void }) {
  const available = workflows.filter((item) => !attached.some((ref) => ref.id === item.id && ref.version === item.version))
  const [workflow, setWorkflow] = React.useState<string | null>(null)
  if (!workflows.length) return <p className="text-xs text-muted-foreground">No published workflow schema is available to add.</p>
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Add a workflow
        <Select value={workflow} onValueChange={(value) => setWorkflow(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a workflow" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {available.map((item) => (
                <SelectItem key={refKey(item)} value={refKey(item)}>
                  {item.name} {versionLabel(item.version)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={!workflow || !available.some((item) => refKey(item) === workflow)}
        onClick={() => {
          const pinned = workflow ? parseRef(workflow) : undefined
          if (!pinned) return
          onAdd(pinned)
          setWorkflow(null)
        }}
      >
        Add
      </Button>
    </div>
  )
}

const CONTEXT_TYPES = ["mission", "customer", "project", "system", "incident", "research", "opportunity"] as const

function ContextEditor({
  version,
  name,
  body,
  onSave,
}: {
  version: number
  name: string
  body: ContextBody
  onSave: (input: { name: string; statement: string; organization: string; standingGuidance: string; evidenceStandard: string; knownConstraints: string; contextType: ContextBody["contextType"] }) => void
}) {
  const [nextName, setNextName] = React.useState(name)
  const [contextType, setContextType] = React.useState(body.contextType)
  const [statement, setStatement] = React.useState(body.statement)
  const [organization, setOrganization] = React.useState(body.organization)
  const [standingGuidance, setStandingGuidance] = React.useState(body.standingGuidance ?? "")
  const [evidenceStandard, setEvidenceStandard] = React.useState(body.evidenceStandard ?? "")
  const [knownConstraints, setKnownConstraints] = React.useState(body.knownConstraints.join("\n"))
  const ready = nextName.trim() && statement.trim() && organization.trim()
  const unchanged =
    nextName.trim() === name &&
    contextType === body.contextType &&
    statement.trim() === body.statement &&
    organization.trim() === body.organization &&
    standingGuidance.trim() === (body.standingGuidance ?? "") &&
    evidenceStandard.trim() === (body.evidenceStandard ?? "") &&
    knownConstraints.split("\n").map((line) => line.trim()).filter(Boolean).join("\n") === body.knownConstraints.join("\n")
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready || unchanged) return
        onSave({ name: nextName, contextType, statement, organization, standingGuidance, evidenceStandard, knownConstraints })
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Context</h3>
        <Button size="sm" type="submit" disabled={!ready || unchanged}>
          Save as {versionLabel(version + 1)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Saving publishes the next version. This version stays as it is.</p>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Name
        <Input value={nextName} onChange={(event) => setNextName(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Type
        <Select value={contextType} onValueChange={(value) => setContextType((value ?? contextType) as ContextBody["contextType"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CONTEXT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Statement
        <Textarea value={statement} onChange={(event) => setStatement(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Organization
        <Textarea value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Command, staff, and the role they hold" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Standing guidance
        <Textarea value={standingGuidance} onChange={(event) => setStandingGuidance(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Evidence standard
        <Textarea value={evidenceStandard} onChange={(event) => setEvidenceStandard(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Known constraints
        <Textarea value={knownConstraints} onChange={(event) => setKnownConstraints(event.target.value)} placeholder="One constraint per line" />
      </label>
    </form>
  )
}

function NewContext({
  onCreate,
  onCancel,
}: {
  onCreate: (input: { name: string; statement: string; organization: string; standingGuidance: string; evidenceStandard: string; knownConstraints: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState("")
  const [statement, setStatement] = React.useState("")
  const [organization, setOrganization] = React.useState("")
  const [standingGuidance, setStandingGuidance] = React.useState("")
  const [evidenceStandard, setEvidenceStandard] = React.useState("")
  const [knownConstraints, setKnownConstraints] = React.useState("")
  const ready = name.trim() && statement.trim() && organization.trim()
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready) return
        onCreate({ name, statement, organization, standingGuidance, evidenceStandard, knownConstraints })
      }}
    >
      <h2 className="text-sm font-semibold">New context</h2>
      <p className="text-xs text-muted-foreground">These fields stay with the context. An effort adds the time window and geography later.</p>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Name
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Statement
        <Textarea value={statement} onChange={(event) => setStatement(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Organization
        <Textarea value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Command, staff, and the role they hold" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Standing guidance
        <Textarea value={standingGuidance} onChange={(event) => setStandingGuidance(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Evidence standard
        <Textarea value={evidenceStandard} onChange={(event) => setEvidenceStandard(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Known constraints
        <Textarea value={knownConstraints} onChange={(event) => setKnownConstraints(event.target.value)} placeholder="One constraint per line" />
      </label>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!ready}>
          Create context
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function NewEffort({
  open,
  onOpenChange,
  contextName,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contextName: string
  onCreate: (input: {
    name: string
    areaOfInterest: string
    areaOfResponsibility: string
    areaOfInterestGeometry?: AreaDraft["geometry"]
    areaOfResponsibilityGeometry?: AreaDraft["geometry"]
    timeWindow: string
    statement: string
  }) => void
}) {
  const [name, setName] = React.useState("")
  const [interest, setInterest] = React.useState<AreaDraft>(EMPTY_AREA)
  const [responsibility, setResponsibility] = React.useState<AreaDraft>(EMPTY_AREA)
  const [activeArea, setActiveArea] = React.useState<"interest" | "responsibility">("interest")
  const [timeWindow, setTimeWindow] = React.useState("")
  const [statement, setStatement] = React.useState("")

  function reset() {
    setName("")
    setInterest(EMPTY_AREA)
    setResponsibility(EMPTY_AREA)
    setActiveArea("interest")
    setTimeWindow("")
    setStatement("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100vw,72rem)] gap-0 p-0 data-[side=right]:w-[min(100vw,72rem)] data-[side=right]:sm:max-w-[min(100vw,72rem)]">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>New effort</SheetTitle>
          <SheetDescription>
            Add the time window and geography for {contextName}. The effort keeps that context’s organization, guidance, and constraints.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            try {
              onCreate({
                name,
                areaOfInterest: interest.label,
                areaOfResponsibility: responsibility.label,
                areaOfInterestGeometry: interest.geometry,
                areaOfResponsibilityGeometry: responsibility.geometry,
                timeWindow,
                statement,
              })
              reset()
              onOpenChange(false)
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The effort was not created.")
            }
          }}
        >
          <div className="grid h-full min-h-0 flex-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-5 overflow-y-auto border-b border-border p-4 lg:border-r lg:border-b-0">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                Name
                <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Night transit" />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">Time window</span>
                <TimeWindowPicker value={timeWindow} onChange={setTimeWindow} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-foreground">Geography</span>
                <button
                  type="button"
                  onClick={() => setActiveArea("interest")}
                  className={cn("rounded-md border px-3 py-2 text-left", activeArea === "interest" ? "border-foreground/30 bg-accent" : "border-border")}
                >
                  <span className="text-xs text-muted-foreground">Area of interest</span>
                  <span className="mt-0.5 block text-sm">{interest.label || "Choose countries or draw on the map"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveArea("responsibility")}
                  className={cn("rounded-md border px-3 py-2 text-left", activeArea === "responsibility" ? "border-foreground/30 bg-accent" : "border-border")}
                >
                  <span className="text-xs text-muted-foreground">Area of responsibility</span>
                  <span className="mt-0.5 block text-sm">{responsibility.label || "Choose countries or draw on the map"}</span>
                </button>
              </div>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                Effort statement
                <Textarea value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Optional. Leave blank to use the context statement." />
              </label>
            </div>
            <AreaPicker
              open={open}
              active={activeArea}
              onActiveChange={setActiveArea}
              interest={interest}
              responsibility={responsibility}
              onChange={(field, value) => (field === "interest" ? setInterest(value) : setResponsibility(value))}
            />
          </div>
          <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create effort
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
