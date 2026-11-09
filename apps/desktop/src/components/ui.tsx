/** Shared UI primitives (Card, Switch, Button, Slider, Select, Banner, Toasts, ...).
 *  Pages should compose these instead of styling raw elements. */

import {
  useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, CircleDashed, Info, MinusCircle, X, XCircle, type LucideIcon,
} from "lucide-react";
import type { FeatureStatus } from "../lib/catalog";
import type { CapabilityStatus } from "../lib/types";
import { useApp } from "../state";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>{children}</section>;
}

export function PageHeader({
  title, subtitle, icon: Icon, actions,
}: { title: string; subtitle: string; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        {Icon && (
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-gradient-to-b from-raised to-panel text-accent shadow-sm">
            <Icon size={21} aria-hidden />
          </span>
        )}
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-mute">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-mute">{children}</h2>
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </div>
  );
}

export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${
          checked ? "left-[23px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

export function Button({
  variant = "secondary", size = "md", icon: Icon, children, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: LucideIcon;
}) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:brightness-110 shadow-sm",
    secondary: "border border-line bg-raised hover:border-mute/50 hover:bg-raised/70",
    danger: "border border-bad/50 text-bad hover:bg-bad/10",
    ghost: "text-mute hover:bg-raised hover:text-fg",
  }[variant];
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${pad} ${styles} ${className}`}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} aria-hidden />}
      {children}
    </button>
  );
}

const featureStyle: Record<FeatureStatus, { label: string; cls: string; Icon: LucideIcon }> = {
  working: { label: "Working", cls: "text-ok border-ok/40 bg-ok/10", Icon: CheckCircle2 },
  partial: { label: "Works with limits", cls: "text-warn border-warn/40 bg-warn/10", Icon: MinusCircle },
  planned: { label: "Planned", cls: "text-mute border-line bg-raised", Icon: CircleDashed },
  unsupported: { label: "Unsupported", cls: "text-bad border-bad/40 bg-bad/10", Icon: XCircle },
};

const capStyle: Record<CapabilityStatus, { label: string; cls: string; Icon: LucideIcon }> = {
  supported: { label: "Supported", cls: "text-ok border-ok/40 bg-ok/10", Icon: CheckCircle2 },
  partial: { label: "Partial", cls: "text-warn border-warn/40 bg-warn/10", Icon: MinusCircle },
  unsupported: { label: "Unsupported", cls: "text-bad border-bad/40 bg-bad/10", Icon: XCircle },
  planned: { label: "Planned", cls: "text-mute border-line bg-raised", Icon: CircleDashed },
};

export function StatusBadge({ status, phase }: { status: FeatureStatus | CapabilityStatus; phase?: number }) {
  const known = featureStyle[status as FeatureStatus];
  const { label, cls, Icon } = status === "supported" ? capStyle.supported : (known ?? capStyle[status as CapabilityStatus]);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={12} aria-hidden />
      {label}
      {status === "planned" && phase ? ` · Phase ${phase}` : ""}
    </span>
  );
}

export function Banner({
  tone = "warn", children, onDismiss,
}: { tone?: "warn" | "bad" | "info"; children: ReactNode; onDismiss?: () => void }) {
  const cls = {
    bad: "border-bad/40 bg-bad/10 text-bad",
    warn: "border-warn/40 bg-warn/10 text-warn",
    info: "border-line bg-raised text-accent",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "info" ? "note" : "alert"} className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 text-fg">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-mute hover:text-fg" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[360px] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-panel px-4 py-3 shadow-xl ${
              t.tone === "bad" ? "border-bad/50" : t.tone === "ok" ? "border-ok/50" : "border-line"
            }`}
          >
            {t.tone === "bad" ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden />
              : <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${t.tone === "ok" ? "text-ok" : "text-accent"}`} aria-hidden />}
            <p className="flex-1 text-sm">{t.text}</p>
            <button type="button" onClick={() => dismissToast(t.id)} className="text-mute hover:text-fg" aria-label="Dismiss">
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- inputs ---

export function Row({
  label, description, children, stack,
}: { label: ReactNode; description?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-4 py-3 ${stack ? "flex-col" : "items-center justify-between"}`}>
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-mute">{description}</p>}
      </div>
      <div className={stack ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}

export function Slider({
  label, value, min, max, step = 1, unit = "", onChange, disabled, format,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; disabled?: boolean; format?: (v: number) => string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <span className="font-mono text-xs text-mute tabular-nums">{format ? format(value) : `${value}${unit}`}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mm-range w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
      />
    </div>
  );
}

const SWATCHES = ["#8b9bff", "#3ecf8e", "#ffd60a", "#ff9f0a", "#ff3b30", "#ff6bd6", "#5ac8fa", "#ffffff"];

export function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <label htmlFor={id} className="font-medium">{label}</label>
      <div className="flex items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use ${c}`}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
              value.toLowerCase() === c ? "border-fg ring-2 ring-accent/60" : "border-line"
            }`}
          />
        ))}
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ml-1 h-7 w-9 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
        />
      </div>
    </div>
  );
}

export function Select<T extends string>({
  value, onChange, options, label, className = "", disabled,
}: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string;
  className?: string; disabled?: boolean;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={`mm-input rounded-lg border border-line bg-raised px-3 py-2 text-sm ${className}`}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
            value === o.id ? "bg-accent text-accent-fg shadow-sm" : "text-mute hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`mm-input rounded-lg border border-line bg-bg px-3 py-2 text-sm ${className}`} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fg shadow-[0_1px_0_var(--color-line)]">
      {children}
    </kbd>
  );
}

/** A toggleable feature with its settings revealed underneath while it is on. */
export function FeatureCard({
  icon: Icon, title, description, enabled, onToggle, disabled, disabledReason, note, status, children,
}: {
  icon?: LucideIcon; title: string; description: ReactNode; enabled: boolean; onToggle: (v: boolean) => void;
  disabled?: boolean; disabledReason?: string; note?: ReactNode; status?: FeatureStatus; children?: ReactNode;
}) {
  return (
    <Card className={`transition-colors ${enabled ? "border-accent/35" : ""}`}>
      <div className="flex items-start gap-4">
        {Icon && (
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
            enabled ? "bg-accent/15 text-accent" : "bg-raised text-mute"
          }`}>
            <Icon size={18} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            {status && status !== "working" && <StatusBadge status={status} />}
          </div>
          <p className="mt-0.5 text-[13px] text-mute">{description}</p>
          {disabled && disabledReason && <p className="mt-1.5 text-xs text-warn">{disabledReason}</p>}
        </div>
        <Switch checked={enabled} onChange={onToggle} label={title} disabled={disabled} />
      </div>
      <AnimatePresence initial={false}>
        {enabled && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-line pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {note && <p className="mt-3 text-xs text-mute">{note}</p>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-mute">{children}</p>;
}
