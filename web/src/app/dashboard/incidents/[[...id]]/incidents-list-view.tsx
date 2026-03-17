"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { getIncidents } from "@/api/sdk.gen";
import type { Incident } from "@/api/types.gen";
import { DataTable } from "@/components/data-table";
import { SiteHeader } from "@/components/site-header";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusDot status={row.original.impact ?? row.getValue("status")} />,
    size: 60,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/incidents/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("title")}
      </Link>
    ),
  },
  {
    accessorKey: "serviceId",
    header: "Service",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("serviceId")}</span>,
  },
  {
    accessorKey: "impact",
    header: "Impact",
    cell: ({ row }) =>
      row.original.impact ? <Badge variant="outline">{row.original.impact}</Badge> : "—",
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.getValue("updatedAt")).toLocaleString()}
      </span>
    ),
  },
];

export function IncidentsListView() {
  const [activeOnly, setActiveOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", { active: activeOnly ? "true" : "false" }],
    queryFn: async () => {
      const res = await getIncidents({ query: { active: activeOnly ? "true" : "false" } });
      return res.data?.incidents ?? [];
    },
  });

  return (
    <>
      <SiteHeader title="Incidents" />
      <div className="p-4">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            searchKey="title"
            searchPlaceholder="Search incidents..."
            emptyMessage="No incidents — everything looks good! Incidents appear automatically when a monitored service changes status."
            toolbar={
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={activeOnly ? "default" : "outline"}
                  onClick={() => setActiveOnly(true)}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={!activeOnly ? "default" : "outline"}
                  onClick={() => setActiveOnly(false)}
                >
                  All
                </Button>
              </div>
            }
          />
        )}
      </div>
    </>
  );
}
