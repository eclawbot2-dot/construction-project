import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "var(--hover-bg)", border: "1px solid var(--border)" }}
      >
        <Icon className="h-8 w-8" style={{ color: "var(--faint)" }} />
      </div>
      <h3 className="mb-1 text-lg font-semibold" style={{ color: "var(--heading)" }}>{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm" style={{ color: "var(--faint)" }}>{description}</p>
      )}
      {action}
    </div>
  );
}
