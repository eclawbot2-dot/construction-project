import Link from "next/link";
import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  /** Stable key for React reconciliation. */
  key: string;
  /** Column header text. Pass empty string for action columns. */
  header: ReactNode;
  /** Optional cell renderer. If omitted, the column displays
   *  `String(row[key])` from the source object — convenient for plain
   *  string/number fields without writing a render function. */
  render?: (row: T) => ReactNode;
  /** Tailwind classes to apply to every cell in this column. Use for
   *  alignment, color, or width hints. */
  cellClassName?: string;
  /** Tailwind classes for the header cell only. */
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Function returning a unique React key for each row. Pass when the
   *  row's natural id is not at row.id. */
  rowKey?: (row: T) => string;
  /** When set, each row becomes a Link to the returned href and gains a
   *  hover/cursor affordance. */
  getRowHref?: (row: T) => string | null | undefined;
  /** Message shown when rows.length === 0. Pass a richer ReactNode for
   *  custom empty states (or use the EmptyState component above the table
   *  and pass an empty array of rows here). */
  emptyMessage?: ReactNode;
  /** Class for the outer wrapper. Default applies the .card style. */
  wrapperClassName?: string;
};

/**
 * Shared list-page table.
 *
 * Background (audit Pass 7 §4.3): the codebase had ~17 components for
 * 113 pages, with extensive duplication of <table>/<thead>/<tbody>
 * markup across list pages. This component absorbs the shape so adding
 * a new module's list page is `<DataTable columns={...} rows={...} />`
 * instead of 30 lines of JSX every time.
 *
 * Theming: relies on the existing .card / .table-header / .table-cell
 * utility classes already in globals.css. No hardcoded grays — light
 * and dark themes both render correctly via CSS variables.
 *
 * Accessibility: the table is naturally semantic; we set scope="col" on
 * headers and use a real <th> element rather than a styled <div>. Rows
 * with hrefs become <Link> wrappers around the entire row's contents
 * so keyboard nav lands on a single target per row.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  getRowHref,
  emptyMessage = "No records yet.",
  wrapperClassName = "card p-0 overflow-hidden",
}: DataTableProps<T>) {
  const keyOf = rowKey ?? ((row: T) => String((row as { id?: unknown }).id ?? Math.random()));

  return (
    <section className={wrapperClassName}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`table-header ${col.headerClassName ?? ""}`.trim()}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10" style={{ background: "var(--panel-bg, transparent)" }}>
            {rows.map((row) => {
              const href = getRowHref?.(row) ?? null;
              return (
                <tr key={keyOf(row)} className="transition hover:bg-white/5">
                  {columns.map((col, ci) => {
                    const content = col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode);
                    const cellClass = `table-cell ${col.cellClassName ?? ""}`.trim();
                    if (href && ci === 0) {
                      // First column wraps the row link to give keyboard focus a single target.
                      return (
                        <td key={col.key} className={cellClass}>
                          <Link href={href} className="font-medium text-white hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
                            {content}
                          </Link>
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className={cellClass}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-cell text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
