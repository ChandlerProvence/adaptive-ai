"use client"

import { StoreProvider, useStore } from "@/lib/store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/app-shell"
import { WorkflowLibrary } from "@/components/screens/workflow-library"
import { WorkflowEditor } from "@/components/screens/workflow-editor"
import { CatalogWorkflowEditor } from "@/components/screens/catalog-workflow-editor"
import { CatalogScreen } from "@/components/screens/catalog-screen"
import { DocumentWorkspace } from "@/components/screens/document-workspace"
import { ChangeSetList } from "@/components/screens/change-set-list"
import { ChangeSetReview } from "@/components/screens/change-set-review"
import { VersionHistory } from "@/components/screens/version-history"
import { DependencyGraph } from "@/components/screens/dependency-graph"
import { ContextProfiles } from "@/components/screens/context-profiles"
import { CoaDocument } from "@/components/screens/coa-document"
import { MissionDocument } from "@/components/screens/mission-document"
import { AuditLog } from "@/components/screens/audit-log"
import type { CatalogRecord } from "@/lib/config"

function ScreenRouter() {
  const { view, instanceId, runs } = useStore()
  const run = runs.find((item) => item.id === instanceId)
  switch (view.name) {
    case "workflows":
      return <WorkflowLibrary />
    case "workflow-editor":
      return view.params?.id ? (
        <CatalogWorkflowEditor key={`${view.params.id}@${view.params.version}`} />
      ) : (
        <WorkflowEditor />
      )
    case "catalog":
    case "inserts":
      return <CatalogScreen />
    case "documents":
      if (run?.document === "coa") return <CoaDocument />
      if (run?.document === "strategic") return <DocumentWorkspace />
      if (run?.document === "mission") return <MissionDocument />
      return <ContextProfiles />
    case "changesets":
      return <ChangeSetList />
    case "changeset-review":
      return <ChangeSetReview />
    case "version-history":
      return <VersionHistory />
    case "graph":
      return <DependencyGraph />
    case "contexts":
      return <ContextProfiles />
    case "audit":
      return <AuditLog />
    default:
      return <WorkflowLibrary />
  }
}

export function ClientApp({ missionRecords }: { missionRecords: CatalogRecord[] }) {
  return (
    <TooltipProvider>
      <StoreProvider missionRecords={missionRecords}>
        <AppShell>
          <ScreenRouter />
        </AppShell>
        <Toaster position="bottom-right" richColors />
      </StoreProvider>
    </TooltipProvider>
  )
}
