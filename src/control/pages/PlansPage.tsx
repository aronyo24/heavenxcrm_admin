import { useEffect, useState } from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Empty, Field, Pill, Spinner } from "../components/widgets"
import { deletePlan, fetchPlans, savePlan } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatMb } from "../lib/format"
import type { Plan } from "../lib/types"

const BLANK: Partial<Plan> = { code: "", name: "", description: "", monthly_price: "0", currency: "USD", max_users: null, storage_limit_mb: 5120, features: [], is_active: true, sort_order: 0 }

export default function PlansPage() {
  const { can } = useControlAuth()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [editing, setEditing] = useState<Partial<Plan> | null>(null)
  const [featuresText, setFeaturesText] = useState("")
  const [busy, setBusy] = useState(false)
  const load = () => fetchPlans().then(setPlans).catch((e) => toast.error(e.message))
  useEffect(() => { void load() }, [])

  const open = (plan: Partial<Plan>) => { setEditing(plan); setFeaturesText((plan.features ?? []).join("\n")) }
  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await savePlan({ ...editing, features: featuresText.split("\n").map((f) => f.trim()).filter(Boolean) })
      toast.success("Plan saved"); setEditing(null); void load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const remove = async (plan: Plan) => {
    try { await deletePlan(plan.id); toast.success("Plan deleted"); void load() } catch (e) { toast.error((e as Error).message) }
  }
  const set = (k: keyof Plan, v: unknown) => setEditing((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Business" title="Subscription plans" description="Plans set each company's default storage allocation and user limit."
        actions={can("plans.manage") && <Button onClick={() => open(BLANK)}><Plus className="h-4 w-4" /> New plan</Button>} />
      {!plans ? <Spinner /> : plans.length === 0 ? <Empty>No plans yet. Run <code>manage.py seed_plans</code> or create one.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">{p.code}</p>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                </div>
                {!p.is_active && <Pill value="inactive" />}
              </div>
              <p className="mt-2 text-2xl font-bold">{p.currency} {Number(p.monthly_price).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> {formatMb(p.storage_limit_mb)} storage</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.max_users ? `${p.max_users} users` : "Unlimited users"}</li>
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> {f}</li>)}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>{p.tenant_count ?? 0} compan{p.tenant_count === 1 ? "y" : "ies"}</span>
                {can("plans.manage") && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(p)}><Pencil className="h-4 w-4" /></Button>
                    {!p.tenant_count && <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code"><Input value={editing.code} disabled={!!editing.id} onChange={(e) => set("code", e.target.value.toLowerCase())} /></Field>
              <Field label="Name"><Input value={editing.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Monthly price"><Input type="number" step="0.01" value={editing.monthly_price} onChange={(e) => set("monthly_price", e.target.value)} /></Field>
              <Field label="Currency"><Input maxLength={3} value={editing.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
              <Field label="Storage (MB)"><Input type="number" min={1} value={editing.storage_limit_mb} onChange={(e) => set("storage_limit_mb", Number(e.target.value))} /></Field>
              <Field label="Max users" hint="Empty = unlimited"><Input type="number" min={1} value={editing.max_users ?? ""} onChange={(e) => set("max_users", e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Description" className="sm:col-span-2"><Input value={editing.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Features (one per line)" className="sm:col-span-2"><Textarea rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Available for new companies</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Spinner />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
