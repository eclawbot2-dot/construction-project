import Link from "next/link";
import { AppLayout } from "./app-layout";

type Crumb = { label: string; href?: string };

export function DetailShell({
  eyebrow,
  title,
  subtitle,
  description,
  crumbs,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppLayout eyebrow={eyebrow} title={title} description={description}>
      <div className="grid gap-6">
        {crumbs && crumbs.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {c.href && !isLast ? (
                    <Link href={c.href} className="hover:text-cyan-300">{c.label}</Link>
                  ) : (
                    <span className={isLast ? "font-medium text-slate-200" : ""}>{c.label}</span>
                  )}
                  {!isLast ? <span className="text-slate-600">›</span> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        {subtitle || actions ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : <span />}
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </AppLayout>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-white">{children}</div>
    </div>
  );
}
