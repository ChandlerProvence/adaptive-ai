"use client"

import * as React from "react"
import {
  acceptProposal,
  analyzeChangeSet,
  coaCatalog,
  createCoaDocument,
  dependencyHealth,
  DocumentStateError,
  editWorking,
  latestCanonical,
  LLM,
  materialize,
  mergeChangeSet,
  proposeRegeneration,
  submitChangeSet,
  type DocumentState,
  type LlmBody,
  type SectionRecord,
} from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RichEditor } from "@/components/rich-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const AUTHOR = "User"

export function CoaDocument() {
  const llm = React.useMemo(() => materialize<LlmBody>(coaCatalog, LLM), [])
  const [state, setState] = React.useState<DocumentState>(() => createCoaDocument())
  const [selectedId, setSelectedId] = React.useState("coa")
  const [error, setError] = React.useState<string | null>(null)
  const section = state.sections.find((item) => item.id === selectedId) ?? state.sections[0]
  const upstream = state.sections.map((item) => ({
    sectionId: item.id,
    canonicalVersion: latestCanonical(item).version,
    content: latestCanonical(item).content,
  }))

  function apply(update: (current: DocumentState) => DocumentState) {
    try {
      setState(update)
      setError(null)
    } catch (caught) {
      setError(caught instanceof DocumentStateError ? caught.message : "The document could not be updated.")
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-64 shrink-0 border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Instance</p>
          <h1 className="text-sm font-semibold">Port security courses of action</h1>
        </div>
        <ul className="flex flex-col gap-1 p-2">
          {state.sections.map((item) => {
            const health = dependencyHealth(item, upstream)
            const canonical = latestCanonical(item)
            const modified = item.working !== null && item.working.content !== canonical.content
            return (
              <li key={item.id}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  className={cn("flex w-full flex-col rounded-md px-3 py-2 text-left", item.id === section.id ? "bg-accent" : "hover:bg-accent/50")}
                >
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">canonical v.{canonical.version}</span>
                  {modified ? <span className="text-[10px] text-muted-foreground">Working draft</span> : null}
                  {health === "potentially_stale" ? <span className="text-[10px] text-amber-700">Potentially stale</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
      <ScrollArea className="min-h-0 flex-1">
        <SectionBody
          key={`${section.id}:${section.revisions.length}:${latestCanonical(section).version}`}
          section={section}
          upstream={upstream}
          llm={llm}
          error={error}
          onSave={(content) => apply((current) => editWorking(current, section.id, content, { name: AUTHOR, kind: "human" }))}
          onSubmit={(content) =>
            apply((current) => {
              const existing = current.sections.find((item) => item.id === section.id)
              const saved = existing?.working?.content === content ? current : editWorking(current, section.id, content, { name: AUTHOR, kind: "human" })
              const savedSection = saved.sections.find((item) => item.id === section.id)
              const id = `CS-${section.id}-${(savedSection?.changeSets.length ?? 0) + 1}`
              return analyzeChangeSet(submitChangeSet(saved, section.id, content, AUTHOR, id), id, llm)
            })
          }
          onMerge={(changeSetId) => apply((current) => mergeChangeSet(current, changeSetId))}
          onPropose={(instruction) =>
            apply((current) =>
              proposeRegeneration(current, {
                sectionId: section.id,
                id: `proposal-${section.id}-${section.generations.length + 1}`,
                llm,
                upstream,
                userInstruction: instruction,
              }),
            )
          }
          onAccept={(content) => apply((current) => acceptProposal(current, section.id, content, "AI"))}
        />
      </ScrollArea>
    </div>
  )
}

function SectionBody({
  section,
  upstream,
  llm,
  error,
  onSave,
  onSubmit,
  onMerge,
  onPropose,
  onAccept,
}: {
  section: SectionRecord
  upstream: { sectionId: string; canonicalVersion: number; content: string }[]
  llm: LlmBody
  error: string | null
  onSave: (content: string) => void
  onSubmit: (content: string) => void
  onMerge: (changeSetId: string) => void
  onPropose: (instruction: string) => void
  onAccept: (content: string) => void
}) {
  const canonical = latestCanonical(section)
  const generation = section.generations[section.generations.length - 1]
  const health = dependencyHealth(section, upstream)
  const active = section.changeSets.find((changeSet) => changeSet.status === "submitted")
  const [draft, setDraft] = React.useState(section.working?.content ?? canonical.content)
  const [instruction, setInstruction] = React.useState("")
  const [completion, setCompletion] = React.useState("")

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{section.title}</h2>
        <Badge variant="outline" className="font-mono text-[10px]">
          canonical v.{canonical.version}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {health === "potentially_stale" ? "Potentially stale" : "Dependencies current"}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed">{canonical.content}</p>
      {generation ? (
        <dl className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 text-sm">
          <Row label="Generation" value={generation.id} />
          <Row label="Manifest" value={generation.manifestId} />
          <Row label="Prompt" value={`${generation.manifest.prompt.id} v.${generation.manifest.prompt.version}`} />
          <Row label="Model" value={`${generation.manifest.model} · temp ${generation.manifest.temperature}`} />
          <Row label="Fingerprint" value={generation.dependencyFingerprint} />
          {generation.dependencies.map((dependency) => (
            <Row key={dependency.sectionId} label={dependency.sectionId} value={`consumed v.${dependency.canonicalVersion}`} />
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">This section is canonical source material. It has no generation of its own.</p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working draft</h3>
        <p className="text-xs text-muted-foreground">Edits stay here until a change set is approved. Each save records a revision and leaves the canonical version unchanged.</p>
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <RichEditor content={draft} onChange={setDraft} placeholder="Revise this section" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onSave(draft)} disabled={draft === (section.working?.content ?? canonical.content)}>
            Save working edit
          </Button>
          <Button size="sm" onClick={() => onSubmit(draft)} disabled={Boolean(active) || draft === canonical.content}>
            Submit change set
          </Button>
        </div>
        {section.revisions.length ? (
          <ul className="text-xs text-muted-foreground">
            {section.revisions.map((revision) => (
              <li key={revision.id}>
                {revision.sequence}. {revision.actorName} · {revision.actor} · {revision.reason}
                {" · "}
                AI {revision.provenance.ai} · human added {revision.provenance.humanAdded} · human modified {revision.provenance.humanModified}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {active ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Change set {active.id}</h3>
          <p className="text-xs text-muted-foreground">The candidate snapshot is frozen at base v.{active.baseVersion}. Further working edits belong to the next review.</p>
          <p className="text-sm">{active.candidateContent.includes("<") ? <span className="prose-editor" dangerouslySetInnerHTML={{ __html: active.candidateContent }} /> : active.candidateContent}</p>
          {active.analysis ? (
            <div className="flex flex-col gap-2 text-xs">
              <p>{active.analysis.summary}</p>
              <p className="text-muted-foreground">
                Explanation request prepared for {active.analysis.chat.prepared.body.model} at {active.analysis.chat.prepared.url}. Header {active.analysis.chat.prepared.headerName} reads {active.analysis.chat.prepared.apiKeyEnv}. The call is not executed in this environment.
              </p>
            </div>
          ) : null}
          <Button size="sm" onClick={() => onMerge(active.id)}>
            Approve and merge
          </Button>
        </section>
      ) : null}

      {generation ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regenerate</h3>
          <p className="text-xs text-muted-foreground">
            Regeneration prepares a revision request from the existing output, the pinned manifest, and the current canonical dependencies. It uses {llm.model} from the LLM catalog and does not replace the working draft.
          </p>
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Optional instruction, such as emphasize sustainment"
            className="h-8 rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => onPropose(instruction)}>
            Prepare regeneration
          </Button>
          {section.proposal ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-xs">
              <p className="text-sm font-medium">Proposal {section.proposal.id}</p>
              <p>Case: {section.proposal.case.split("_").join(" ")}</p>
              <p>{section.proposal.workingDiverged ? "The working draft has diverged, so the request includes it as the human side of the revision." : "The working draft matches the canonical baseline."}</p>
              <p className="text-muted-foreground">
                Prepared for {section.proposal.chat.prepared.body.model} · temp {section.proposal.chat.prepared.body.temperature}. The model call is not executed here, so there is no completion to apply.
              </p>
              <pre className="overflow-auto rounded-md bg-muted/40 p-3 font-mono leading-relaxed">{section.proposal.chat.prepared.body.messages.map((message) => message.content).join("\n\n")}</pre>
              <label className="flex flex-col gap-1 text-muted-foreground">
                Completed model text, supplied when a host can run the request
                <div className="overflow-hidden rounded-md border border-border bg-background">
                  <RichEditor dense trackAs="ai" content={completion} onChange={setCompletion} placeholder="Paste the completed section" />
                </div>
              </label>
              <Button size="sm" disabled={!completion.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()} onClick={() => onAccept(completion)}>
                Apply completion to working draft
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-medium">{value}</dd>
    </div>
  )
}
