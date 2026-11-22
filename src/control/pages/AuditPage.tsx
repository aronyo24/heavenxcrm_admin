import { Fragment, useEffect, useState } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, NativeSelect, Pill, Spinner } from "../components/widgets"
import { fetchAudit } from "../lib/api"
import { formatDateTime, humanizeAction } from "../lib/format"
import type { AuditEntry } from "../lib/types"

const PAGE = 50
const ACTION_GROUPS = [
  ["", "All actions"], ["auth", "Sign-ins"], ["tenant", "Company changes"], ["data", "Data access"],
  ["security", "Security"], ["announcement", "Announcements"], ["backup", "Backups"], ["db", "Database maintenance"], ["team", "Team"], ["plan", "Plans"], ["storage", "Storage"],
]

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState({ tenant: "", developer: "", action: "", success: "" })
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = (off = 0) => {
    fetchAudit({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), limit: PAGE, offset: off })
      .then((r) => { setEntries(r.results); setCount(r.count); setOffset(off) })
      .catch((e) => toast.error(e.message))
  }
  useEffect(() => { load(0) }, [filters.action, filters.success]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Audit log" description="Append-only record of every developer sign-in, change and company data access." />
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); load(0) }}>
        <Input placeholder="Company identifier" value={filters.tenant} onChange={(e) => setFilters({ ...filters, tenant: e.target.value })} />
        <Input placeholder="Developer email" value={filters.developer} onChange={(e) => setFilters({ ...filters, developer: e.target.value })} />
        <NativeSelect value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
          {ACTION_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
        <NativeSelect className="sm:w-40" value={filters.success} onChange={(e) => setFilters({ ...filters, success: e.target.value })}>
          <option value="">Any result</option><option value="1">Succeeded</option><option value="0">Failed</option>
        </NativeSelect>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {!entries ? <div className="p-8"><Spinner /></div> : entries.length === 0 ? <div className="p-6"><Empty>No entries.</Empty></div> : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>When</TableHead><TableHead>Developer</TableHead><TableHead>Action</TableHead><TableHead>Company</TableHead><TableHead>Target / reason</TableHead><TableHead>IP</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((a) => (
                <Fragment key={a.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-xs">{a.developer_email || "system"}</TableCell>
                    <TableCell><span className="text-sm font-medium">{humanizeAction(a.action)}</span> {!a.success && <Pill value="failed" />}</TableCell>
                    <TableCell className="font-mono text-xs">{a.tenant_slug || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{a.target}{a.reason && ` — ${a.reason}`}</TableCell>
                    <TableCell className="font-mono text-xs">{a.ip_address}</TableCell>
                  </TableRow>
                  {expanded === a.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/40">
                        <pre className="whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify({ details: a.details, reason: a.reason, user_agent: a.user_agent }, null, 2)}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{count.toLocaleString()} entries</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>Newer</Button>
            <Button size="sm" variant="outline" disabled={offset + PAGE >= count} onClick={() => load(offset + PAGE)}>Older</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
