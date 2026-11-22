import { useEffect, useState } from "react"
import { KeyRound, LogOut, Pencil, Plus, ShieldCheck, ShieldOff, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Field, NativeSelect, Pill, Spinner } from "../components/widgets"
import {
  deleteTeamMember, fetchPermissionCatalog, fetchTeam, resetMemberMfa, revokeMemberSessions, saveTeamMember,
} from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { timeAgo } from "../lib/format"
import type { PermissionCatalog, TeamMember } from "../lib/types"

const ROLES = [
  ["owner", "Owner"], ["admin", "Platform admin"], ["engineer", "Engineer"], ["support", "Support"], ["viewer", "Viewer"],
] as const

type Draft = Partial<TeamMember> & { password?: string }

export default function TeamPage() {
  const { developer } = useControlAuth()
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => fetchTeam().then(setTeam).catch((e) => toast.error(e.message))
  useEffect(() => { void load(); fetchPermissionCatalog().then(setCatalog).catch(() => {}) }, [])

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const body = { ...draft }
      if (!body.password) delete body.password
      await saveTeamMember(body)
      toast.success("Saved"); setDraft(null); void load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const act = (fn: () => Promise<unknown>, msg: string) => fn().then(() => { toast.success(msg); void load() }).catch((e) => toast.error(e.message))
  const rolePerms = new Set(draft?.role && catalog ? catalog.roles[draft.role] : [])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Developer team"
        description="HeavenxCRM staff with Control Center access. These accounts are separate from every company's users."
        actions={<Button onClick={() => setDraft({ role: "engineer", is_active: true, extra_permissions: [] })}><Plus className="h-4 w-4" /> Add member</Button>} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {!team ? <div className="p-8"><Spinner /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead>2FA</TableHead>
                <TableHead>Last sign-in</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.full_name}{m.id === developer?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{ROLES.find((r) => r[0] === m.role)?.[1] ?? m.role}</TableCell>
                  <TableCell>{m.mfa_enabled ? <Pill value="active" label="Enabled" /> : <Pill value="warning" label="Off" />}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(m.last_login_at)}{m.last_login_ip && ` · ${m.last_login_ip}`}</TableCell>
                  <TableCell>
                    {!m.is_active ? <Pill value="inactive" label="Disabled" />
                      : m.locked_until && new Date(m.locked_until) > new Date() ? <Pill value="suspended" label="Locked" />
                      : <Pill value="active" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Edit" onClick={() => setDraft({ ...m })}><Pencil className="h-4 w-4" /></Button>
                      {m.mfa_enabled && <Button size="sm" variant="ghost" title="Reset 2FA" onClick={() => act(() => resetMemberMfa(m.id), "2FA reset")}><ShieldOff className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" title="Sign out everywhere" onClick={() => act(() => revokeMemberSessions(m.id), "Sessions revoked")}><LogOut className="h-4 w-4" /></Button>
                      {m.id !== developer?.id && <Button size="sm" variant="ghost" title="Delete" onClick={() => act(() => deleteTeamMember(m.id), "Member removed")}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {catalog && (
        <div className="rounded-xl border bg-card p-5 text-sm shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Role permissions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-4">Permission</th>{ROLES.map((r) => <th key={r[0]} className="px-2 text-center">{r[1]}</th>)}</tr></thead>
              <tbody>
                {Object.entries(catalog.permissions).map(([key, label]) => (
                  <tr key={key} className="border-t">
                    <td className="py-1.5 pr-4"><span className="font-mono">{key}</span> <span className="text-muted-foreground">— {label}</span></td>
                    {ROLES.map((r) => <td key={r[0]} className="text-center">{catalog.roles[r[0]]?.includes(key) ? "●" : ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit member" : "Add team member"}</DialogTitle>
            <DialogDescription>Only owners can create or change owner accounts.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name"><Input value={draft.full_name ?? ""} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
                <Field label="Email"><Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
                <Field label="Role">
                  <NativeSelect value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={draft.id ? "New password (optional)" : "Initial password"} hint="12+ characters. Share it securely; they should change it.">
                  <Input type="password" autoComplete="new-password" value={draft.password ?? ""} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                </Field>
              </div>
              {catalog && (
                <Field label="Extra permissions on top of the role">
                  <div className="grid gap-1 sm:grid-cols-2">
                    {Object.keys(catalog.permissions).filter((p) => !rolePerms.has(p)).map((p) => (
                      <label key={p} className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={!!draft.extra_permissions?.includes(p)}
                          onChange={(e) => setDraft({ ...draft, extra_permissions: e.target.checked
                            ? [...(draft.extra_permissions ?? []), p] : (draft.extra_permissions ?? []).filter((x) => x !== p) })} />
                        <span className="font-mono">{p}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.is_active ?? true} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Account active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <Spinner /> : <KeyRound className="h-4 w-4" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
