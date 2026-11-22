import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { PageLoading } from "@/components/page-loading"
import { ControlAuthProvider } from "@/control/lib/auth"
import { ControlLayout } from "@/control/components/ControlLayout"
import ControlLogin from "@/control/pages/ControlLogin"

// Pages load on demand so the first visit only downloads the login screen
// and the shell; each page arrives as its own small chunk.
const ControlDashboard = lazy(() => import("@/control/pages/ControlDashboard"))
const CompaniesList = lazy(() => import("@/control/pages/CompaniesList"))
const CompanyCreate = lazy(() => import("@/control/pages/CompanyCreate"))
const CompanyDetail = lazy(() => import("@/control/pages/CompanyDetail"))
const StoragePage = lazy(() => import("@/control/pages/StoragePage"))
const HealthPage = lazy(() => import("@/control/pages/HealthPage"))
const PlansPage = lazy(() => import("@/control/pages/PlansPage"))
const TeamPage = lazy(() => import("@/control/pages/TeamPage"))
const AuditPage = lazy(() => import("@/control/pages/AuditPage"))
const AccountPage = lazy(() => import("@/control/pages/AccountPage"))
const AlertsPage = lazy(() => import("@/control/pages/AlertsPage"))
const AnnouncementsPage = lazy(() => import("@/control/pages/AnnouncementsPage"))

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ControlAuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/login" element={<ControlLogin />} />
              <Route path="/" element={<ControlLayout />}>
                <Route index element={<ControlDashboard />} />
                <Route path="companies" element={<CompaniesList />} />
                <Route path="companies/new" element={<CompanyCreate />} />
                <Route path="companies/:slug" element={<CompanyDetail />} />
                <Route path="storage" element={<StoragePage />} />
                <Route path="health" element={<HealthPage />} />
                <Route path="plans" element={<PlansPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="account" element={<AccountPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ControlAuthProvider>
    </ThemeProvider>
  )
}
