"use client";

import { useQuery } from "@tanstack/react-query";

import { getMonitorComponents } from "@/lib/board-api";
import type { MonitorComponent } from "@/lib/board-api";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusDot } from "@/components/status-dot";

interface Props {
  boardId: string;
  monitorId: string;
  selected: Set<string>;
  onToggle: (componentId: string) => void;
}

/** Checkbox tree for selecting which parts of a service to watch. */
export function ComponentSelector({ boardId, monitorId, selected, onToggle }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["monitor-components", boardId, monitorId],
    queryFn: async () => {
      const res = await getMonitorComponents(boardId, monitorId);
      return res.components ?? [];
    },
  });

  if (isLoading) return <div className="animate-pulse h-20" />;

  const components = data ?? [];
  if (components.length === 0) {
    return <p className="text-sm text-muted-foreground">No components available</p>;
  }

  /** Group components by their group field */
  const groups = components.reduce<Record<string, MonitorComponent[]>>((acc, c) => {
    const group = c.group ?? "Ungrouped";
    if (!acc[group]) acc[group] = [];
    acc[group].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {group}
          </p>
          {items.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent cursor-pointer"
            >
              <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggle(c.id)} />
              <StatusDot status={c.status} />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
