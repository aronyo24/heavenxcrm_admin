import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Database, Download, ExternalLink, Eye, HardDrive, ImagePlus, LogOut, Mail, PauseCircle, PlayCircle,
  GraduationCap, KeyRound, RefreshCw, RotateCcw, Save, Search, ShieldAlert, Trash2, Users, Wrench,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmAction, Empty, Field, NativeSelect, PasswordInput, Panel, Pill, Spinner, UsageBar } from "../components/widgets"
import {
  apiUrl, backupDownloadUrl, clearSessions, createBackup, deleteTenant, fetchBackups, fetchDataset, fetchDatasets,
  fetchPlans, fetchProvisioning, fetchTenant, fetchTenantActivity, fetchTenantHealth, fetchUsageHistory,
  migrateTenant, refreshUsage, reprovisionTenant, resendInvite, restoreBackup, setAdminPassword, setMaintenance, updateTenant,
  uploadLogo,
} from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { SecurityTab } from "./CompanySecurityTab"
import { formatBytes, formatDate, formatDateTime, formatMb, humanizeAction, timeAgo } from "../lib/format"
import type { AuditEntry, Backup, DatasetPage, DbHealth, Plan, Tenant, Usage } from "../lib/types"

const err = (e: unknown) => toast.error((e as Error).message)

export default function CompanyDetail() {
  const { slug = "" } = useParams()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => fetchTenant(slug).then(setTenant).catch((e) => setError(e.message)), [slug])
  useEffect(() => { void load() }, [load])

  if (error) return <Empty>{error}</Empty>
  if (!tenant) return <div className="flex justify-center p-16"><Spinner className="h-6 w-6" /></div>

  if (tenant.provisioning_status !== "ready") {
    return <ProvisioningView tenant={tenant} onReady={load} />
  }
  return <ReadyView tenant={tenant} reload={load} setTenant={setTenant} />
}

