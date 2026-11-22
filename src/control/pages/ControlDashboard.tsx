import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle, Building2, CheckCircle2, Database, FileText, GraduationCap, HardDrive, PauseCircle, Plus, ShieldAlert, Users,
  XCircle,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Empty, Panel, Pill, Spinner, UsageBar } from "../components/widgets"
import { fetchAlertSummary, fetchDashboard } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatBytes, formatDate, formatMb, humanizeAction, timeAgo } from "../lib/format"
import type { AlertCounts, DashboardData, SecurityAlert } from "../lib/types"

const PIE_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b"]
const tooltipStyle = { background: "hsl(var(--card, 0 0% 100%))", borderRadius: 8, fontSize: 12, border: "1px solid rgba(100,116,139,.25)" }

export default function ControlDashboard() {
  const { can } = useControlAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<{ open: AlertCounts; latest: SecurityAlert[] } | null>(null)

  useEffect(() => {
    fetchDashboard().then(setData).catch((e) => setError(e.message))
    if (can("security.view")) fetchAlertSummary().then(setAlerts).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Empty>{error}</Empty>
  if (!data) return <div className="flex justify-center p-16"><Spinner className="h-6 w-6" /></div>

  const { companies, records, storage, subscriptions, health } = data
  const diskPct = Math.round((health.disk.used_bytes / health.disk.total_bytes) * 100)
  const storageChart = storage.top.map((r) => ({
    name: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name,
    Database: +(r.database_bytes / 1048576).toFixed(1),
    Files: +(r.file_bytes / 1048576).toFixed(1),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform overview"
        title="HeavenxCRM Control Center"
        description="All companies, databases and storage across the platform."
        actions={can("tenants.manage") && (
          <Button asChild><Link to="/companies/new"><Plus className="h-4 w-4" /> New company</Link></Button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Companies" value={companies.total} icon={Building2} tone="sky"
          hint={`${companies.provisioning} provisioning · ${companies.failed} failed`} />
        <StatTile label="Active" value={companies.active} icon={CheckCircle2} tone="emerald"
          hint={`${companies.maintenance} in maintenance`} />
        <StatTile label="Suspended" value={companies.suspended} icon={PauseCircle} tone="amber"
          hint={`${subscriptions.expired} subscriptions expired`} />
        <StatTile label="Inactive" value={companies.inactive} icon={XCircle} tone="slate" />
        <StatTile label="Active users (all companies)" value={records.users.toLocaleString()} icon={Users} tone="violet"
          hint={`${records.staff.toLocaleString()} staff accounts`} />
        <StatTile label="Leads & students" value={records.leads.toLocaleString()} icon={GraduationCap} tone="sky" />
        <StatTile label="Applications" value={records.applications.toLocaleString()} icon={FileText} tone="emerald" />
        <StatTile label="Total storage" value={formatBytes(storage.database_bytes + storage.file_bytes)} icon={HardDrive} tone="amber"
          hint={`DB ${formatBytes(storage.database_bytes)} · files ${formatBytes(storage.file_bytes)}`} />
      </div>
      <p className="-mt-3 text-[11px] text-muted-foreground">
        Usage figures from the last measurement {timeAgo(storage.last_collected_at)} ·{" "}
        <Link to="/storage" className="underline-offset-2 hover:underline">refresh on the Storage page</Link>
      </p>

      {alerts && alerts.open.critical + alerts.open.warning > 0 && (
        <div className={`rounded-xl border p-4 ${alerts.open.critical ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`flex items-center gap-2 text-sm font-semibold ${alerts.open.critical ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
              <ShieldAlert className="h-4 w-4" />
              {alerts.open.critical > 0 && `${alerts.open.critical} critical`}
              {alerts.open.critical > 0 && alerts.open.warning > 0 && " · "}
              {alerts.open.warning > 0 && `${alerts.open.warning} warning`} security alert{alerts.open.critical + alerts.open.warning === 1 ? "" : "s"} need attention
            </p>
            <Button asChild size="sm" variant="outline"><Link to="/alerts">Review alerts</Link></Button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {alerts.latest.filter((a) => a.severity !== "info").slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Pill value={a.severity} /> <span className="truncate">{a.title}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{timeAgo(a.last_seen_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {storage.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {storage.alerts.length} compan{storage.alerts.length === 1 ? "y is" : "ies are"} near the storage limit
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {storage.alerts.map((a) => (
              <Link key={a.slug} to={`/companies/${a.slug}`} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm shadow-sm hover:shadow">
                <Pill value={a.level ?? "warning"} />
                <span className="flex-1 truncate font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(a.total_bytes)} / {formatMb(a.storage_limit_mb)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Company registrations" description="New companies per month" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.registrations_by_month}>
                <defs>
                  <linearGradient id="reg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" name="Companies" stroke="#0ea5e9" fill="url(#reg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Subscription plans" description="Companies per plan">
          {subscriptions.plans.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subscriptions.plans} dataKey="count" nameKey="plan" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {subscriptions.plans.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty>No companies yet.</Empty>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {subscriptions.plans.map((p, i) => (
              <span key={p.plan} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {p.plan} ({p.count})
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Storage by company" description="Top 10, in MB" className="lg:col-span-2">
          {storageChart.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storageChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,.15)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Database" stackId="s" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Files" stackId="s" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty>No company has finished setting up yet.</Empty>}
        </Panel>
        <Panel title="Server & database health">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" /> Control database</span>
              {health.control_db.ok
                ? <Pill value="active" label={`OK · ${health.control_db.latency_ms} ms`} />
                : <Pill value="failed" label="Down" />}
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Server disk</span><span>{formatBytes(health.disk.free_bytes)} free</span>
              </div>
              <UsageBar percent={diskPct} />
            </div>
            {health.memory && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Memory</span><span>{formatBytes(health.memory.available_bytes)} available</span>
                </div>
                <UsageBar percent={Math.round(100 - (health.memory.available_bytes / health.memory.total_bytes) * 100)} />
              </div>
            )}
            {health.load_average && (
              <p className="text-xs text-muted-foreground">Load average: {health.load_average.join(" · ")}</p>
            )}
            <Button asChild variant="outline" size="sm" className="w-full"><Link to="/health">Open health monitor</Link></Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent companies" action={<Link to="/companies" className="text-xs text-sky-600 hover:underline">View all</Link>}>
          {data.recent_companies.length ? (
            <div className="divide-y">
              {data.recent_companies.map((t) => (
                <Link key={t.slug} to={`/companies/${t.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sm font-bold text-sky-700 dark:text-sky-300">
                    {t.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.workspace_url.replace(/^https?:\/\//, "")}</p>
                  </div>
                  <div className="text-right">
                    <Pill value={t.provisioning_status === "ready" ? t.status : t.provisioning_status} />
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(t.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : <Empty>No companies yet.</Empty>}
        </Panel>
        <Panel title="Recent developer activity" action={can("audit.view") && <Link to="/audit" className="text-xs text-sky-600 hover:underline">Audit log</Link>}>
          {data.recent_activity.length ? (
            <ul className="space-y-2.5">
              {data.recent_activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${a.success ? "bg-emerald-500" : "bg-red-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate"><span className="font-medium">{humanizeAction(a.action)}</span>
                      {a.tenant_slug && <span className="text-muted-foreground"> · {a.tenant_slug}</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.developer_email || "system"} · {timeAgo(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty>No activity yet.</Empty>}
        </Panel>
      </div>

      {subscriptions.expiring_soon.length > 0 && (
        <Panel title="Subscriptions expiring in the next 30 days">
          <div className="flex flex-wrap gap-2">
            {subscriptions.expiring_soon.map((s) => (
              <Link key={s.slug} to={`/companies/${s.slug}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                {s.name} <span className="text-muted-foreground">· {formatDate(s.subscription_end)}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
