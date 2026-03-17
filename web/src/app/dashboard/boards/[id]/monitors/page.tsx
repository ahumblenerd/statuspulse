"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteMonitor, listMonitors, updateMonitor } from "@/lib/board-api";
import type { Monitor } from "@/lib/board-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddMonitorDialog } from "@/components/add-monitor-dialog";
import { ComponentSelector } from "@/components/component-selector";
import { SiteHeader } from "@/components/site-header";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonitorsPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["board-monitors", boardId],
    queryFn: async () => {
      const res = await listMonitors(boardId);
      return res.monitors ?? [];
    },
    refetchInterval: 15_000,
  });

  const remove = useMutation({
    mutationFn: (monitorId: string) => deleteMonitor(boardId, monitorId),
    onSuccess: () => {
      toast.success("Service removed");
      qc.invalidateQueries({ queryKey: ["board-monitors", boardId] });
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove service"),
  });

  const monitors = data ?? [];

  if (isLoading) return <div className="animate-pulse h-full" />;

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Boards", href: "/dashboard/boards" },
        { label: "Board", href: `/dashboard/boards/${boardId}` },
        { label: "Services" },
      ]} />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {monitors.length} service{monitors.length !== 1 ? "s" : ""} monitored
          </p>
          <AddMonitorDialog boardId={boardId} />
        </div>
        <div className="space-y-3">
          {monitors.map((m) => (
            <MonitorRow
              key={m.id}
              monitor={m}
              boardId={boardId}
              onRemove={() => remove.mutate(m.id)}
              isPending={remove.isPending}
            />
          ))}
        </div>
        {monitors.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-sm text-muted-foreground">No services added yet</p>
            <AddMonitorDialog boardId={boardId} />
          </div>
        )}
      </div>
    </>
  );
}

function MonitorRow({
  monitor,
  boardId,
  onRemove,
  isPending,
}: {
  monitor: Monitor;
  boardId: string;
  onRemove: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const initIds = monitor.selectedComponentIds
    ? (JSON.parse(monitor.selectedComponentIds) as string[])
    : [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initIds));
  const [mode, setMode] = useState(monitor.selectionMode);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      updateMonitor(boardId, monitor.id, {
        selectionMode: mode,
        selectedComponentIds: mode === "all" ? null : [...selected],
      }),
    onSuccess: () => {
      toast.success("Filter saved");
      qc.invalidateQueries({ queryKey: ["board-monitors", boardId] });
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: () => toast.error("Failed to save filter"),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <StatusDot status={monitor.computedStatus} />
        <CardTitle className="text-sm font-medium flex-1">{monitor.name}</CardTitle>
        <Badge variant="secondary" className="text-xs capitalize">
          {monitor.computedStatus}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Toggle component filter"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Remove service"
          disabled={isPending}
          onClick={() => {
            if (confirm(`Remove "${monitor.name}" from this board?`)) onRemove();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mode:</span>
            <Select value={mode} onValueChange={(v) => v && setMode(v)}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All components</SelectItem>
                <SelectItem value="include_only">Include only</SelectItem>
                <SelectItem value="exclude">Exclude</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode !== "all" && (
            <ComponentSelector
              boardId={boardId}
              monitorId={monitor.id}
              selected={selected}
              onToggle={toggle}
            />
          )}
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Save Filter
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