function Header({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Link to="/companies" className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      {tenant.logo_url
        ? <img src={apiUrl(tenant.logo_url)} alt="" className="h-12 w-12 rounded-lg border bg-white object-contain p-1" />
        : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/10 text-lg font-bold text-sky-700 dark:text-sky-300">{tenant.name[0]}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          {tenant.provisioning_status === "ready" ? <Pill value={tenant.status} /> : <Pill value={tenant.provisioning_status} />}
          {tenant.maintenance_mode && <Pill value="maintenance" />}
          {tenant.subscription_expired && <Pill value="expired" label="Subscription expired" />}
          {tenant.is_primary && <Pill value="inactive" label="Primary database" />}
        </div>
        <a href={tenant.workspace_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline">
          {tenant.workspace_url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

function ProvisioningView({ tenant, onReady }: { tenant: Tenant; onReady: () => void }) {
  const { can } = useControlAuth()
  const [log, setLog] = useState("")
  const [status, setStatus] = useState(tenant.provisioning_status)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const p = await fetchProvisioning(tenant.slug)
        if (!alive) return
        setLog(p.provisioning_log)
        setStatus(p.provisioning_status as Tenant["provisioning_status"])
        if (p.provisioning_status === "ready") { toast.success("Workspace is live"); onReady() }
      } catch { /* keep polling */ }
    }
    void tick()
    const timer = setInterval(tick, 2000)
    return () => { alive = false; clearInterval(timer) }
  }, [tenant.slug, onReady])

  return (
    <div className="space-y-6">
      <Header tenant={{ ...tenant, provisioning_status: status }} />
      <Panel
        title={status === "failed" ? "Provisioning failed" : "Provisioning the workspace…"}
        description="Creating the database, applying the CRM schema and creating the administrator."
        action={status === "failed" && can("tenants.manage") && (
          <Button size="sm" onClick={() => reprovisionTenant(tenant.slug).then(() => setStatus("provisioning")).catch(err)}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        )}
      >
        <pre className="max-h-96 overflow-auto rounded-lg bg-[#0b1530] p-4 font-mono text-xs leading-relaxed text-cyan-100">
          {log || "Waiting for the provisioning job…"}
          {status !== "failed" && "\n▍"}
        </pre>
      </Panel>
      {status === "failed" && <DangerZone tenant={tenant} failed />}
    </div>
  )
}

function ReadyView({ tenant, reload, setTenant }: { tenant: Tenant; reload: () => void; setTenant: (t: Tenant) => void }) {
  const { can } = useControlAuth()
  const u = tenant.usage
  const [confirm, setConfirm] = useState<null | "suspend" | "maintenance" | "sessions" | "password">(null)
  const [adminPw, setAdminPw] = useState("")
  const [notifyAdmin, setNotifyAdmin] = useState(false)

  const toggleStatus = async (status: Tenant["status"], reason: string) => {
    const next = await updateTenant(tenant.slug, { status, status_reason: reason })
    setTenant(next)
    toast.success(`Company ${status === "active" ? "activated" : status}`)
  }

  return (
    <div className="space-y-6">
      <Header tenant={tenant} />

      <div className="flex flex-wrap gap-2">
        {can("tenants.manage") && (tenant.status === "active" ? (
          <Button variant="outline" size="sm" onClick={() => setConfirm("suspend")}><PauseCircle className="h-4 w-4" /> Suspend</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => toggleStatus("active", "").catch(err)}><PlayCircle className="h-4 w-4" /> Activate</Button>
        ))}
        {can("db.maintain") && (
          <Button variant="outline" size="sm" onClick={() => tenant.maintenance_mode
            ? setMaintenance(tenant.slug, false).then(setTenant).then(() => toast.success("Maintenance mode off")).catch(err)
            : setConfirm("maintenance")}>
            <Wrench className="h-4 w-4" /> {tenant.maintenance_mode ? "End maintenance" : "Maintenance mode"}
          </Button>
        )}
        {can("tenants.manage") && !tenant.is_primary && (
          <Button variant="outline" size="sm" onClick={() => resendInvite(tenant.slug).then((r) => {
            toast.success(r.sent ? "Invitation sent" : "Could not send the invitation")
            if (r.debug_link) console.info("Set-password link (DEBUG only):", r.debug_link)
          }).catch(err)}>
            <Mail className="h-4 w-4" /> Resend admin invite
          </Button>
        )}
        {can("tenants.manage") && !tenant.is_primary && (
          <Button variant="outline" size="sm" onClick={() => { setAdminPw(""); setNotifyAdmin(false); setConfirm("password") }}>
            <KeyRound className="h-4 w-4" /> Set admin password
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active users" value={u?.user_count ?? "—"} icon={Users} tone="sky"
          hint={u ? `${u.staff_count} staff (admin, manager, counselor)` : "not measured"} />
        <StatTile label="Leads & students" value={u?.lead_count ?? "—"} icon={GraduationCap} tone="violet" />
        <StatTile label="Applications" value={u?.application_count ?? "—"} icon={Database} tone="emerald" />
        <StatTile label="Storage" value={formatBytes(u?.total_bytes)} icon={HardDrive} tone={u?.alert === "critical" ? "red" : "amber"}
          hint={`of ${formatMb(tenant.effective_storage_limit_mb)} · ${u ? timeAgo(u.collected_at) : "not measured"}`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Settings</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          {can("security.view") && <TabsTrigger value="security">Security</TabsTrigger>}
          {can("backups.manage") && <TabsTrigger value="backups">Backups</TabsTrigger>}
          {can("data.inspect") && <TabsTrigger value="data">Data inspector</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><SettingsTab tenant={tenant} setTenant={setTenant} /></TabsContent>
        <TabsContent value="database" className="mt-4"><DatabaseTab tenant={tenant} onSessions={() => setConfirm("sessions")} /></TabsContent>
        <TabsContent value="storage" className="mt-4"><StorageTab tenant={tenant} reload={reload} /></TabsContent>
        {can("security.view") && <TabsContent value="security" className="mt-4"><SecurityTab tenant={tenant} /></TabsContent>}
        {can("backups.manage") && <TabsContent value="backups" className="mt-4"><BackupsTab tenant={tenant} /></TabsContent>}
        {can("data.inspect") && <TabsContent value="data" className="mt-4"><DataTab tenant={tenant} /></TabsContent>}
        <TabsContent value="activity" className="mt-4"><ActivityTab tenant={tenant} /></TabsContent>
      </Tabs>

      <DangerZone tenant={tenant} />

      <ConfirmAction open={confirm === "suspend"} onOpenChange={(o) => !o && setConfirm(null)}
        title={`Suspend ${tenant.name}?`} description="Every user of this company is blocked immediately (within ~30 seconds on all servers). Data is kept."
        requireReason confirmText="Suspend" destructive
        onConfirm={({ reason }) => toggleStatus("suspended", reason).catch(err)} />
      <ConfirmAction open={confirm === "maintenance"} onOpenChange={(o) => !o && setConfirm(null)}
        title="Turn on maintenance mode?" description="The workspace answers “under maintenance” until you turn it off."
        requireReason confirmText="Enable"
        onConfirm={({ reason }) => setMaintenance(tenant.slug, true, reason).then(setTenant).catch(err)} />
      <ConfirmAction open={confirm === "sessions"} onOpenChange={(o) => !o && setConfirm(null)}
        title="Sign out every user?" description="Deletes all sessions in this company's database. Users must sign in again."
        requireReason confirmText="Sign everyone out" destructive
        onConfirm={({ reason }) => clearSessions(tenant.slug, reason).then((r) => toast.success(`${r.cleared} session(s) cleared`)).catch(err)} />
      <ConfirmAction open={confirm === "password"} onOpenChange={(o) => { if (!o) { setConfirm(null); setAdminPw("") } }}
        title="Set the company admin password"
        description={<>Sets the login for <b>{tenant.admin_email}</b> — used for both the CRM and the company admin panel. Their current sessions are signed out. The password is stored only as a hash in the company database.</>}
        confirmText="Save password"
        onConfirm={() => {
          if (adminPw.length < 10) { toast.error("Use at least 10 characters."); return Promise.reject(new Error("short")) }
          return setAdminPassword(tenant.slug, adminPw, notifyAdmin).then((r) => {
            toast.success(`Password updated for ${r.email}${r.notified ? " — welcome email sent" : ""}`)
            setAdminPw("")
          }).catch((e) => { err(e); throw e })
        }}>
        <Field label="New password" hint="Copy it before saving — it is not shown again.">
          <PasswordInput value={adminPw} onChange={setAdminPw} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyAdmin} onChange={(e) => setNotifyAdmin(e.target.checked)} />
          Email them the sign-in address (the password is not included)
        </label>
      </ConfirmAction>
    </div>
  )
}

function DangerZone({ tenant, failed = false }: { tenant: Tenant; failed?: boolean }) {
  const { can } = useControlAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // A failed workspace has nothing worth backing up, so it is always purged.
  const [purge, setPurge] = useState(failed)
  if (!can("tenants.delete") || tenant.is_primary) return null

  return (
    <>
      <Panel className="border-red-500/40" title={<span className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-4 w-4" /> Danger zone</span>}
        description={failed
          ? "Remove this failed company: its database, credentials and any files are dropped."
          : "Deleting permanently drops the company database, its credentials and uploaded files."}>
        <Button variant="destructive" size="sm" onClick={() => { setPurge(failed); setOpen(true) }}><Trash2 className="h-4 w-4" /> Delete company</Button>
      </Panel>
      <ConfirmAction open={open} onOpenChange={setOpen}
        title={`Delete ${tenant.name} permanently?`}
        description={purge
          ? "Everything is erased: the database, its user, uploaded files, the logo and every backup. Nothing can be restored."
          : "A final backup is taken first and kept on the server. The database, its user and all files are removed."}
        requireSlug={tenant.slug} requireReason confirmText={purge ? "Delete with all data" : "Delete company"} destructive
        onConfirm={({ confirm: c, reason }) => deleteTenant(tenant.slug, c, reason, purge)
          .then(() => { toast.success(purge ? "Company and all its data deleted" : "Company deleted"); navigate("/companies") })
          .catch((e) => { err(e); throw e })}>
        {!failed && (
          <label className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={purge} onChange={(e) => setPurge(e.target.checked)} />
            <span>
              <b>Delete all data, including backups</b>
              <span className="block text-xs text-muted-foreground">Skips the final backup and erases every existing backup. Nothing can be restored.</span>
            </span>
          </label>
        )}
      </ConfirmAction>
    </>
  )
}

function SettingsTab({ tenant, setTenant }: { tenant: Tenant; setTenant: (t: Tenant) => void }) {
  const { can } = useControlAuth()
  const editable = can("tenants.manage")
  const [plans, setPlans] = useState<Plan[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: tenant.name, subdomain: tenant.subdomain, custom_domain: tenant.custom_domain ?? "",
    admin_name: tenant.admin_name, admin_email: tenant.admin_email, contact_phone: tenant.contact_phone,
    country: tenant.country, notes: tenant.notes, plan_id: tenant.plan ? String(tenant.plan.id) : "",
    subscription_start: tenant.subscription_start ?? "", subscription_end: tenant.subscription_end ?? "",
    storage_limit_mb: tenant.storage_limit_mb ? String(tenant.storage_limit_mb) : "", status: tenant.status,
  })
  useEffect(() => { fetchPlans().then(setPlans).catch(() => {}) }, [])
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    try {
      const next = await updateTenant(tenant.slug, {
        ...form,
        custom_domain: form.custom_domain || null,
        plan_id: form.plan_id ? Number(form.plan_id) : null,
        storage_limit_mb: form.storage_limit_mb ? Number(form.storage_limit_mb) : null,
        subscription_start: form.subscription_start || null,
        subscription_end: form.subscription_end || null,
      })
      setTenant(next)
      toast.success("Saved")
    } catch (e) { err(e) } finally { setBusy(false) }
  }

  const onLogo = async (file?: File) => {
    if (!file) return
    try { setTenant(await uploadLogo(tenant.slug, file)); toast.success("Logo updated") } catch (e) { err(e) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Company details" className="lg:col-span-2"
        action={editable && <Button size="sm" onClick={save} disabled={busy}>{busy ? <Spinner /> : <Save className="h-4 w-4" />} Save</Button>}>
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Identifier" hint="Fixed after creation"><Input value={tenant.slug} disabled /></Field>
          <Field label="Subdomain" hint={tenant.is_primary ? undefined : "Changing it moves the workspace to the new address."}>
            <Input value={form.subdomain} onChange={(e) => set("subdomain", e.target.value.toLowerCase())} />
          </Field>
          <Field label="Custom domain"><Input value={form.custom_domain} onChange={(e) => set("custom_domain", e.target.value.toLowerCase())} /></Field>
          <Field label="Administrator name"><Input value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} /></Field>
          <Field label="Administrator email" hint="Contact only — changing it does not change the login.">
            <Input type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
          </Field>
          <Field label="Phone"><Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
          <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </fieldset>
      </Panel>
      <div className="space-y-6">
        <Panel title="Subscription & status">
          <fieldset disabled={!editable} className="space-y-4">
            <Field label="Plan">
              <NativeSelect value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
                <option value="">No plan</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (inactive)"}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start"><Input type="date" value={form.subscription_start} onChange={(e) => set("subscription_start", e.target.value)} /></Field>
              <Field label="Expiry"><Input type="date" value={form.subscription_end} onChange={(e) => set("subscription_end", e.target.value)} /></Field>
            </div>
            <Field label="Storage allocation (MB)" hint={`Effective limit: ${formatMb(tenant.effective_storage_limit_mb)}`}>
              <Input type="number" min={1} value={form.storage_limit_mb} placeholder={tenant.plan ? String(tenant.plan.storage_limit_mb) : ""}
                onChange={(e) => set("storage_limit_mb", e.target.value)} />
            </Field>
            <Field label="Status">
              <NativeSelect value={form.status} onChange={(e) => set("status", e.target.value as Tenant["status"])}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </NativeSelect>
            </Field>
            {tenant.status_reason && <p className="text-xs text-muted-foreground">Last reason: {tenant.status_reason}</p>}
          </fieldset>
        </Panel>
        <Panel title="Logo">
          <label className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground ${editable ? "cursor-pointer hover:bg-muted/40" : ""}`}>
            {tenant.logo_url ? <img src={apiUrl(tenant.logo_url)} alt="" className="h-14 object-contain" /> : <ImagePlus className="h-6 w-6" />}
            {editable ? "Upload a new logo" : "No permission to change"}
            {editable && <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />}
          </label>
        </Panel>
        <Panel title="Record">
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{formatDateTime(tenant.created_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Provisioned</dt><dd>{formatDateTime(tenant.provisioned_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Updated</dt><dd>{formatDateTime(tenant.updated_at)}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  )
}

function DatabaseTab({ tenant, onSessions }: { tenant: Tenant; onSessions: () => void }) {
  const { can } = useControlAuth()
  const [health, setHealth] = useState<DbHealth | null>(null)
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const db = tenant.database

  const check = useCallback(() => { fetchTenantHealth(tenant.slug).then(setHealth).catch(err) }, [tenant.slug])
  useEffect(() => { check() }, [check])

  const migrate = async () => {
    setBusy(true)
    try {
      const res = await migrateTenant(tenant.slug, "Applied from the company page")
      setOutput(res.output)
      toast[res.ok ? "success" : "error"](res.ok ? "Migrations applied" : "Migration failed")
      check()
    } catch (e) { err(e) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Connection" description="Credentials are stored encrypted and never shown.">
        {db ? (
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Engine</dt><dd className="col-span-2 font-medium uppercase">{db.engine}</dd>
            <dt className="text-muted-foreground">Database</dt><dd className="col-span-2 break-all font-mono text-xs">{db.display_name}</dd>
            {db.host && <><dt className="text-muted-foreground">Host</dt><dd className="col-span-2 font-mono text-xs">{db.host}{db.port && `:${db.port}`}</dd></>}
            {db.user && <><dt className="text-muted-foreground">DB user</dt><dd className="col-span-2 font-mono text-xs">{db.user}</dd></>}
            <dt className="text-muted-foreground">Password</dt><dd className="col-span-2">{db.has_password ? "•••••••• (encrypted)" : "—"}</dd>
            <dt className="text-muted-foreground">Managed</dt><dd className="col-span-2">{db.managed ? "Created by the platform" : "External / primary"}</dd>
          </dl>
        ) : <Empty>No database.</Empty>}
      </Panel>
      <Panel title="Health & migrations" action={<Button variant="ghost" size="sm" onClick={check}><RefreshCw className="h-4 w-4" /></Button>}>
        {!health ? <Spinner /> : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Connection</span>
              {health.ok ? <Pill value="active" label={`OK · ${health.latency_ms} ms`} /> : <Pill value="failed" label="Unreachable" />}
            </div>
            {health.error && <p className="text-xs text-red-600">{health.error}</p>}
            <div className="flex items-center justify-between">
              <span>Pending migrations</span>
              <Pill value={health.pending_migrations?.length ? "warning" : "active"} label={String(health.pending_migrations?.length ?? "?")} />
            </div>
            {!!health.pending_migrations?.length && (
              <ul className="max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
                {health.pending_migrations.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
            {can("db.maintain") && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={migrate} disabled={busy}>{busy ? <Spinner /> : <Database className="h-4 w-4" />} Apply migrations</Button>
                <Button size="sm" variant="outline" onClick={onSessions}><LogOut className="h-4 w-4" /> Sign out all users</Button>
              </div>
            )}
          </div>
        )}
        {output && <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-[#0b1530] p-3 font-mono text-[11px] text-cyan-100">{output}</pre>}
      </Panel>
    </div>
  )
}

function StorageTab({ tenant, reload }: { tenant: Tenant; reload: () => void }) {
  const [history, setHistory] = useState<Usage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => fetchUsageHistory(tenant.slug).then(setHistory).catch(err), [tenant.slug])
  useEffect(() => { void load() }, [load])
  const u = tenant.usage

  const refresh = async () => {
    setBusy(true)
    try { await refreshUsage(tenant.slug); await load(); reload(); toast.success("Usage measured") } catch (e) { err(e) } finally { setBusy(false) }
  }

  const rows = u ? [
    { label: "Database", value: u.database_bytes, color: "bg-violet-500" },
    { label: "Documents", value: u.documents_bytes, color: "bg-sky-500" },
    { label: "Images & media", value: u.images_bytes, color: "bg-emerald-500" },
    { label: "Other files", value: u.other_files_bytes, color: "bg-slate-400" },
  ] : []
  const limitBytes = (tenant.effective_storage_limit_mb ?? 0) * 1048576

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Breakdown" action={<Button size="sm" variant="outline" onClick={refresh} disabled={busy}>{busy ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Measure now</Button>}>
        {!u ? <Empty>Not measured yet.</Empty> : (
          <div className="space-y-4">
            <UsageBar percent={u.usage_percent} />
            <p className="text-xs text-muted-foreground">
              {formatBytes(u.total_bytes)} used of {formatMb(tenant.effective_storage_limit_mb)}
              {limitBytes > 0 && ` · ${formatBytes(Math.max(0, limitBytes - u.total_bytes))} remaining`}
            </p>
            <ul className="space-y-2 text-sm">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-sm ${r.color}`} />
                  <span className="flex-1">{r.label}</span>
                  <span className="tabular-nums">{formatBytes(r.value)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{u.file_count.toLocaleString()} files · measured {formatDateTime(u.collected_at)}</p>
            {u.error && <p className="text-xs text-red-600">{u.error}</p>}
            <p className="text-xs text-muted-foreground">Change the allocation on the Settings tab.</p>
          </div>
        )}
      </Panel>
      <Panel title="Usage over time (MB)" className="lg:col-span-2">
        {!history ? <Spinner /> : history.length < 2 ? <Empty>Need at least two measurements for a trend.</Empty> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.map((h) => ({
                at: formatDate(h.collected_at), Database: +(h.database_bytes / 1048576).toFixed(2), Files: +(h.file_bytes / 1048576).toFixed(2),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,.15)" />
                <XAxis dataKey="at" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={44} />
                <Tooltip />
                <Area type="monotone" dataKey="Database" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                <Area type="monotone" dataKey="Files" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  )
}

const KIND_LABEL: Record<Backup["kind"], string> = {
  manual: "Manual", scheduled: "Scheduled", pre_restore: "Before restore", pre_delete: "Before delete",
}

function BackupsTab({ tenant }: { tenant: Tenant }) {
  const { can } = useControlAuth()
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [includeMedia, setIncludeMedia] = useState(true)
  const [note, setNote] = useState("")
  const [restoring, setRestoring] = useState<Backup | null>(null)
  const [restoreMedia, setRestoreMedia] = useState(true)

  const load = useCallback(() => fetchBackups(tenant.slug).then(setBackups).catch(err), [tenant.slug])
  useEffect(() => {
    void load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])

  const create = async () => {
    try { await createBackup(tenant.slug, includeMedia, note); setNote(""); toast.success("Backup started"); void load() } catch (e) { err(e) }
  }

  return (
    <div className="space-y-6">
      <Panel title="Create a backup" description="Database dump plus (optionally) all uploaded files, checksummed and stored outside the web root.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Note" className="flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Before importing leads" /></Field>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} /> Include files
          </label>
          <Button onClick={create}><HardDrive className="h-4 w-4" /> Back up now</Button>
        </div>
      </Panel>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {!backups ? <div className="p-8"><Spinner /></div> : backups.length === 0 ? <div className="p-6"><Empty>No backups yet.</Empty></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Size</TableHead><TableHead>By</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">
                    {formatDateTime(b.created_at)}
                    {b.note && <p className="text-xs text-muted-foreground">{b.note}</p>}
                    {b.restored_at && <p className="text-xs text-violet-600">Restored {formatDateTime(b.restored_at)}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{KIND_LABEL[b.kind]}{b.include_media && " + files"}</TableCell>
                  <TableCell><Pill value={b.status} />{b.error && <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={b.error}>{b.error}</p>}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBytes(b.size_bytes)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.created_by_email ?? "schedule"}</TableCell>
                  <TableCell className="text-right">
                    {b.status === "completed" && (
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" title="Download database dump">
                          <a href={backupDownloadUrl(tenant.slug, b.id, "database")}><Download className="h-4 w-4" /> DB</a>
                        </Button>
                        {b.include_media && (
                          <Button asChild size="sm" variant="ghost" title="Download files archive">
                            <a href={backupDownloadUrl(tenant.slug, b.id, "media")}><Download className="h-4 w-4" /> Files</a>
                          </Button>
                        )}
                        {can("backups.restore") && (
                          <Button size="sm" variant="outline" onClick={() => setRestoring(b)}><RotateCcw className="h-4 w-4" /> Restore</Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <ConfirmAction open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)}
        title="Restore this backup?"
        description={`${tenant.name}'s current data is replaced with the backup from ${restoring ? formatDateTime(restoring.created_at) : ""}. A safety backup is taken first and the workspace is in maintenance mode while it runs.`}
        requireSlug={tenant.slug} requireReason confirmText="Restore" destructive
        onConfirm={async ({ confirm, reason }) => {
          if (!restoring) return
          try { await restoreBackup(tenant.slug, restoring.id, confirm, reason, restoreMedia); toast.success("Restore started") } catch (e) { err(e) }
        }}>
        {restoring?.include_media && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={restoreMedia} onChange={(e) => setRestoreMedia(e.target.checked)} /> Also restore uploaded files
          </label>
        )}
      </ConfirmAction>
    </div>
  )
}

function DataTab({ tenant }: { tenant: Tenant }) {
  const [datasets, setDatasets] = useState<{ key: string; label: string }[]>([])
  const [dataset, setDataset] = useState("students")
  const [reason, setReason] = useState("")
  const [unlockedReason, setUnlockedReason] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DatasetPage | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchDatasets(tenant.slug).then(setDatasets).catch(err) }, [tenant.slug])

  const load = useCallback(async (p = 1) => {
    if (!unlockedReason) return
    setBusy(true)
    try { setData(await fetchDataset(tenant.slug, dataset, { reason: unlockedReason, page: p, search })); setPage(p) } catch (e) { err(e) } finally { setBusy(false) }
  }, [tenant.slug, dataset, search, unlockedReason])

  useEffect(() => {
    if (!unlockedReason) return
    fetchDataset(tenant.slug, dataset, { reason: unlockedReason, page: 1 })
      .then((d) => { setData(d); setPage(1) })
      .catch(err)
  }, [tenant.slug, dataset, unlockedReason])

  if (!unlockedReason) {
    return (
      <Panel title="Audited, read-only access" description="Company records are confidential. State why you need to look; every page you open is recorded with this reason.">
        <div className="max-w-xl space-y-3">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Support ticket #1234 — admin reports missing applications" />
          <Button disabled={reason.trim().length < 10} onClick={() => setUnlockedReason(reason.trim())}><Eye className="h-4 w-4" /> Open data inspector</Button>
        </div>
      </Panel>
    )
  }

  const pages = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <NativeSelect className="sm:w-60" value={dataset} onChange={(e) => setDataset(e.target.value)}>
          {datasets.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </NativeSelect>
        <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void load(1) }}>
          <Input placeholder="Search text fields…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline">{busy ? <Spinner /> : <Search className="h-4 w-4" />}</Button>
        </form>
        <span className="text-xs text-muted-foreground">Reason: “{unlockedReason}”</span>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {!data ? <div className="p-8"><Spinner /></div> : data.rows.length === 0 ? <div className="p-6"><Empty>No records.</Empty></div> : (
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>{data.columns.map((c) => <TableHead key={c} className="whitespace-nowrap text-xs">{c}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  <TableRow key={i}>
                    {data.columns.map((c) => (
                      <TableCell key={c} className="max-w-[240px] truncate whitespace-nowrap font-mono text-[11px]" title={String(row[c] ?? "")}>
                        {row[c] === null || row[c] === undefined ? <span className="text-muted-foreground">null</span> : String(row[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>{data.count.toLocaleString()} records · page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || busy} onClick={() => load(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages || busy} onClick={() => load(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityTab({ tenant }: { tenant: Tenant }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  useEffect(() => { fetchTenantActivity(tenant.slug).then(setEntries).catch(err) }, [tenant.slug])
  if (!entries) return <Spinner />
  if (!entries.length) return <Empty>No developer activity on this company yet.</Empty>
  return (
    <Panel title="Developer actions on this company" description="From the platform audit log. Company users' own CRM activity is in the Data inspector → CRM activity log.">
      <ul className="divide-y">
        {entries.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${a.success ? "bg-emerald-500" : "bg-red-500"}`} />
            <div className="min-w-0 flex-1">
              <p><span className="font-medium">{humanizeAction(a.action)}</span>{a.target && <span className="text-muted-foreground"> · {a.target}</span>}</p>
              {a.reason && <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{a.developer_email || "system"}</p>
              <p>{formatDateTime(a.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
