import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  className?: string;
}

interface DataTableProps<Row> {
  caption: string;
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  getRowKey: (row: Row) => string;
  loading?: boolean;
  emptyState?: ReactNode;
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyState = 'No results found.',
}: DataTableProps<Row>) {
  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-xl border bg-surface p-8 text-center text-sm text-muted-foreground">
        {emptyState}
      </div>
    );
  }

  return (
    <div
      aria-busy={loading || undefined}
      aria-label={loading ? `Loading ${caption}` : undefined}
      className="w-full overflow-x-auto rounded-xl border bg-surface"
      role={loading ? 'status' : undefined}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th className={`px-4 py-3 font-semibold ${column.className ?? ''}`} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading
            ? Array.from({ length: 3 }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td className="px-4 py-4" key={column.key}>
                      <Skeleton className="h-4 w-4/5" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr className="hover:bg-muted/30" key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td className={`px-4 py-4 ${column.className ?? ''}`} key={column.key}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
