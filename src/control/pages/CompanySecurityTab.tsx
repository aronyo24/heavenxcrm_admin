import { useCallback, useEffect, useState } from "react"
import { KeyRound, Lock, LockOpen, LogOut, Save, Search, ShieldAlert, ShieldCheck, UserX, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { StatTile } from "@/components/crm/StatTile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmAction, Empty, Field, NativeSelect, Panel, Pill, Spinner } from "../components/widgets"
import {
  fetchCompanySecurity, fetchLoginAttempts, staffSecurityAction, updateCompanyPolicy, type StaffSecurityOp,
} from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatDateTime, timeAgo } from "../lib/format"
import type { CompanySecurity, CompanyStaffSecurity, LoginAttempt, SecurityPolicy, Tenant } from "../lib/types"

const err = (e: unknown) => toast.error((e as Error).message)

const ROLE_LABEL: Record<string, string> = { admin: "Admin", sub_admin: "Manager", counselor: "Counselor" }

const OP_COPY: Record<StaffSecurityOp, { title: string; description: string; confirm: string; destructive?: boolean; done: string }> = {
  lock: {
    title: "Lock this account?",
    description: "They are signed out everywhere right now and cannot sign in until a developer unlocks the account.",
    confirm: "Lock account", destructive: true, done: "Account locked",
  },
  unlock: {
    title: "Unlock this account?",
    description: "Clears a manual lock and any automatic lockout from failed sign-ins.",
    confirm: "Unlock", done: "Account unlocked",
  },
  logout: {
    title: "Sign this user out everywhere?",
    description: "Ends every session they have. They can sign in again immediately.",
    confirm: "Sign out", destructive: true, done: "Signed out",
  },
  "reset-mfa": {
    title: "Reset two-factor authentication?",
    description: "Removes their authenticator. If the company requires 2FA they must set it up again on next sign-in. They are signed out.",
    confirm: "Reset 2FA", destructive: true, done: "Two-factor reset",
  },
}

