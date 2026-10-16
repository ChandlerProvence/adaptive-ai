import type { DocSection } from "./mock-data"

export type SeedSection = Omit<DocSection, "canonicalHtml">

export function seedDocSections(): SeedSection[] {
  return [
    {
      id: "sec-exec-summary",
      title: "Executive Summary",
      canonicalVersion: "V3",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-880",
      bodyHtml:
        "<p>This assessment evaluates the Market Expansion Initiative and its readiness for an executive go / no-go decision, synthesizing environment, narrative, constraint, and risk analysis into a single decision-support view.</p>",
      dependencies: [
        { name: "Recommendation", generatedWith: "V6", current: "V6", state: "Current" },
        { name: "Narrative Assessment", generatedWith: "V4", current: "V4", state: "Current" },
      ],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-08-02", contentHash: "9f2a…c41", approvedBy: "Alex Morgan" },
        { version: "V2", label: "Change Set", changeSet: "CS-011", date: "2026-08-21", approvedBy: "Jordan Lee", contentHash: "b7d0…18e" },
        { version: "V3", label: "Change Set", changeSet: "CS-016", date: "2026-09-06", approvedBy: "Alex Morgan", contentHash: "3ce4…9a2" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Recommendation Development V3",
        purpose: "Executive Decision Support V3",
        prompt: "Executive Summary V3",
        artifactSchema: "Executive Brief V2",
        customInserts: ["Executive Summary"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-exec-context",
      title: "Executive Context",
      canonicalVersion: "V4",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-812",
      bodyHtml:
        "<p>The Market Expansion Initiative evaluates entry into two adjacent regional markets over an 18-month horizon. This section establishes scope, decision authority, and the framing questions the assessment must answer.</p>",
      dependencies: [],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-07-20", contentHash: "1aa2…77b", approvedBy: "Alex Morgan" },
        { version: "V2", label: "Change Set", changeSet: "CS-004", date: "2026-08-01", approvedBy: "Sam Patel", contentHash: "55cd…021" },
        { version: "V3", label: "Change Set", changeSet: "CS-010", date: "2026-08-19", approvedBy: "Jordan Lee", contentHash: "9b1e…4d3" },
        { version: "V4", label: "Change Set", changeSet: "CS-015", date: "2026-09-04", approvedBy: "Alex Morgan", contentHash: "e0f7…8c6" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Constraint Extraction V4",
        purpose: "Executive Decision Support V3",
        prompt: "Executive Context V2",
        artifactSchema: "Context Frame V1",
        customInserts: ["Supporting Context"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-environment",
      title: "Environment",
      canonicalVersion: "V4",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-820",
      bodyHtml:
        "<p>Environmental conditions across both target markets are assessed below, covering demand signals, regulatory posture, and competitive intensity. Demand growth is uneven, with pricing pressure concentrated in the primary region.</p>",
      dependencies: [{ name: "Executive Context", generatedWith: "V4", current: "V4", state: "Current" }],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-07-22", contentHash: "2b3c…9f0", approvedBy: "Jordan Lee" },
        { version: "V4", label: "Change Set", changeSet: "CS-013", date: "2026-09-01", approvedBy: "Alex Morgan", contentHash: "77ab…33d" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Comparative Assessment V3",
        purpose: "Analyst Working Draft V2",
        prompt: "Environment Analysis V4",
        artifactSchema: "Environment Findings V3",
        customInserts: ["Trend Analysis", "Quantitative Detail"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-narrative",
      title: "Narrative Assessment",
      canonicalVersion: "V4",
      workingState: "Modified",
      changeSet: null,
      generation: "GEN-842",
      bodyHtml:
        "<h2>Narrative Assessment</h2><p>Two dominant narratives shape the market-entry opportunity. The first frames expansion as a defensive necessity driven by margin compression in the core market. The second frames it as an offensive growth play enabled by an emerging demand pocket in the secondary region.</p><p>Sources materially disagree on the durability of the secondary-region demand signal. Field reporting treats it as structural; competitor filings treat it as promotional and temporary. This disagreement is the single most decision-relevant point of contention.</p><p>A supporting narrative asserts limited regulatory friction, but this claim is currently under-evidenced and rests on a single source. Recent working edits add that any entry approach must account for customer data residency constraints in the primary market.</p>",
      dependencies: [
        { name: "Environment", generatedWith: "V4", current: "V4", state: "Current" },
        { name: "Actor Assessment", generatedWith: "V3", current: "V3", state: "Current" },
        { name: "Market Context", generatedWith: "V2", current: "V2", state: "Current" },
      ],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-07-25", contentHash: "aa10…2ff", approvedBy: "Alex Morgan" },
        { version: "V2", label: "Change Set", changeSet: "CS-009", date: "2026-08-12", approvedBy: "Jordan Lee", contentHash: "c2d4…5b1" },
        { version: "V3", label: "Change Set", changeSet: "CS-014", date: "2026-08-28", approvedBy: "Sam Patel", contentHash: "6e88…0a7" },
        { version: "V4", label: "Change Set", changeSet: "CS-018", date: "2026-09-08", approvedBy: "Alex Morgan", contentHash: "40bd…9c2" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Narrative Analysis V2",
        purpose: "Executive Decision Support V3",
        prompt: "Narrative Analysis V5",
        artifactSchema: "Narrative Findings V2",
        customInserts: ["Source Comparison V1", "Contradiction Detection V2"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-constraints",
      title: "Constraints",
      canonicalVersion: "V9",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-861",
      bodyHtml:
        "<p>Binding constraints include a fixed 18-month funding envelope, existing distribution commitments, and a newly introduced customer data residency requirement in the primary market (introduced in V9).</p>",
      dependencies: [{ name: "Executive Context", generatedWith: "V4", current: "V4", state: "Current" }],
      history: [
        { version: "V8", label: "Change Set", changeSet: "CS-017", date: "2026-09-05", approvedBy: "Sam Patel", contentHash: "18fa…3c0" },
        { version: "V9", label: "Change Set", changeSet: "CS-019", date: "2026-09-15", approvedBy: "Alex Morgan", contentHash: "9d2b…7e4" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Constraint Extraction V4",
        purpose: "Analyst Working Draft V2",
        prompt: "Constraint Extraction V3",
        artifactSchema: "Constraint Set V2",
        customInserts: ["Completeness Check"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-alternatives",
      title: "Alternatives",
      canonicalVersion: "V3",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-848",
      bodyHtml:
        "<p>Three alternatives are developed: sequential single-market entry (A), parallel dual-market entry (B), and a partnership-led entry (C).</p>",
      dependencies: [{ name: "Constraints", generatedWith: "V9", current: "V9", state: "Current" }],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-07-28", contentHash: "5f1a…8b2", approvedBy: "Jordan Lee" },
        { version: "V3", label: "Change Set", changeSet: "CS-012", date: "2026-08-26", approvedBy: "Alex Morgan", contentHash: "70cd…14a" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Comparative Assessment V3",
        purpose: "Analyst Working Draft V2",
        prompt: "Alternatives Development V3",
        artifactSchema: "Alternatives Matrix V2",
        customInserts: ["Alternative Comparison"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-risk",
      title: "Risk Assessment",
      canonicalVersion: "V5",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-855",
      staleReason: "Constraints changed from V8 → V9 after this section was generated.",
      staleImpact: "Medium",
      staleSummary: "V9 introduces a customer data residency constraint that may change the risk grading for Alternative B.",
      bodyHtml:
        "<p>The dominant risks concentrate around Alternative B, where parallel execution amplifies exposure to competitor response and execution complexity.</p>",
      dependencies: [
        { name: "Constraints", generatedWith: "V8", current: "V9", state: "Changed" },
        { name: "Alternatives", generatedWith: "V3", current: "V3", state: "Current" },
      ],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-07-30", contentHash: "8a2c…41f", approvedBy: "Sam Patel" },
        { version: "V5", label: "Change Set", changeSet: "CS-016", date: "2026-09-06", approvedBy: "Jordan Lee", contentHash: "cc90…2b8" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Risk Analysis V2",
        purpose: "Analyst Working Draft V2",
        prompt: "Risk Analysis V3",
        artifactSchema: "Risk Register V2",
        customInserts: ["Assumption Analysis"],
        context: "Market Expansion Initiative V3",
      },
    },
    {
      id: "sec-recommendation",
      title: "Recommendation",
      canonicalVersion: "V6",
      workingState: "Current",
      changeSet: null,
      generation: "GEN-910",
      staleReason: "Constraints changed from V8 → V9 after this section was generated.",
      staleImpact: "High",
      staleSummary: "V9 introduces a new operational constraint that may affect the viability of Alternative B.",
      bodyHtml:
        "<p>The assessment recommends Alternative A (sequential single-market entry) as the preferred course of action, preserving optionality on the secondary market pending stronger demand evidence.</p>",
      dependencies: [
        { name: "Environment", generatedWith: "V4", current: "V4", state: "Current" },
        { name: "Constraints", generatedWith: "V8", current: "V9", state: "Changed" },
        { name: "Alternatives", generatedWith: "V3", current: "V3", state: "Current" },
      ],
      history: [
        { version: "V1", label: "Initial AI Generation", date: "2026-08-01", contentHash: "2200…9de", approvedBy: "Alex Morgan" },
        { version: "V6", label: "Change Set", changeSet: "CS-016", date: "2026-09-06", approvedBy: "Alex Morgan", contentHash: "7f3a…6b1" },
      ],
      config: {
        workflowSchema: "Strategic Assessment — Narrative Focus V3",
        task: "Recommendation Development V3",
        purpose: "Executive Decision Support V3",
        prompt: "Recommendation Development V4",
        artifactSchema: "Recommendation Brief V2",
        customInserts: ["Evidence Check"],
        context: "Market Expansion Initiative V3",
      },
    },
  ]
}

