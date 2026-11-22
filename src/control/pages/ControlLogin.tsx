import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { KeyRound, Lock, ShieldCheck, Terminal } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Spinner } from "../components/widgets"
import { ControlApiError } from "../lib/api"
import { useControlAuth } from "../lib/auth"

export default function ControlLogin() {
  const { developer, login, loading } = useControlAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [needsOtp, setNeedsOtp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && developer) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password, needsOtp ? otp : undefined)
      navigate("/", { replace: true })
    } catch (err) {
      const apiErr = err as ControlApiError
      if ((apiErr.data as { mfa_required?: boolean } | undefined)?.mfa_required) setNeedsOtp(true)
      setError(apiErr.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1530] p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.12),transparent_40%)]" />
        <BrandLogo tone="light" className="relative h-10" />
        <div className="relative space-y-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            <Terminal className="h-4 w-4" /> Developer Control Center
          </p>
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            Every company, database and workspace on the platform — from one console.
          </h1>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Separate developer accounts — customer credentials never work here.</li>
            <li className="flex gap-2"><Lock className="h-4 w-4 text-cyan-300" /> Every company has its own isolated database.</li>
            <li className="flex gap-2"><KeyRound className="h-4 w-4 text-cyan-300" /> Each action and record view is written to the audit log.</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Authorized HeavenxCRM team members only.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden"><BrandLogo className="h-9" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Developer sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your HeavenxCRM team account.</p>
          </div>
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <Field label="Work email">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={needsOtp} />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={needsOtp} />
          </Field>
          {needsOtp && (
            <Field label="Authenticator code" hint="6 digits from your authenticator app.">
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} autoFocus
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required />
            </Field>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Spinner />} {needsOtp ? "Verify and sign in" : "Sign in"}
          </Button>
          {needsOtp && (
            <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setNeedsOtp(false); setOtp(""); setError(null) }}>
              Use a different account
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