export function SecurityTab({ tenant }: { tenant: Tenant }) {
  const { can } = useControlAuth()
  const [data, setData] = useState<CompanySecurity | null>(null)
  const [pending, setPending] = useState<{ user: CompanyStaffSecurity; op: StaffSecurityOp } | null>(null)

  const load = useCallback(() => fetchCompanySecurity(tenant.slug).then(setData).catch(err), [tenant.slug])
  useEffect(() => { void load() }, [load])

  if (!data) return <div className="flex justify-center p-10"><Spinner className="h-5 w-5" /></div>
  const s = data.stats
  const manage = can("security.manage")

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Failed sign-ins (24h)" value={s.failed_24h} icon={ShieldAlert} tone={s.failed_24h >= data.policy.alert_failed_logins ? "red" : "amber"}
          hint={`${s.failed_7d} in 7 days · ${s.failed_ips_24h} IP(s)`} />
        <StatTile label="Successful sign-ins (24h)" value={s.success_24h} icon={ShieldCheck} tone="emerald" />
        <StatTile label="Locked accounts" value={s.locked_now} icon={UserX} tone={s.locked_now ? "red" : "sky"} hint={`of ${s.staff_total} staff`} />
        <StatTile label="Two-factor enabled" value={`${s.mfa_enabled}/${s.staff_total}`} icon={KeyRound} tone="violet"
          hint={`${s.active_sessions} active session(s)${data.policy.require_mfa ? " · required" : ""}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Sign-ins, last 14 days" description="Successful vs failed attempts on this workspace.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="ok" name="Successful" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Top failing IPs (24h)">
          {data.top_failed_ips.length === 0 ? <Empty>No failed sign-ins.</Empty> : (
            <ul className="space-y-2 text-sm">
              {data.top_failed_ips.map((row) => (
                <li key={row.ip_address} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="font-mono text-xs">{row.ip_address}</span>
                  <Pill value={row.count >= 10 ? "critical" : "warning"} label={`${row.count} failed`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PolicyPanel key={JSON.stringify(data.policy)} tenant={tenant} data={data} editable={manage} onSaved={load} />

      <Panel title="Staff accounts" description="Admins, managers and counselors of this company.">
        {data.users.length === 0 ? <Empty>No staff accounts.</Empty> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>
                  <TableHead>2FA</TableHead><TableHead>Sessions</TableHead><TableHead>Last sign-in</TableHead>
                  {manage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email || u.username}</div>
                    </TableCell>
                    <TableCell className="text-xs">{ROLE_LABEL[u.role] ?? u.role}</TableCell>
                    <TableCell>
                      {!u.is_active ? <Pill value="inactive" label="Disabled" />
                        : u.locked_manually ? <span title={u.lock_reason}><Pill value="critical" label="Locked" /></span>
                          : u.locked ? <Pill value="warning" label={`Locked until ${formatDateTime(u.locked_until)}`} />
                            : <Pill value="active" />}
                      {u.failed_login_count > 0 && !u.locked && (
                        <div className="mt-1 text-[11px] text-amber-600">{u.failed_login_count} recent failed attempt(s)</div>
                      )}
                    </TableCell>
                    <TableCell>{u.mfa_enabled ? <Pill value="active" label="On" /> : <Pill value="inactive" label="Off" />}</TableCell>
                    <TableCell className="tabular-nums text-sm">{u.sessions}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(u.last_login)}</TableCell>
                    {manage && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {u.locked
                            ? <Button size="sm" variant="outline" onClick={() => setPending({ user: u, op: "unlock" })}><LockOpen className="h-3.5 w-3.5" /> Unlock</Button>
                            : <Button size="sm" variant="outline" onClick={() => setPending({ user: u, op: "lock" })}><Lock className="h-3.5 w-3.5" /> Lock</Button>}
                          <Button size="sm" variant="outline" disabled={!u.sessions} onClick={() => setPending({ user: u, op: "logout" })} title="Sign out everywhere">
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" disabled={!u.mfa_enabled} onClick={() => setPending({ user: u, op: "reset-mfa" })} title="Reset two-factor">
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <AttemptsPanel tenant={tenant} initial={data.recent_attempts} />

      {pending && (
        <ConfirmAction open onOpenChange={(o) => !o && setPending(null)}
          title={OP_COPY[pending.op].title}
          description={<><b>{pending.user.email || pending.user.username}</b> — {OP_COPY[pending.op].description}</>}
          requireReason confirmText={OP_COPY[pending.op].confirm} destructive={OP_COPY[pending.op].destructive}
          onConfirm={({ reason }) => staffSecurityAction(tenant.slug, pending.user.id, pending.op, reason)
            .then((r) => {
              toast.success(`${OP_COPY[pending.op].done}${r.sessions_ended ? ` · ${r.sessions_ended} session(s) ended` : ""}`)
              void load()
            })
            .catch((e) => { err(e); throw e })} />
      )}
    </div>
  )
}

function PolicyPanel({ tenant, data, editable, onSaved }: {
  tenant: Tenant; data: CompanySecurity; editable: boolean; onSaved: () => void
}) {
  const [form, setForm] = useState<SecurityPolicy>(data.policy)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(data.policy)
  const limits = data.policy_limits

  const num = (key: keyof SecurityPolicy, label: string, hint: string) => (
    <Field label={label} hint={`${hint} (${limits[key]?.[0]}–${limits[key]?.[1]}, default ${data.policy_defaults[key]})`}>
      <Input type="number" min={limits[key]?.[0]} max={limits[key]?.[1]} disabled={!editable}
        value={form[key] as number} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
    </Field>
  )

  const save = async () => {
    setBusy(true)
    try {
      await updateCompanyPolicy(tenant.slug, form)
      toast.success("Security policy saved — applies within 30 seconds")
      onSaved()
    } catch (e) { err(e) } finally { setBusy(false) }
  }

  return (
    <Panel title="Sign-in policy" description="Applies to every staff account of this company. Every change is audited."
      action={editable && <Button size="sm" disabled={!dirty || busy} onClick={save}>{busy ? <Spinner /> : <Save className="h-4 w-4" />} Save policy</Button>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {num("max_failed_logins", "Lock after failed sign-ins", "Wrong passwords before the account locks")}
        {num("lockout_minutes", "Lockout duration (minutes)", "How long an automatic lock lasts")}
        {num("password_min_length", "Minimum password length", "For new and changed passwords")}
        {num("alert_failed_logins", "Attack alert threshold", "Failed sign-ins in 15 min that alert your team")}
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm">
        <input type="checkbox" className="mt-0.5" disabled={!editable} checked={form.require_mfa}
          onChange={(e) => setForm({ ...form, require_mfa: e.target.checked })} />
        <span>
          <b>Require two-factor authentication for all staff</b>
          <span className="block text-xs text-muted-foreground">
            Staff without an authenticator app are asked to set one up before they can use the CRM. Staff already signed in without a code must sign in again.
          </span>
        </span>
      </label>
    </Panel>
  )
}

function AttemptsPanel({ tenant, initial }: { tenant: Tenant; initial: LoginAttempt[] }) {
  const PAGE = 50
  const [rows, setRows] = useState<LoginAttempt[]>(initial)
  const [count, setCount] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [success, setSuccess] = useState("")

  const load = (off = 0) => fetchLoginAttempts(tenant.slug, { search: search || undefined, success: success || undefined, limit: PAGE, offset: off })
    .then((r) => { setRows(r.results); setCount(r.count); setOffset(off) }).catch(err)
  useEffect(() => { if (count !== null || success) void load(0) }, [success]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Panel title="Sign-in log" description="Every attempt on this workspace, newest first.">
      <form className="mb-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void load(0) }}>
        <Input placeholder="Email or IP" value={search} onChange={(e) => setSearch(e.target.value)} />
        <NativeSelect className="sm:w-44" value={success} onChange={(e) => setSuccess(e.target.value)}>
          <option value="">All attempts</option><option value="0">Failed only</option><option value="1">Successful only</option>
        </NativeSelect>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
      </form>
      {rows.length === 0 ? <Empty>No sign-in attempts recorded yet.</Empty> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>When</TableHead><TableHead>Account</TableHead><TableHead>Result</TableHead><TableHead>IP</TableHead><TableHead>Device</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</TableCell>
                  <TableCell className="text-xs">{a.identifier}</TableCell>
                  <TableCell><Pill value={a.success ? "active" : a.reason === "locked" ? "critical" : "warning"} label={a.reason_label} /></TableCell>
                  <TableCell className="font-mono text-xs">{a.ip_address ?? "—"}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={a.user_agent}>{a.user_agent || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {count !== null && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{count.toLocaleString()} attempts</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>Newer</Button>
            <Button size="sm" variant="outline" disabled={offset + PAGE >= count} onClick={() => load(offset + PAGE)}>Older</Button>
          </div>
        </div>
      )}
      {count === null && rows.length >= 25 && (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => load(0)}><Users className="h-4 w-4" /> Show full log</Button>
      )}
    </Panel>
  )
}
