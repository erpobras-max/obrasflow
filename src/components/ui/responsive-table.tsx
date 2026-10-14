import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ResponsiveTableColumn<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  priority: "essential" | "secondary";
  mobileLabel: string;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

type ResponsiveTableProps<Row> = {
  columns: ResponsiveTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => React.Key;
  renderActions?: (row: Row) => React.ReactNode;
  emptyState?: React.ReactNode;
  loading?: boolean | React.ReactNode;
  mobileMode?: "cards" | "scroll";
  className?: string;
};

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

function LoadingState({ loading }: { loading: boolean | React.ReactNode }) {
  if (loading === false || loading == null) return null;
  if (loading === true) {
    return (
      <div className="p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
        Carregando…
      </div>
    );
  }
  return <>{loading}</>;
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  getRowKey,
  renderActions,
  emptyState = "Nenhum registro encontrado.",
  loading = false,
  mobileMode = "cards",
  className,
}: ResponsiveTableProps<Row>) {
  const isLoading = loading !== false && loading != null;
  const essentialColumns = columns.filter((column) => column.priority === "essential");
  const secondaryColumns = columns.filter((column) => column.priority === "secondary");
  const isScrollMode = mobileMode === "scroll";

  if (isLoading) return <LoadingState loading={loading} />;
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground" role="status">
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {mobileMode === "cards" && (
        <div className="space-y-3 px-4 pb-4 md:hidden">
          {rows.map((row) => (
            <article key={getRowKey(row)} className="min-w-0 rounded-lg border bg-card p-4 text-sm">
              <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3">
                {essentialColumns.map((column, index) => (
                  <div
                    key={column.key}
                    className={cn(
                      "min-w-0",
                      index === 0 && essentialColumns.length % 2 === 1 && "col-span-2",
                    )}
                  >
                    <dt className="text-xs text-muted-foreground">{column.mobileLabel}</dt>
                    <dd className="mt-0.5 break-words font-medium">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>

              {secondaryColumns.length > 0 && (
                <details className="mt-3 border-t pt-3">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Ver detalhes
                  </summary>
                  <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 pb-2 text-xs">
                    {secondaryColumns.map((column) => (
                      <div key={column.key} className="min-w-0">
                        <dt className="text-muted-foreground">{column.mobileLabel}</dt>
                        <dd className="mt-0.5 break-words font-medium text-foreground">
                          {column.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              {renderActions && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 [&_button]:min-h-11 [&_button]:min-w-11">
                  {renderActions(row)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className={cn(mobileMode === "cards" && "hidden md:block", "min-w-0")}>
        <div className={cn("relative min-w-0", isScrollMode && "max-w-full")}>
          <Table className={cn(isScrollMode && "min-w-max md:min-w-full")}>
            <TableHeader>
              <TableRow>
                {columns.map((column, index) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      alignClasses[column.align ?? "left"],
                      column.headerClassName,
                      isScrollMode && index === 0 && "sticky left-0 z-20 border-r bg-background",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
                {renderActions && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        alignClasses[column.align ?? "left"],
                        column.cellClassName,
                        isScrollMode && index === 0 && "sticky left-0 z-10 border-r bg-background",
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {renderActions && (
                    <TableCell className="text-right [&_button]:min-h-11 [&_button]:min-w-11">
                      {renderActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {isScrollMode && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
              />
              <p className="px-3 py-2 text-xs text-muted-foreground md:hidden">
                Deslize para ver mais colunas
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
