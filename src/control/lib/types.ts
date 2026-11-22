export type TenantStatus = "active" | "suspended" | "inactive"
export type ProvisioningStatus = "pending" | "provisioning" | "ready" | "failed"
export type AlertLevel = "warning" | "critical" | null

export interface Developer {
  id: number
  email: string
  full_name: string
  role: string
  role_label: string
  permissions: string[]
  mfa_enabled: boolean
  mfa_required: boolean
  last_login_at: string | null
}

export interface Plan {
  id: number
  code: string
  name: string
  description: string
  monthly_price: string
  currency: string
  max_users: number | null
  storage_limit_mb: number
  features: string[]
  is_active: boolean
  sort_order: number
  tenant_count?: number
}

export interface Usage {
  database_bytes: number
  documents_bytes: number
  images_bytes: number
  other_files_bytes: number
  file_bytes: number
  file_count: number
  total_bytes: number
  storage_limit_mb: number | null
  usage_percent: number | null
  alert: AlertLevel
  user_count: number
  staff_count: number
  lead_count: number
  application_count: number
  error: string
  collected_at: string
}

export interface TenantDatabase {
  engine: string
  name: string
  display_name: string
  host: string
  port: string
  user: string
  has_password: boolean
  managed: boolean
  created_at: string | null
}

export interface Tenant {
  id: number
  slug: string
  name: string
  subdomain: string
  custom_domain: string | null
  logo_url: string | null
  admin_name: string
  admin_email: string
  contact_phone: string
  country: string
  notes: string
  plan: Plan | null
  subscription_start: string | null
  subscription_end: string | null
  subscription_expired: boolean
  storage_limit_mb: number | null
  effective_storage_limit_mb: number | null
  status: TenantStatus
  status_reason: string
  maintenance_mode: boolean
  provisioning_status: ProvisioningStatus
  provisioned_at: string | null
  is_primary: boolean
  block_reason: string | null
  database: TenantDatabase | null
  workspace_url: string
  usage: Usage | null
  created_at: string
  updated_at: string
}

export interface AuditEntry {
  id: number
  developer_email: string
  action: string
  tenant_slug: string
  target: string
  reason: string
  details: Record<string, unknown>
  success: boolean
  ip_address: string | null
  user_agent: string
  created_at: string
}

export interface Backup {
  id: number
  kind: "manual" | "scheduled" | "pre_restore" | "pre_delete"
  status: "running" | "completed" | "failed"
  include_media: boolean
  size_bytes: number
  database_sha256: string
  media_sha256: string
  error: string
  note: string
  created_by_email: string | null
  created_at: string
  completed_at: string | null
  restored_at: string | null
}

export interface StorageRow {
  slug: string
  name: string
  database_bytes: number
  file_bytes: number
  total_bytes: number
  storage_limit_mb: number | null
  usage_percent: number | null
  level?: "warning" | "critical"
}

export interface DashboardData {
  companies: {
    total: number; active: number; suspended: number; inactive: number
    provisioning: number; failed: number; maintenance: number
  }
  records: { users: number; staff: number; leads: number; applications: number }
  storage: {
    database_bytes: number; file_bytes: number; documents_bytes: number; images_bytes: number
    other_files_bytes: number; allocated_mb: number; top: StorageRow[]; alerts: StorageRow[]
    last_collected_at: string | null
  }
  subscriptions: {
    expired: number
    expiring_soon: { slug: string; name: string; subscription_end: string }[]
    plans: { plan: string; count: number }[]
  }
  registrations_by_month: { month: string; count: number }[]
  recent_companies: Tenant[]
  recent_activity: AuditEntry[]
  health: {
    control_db: { ok: boolean; latency_ms?: number; error?: string; engine: string }
    disk: { total_bytes: number; used_bytes: number; free_bytes: number }
    load_average: number[] | null
    memory: { total_bytes: number; available_bytes: number } | null
  }
}

export interface DbHealth {
  ok: boolean
  latency_ms?: number
  error?: string
  engine?: string
  pending_migrations?: string[]
  pending_migrations_error?: string
}

export interface HealthData {
  server: {
    python: string; django: string; platform: string; cpu_count: number | null
    load_average: number[] | null
    memory: { total_bytes: number; available_bytes: number } | null
    disk: { total_bytes: number; used_bytes: number; free_bytes: number }
    debug: boolean
    control_db: DbHealth
  }
  companies: ({ slug: string; name: string; status: TenantStatus } & DbHealth)[]
}

export interface DatasetPage {
  dataset: string
  columns: string[]
  rows: Record<string, unknown>[]
  count: number
  page: number
  page_size: number
}

export interface TeamMember {
  id: number
  email: string
  full_name: string
  role: string
  extra_permissions: string[]
  permissions: string[]
  is_active: boolean
  mfa_enabled: boolean
  last_login_at: string | null
  last_login_ip: string | null
  locked_until: string | null
  created_at: string
}

export interface PermissionCatalog {
  permissions: Record<string, string>
  roles: Record<string, string[]>
}

// -- security center ----------------------------------------------------------

export interface SecurityPolicy {
  max_failed_logins: number
  lockout_minutes: number
  password_min_length: number
  require_mfa: boolean
  alert_failed_logins: number
}

export interface LoginAttempt {
  id: number
  identifier: string
  user_id: number | null
  success: boolean
  reason: string
  reason_label: string
  portal: string
  ip_address: string | null
  user_agent: string
  created_at: string
}

export interface CompanyStaffSecurity {
  id: number
  email: string
  username: string
  name: string
  role: "admin" | "sub_admin" | "counselor"
  is_active: boolean
  last_login: string | null
  locked: boolean
  locked_manually: boolean
  locked_until: string | null
  lock_reason: string
  failed_login_count: number
  mfa_enabled: boolean
  sessions: number
  last_failed_at: string | null
}

export interface CompanySecurity {
  policy: SecurityPolicy
  policy_defaults: SecurityPolicy
  policy_limits: Record<string, [number, number]>
  stats: {
    failed_24h: number
    failed_7d: number
    success_24h: number
    failed_ips_24h: number
    staff_total: number
    locked_now: number
    mfa_enabled: number
    active_sessions: number
  }
  top_failed_ips: { ip_address: string; count: number }[]
  daily: { date: string; ok: number; failed: number }[]
  users: CompanyStaffSecurity[]
  recent_attempts: LoginAttempt[]
}

export type AlertSeverity = "critical" | "warning" | "info"

export interface SecurityAlert {
  id: number
  kind: string
  severity: AlertSeverity
  title: string
  message: string
  tenant_slug: string
  details: Record<string, unknown>
  occurrences: number
  emailed: boolean
  created_at: string
  last_seen_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  acknowledged_note: string
}

export type AlertCounts = Record<AlertSeverity, number>

export interface Announcement {
  id: number
  title: string
  message: string
  level: "info" | "success" | "warning" | "maintenance"
  audience: "all_staff" | "admins"
  all_companies: boolean
  tenants: string[]
  link_url: string
  link_label: string
  starts_at: string
  ends_at: string | null
  dismissible: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  live: boolean
}
