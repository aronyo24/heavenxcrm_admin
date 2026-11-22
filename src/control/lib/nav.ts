import {
  Activity, Building2, CreditCard, Gauge, HardDrive, LayoutDashboard, Megaphone, ScrollText, ShieldAlert, ShieldCheck, Users,
  type LucideIcon,
} from "lucide-react"

export interface ControlNavItem {
  to: string
  label: string
  icon: LucideIcon
  section: string
  permission?: string
  exact?: boolean
  /** Shows the open security-alert count next to the label. */
  badge?: "alerts"
}

export const CONTROL_NAV: ControlNavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, section: "Platform", exact: true, permission: "tenants.view" },
  { to: "/companies", label: "Companies", icon: Building2, section: "Platform", permission: "tenants.view" },
  { to: "/announcements", label: "Announcements", icon: Megaphone, section: "Platform", permission: "tenants.view" },
  { to: "/alerts", label: "Security alerts", icon: ShieldAlert, section: "Monitoring", permission: "security.view", badge: "alerts" },
  { to: "/storage", label: "Storage", icon: HardDrive, section: "Monitoring", permission: "tenants.view" },
  { to: "/health", label: "System health", icon: Activity, section: "Monitoring", permission: "tenants.view" },
  { to: "/plans", label: "Subscription plans", icon: CreditCard, section: "Business", permission: "tenants.view" },
  { to: "/team", label: "Developer team", icon: Users, section: "Administration", permission: "team.manage" },
  { to: "/audit", label: "Audit log", icon: ScrollText, section: "Administration", permission: "audit.view" },
  { to: "/account", label: "My security", icon: ShieldCheck, section: "Administration" },
]

export const CONTROL_SECTIONS = ["Platform", "Monitoring", "Business", "Administration"]

export function isActive(item: ControlNavItem, pathname: string) {
  return item.exact ? pathname === item.to || pathname === `${item.to}/` : pathname.startsWith(item.to)
}

export { Gauge }
