import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Building2, ExternalLink, Plus, Search } from "lucide-react"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, NativeSelect, Pill, Spinner, UsageBar } from "../components/widgets"
import { apiUrl, fetchPlans, fetchTenants } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { formatBytes, formatDate, formatMb } from "../lib/format"
import type { Plan, Tenant } from "../lib/types"

export default function CompaniesList() {
  const { can } = useControlAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [plan, setPlan] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchPlans().then(setPlans).catch(() => {}) }, [])
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchTenants({ search: search || undefined, status: status || undefined, plan: plan || undefined })
        .then(setTenants).catch((e) => setError(e.message))
    }, 250)
    return () => clearTimeout(handle)
  }, [search, status, plan])

  const totals = useMemo(() => ({
    storage: (tenants ?? []).reduce((sum, t) => sum + (t.usage?.total_bytes ?? 0), 0),
    leads: (tenants ?? []).reduce((sum, t) => sum + (t.usage?.lead_count ?? 0), 0),
  }), [tenants])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company management"
        title="Companies"
        description="Every customer company, its workspace address, database and subscription."
        actions={can("tenants.manage") && (
          <Button asChild><Link to="/companies/new"><Plus className="h-4 w-4" /> New company</Link></Button>
        )}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, identifier, domain or admin email…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <NativeSelect className="sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </NativeSelect>
        <NativeSelect className="sm:w-44" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">All plans</option>
          {plans.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
        </NativeSelect>
      </div>

      {error && <Empty>{error}</Empty>}
      {!tenants && !error && <div className="flex justify-center p-12"><Spinner className="h-6 w-6" /></div>}
      {tenants && tenants.length === 0 && (
        <Empty><Building2 className="mx-auto mb-2 h-6 w-6" />No companies match these filters.</Empty>
      )}
      {tenants && tenants.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Active users</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="min-w-[180px]">Storage</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.slug} className="cursor-pointer" onClick={() => navigate(`/companies/${t.slug}`)}>
                    <TableCell>
                      <Link to={`/companies/${t.slug}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {t.logo_url
                          ? <img src={apiUrl(t.logo_url)} alt="" className="h-8 w-8 rounded-md object-contain" />
                          : <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-xs font-bold text-sky-700 dark:text-sky-300">{t.name[0]}</div>}
                        <div>
                          <p className="font-medium">{t.name}{t.is_primary && <span className="ml-2 text-[10px] uppercase text-muted-foreground">primary</span>}</p>
                          <p className="text-xs text-muted-foreground">{t.admin_email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <a href={t.workspace_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
                        {t.workspace_url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="text-[11px] text-muted-foreground">{t.database?.engine} · {t.database?.display_name}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.provisioning_status !== "ready" ? <Pill value={t.provisioning_status} /> : <Pill value={t.status} />}
                        {t.maintenance_mode && <Pill value="maintenance" />}
                        {t.subscription_expired && <Pill value="expired" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.plan?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.usage?.user_count ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.usage?.lead_count ?? "—"}</TableCell>
                    <TableCell>
                      <UsageBar percent={t.usage?.usage_percent} />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatBytes(t.usage?.total_bytes)} of {formatMb(t.effective_storage_limit_mb)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(t.subscription_end)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>{tenants.length} compan{tenants.length === 1 ? "y" : "ies"}</span>
            <span>{totals.leads.toLocaleString()} leads · {formatBytes(totals.storage)} stored</span>
          </div>
        </div>
      )}
    </div>
  )
}
