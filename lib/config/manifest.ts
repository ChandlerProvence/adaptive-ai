import { fingerprint } from "./hash.ts"
import type { ResolvedNode, RuntimeManifest } from "./types.ts"

/** Freeze the resolved node into the execution contract a generation must store. */
export function freezeManifest(resolved: ResolvedNode): RuntimeManifest {
  const manifest: Omit<RuntimeManifest, "id"> = {
    workflow: resolved.workflow,
    parentWorkflow: resolved.parentWorkflow,
    context: resolved.context,
    nodeId: resolved.nodeId,
    nodeTitle: resolved.nodeTitle,
    task: resolved.task,
    purpose: resolved.purpose,
    prompt: resolved.prompt,
    artifactSchema: resolved.artifactSchema,
    llm: resolved.llm,
    inserts: resolved.inserts,
    dependencies: resolved.dependencies,
    framing: resolved.framing,
    promptBody: resolved.promptBody,
    model: resolved.llmBody.model,
    temperature: resolved.llmBody.temperature,
    runtimeInstruction: resolved.runtimeInstruction,
    provenance: resolved.provenance,
  }
  return { id: `manifest:${fingerprint(manifest)}`, ...manifest }
}
