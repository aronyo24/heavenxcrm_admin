import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { KeyRound, Monitor, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/crm/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Panel, Pill, Spinner } from "../components/widgets"
import { changePassword, fetchSessions, mfaConfirm, mfaDisable, mfaSetup } from "../lib/api"
import { useControlAuth } from "../lib/auth"
import { timeAgo } from "../lib/format"

export default function AccountPage() {
  const { developer, setDeveloper } = useControlAuth()
  const location = useLocation()
  const forced = (location.state as { mfaSetup?: boolean } | null)?.mfaSetup || (developer?.mfa_required && !developer?.mfa_enabled)
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" })
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null)
  const [code, setCode] = useState("")
  const [disablePw, setDisablePw] = useState("")
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchSessions>>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchSessions().then(setSessions).catch(() => {}) }, [])
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="My security" description={`${developer?.full_name} · ${developer?.email} · ${developer?.role_label}`} />
      {forced && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          Two-factor authentication is required on this platform. Set it up below to continue.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Two-factor authentication</span>}
          action={developer?.mfa_enabled ? <Pill value="active" label="Enabled" /> : <Pill value="warning" label="Off" />}>
          {developer?.mfa_enabled ? (
            developer.mfa_required ? <p className="text-sm text-muted-foreground">Required for every developer; an owner can reset it if you lose your device.</p> : (
              <div className="space-y-3">
                <Field label="Confirm your password to turn it off"><Input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} /></Field>
                <Button variant="outline" disabled={busy || !disablePw} onClick={() => run(async () => { setDeveloper((await mfaDisable(disablePw)).developer); toast.success("2FA disabled") })}>Disable 2FA</Button>
              </div>
            )
          ) : setup ? (
            <div className="space-y-3 text-sm">
              <p>Add this key to Google Authenticator, Microsoft Authenticator, 1Password or similar (choose “enter a setup key”, time-based):</p>
              <code className="block break-all rounded-lg bg-muted p-3 text-center font-mono text-base tracking-widest">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">otpauth URI</summary><code className="break-all">{setup.otpauth_uri}</code></details>
              <Field label="Enter the 6-digit code it shows">
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Button disabled={busy || code.length !== 6} onClick={() => run(async () => {
                setDeveloper((await mfaConfirm(code)).developer); setSetup(null); setCode(""); toast.success("2FA enabled")
              })}>{busy && <Spinner />} Verify and enable</Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Protect your developer account with a code from an authenticator app at every sign-in.</p>
              <Button disabled={busy} onClick={() => run(async () => setSetup(await mfaSetup()))}><ShieldCheck className="h-4 w-4" /> Set up 2FA</Button>
            </div>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change password</span>}
          description="Signs you out of every other session.">
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault()
            if (pw.next !== pw.repeat) { toast.error("Passwords do not match"); return }
            void run(async () => { await changePassword(pw.current, pw.next); setPw({ current: "", next: "", repeat: "" }); toast.success("Password changed") })
          }}>
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password" hint="At least 12 characters."><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Repeat new password"><Input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} /></Field>
            <Button type="submit" disabled={busy || !pw.current || pw.next.length < 12}>Change password</Button>
          </form>
        </Panel>
      </div>
      <Panel title={<span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Active sessions</span>}>
        <ul className="divide-y text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate">{s.user_agent || "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">{s.ip_address} · signed in {timeAgo(s.created_at)} · active {timeAgo(s.last_seen_at)}</p>
              </div>
              {s.current && <Pill value="active" label="This session" />}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
