import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Database, FileText, HardDrive, Image, RefreshCw } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, Panel, Pill, Spinner, UsageBar } from "../components/widgets"
import { fetchStorage, refreshAllStorage } from "../lib/api"
import { formatBytes, formatMb, timeAgo } from "../lib/format"

type StorageData = Awaited<ReturnType<typeof fetchStorage>>

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => fetchStorage().then(setData).catch((e) => toast.error(e.message)), [])
  useEffect(() => { void load() }, [load])

  const refresh = async () => {
    setBusy(true)
    try { const r = await refreshAllStorage(); toast.success(`Measured ${r.refreshed} companies`); await load() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const totals = useMemo(() => {
    const rows = data?.companies ?? []
    const sum = (k: "database_bytes" | "documents_bytes" | "images_bytes" | "other_files_bytes") => rows.reduce((s, r) => s + (r.usage?.[k] ?? 0), 0)
    return {
      db: sum("database_bytes"), docs: sum("documents_bytes"), images: sum("images_bytes"), other: sum("other_files_bytes"),
      allocated: rows.reduce((s, r) => s + (r.storage_limit_mb ?? 0), 0),
      alerts: rows.filter((r) => r.usage?.alert),
    }
  }, [data])

  if (!data) return <div className="flex justify-center p-16"><Spinner className="h-6 w-6" /></div>
  const sorted = [...data.companies].sort((a, b) => (b.usage?.usage_percent ?? -1) - (a.usage?.usage_percent ?? -1))
  const chart = [...data.companies]
    .sort((a, b) => (b.usage?.total_bytes ?? 0) - (a.usage?.total_bytes ?? 0)).slice(0, 12)
    .map((r) => ({
      name: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name,
      Database: +((r.usage?.database_bytes ?? 0) / 1048576).toFixed(1),
      Documents: +((r.usage?.documents_bytes ?? 0) / 1048576).toFixed(1),
      Images: +((r.usage?.images_bytes ?? 0) / 1048576).toFixed(1),
      Other: +((r.usage?.other_files_bytes ?? 0) / 1048576).toFixed(1),
    }))

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monitoring" title="Storage"
        description={`Database and file storage per company. Alerts at ${data.warn_percent}% and ${data.critical_percent}% of the allocation.`}
        actions={<Button onClick={refresh} disabled={busy}>{busy ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Measure all now</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Databases" value={formatBytes(totals.db)} icon={Database} tone="violet" />
        <StatTile label="Documents" value={formatBytes(totals.docs)} icon={FileText} tone="sky" />
        <StatTile label="Images & media" value={formatBytes(totals.images + totals.other)} icon={Image} tone="emerald" />
        <StatTile label="Allocated" value={formatMb(totals.allocated)} icon={HardDrive} tone="amber"
          hint={`${totals.alerts.length} compan${totals.alerts.length === 1 ? "y" : "ies"} over ${data.warn_percent}%`} />
      </div>

      {totals.alerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <p>
            <span className="font-semibold">{totals.alerts.map((a) => a.name).join(", ")}</span> {totals.alerts.length === 1 ? "is" : "are"} approaching the storage limit.
            Increase the allocation on the company's Settings tab.
          </p>
        </div>
      )}

      <Panel title="Storage by company (MB)" description="Largest 12">
        {chart.length ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={44} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Database" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Documents" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="Images" stackId="a" fill="#10b981" />
                <Bar dataKey="Other" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty>No measurements yet.</Empty>}
      </Panel>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Database</TableHead>
                <TableHead className="text-right">Documents</TableHead>
                <TableHead className="text-right">Images</TableHead>
                <TableHead className="text-right">Total files</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="min-w-[170px]">Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const u = r.usage
                const limit = (r.storage_limit_mb ?? 0) * 1048576
                return (
                  <TableRow key={r.slug}>
                    <TableCell>
                      <Link to={`/companies/${r.slug}`} className="font-medium hover:underline">{r.name}</Link>
                      <p className="text-[11px] text-muted-foreground">{r.plan ?? "No plan"} · {u ? timeAgo(u.collected_at) : "not measured"}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(u?.database_bytes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(u?.documents_bytes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(u?.images_bytes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(u?.file_bytes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMb(r.storage_limit_mb)}</TableCell>
                    <TableCell className="text-right tabular-nums">{u && limit ? formatBytes(Math.max(0, limit - u.total_bytes)) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UsageBar percent={u?.usage_percent} className="flex-1" />
                        {u?.alert && <Pill value={u.alert} />}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
