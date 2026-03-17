"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";

import { deleteAlertTarget, getAlertTargets, testAlertTarget } from "@/api/sdk.gen";
import type { AlertTarget } from "@/api/types.gen";
import { AddAlertDialog } from "@/components/add-alert-dialog";
import { DataTable } from "@/components/data-table";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useAlertActions() {
  const qc = useQueryClient();

  const test = useMutation({
    mutationFn: (id: string) => testAlertTarget({ path: { id } }),
    onSuccess: () => toast.success("Test alert sent"),
    onError: () => toast.error("Test failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAlertTarget({ path: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-targets"] });
      toast.success("Alert target deleted");
    },
  });

  return { test, remove };
}

function useColumns() {
  const { test, remove } = useAlertActions();

  const columns: ColumnDef<AlertTarget>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.getValue("type")}
        </Badge>
      ),
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-48 block">
          {row.getValue("url")}
        </span>
      ),
    },
    {
      id: "filters",
      header: "Filters",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex gap-1">
            {t.filterRegion && (
              <Badge variant="outline" className="text-xs">
                {t.filterRegion}
              </Badge>
            )}
            {t.filterCategory && (
              <Badge variant="outline" className="text-xs">
                {t.filterCategory}
              </Badge>
            )}
            {!t.filterRegion && !t.filterCategory && (
              <span className="text-xs text-muted-foreground">All</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 60,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => t.id && test.mutate(t.id)}>
                <Send className="mr-2 h-3 w-3" /> Send Test
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => t.id && remove.mutate(t.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return columns;
}

export default function AlertsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["alert-targets"],
    queryFn: async () => {
      const res = await getAlertTargets();
      return res.data?.targets ?? [];
    },
  });

  const columns = useColumns();

  return (
    <>
      <SiteHeader title="Alerts" />
      <div className="p-4">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            searchKey="name"
            searchPlaceholder="Search alerts..."
            toolbar={<AddAlertDialog />}
          />
        )}
      </div>
    </>
  );
}
