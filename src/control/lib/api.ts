/**
 * Developer Control Center API client (/api/control/).
 *
 * Separate axios instance from the CRM's: developer sessions use their own
 * HttpOnly cookie (scoped to /api/control/) and never the company session.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { API_BASE_URL } from "@/lib/env"
import type {
  AlertCounts, AlertSeverity, Announcement, AuditEntry, Backup, CompanySecurity, DashboardData, DatasetPage, Developer,
  HealthData, LoginAttempt, PermissionCatalog, Plan, SecurityAlert, SecurityPolicy, StorageRow, Tenant, TeamMember, Usage,
} from "./types"

export const controlClient = axios.create({
  baseURL: `${API_BASE_URL}/control`,
  timeout: 120000,
  withCredentials: true,
})

let csrfToken: string | null = null

async function fetchCsrf(): Promise<string> {
  const res = await axios.get(`${API_BASE_URL}/control/auth/csrf/`, { withCredentials: true })
  csrfToken = res.data.csrfToken
  return csrfToken as string
}

controlClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || "get").toLowerCase()
  if (!["get", "head", "options"].includes(method)) {
    const token = csrfToken || (await fetchCsrf())
    config.headers.set("X-CSRFToken", token)
  }
  return config
})

export class ControlApiError extends Error {
  status?: number
  data?: unknown
  constructor(message: string, status?: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

function messageFrom(error: AxiosError): string {
  const data = error.response?.data as Record<string, unknown> | undefined
  if (!error.response) return "Network error: unable to reach the server."
  if (data && typeof data.detail === "string") return data.detail
  if (data && typeof data === "object") {
    const text = Object.entries(data)
      .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((v) => (typeof v === "string" ? (key === "non_field_errors" ? v : `${key}: ${v}`) : "")))
      .filter(Boolean)
      .join(" ")
    if (text) return text
  }
  return `Server error (${error.response.status})`
}

type RetryConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

controlClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetryConfig | undefined
  const detail = (error.response?.data as { detail?: string } | undefined)?.detail
  if (config && !config._csrfRetried && error.response?.status === 403 && detail?.includes("CSRF")) {
    config._csrfRetried = true
    csrfToken = null
    await fetchCsrf()
    return controlClient.request(config)
  }
  if (error.response?.status === 401 || (error.response?.status === 403 && detail?.includes("session"))) {
    window.dispatchEvent(new Event("control:unauthorized"))
  }
  return Promise.reject(new ControlApiError(messageFrom(error), error.response?.status, error.response?.data))
})

const get = async <T,>(url: string, params?: Record<string, unknown>) => (await controlClient.get<T>(url, { params })).data
const post = async <T,>(url: string, body?: unknown) => (await controlClient.post<T>(url, body)).data
const patch = async <T,>(url: string, body?: unknown) => (await controlClient.patch<T>(url, body)).data
const del = async (url: string, body?: unknown) => (await controlClient.delete(url, { data: body })).data

// auth
export const login = (email: string, password: string, otp?: string) =>
  post<{ developer: Developer }>("/auth/login/", { email, password, otp })
export const logout = () => post("/auth/logout/")
export const fetchMe = () => get<{ developer: Developer }>("/auth/me/")
export const changePassword = (current_password: string, new_password: string) =>
  post("/auth/change-password/", { current_password, new_password })
export const mfaSetup = () => post<{ secret: string; otpauth_uri: string }>("/auth/mfa/setup/")
export const mfaConfirm = (code: string) => post<{ developer: Developer }>("/auth/mfa/confirm/", { code })
export const mfaDisable = (password: string) => post<{ developer: Developer }>("/auth/mfa/disable/", { password })
export const fetchSessions = () =>
  get<{ id: number; created_at: string; last_seen_at: string; ip_address: string; user_agent: string; current: boolean }[]>("/auth/sessions/")

// dashboard / monitoring
export const fetchDashboard = () => get<DashboardData>("/dashboard/")
export const fetchStorage = () =>
  get<{ warn_percent: number; critical_percent: number; companies: { slug: string; name: string; status: string; plan: string | null; storage_limit_mb: number | null; usage: Usage | null }[] }>("/storage/")
export const refreshAllStorage = () => post<{ refreshed: number }>("/storage/refresh/")
export const fetchHealth = (migrations = false) => get<HealthData>("/health/", migrations ? { migrations: 1 } : undefined)
export const migrateAll = (slugs?: string[]) => post<{ results: { slug: string; ok: boolean; error?: string }[] }>("/migrations/run/", { slugs })
export const fetchAudit = (params: Record<string, unknown>) => get<{ count: number; results: AuditEntry[] }>("/audit/", params)
export const fetchPermissionCatalog = () => get<PermissionCatalog>("/permissions/")

// companies
export const fetchTenants = (params?: Record<string, unknown>) => get<Tenant[]>("/tenants/", params)
export const fetchTenant = (slug: string) => get<Tenant>(`/tenants/${slug}/`)
export const createTenant = (body: Record<string, unknown>) => post<Tenant>("/tenants/", body)
export const updateTenant = (slug: string, body: Record<string, unknown>) => patch<Tenant>(`/tenants/${slug}/`, body)
export const deleteTenant = (slug: string, confirm: string, reason: string, purge = false) =>
  del(`/tenants/${slug}/`, { confirm, reason, purge })
export const fetchProvisioning = (slug: string) =>
  get<{ slug: string; provisioning_status: string; provisioning_log: string }>(`/tenants/${slug}/provisioning/`)
export const reprovisionTenant = (slug: string) => post(`/tenants/${slug}/reprovision/`)
export const resendInvite = (slug: string) => post<{ sent: boolean; debug_link?: string }>(`/tenants/${slug}/resend-invite/`)
export const setAdminPassword = (slug: string, password: string, notify = false) =>
  post<{ ok: boolean; email: string; notified: boolean | null }>(`/tenants/${slug}/admin-password/`, { password, notify })
export const uploadLogo = (slug: string, file: File) => {
  const form = new FormData()
  form.append("logo", file)
  return post<Tenant>(`/tenants/${slug}/logo/upload/`, form)
}
export const fetchUsageHistory = (slug: string) => get<Usage[]>(`/tenants/${slug}/usage/`)
export const refreshUsage = (slug: string) => post<Usage>(`/tenants/${slug}/refresh-usage/`)
export const fetchTenantHealth = (slug: string) => get<HealthData["companies"][number]>(`/tenants/${slug}/health/`)
export const migrateTenant = (slug: string, reason?: string) => post<{ ok: boolean; output: string }>(`/tenants/${slug}/migrate/`, { reason })
export const setMaintenance = (slug: string, enabled: boolean, reason?: string) =>
  post<Tenant>(`/tenants/${slug}/maintenance/`, { enabled, reason })
export const clearSessions = (slug: string, reason: string) => post<{ cleared: number }>(`/tenants/${slug}/clear-sessions/`, { reason })
export const fetchTenantActivity = (slug: string) => get<AuditEntry[]>(`/tenants/${slug}/activity/`)
export const fetchBackups = (slug: string) => get<Backup[]>(`/tenants/${slug}/backups/`)
export const createBackup = (slug: string, include_media: boolean, note: string) =>
  post<Backup>(`/tenants/${slug}/backups/`, { include_media, note })
export const restoreBackup = (slug: string, id: number, confirm: string, reason: string, restore_media: boolean) =>
  post(`/tenants/${slug}/backups/${id}/restore/`, { confirm, reason, restore_media })
export const backupDownloadUrl = (slug: string, id: number, part: "database" | "media") =>
  `${API_BASE_URL}/control/tenants/${slug}/backups/${id}/download/${part}/`
export const fetchDatasets = (slug: string) => get<{ key: string; label: string }[]>(`/tenants/${slug}/datasets/`)
export const fetchDataset = (slug: string, dataset: string, params: { reason: string; page?: number; search?: string }) =>
  get<DatasetPage>(`/tenants/${slug}/data/${dataset}/`, params)

// plans
export const fetchPlans = () => get<Plan[]>("/plans/")
export const savePlan = (plan: Partial<Plan>) => (plan.id ? patch<Plan>(`/plans/${plan.id}/`, plan) : post<Plan>("/plans/", plan))
export const deletePlan = (id: number) => del(`/plans/${id}/`)

// team
export const fetchTeam = () => get<TeamMember[]>("/team/")
export const saveTeamMember = (body: Partial<TeamMember> & { password?: string }) =>
  body.id ? patch<TeamMember>(`/team/${body.id}/`, body) : post<TeamMember>("/team/", body)
export const deleteTeamMember = (id: number) => del(`/team/${id}/`)
export const resetMemberMfa = (id: number) => post<TeamMember>(`/team/${id}/reset-mfa/`)
export const revokeMemberSessions = (id: number) => post<{ revoked: number }>(`/team/${id}/revoke-sessions/`)

// company security center
export const fetchCompanySecurity = (slug: string) => get<CompanySecurity>(`/tenants/${slug}/security/`)
export const updateCompanyPolicy = (slug: string, policy: Partial<SecurityPolicy>) =>
  patch<{ policy: SecurityPolicy }>(`/tenants/${slug}/security/`, { policy })
export const fetchLoginAttempts = (slug: string, params: Record<string, unknown>) =>
  get<{ count: number; results: LoginAttempt[] }>(`/tenants/${slug}/security/attempts/`, params)
export type StaffSecurityOp = "lock" | "unlock" | "logout" | "reset-mfa"
export const staffSecurityAction = (slug: string, userId: number, op: StaffSecurityOp, reason: string) =>
  post<{ ok: boolean; sessions_ended: number }>(`/tenants/${slug}/security/users/${userId}/${op}/`, { reason })

// security alerts
export const fetchAlerts = (params: { status?: "open" | "acknowledged" | "all"; severity?: AlertSeverity | ""; tenant?: string; limit?: number; offset?: number }) =>
  get<{ count: number; open: AlertCounts; results: SecurityAlert[] }>("/alerts/", params)
export const fetchAlertSummary = () => get<{ open: AlertCounts; latest: SecurityAlert[] }>("/alerts/summary/")
export const acknowledgeAlert = (id: number, note = "") => post<{ acknowledged: number; open: AlertCounts }>(`/alerts/${id}/acknowledge/`, { note })
export const acknowledgeAlerts = (ids: number[], note = "") => post<{ acknowledged: number; open: AlertCounts }>("/alerts/acknowledge/", { ids, note })

// announcements
export const fetchAnnouncements = () => get<Announcement[]>("/announcements/")
export const saveAnnouncement = (body: Partial<Announcement>) =>
  body.id ? patch<Announcement>(`/announcements/${body.id}/`, body) : post<Announcement>("/announcements/", body)
export const deleteAnnouncement = (id: number) => del(`/announcements/${id}/`)

export type { StorageRow }

/** Absolute URL for a server path like /api/control/tenants/x/logo/. */
export const apiUrl = (path: string) => `${API_BASE_URL}${path.replace(/^\/api/, "")}`
