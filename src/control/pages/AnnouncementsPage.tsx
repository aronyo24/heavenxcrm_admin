import { useEffect, useMemo, useState } from "react"
import { Info, Megaphone, Pencil, Plus, Sparkles, Trash2, TriangleAlert, Wrench } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ConfirmAction, Empty, Field, NativeSelect, Pill, Spinner } from "../components/widgets"
import { deleteAnnouncement, fetchAnnouncements, fetchTenants, saveAnnouncement } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatDateTime } from "../lib/format"
import type { Announcement, Tenant } from "../lib/types"

const LEVELS: { value: Announcement["level"]; label: string; icon: typeof Info; tone: string }[] = [
  { value: "info", label: "Information", icon: Info, tone: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100" },
  { value: "success", label: "New feature", icon: Sparkles, tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" },
  { value: "warning", label: "Warning", icon: TriangleAlert, tone: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100" },
  { value: "maintenance", label: "Maintenance", icon: Wrench, tone: "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-100" },
]

type Draft = Partial<Announcement>

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

function state(a: Announcement): { value: string; label: string } {
  const now = Date.now()
  if (!a.is_active) return { value: "inactive", label: "Off" }
  if (new Date(a.starts_at).getTime() > now) return { value: "pending", label: "Scheduled" }
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return { value: "inactive", label: "Ended" }
  return { value: "active", label: "Live" }
}

export function BannerPreview({ draft }: { draft: Draft }) {
  const level = LEVELS.find((l) => l.value === (draft.level ?? "info")) ?? LEVELS[0]
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", level.tone)}>
      <level.icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <b>{draft.title || "Title"}</b>{" "}
        <span className="opacity-90">{draft.message || "Your message to the company's staff."}</span>
        {draft.link_url && <span className="ml-1 font-semibold underline">{draft.link_label || "Learn more"}</span>}
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const { can } = useControlAuth()
  const manage = can("announcements.manage")
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [removing, setRemoving] = useState<Announcement | null>(null)

  const load = () => fetchAnnouncements().then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => {
    void load()
    fetchTenants().then(setTenants).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Announcements"
        description="Banners shown inside companies' CRM: maintenance windows, new features, policy changes."
        actions={manage && <Button onClick={() => setDraft({ level: "info", audience: "all_staff", all_companies: true, tenants: [], dismissible: true, is_active: true })}><Plus className="h-4 w-4" /> New announcement</Button>} />

      {!items ? <div className="flex justify-center p-10"><Spinner className="h-5 w-5" /></div> : items.length === 0 ? (
        <Empty><Megaphone className="mx-auto mb-2 h-6 w-6" />No announcements yet.</Empty>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const st = state(a)
            return (
              <article key={a.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-2">
                    <BannerPreview draft={a} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <Pill value={st.value} label={st.label} />
                      <span>{a.all_companies ? "All companies" : `${a.tenants.length} compan${a.tenants.length === 1 ? "y" : "ies"}: ${a.tenants.join(", ")}`}</span>
                      <span>{a.audience === "admins" ? "Administrators only" : "All staff"}</span>
                      <span>{formatDateTime(a.starts_at)} → {a.ends_at ? formatDateTime(a.ends_at) : "no end"}</span>
                      {a.created_by && <span>by {a.created_by}</span>}
                    </div>
                  </div>
                  {manage && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDraft(a)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => setRemoving(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {draft && <Editor draft={draft} tenants={tenants} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); void load() }} />}
      <ConfirmAction open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Delete this announcement?"
        description="It disappears from every company's CRM immediately." confirmText="Delete" destructive
        onConfirm={() => deleteAnnouncement(removing!.id).then(() => { toast.success("Deleted"); void load() }).catch((e) => toast.error(e.message))} />
    </div>
  )
}

function Editor({ draft: initial, tenants, onClose, onSaved }: { draft: Draft; tenants: Tenant[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState("")
  const selected = useMemo(() => new Set(d.tenants ?? []), [d.tenants])
  const shown = tenants.filter((t) => !filter || `${t.name} ${t.slug}`.toLowerCase().includes(filter.toLowerCase()))

  const toggle = (slug: string) => {
    const next = new Set(selected)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    setD({ ...d, tenants: [...next] })
  }

  const save = async () => {
    setBusy(true)
    try {
      await saveAnnouncement({ ...d, link_url: d.link_url || "", link_label: d.link_label || "" })
      toast.success(initial.id ? "Announcement updated" : "Announcement published")
      onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{initial.id ? "Edit announcement" : "New announcement"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <BannerPreview draft={d} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input maxLength={200} value={d.title ?? ""} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Scheduled maintenance on Sunday" />
            </Field>
            <Field label="Message" className="sm:col-span-2">
              <Textarea rows={3} maxLength={2000} value={d.message ?? ""} onChange={(e) => setD({ ...d, message: e.target.value })}
                placeholder="The CRM will be unavailable from 02:00 to 03:00 UTC while we upgrade the servers." />
            </Field>
            <Field label="Type">
              <NativeSelect value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as Announcement["level"] })}>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Who sees it">
              <NativeSelect value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value as Announcement["audience"] })}>
                <option value="all_staff">All staff (admins, managers, counselors)</option>
                <option value="admins">Company administrators only</option>
              </NativeSelect>
            </Field>
            <Field label="Starts" hint="Leave empty to publish now.">
              <Input type="datetime-local" value={toLocalInput(d.starts_at)} onChange={(e) => setD({ ...d, starts_at: fromLocalInput(e.target.value) ?? undefined })} />
            </Field>
            <Field label="Ends" hint="Leave empty to keep it until you turn it off.">
              <Input type="datetime-local" value={toLocalInput(d.ends_at)} onChange={(e) => setD({ ...d, ends_at: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Link (optional)">
              <Input type="url" value={d.link_url ?? ""} onChange={(e) => setD({ ...d, link_url: e.target.value })} placeholder="https://heavenxcrm.com/changelog" />
            </Field>
            <Field label="Link text">
              <Input maxLength={60} value={d.link_label ?? ""} onChange={(e) => setD({ ...d, link_label: e.target.value })} placeholder="Read more" />
            </Field>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!d.all_companies} onChange={(e) => setD({ ...d, all_companies: e.target.checked })} />
              Send to all companies
            </label>
            {!d.all_companies && (
              <>
                <Input placeholder="Search companies" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {shown.map((t) => (
                    <label key={t.slug} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                      <input type="checkbox" checked={selected.has(t.slug)} onChange={() => toggle(t.slug)} />
                      {t.name} <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selected.size} selected</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!d.dismissible} onChange={(e) => setD({ ...d, dismissible: e.target.checked })} /> Staff can dismiss it
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} /> Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !d.title?.trim() || !d.message?.trim()}>
            {busy && <Spinner className="mr-2" />}{initial.id ? "Save changes" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
