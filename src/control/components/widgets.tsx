import { useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { generatePassword } from "../lib/password"
import type { ProvisioningStatus, TenantStatus } from "../lib/types"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  suspended: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  inactive: "bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300",
  ready: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  provisioning: "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  pending: "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  failed: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300",
  completed: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  running: "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  critical: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300",
  maintenance: "bg-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  expired: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300",
}

export function Pill({ value, label, className }: { value: TenantStatus | ProvisioningStatus | string; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset", STATUS_STYLES[value] ?? STATUS_STYLES.inactive, className)}>
      {label ?? value.replace("_", " ")}
    </span>
  )
}

export function UsageBar({ percent, className }: { percent: number | null | undefined; className?: string }) {
  const value = Math.min(100, Math.max(0, percent ?? 0))
  const tone = percent == null ? "bg-slate-300" : value >= 95 ? "bg-red-500" : value >= 80 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{percent == null ? "—" : `${percent}%`}</span>
    </div>
  )
}

export function Panel({ title, description, action, children, className }: {
  title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Confirmation for audited / destructive actions: optional "type the
 * identifier" check and an optional reason that goes to the audit log.
 */
export function ConfirmAction({
  open, onOpenChange, title, description, confirmText, requireSlug, requireReason, destructive, onConfirm, children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmText?: string
  requireSlug?: string
  requireReason?: boolean
  destructive?: boolean
  onConfirm: (values: { confirm: string; reason: string }) => unknown
  children?: ReactNode
}) {
  const [confirm, setConfirm] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const ok = (!requireSlug || confirm === requireSlug) && (!requireReason || reason.trim().length >= 10)

  const submit = async () => {
    setBusy(true)
    try {
      await onConfirm({ confirm, reason })
      setConfirm("")
      setReason("")
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          {children}
          {requireReason && (
            <Field label="Reason (recorded in the audit log)" hint="At least 10 characters, e.g. a ticket number.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
          )}
          {requireSlug && (
            <Field label={`Type "${requireSlug}" to confirm`}>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={!ok || busy} onClick={submit}>
            {busy && <Spinner className="mr-2" />}
            {confirmText ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
    />
  )
}


export function PasswordInput({ value, onChange, required, placeholder }: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex gap-2">
      <input
        type={visible ? "text" : "password"} value={value} required={required} minLength={10} placeholder={placeholder}
        autoComplete="new-password" spellCheck={false} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <button type="button" className="shrink-0 rounded-md border px-2.5 text-xs hover:bg-muted" onClick={() => setVisible((v) => !v)}>
        {visible ? "Hide" : "Show"}
      </button>
      <button type="button" className="shrink-0 rounded-md border px-2.5 text-xs hover:bg-muted"
        onClick={() => { onChange(generatePassword()); setVisible(true) }}>
        Generate
      </button>
      <button type="button" disabled={!value} className="shrink-0 rounded-md border px-2.5 text-xs hover:bg-muted disabled:opacity-40"
        onClick={() => navigator.clipboard?.writeText(value)}>
        Copy
      </button>
    </div>
  )
}
