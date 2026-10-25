"use client";

import React from "react";
import { ArrowUpRight, Loader2, Plus, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const workspaceInput =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
export const workspaceButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-brand-700/15 transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
export const workspaceSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

export function WorkspaceHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  action,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  icon: LucideIcon;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-3xl border border-brand-100 bg-white p-5 dark:border-brand-900/50 dark:bg-slate-900 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-12 -top-28 -z-10 h-72 w-72 rounded-full bg-brand-50 dark:bg-brand-950/30"
      />
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-sm">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-brand-700 dark:text-brand-300">
              <Sparkles className="h-3 w-3" />
              {eyebrow}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>
        {action && (
          <button type="button" onClick={action} className={workspaceButton}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}

export function WorkspaceStats({
  items,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    icon: LucideIcon;
    tone?: "purple" | "green" | "amber" | "burgundy";
  }>;
}) {
  const tones = {
    purple:
      "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
    green:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    burgundy:
      "bg-brand-50 text-brand-800 dark:bg-brand-950/50 dark:text-brand-200",
  };
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, tone = "purple" }) => (
        <div
          key={label}
          className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
        >
          <div className="min-w-0">
            <dt className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
              {label}
            </dt>
            <dd className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {value}
            </dd>
          </div>
          <span
            className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl min-[360px]:flex ${tones[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
      ))}
    </dl>
  );
}

export function WorkspaceSearch({
  label,
  value,
  onChange,
  name,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
      />
      <input
        type="search"
        name={name}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        placeholder={placeholder}
        className={`${workspaceInput} ps-10`}
      />
    </label>
  );
}

export function WorkspaceTabs({
  value,
  onChange,
  label,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  items: Array<{ value: string; label: string; count?: number }>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex min-w-0 flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-brand-500 ${value === item.value ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${value === item.value ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-200" : "bg-slate-200/60 dark:bg-slate-700"}`}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center sm:py-20">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function WorkspaceNotice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  if (!message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"}`}
    >
      {message}
    </p>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "purple" | "red";
}) {
  const tones = {
    neutral:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    green:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    purple:
      "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
      />
      {label}
    </span>
  );
}

export function SubmitWorkspaceButton({
  busy,
  label,
  saving,
}: {
  busy: boolean;
  label: string;
  saving: string;
}) {
  return (
    <button type="submit" disabled={busy} className={workspaceButton}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {busy ? saving : label}
    </button>
  );
}

export const WorkspaceArrow = () => (
  <ArrowUpRight
    aria-hidden="true"
    className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 rtl:-rotate-90"
  />
);
