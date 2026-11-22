import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, CheckCheck, Info, Mail, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ConfirmAction, Empty, NativeSelect, Pill, Spinner } from "../components/widgets"
import { acknowledgeAlert, acknowledgeAlerts, fetchAlerts } from "../lib/api"
import { formatDateTime, timeAgo } from "../lib/format"
import type { AlertCounts, AlertSeverity, SecurityAlert } from "../lib/types"

const PAGE = 50
const SEVERITY_ICON = { critical: ShieldAlert, warning: AlertTriangle, info: Info }
const SEVERITY_RING: Record<AlertSeverity, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
}

const changed = () => window.dispatchEvent(new Event("control:alerts-changed"))

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[] | null>(null)
  const [open, setOpen] = useState<AlertCounts>({ critical: 0, warning: 0, info: 0 })
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<"open" | "acknowledged" | "all">("open")
  const [severity, setSeverity] = useState<AlertSeverity | "">("")
  const [tenant, setTenant] = useState("")
  const [ackAll, setAckAll] = useState(false)

  const load = (off = 0) => fetchAlerts({ status, severity, tenant: tenant || undefined, limit: PAGE, offset: off })
    .then((r) => { setAlerts(r.results); setOpen(r.open); setCount(r.count); setOffset(off) })
    .catch((e) => toast.error(e.message))
  useEffect(() => { void load(0) }, [status, severity]) // eslint-disable-line react-hooks/exhaustive-deps

  const ack = async (alert: SecurityAlert) => {
    try {
      const r = await acknowledgeAlert(alert.id)
      setOpen(r.open)
      toast.success("Alert acknowledged")
      changed()
      void load(offset)
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monitoring" title="Security alerts"
        description="Attacks on companies, developer sign-ins from new places, suspended or expiring companies and failed backups. Warnings and critical alerts are also e-mailed to owners and admins." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open critical" value={open.critical} icon={ShieldAlert} tone={open.critical ? "red" : "emerald"}
          active={severity === "critical"} onClick={() => { setStatus("open"); setSeverity(severity === "critical" ? "" : "critical") }} />
        <StatTile label="Open warnings" value={open.warning} icon={AlertTriangle} tone={open.warning ? "amber" : "emerald"}
          active={severity === "warning"} onClick={() => { setStatus("open"); setSeverity(severity === "warning" ? "" : "warning") }} />
        <StatTile label="Open info" value={open.info} icon={Info} tone="sky"
          active={severity === "info"} onClick={() => { setStatus("open"); setSeverity(severity === "info" ? "" : "info") }} />
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void load(0) }}>
        <NativeSelect className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="all">All</option>
        </NativeSelect>
        <NativeSelect className="sm:w-44" value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity | "")}>
          <option value="">Any severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
        </NativeSelect>
        <Input placeholder="Company identifier" value={tenant} onChange={(e) => setTenant(e.target.value)} />
        <Button type="submit" variant="outline">Filter</Button>
        {status === "open" && count > 0 && (
          <Button type="button" variant="outline" onClick={() => setAckAll(true)}><CheckCheck className="h-4 w-4" /> Acknowledge all</Button>
        )}
      </form>

      {!alerts ? <div className="flex justify-center p-10"><Spinner className="h-5 w-5" /></div> : alerts.length === 0 ? (
        <Empty>{status === "open" ? "No open alerts — all clear." : "No alerts match."}</Empty>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const Icon = SEVERITY_ICON[a.severity]
            return (
              <article key={a.id} className={cn("rounded-xl border border-l-4 bg-card p-4 shadow-sm", SEVERITY_RING[a.severity], a.acknowledged_at && "opacity-70")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", a.severity === "critical" ? "text-red-500" : a.severity === "warning" ? "text-amber-500" : "text-sky-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{a.title}</h3>
                      <Pill value={a.severity} />
                      {a.occurrences > 1 && <Pill value="inactive" label={`×${a.occurrences}`} />}
                      {a.emailed && <span title="E-mailed to the team"><Mail className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                    </div>
                    {a.message && <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>First {formatDateTime(a.created_at)}</span>
                      <span>Last {timeAgo(a.last_seen_at)}</span>
                      {a.tenant_slug && <Link className="font-mono text-sky-600 hover:underline" to={`/companies/${a.tenant_slug}`}>{a.tenant_slug}</Link>}
                      {a.acknowledged_at && <span>Acknowledged by {a.acknowledged_by ?? "—"} {timeAgo(a.acknowledged_at)}{a.acknowledged_note && ` — ${a.acknowledged_note}`}</span>}
                    </div>
                  </div>
                  {!a.acknowledged_at && (
                    <Button size="sm" variant="outline" onClick={() => ack(a)}><CheckCheck className="h-4 w-4" /> Acknowledge</Button>
                  )}
                </div>
              </article>
            )
          })}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{count.toLocaleString()} alert(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>Newer</Button>
              <Button size="sm" variant="outline" disabled={offset + PAGE >= count} onClick={() => load(offset + PAGE)}>Older</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmAction open={ackAll} onOpenChange={setAckAll} title="Acknowledge every open alert?"
        description="Use this after you have reviewed them. The acknowledgement is recorded in the audit log." confirmText="Acknowledge all"
        onConfirm={() => acknowledgeAlerts(alerts?.filter((a) => !a.acknowledged_at).map((a) => a.id) ?? [])
          .then((r) => { toast.success(`${r.acknowledged} alert(s) acknowledged`); changed(); void load(0) })
          .catch((e) => toast.error(e.message))} />
    </div>
  )
}
