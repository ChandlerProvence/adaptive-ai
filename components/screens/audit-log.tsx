"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Search } from "lucide-react"

export function AuditLog() {
  const { audit } = useStore()
  const [query, setQuery] = React.useState("")

  const q = query.trim().toLowerCase()
  const rows = q
    ? audit.filter((a) =>
        [a.actor, a.action, a.entity, a.previous, a.next, a.correlationId].some((f) => f.toLowerCase().includes(q)),
      )
    : audit

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-lg font-semibold">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Append-only record of every state transition, with who, what, before, after, and a correlation ID.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-6 py-3">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by actor, action, entity, correlation ID"
                className="pl-8"
                aria-label="Filter audit log"
              />
            </div>
            <span className="text-xs text-muted-foreground">{rows.length} entries</span>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-6 pb-6">
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Previous → Next</TableHead>
                    <TableHead className="w-28">Correlation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.at}</TableCell>
                      <TableCell className="text-sm font-medium">{a.actor}</TableCell>
                      <TableCell className="text-sm">{a.action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.entity}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="text-muted-foreground">{a.previous}</span>
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <span>{a.next}</span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setQuery(a.correlationId)}
                          className="font-mono text-xs text-primary hover:underline"
                          title="Show all entries from this operation"
                        >
                          {a.correlationId}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
      </div>
    </div>
  )
}
