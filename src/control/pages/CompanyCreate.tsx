import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Database, Globe, ImagePlus, Rocket } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, NativeSelect, PasswordInput, Panel, Spinner } from "../components/widgets"
import { createTenant, fetchPlans, uploadLogo } from "../lib/api"
import type { Plan } from "../lib/types"

const BASE_DOMAIN = (import.meta.env.VITE_TENANT_BASE_DOMAIN as string) || "heavenxcrm.com"

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

export default function CompanyCreate() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: "", slug: "", subdomain: "", custom_domain: "", admin_name: "", admin_email: "", contact_phone: "",
    country: "", notes: "", plan_id: "", subscription_start: today, subscription_end: "", storage_limit_mb: "",
    status: "active", database_engine: "", database_name: "", send_invite: true,
    admin_password: "",
  })
  const [usePassword, setUsePassword] = useState(true)

  useEffect(() => { fetchPlans().then((p) => setPlans(p.filter((x) => x.is_active))).catch(() => {}) }, [])

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))
  const selectedPlan = useMemo(() => plans.find((p) => String(p.id) === form.plan_id), [plans, form.plan_id])
  const subdomain = form.subdomain || form.slug
  const dbName = form.database_name || `${form.slug.replace(/-/g, "_") || "company"}_db`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        subdomain,
        plan_id: form.plan_id ? Number(form.plan_id) : null,
        storage_limit_mb: form.storage_limit_mb ? Number(form.storage_limit_mb) : null,
        subscription_start: form.subscription_start || null,
        subscription_end: form.subscription_end || null,
        custom_domain: form.custom_domain || null,
      }
      if (!form.database_engine) delete payload.database_engine
      if (!form.database_name) delete payload.database_name
      if (!usePassword || !form.admin_password) delete payload.admin_password
      const tenant = await createTenant(payload)
      if (logo) {
        try { await uploadLogo(tenant.slug, logo) } catch (err) { toast.error(`Logo not saved: ${(err as Error).message}`) }
      }
      toast.success(`${tenant.name} created — provisioning its workspace…`)
      navigate(`/companies/${tenant.slug}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        eyebrow="Company management"
        title="New company"
        description="Creates an isolated database, applies the CRM schema, creates the company administrator and opens the workspace on its subdomain."
        actions={<>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <Rocket className="h-4 w-4" />} Create & provision</Button>
        </>}
      />
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Company">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" className="sm:col-span-2">
                <Input required value={form.name} placeholder="Green Valley College" onChange={(e) => {
                  set("name", e.target.value)
                  if (!slugTouched) set("slug", slugify(e.target.value))
                }} />
              </Field>
              <Field label="Unique identifier (slug)" hint="Lowercase letters, digits and hyphens. Cannot change later.">
                <Input required value={form.slug} pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
                  onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()) }} />
              </Field>
              <Field label="Subdomain" hint={`${subdomain || "company"}.${BASE_DOMAIN}`}>
                <Input value={form.subdomain} placeholder={form.slug} onChange={(e) => set("subdomain", e.target.value.toLowerCase())} />
              </Field>
              <Field label="Custom domain (optional)" hint="e.g. crm.greenvalley.edu — point its DNS at the platform first." className="sm:col-span-2">
                <Input value={form.custom_domain} onChange={(e) => set("custom_domain", e.target.value.toLowerCase())} />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
              </Field>
              <Field label="Contact phone">
                <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
              </Field>
              <Field label="Internal notes" className="sm:col-span-2">
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Company administrator" description="The company's owner account. It signs in to both the CRM and the company admin panel with full company permissions. It is a normal company account — never a platform staff user or superuser.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Administrator name">
                <Input required value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} />
              </Field>
              <Field label="Administrator email (login)">
                <Input required type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="admin-access" checked={usePassword} onChange={() => setUsePassword(true)} />
                  Set a login password now
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="admin-access" checked={!usePassword} onChange={() => setUsePassword(false)} />
                  Let them choose it (email a set-password link)
                </label>
              </div>
              {usePassword && (
                <Field label="Login password" className="sm:col-span-2"
                  hint="At least 10 characters, not too common or similar to the email. Stored only as a hash in the company's own database — copy it now and hand it over securely; it is never emailed or shown again.">
                  <PasswordInput required value={form.admin_password} onChange={(v) => set("admin_password", v)} />
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.send_invite} onChange={(e) => set("send_invite", e.target.checked)} />
                {usePassword
                  ? "Email a welcome message with the sign-in address when the workspace is ready (no password in the email)"
                  : "Email the set-password invitation when the workspace is ready"}
              </label>
            </div>
          </Panel>

          <Panel title="Database" description="Every company gets its own database with its own credentials.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Engine" hint="Server default is used when left on Default.">
                <NativeSelect value={form.database_engine} onChange={(e) => set("database_engine", e.target.value)}>
                  <option value="">Default (server setting)</option>
                  <option value="mysql">MySQL — dedicated DB + user</option>
                </NativeSelect>
              </Field>
              <Field label="Database name" hint="Letters, digits, underscores.">
                <Input value={form.database_name} placeholder={dbName} pattern="[a-z0-9_]{1,64}"
                  onChange={(e) => set("database_name", e.target.value.toLowerCase())} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Subscription">
            <div className="space-y-4">
              <Field label="Plan">
                <NativeSelect value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
                  <option value="">No plan</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><Input type="date" value={form.subscription_start} onChange={(e) => set("subscription_start", e.target.value)} /></Field>
                <Field label="Expiry"><Input type="date" value={form.subscription_end} onChange={(e) => set("subscription_end", e.target.value)} /></Field>
              </div>
              <Field label="Storage allocation (MB)" hint={selectedPlan ? `Plan default: ${selectedPlan.storage_limit_mb} MB` : "Leave empty to use the plan's limit."}>
                <Input type="number" min={1} value={form.storage_limit_mb} onChange={(e) => set("storage_limit_mb", e.target.value)} />
              </Field>
              <Field label="Account status">
                <NativeSelect value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </NativeSelect>
              </Field>
            </div>
          </Panel>

          <Panel title="Logo">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
              {logo ? <img src={URL.createObjectURL(logo)} alt="" className="h-16 object-contain" /> : <ImagePlus className="h-6 w-6" />}
              {logo ? logo.name : "PNG, JPEG or WebP, up to 2 MB"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
            </label>
          </Panel>

          <Panel title="What happens next">
            <ol className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><Database className="mt-0.5 h-4 w-4 text-sky-500" /> Database <code className="text-xs">{dbName}</code> is created with its own credentials.</li>
              <li className="flex gap-2"><Rocket className="mt-0.5 h-4 w-4 text-sky-500" /> The CRM schema is migrated and the administrator is created.</li>
              <li className="flex gap-2"><Globe className="mt-0.5 h-4 w-4 text-sky-500" /> The workspace goes live at <code className="text-xs">{subdomain || "company"}.{BASE_DOMAIN}</code>.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </form>
  )
}
