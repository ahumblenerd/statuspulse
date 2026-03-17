"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { deletePlugin, getPlugins, updatePlugin } from "@/api/sdk.gen";
import type { Plugin } from "@/api/types.gen";
import { AddPluginDialog } from "@/components/add-plugin-dialog";
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
import { Switch } from "@/components/ui/switch";

function usePluginActions() {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updatePlugin({ path: { id }, body: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plugins"] });
      toast.success("Plugin updated");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlugin({ path: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plugins"] });
      toast.success("Plugin deleted");
    },
  });

  return { toggle, remove };
}

function useColumns() {
  const { toggle, remove } = usePluginActions();

  const columns: ColumnDef<Plugin>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{row.getValue("type")}</Badge>,
    },
    {
      id: "url",
      header: "URL",
      cell: ({ row }) => {
        const config = row.original.config as Record<string, unknown> | undefined;
        const url = config?.url;
        return (
          <span className="font-mono text-xs text-muted-foreground truncate max-w-48 block">
            {typeof url === "string" ? url : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "enabled",
      header: "Enabled",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <Switch
            checked={p.enabled}
            onCheckedChange={(checked) => p.id && toggle.mutate({ id: p.id, enabled: checked })}
          />
        );
      },
    },
    {
      id: "actions",
      size: 60,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => p.id && remove.mutate(p.id)}>
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

export default function PluginsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => {
      const res = await getPlugins();
      return res.data?.plugins ?? [];
    },
  });

  const columns = useColumns();

  return (
    <>
      <SiteHeader title="Plugins" />
      <div className="p-4">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            searchKey="name"
            searchPlaceholder="Search plugins..."
            emptyMessage="No plugins yet. Plugins let you monitor custom internal services via health check URLs."
            toolbar={<AddPluginDialog />}
          />
        )}
      </div>
    </>
  );
}
