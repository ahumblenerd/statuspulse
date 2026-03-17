"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import type { Service } from "@/api/types.gen";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnActions {
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

export function getServiceColumns(actions: ColumnActions): ColumnDef<Service>[] {
  return [
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusDot status={row.getValue("status")} />,
      size: 60,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/services/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("name")}
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <Badge variant="secondary">{row.getValue("category")}</Badge>,
    },
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.region ?? "—"}</span>
      ),
    },
    {
      accessorKey: "lastCheckedAt",
      header: "Last Checked",
      cell: ({ row }) => {
        const val = row.original.lastCheckedAt;
        return (
          <span className="text-xs text-muted-foreground">
            {val ? new Date(val).toLocaleString() : "Never"}
          </span>
        );
      },
    },
    {
      id: "actions",
      size: 60,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/dashboard/services/${s.id}`} />}>
                View Details
              </DropdownMenuItem>
              {s.statusPageUrl && (
                <DropdownMenuItem
                  render={<a href={s.statusPageUrl} target="_blank" rel="noreferrer" />}
                >
                  Status Page <ExternalLink className="ml-auto h-3 w-3" />
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => s.id && actions.onToggle(s.id, !s.enabled)}>
                {s.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => s.id && actions.onDelete(s.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
