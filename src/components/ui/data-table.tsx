"use client";

import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type Row,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { gentle, snappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Checkbox } from "./choice";

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Column helper bound to the features every DataTable supports. */
export function columnsFor<T extends RowData>() {
  return createColumnHelper<DataTableFeatures, T>();
}

type ColumnMeta = { align?: "start" | "end"; className?: string };

type Columns<T extends RowData> = ReturnType<ReturnType<typeof columnsFor<T>>["columns"]>;

export function DataTable<T extends RowData>({
  columns,
  data,
  caption,
  getRowId,
  onRowClick,
  selectable = false,
  bulkActions,
  initialSorting = [],
  empty,
  className,
}: {
  columns: Columns<T>;
  data: T[];
  /** Read by screen readers; describe what the table lists. */
  caption: string;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  initialSorting?: SortingState;
  empty?: React.ReactNode;
  className?: string;
}) {
  const allColumns = React.useMemo(() => {
    if (!selectable) return columns;
    const helper = columnsFor<T>();
    return helper.columns([
      helper.display({
        id: "_select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows"
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            onClick={(e) => {
              e.stopPropagation();
              row.getToggleSelectedHandler()(e);
            }}
          />
        ),
      }),
      ...columns,
    ]) as Columns<T>;
  }, [columns, selectable]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data,
    getRowId,
    initialState: { sorting: initialSorting },
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);

  function onRowKeyDown(
    e: React.KeyboardEvent<HTMLTableRowElement>,
    row: Row<DataTableFeatures, T>,
  ) {
    if (e.key === "Enter" && onRowClick) {
      e.preventDefault();
      onRowClick(row.original);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("tr[tabindex]") ?? []);
      const i = all.indexOf(e.currentTarget);
      all[e.key === "ArrowDown" ? i + 1 : i - 1]?.focus();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative overflow-x-auto rounded-card border border-hairline bg-surface shadow-xs">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-hairline bg-surface-sunken">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const sort = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const SortIcon =
                    sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ChevronsUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined
                      }
                      className={cn(
                        "h-10 px-cell text-caption font-medium whitespace-nowrap text-ink-muted",
                        header.column.id === "_select" && "w-10 pr-0",
                        meta?.align === "end" && "text-right",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 hover:bg-surface-active hover:text-ink",
                            sort && "text-ink",
                            meta?.align === "end" && "flex-row-reverse",
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon
                            className={cn("size-3", !sort && "text-ink-subtle/60")}
                            aria-hidden
                          />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody ref={bodyRef}>
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.tr
                  key={row.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={gentle}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={(e) => onRowKeyDown(e, row)}
                  data-selected={row.getIsSelected() || undefined}
                  className={cn(
                    "h-row border-b border-hairline last:border-0",
                    "transition-colors duration-150 data-selected:bg-accent-subtle/60",
                    onRowClick &&
                      "cursor-pointer hover:bg-surface-hover focus-visible:-outline-offset-2",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-cell num text-body whitespace-nowrap text-ink",
                          cell.column.id === "_select" && "w-10 pr-0",
                          meta?.align === "end" && "text-right",
                          meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {rows.length === 0 && empty}
      </div>

      <AnimatePresence>
        {selectable && selected.length > 0 && bulkActions && (
          <motion.div
            role="region"
            aria-label="Bulk actions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={snappy}
            className="sticky bottom-4 z-10 mx-auto mt-3 flex w-fit items-center gap-3 rounded-full border border-hairline bg-ink py-1.5 pr-1.5 pl-4 text-bg shadow-lg"
          >
            <span className="num text-small font-medium">{selected.length} selected</span>
            <div className="flex items-center gap-1.5">
              {bulkActions(selected, () => table.resetRowSelection())}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear selection"
                className="rounded-full text-bg/70 hover:bg-bg/10 hover:text-bg"
                onClick={() => table.resetRowSelection()}
              >
                <X />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
