import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Cpu, Database, GitBranch, HardDrive, MemoryStick, RefreshCw, Server } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmAction, Panel, Pill, Spinner, UsageBar } from "../components/widgets"
import { fetchHealth, migrateAll } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatBytes } from "../lib/format"
import type { HealthData } from "../lib/types"

export default function HealthPage() {
  const { can } = useControlAuth()
  const [data, setData] = useState<HealthData | null>(null)
  const [withMigrations, setWithMigrations] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = useCallback(() => {
    fetchHealth(withMigrations).then(setData).catch((e) => toast.error(e.message))
  }, [withMigrations])
  useEffect(() => { load() }, [load])

  const runAll = async () => {
    setBusy(true)
    try {
      const res = await migrateAll()
      const failed = res.results.filter((r) => !r.ok)
      if (failed.length) toast.error(`${failed.length} failed: ${failed.map((f) => f.slug).join(", ")}`)
      else toast.success(`Migrated ${res.results.length} databases`)
      load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const s = data?.server
  const pendingTotal = data?.companies.reduce((n, c) => n + (c.pending_migrations?.length ?? 0), 0) ?? 0
  const down = data?.companies.filter((c) => !c.ok).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monitoring" title="System health"
        description="Server resources, the control database and every company database."
        actions={<>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withMigrations} onChange={(e) => setWithMigrations(e.target.checked)} /> Check migrations</label>
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Re-check</Button>
          {can("db.maintain") && <Button onClick={() => setConfirm(true)} disabled={busy}>{busy ? <Spinner /> : <GitBranch className="h-4 w-4" />} Migrate all</Button>}
        </>} />

      {!data || !s ? <div className="flex justify-center p-16"><Spinner className="h-6 w-6" /></div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Control database" value={s.control_db.ok ? `${s.control_db.latency_ms} ms` : "DOWN"} icon={Database}
              tone={s.control_db.ok ? "emerald" : "red"} hint={s.control_db.engine} />
            <StatTile label="Company databases" value={`${data.companies.length - down}/${data.companies.length}`} icon={Server}
              tone={down ? "red" : "emerald"} hint={down ? `${down} unreachable` : "all reachable"} />
            <StatTile label="Pending migrations" value={withMigrations ? pendingTotal : "—"} icon={GitBranch} tone={pendingTotal ? "amber" : "sky"} />
            <StatTile label="CPU" value={s.cpu_count ?? "—"} icon={Cpu} tone="violet" hint={s.load_average ? `load ${s.load_average.join(" / ")}` : undefined} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={<span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Disk</span>}>
              <UsageBar percent={Math.round((s.disk.used_bytes / s.disk.total_bytes) * 100)} />
              <p className="mt-2 text-xs text-muted-foreground">{formatBytes(s.disk.used_bytes)} used · {formatBytes(s.disk.free_bytes)} free of {formatBytes(s.disk.total_bytes)}</p>
            </Panel>
            <Panel title={<span className="flex items-center gap-2"><MemoryStick className="h-4 w-4" /> Memory</span>}>
              {s.memory ? <>
                <UsageBar percent={Math.round(100 - (s.memory.available_bytes / s.memory.total_bytes) * 100)} />
                <p className="mt-2 text-xs text-muted-foreground">{formatBytes(s.memory.available_bytes)} available of {formatBytes(s.memory.total_bytes)}</p>
              </> : <p className="text-sm text-muted-foreground">Not available on this OS.</p>}
            </Panel>
            <Panel title="Runtime">
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Python</dt><dd>{s.python}</dd>
                <dt className="text-muted-foreground">Django</dt><dd>{s.django}</dd>
                <dt className="text-muted-foreground">Debug</dt><dd>{s.debug ? <span className="font-semibold text-amber-600">ON</span> : "off"}</dd>
                <dt className="text-muted-foreground">Platform</dt><dd className="truncate" title={s.platform}>{s.platform}</dd>
              </dl>
            </Panel>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead><TableHead>Engine</TableHead><TableHead>Connection</TableHead>
                  <TableHead>Migrations</TableHead><TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.companies.map((c) => (
                  <TableRow key={c.slug}>
                    <TableCell><Link to={`/companies/${c.slug}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                    <TableCell className="text-xs uppercase">{c.engine}</TableCell>
                    <TableCell>{c.ok ? <Pill value="active" label={`OK · ${c.latency_ms} ms`} /> : <Pill value="failed" label="Unreachable" />}</TableCell>
                    <TableCell>
                      {c.pending_migrations === undefined ? <span className="text-xs text-muted-foreground">—</span>
                        : c.pending_migrations.length ? <Pill value="warning" label={`${c.pending_migrations.length} pending`} />
                        : <Pill value="active" label="Up to date" />}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-xs text-muted-foreground" title={c.error || c.pending_migrations?.join(", ")}>
                      {c.error || c.pending_migrations_error || c.pending_migrations?.slice(0, 3).join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Migrate every company database?"
        description="Applies pending migrations to each company database one by one. Run it after deploying a new backend version."
        confirmText="Run migrations" onConfirm={runAll} />
    </div>
  )
}
