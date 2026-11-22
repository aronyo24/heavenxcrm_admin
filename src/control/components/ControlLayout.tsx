import { Suspense, useEffect, useState } from "react"
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { PageLoading } from "@/components/page-loading"
import { AnimatePresence, motion } from "framer-motion"
import { LogOut, Menu, Terminal, X } from "lucide-react"

import { BrandLogo, BrandMark } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { fetchAlertSummary } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { CONTROL_NAV, CONTROL_SECTIONS, isActive } from "../lib/nav"

/** Open critical + warning alerts, refreshed every minute and whenever the
 * alerts page changes them (it fires "control:alerts-changed"). */
function useOpenAlertCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () => fetchAlertSummary().then((r) => alive && setCount(r.open.critical + r.open.warning)).catch(() => {})
    void load()
    const timer = setInterval(load, 60000)
    window.addEventListener("control:alerts-changed", load)
    return () => { alive = false; clearInterval(timer); window.removeEventListener("control:alerts-changed", load) }
  }, [enabled])
  return count
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { developer, logout, can } = useControlAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const items = CONTROL_NAV.filter((item) => !item.permission || can(item.permission))
  const alertCount = useOpenAlertCount(can("security.view"))

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Link to="/" onClick={onNavigate} className="block">
          <BrandLogo tone="light" className="h-9" />
        </Link>
        <p className="mt-2 flex items-center gap-1.5 pl-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
          <Terminal className="h-3 w-3 text-cyan-400" />
          Developer Control Center
        </p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {CONTROL_SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section)
          if (!sectionItems.length) return null
          return (
            <div key={section}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{section}</p>
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const active = isActive(item, location.pathname)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-cyan-400" />}
                      <item.icon className={cn("h-4 w-4", active ? "text-cyan-400" : "text-white/45 group-hover:text-white/80")} />
                      {item.label}
                      {item.badge === "alerts" && alertCount > 0 && (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {alertCount > 99 ? "99+" : alertCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-sky-500 text-xs font-bold text-[#0b1530]">
            {(developer?.full_name || developer?.email || "D")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{developer?.full_name}</p>
            <p className="truncate text-[11px] text-white/45">{developer?.role_label}</p>
          </div>
          <button
            type="button"
            title="Sign out"
            onClick={async () => { await logout(); navigate("/login") }}
            className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ControlLayout() {
  const { developer, loading } = useControlAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (!developer) return <Navigate to="/login" state={{ from: location }} replace />
  if (developer.mfa_required && !developer.mfa_enabled && location.pathname !== "/account") {
    return <Navigate to="/account" replace state={{ mfaSetup: true }} />
  }

  const current = CONTROL_NAV.find((i) => isActive(i, location.pathname))

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col overflow-hidden bg-[#0b1530] lg:flex">
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[#0b1530] lg:hidden"
              >
                <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-md p-1.5 text-white/50 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
                <Sidebar onNavigate={() => setOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="h-8 w-8 lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
            <BrandMark className="h-7 w-7 lg:hidden" />
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">Control Center</span>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="truncate font-semibold">{current?.label ?? "Control Center"}</span>
            </div>
            <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Every action is audited
            </span>
            <ThemeToggle />
          </header>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
            className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"
          >
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
