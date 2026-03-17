"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  applyMockScenario,
  listMockScenarios,
  overrideMonitorStatus,
  resetMonitor,
  seedHistory,
} from "@/lib/board-api";
import type { Monitor } from "@/lib/board-api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Simulation panel — renders inside a Sheet drawer. */
export function SimulationPanel({ boardId, monitors }: { boardId: string; monitors: Monitor[] }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["board", boardId] });

  const { data } = useQuery({
    queryKey: ["mock-scenarios"],
    queryFn: async () => {
      const res = await listMockScenarios();
      return res.scenarios ?? [];
    },
  });

  const apply = useMutation({
    mutationFn: (name: string) => applyMockScenario(boardId, name),
    onSuccess: () => { toast.success("Drill started"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const override = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => overrideMonitorStatus(id, status),
    onSuccess: () => { toast.success("Status overridden"); invalidate(); },
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetMonitor(id),
    onSuccess: () => { toast.success("Reset to live"); invalidate(); },
  });

  const seed = useMutation({
    mutationFn: () => seedHistory(boardId),
    onSuccess: () => toast.success("30 days of history seeded"),
  });

  const scenarios = data ?? [];
  const hasOverrides = monitors.some((m) => m.statusOverride);

  return (
    <div className="space-y-6">
      {hasOverrides && (
        <div className="flex items-center gap-2 text-sm text-status-degraded font-medium">
          <FlaskConical className="h-4 w-4" />
          Simulation active
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Scenarios</p>
        <p className="text-xs text-muted-foreground">Apply a preset scenario to this board</p>
        <div className="flex flex-wrap gap-1.5">
          {scenarios.map((s) => (
            <Button key={s.name} size="sm" variant="secondary" onClick={() => apply.mutate(s.name)}>
              {s.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => seed.mutate()}>Seed History</Button>
        {hasOverrides && (
          <Button size="sm" variant="destructive" onClick={() => {
            monitors.forEach((m) => { if (m.statusOverride) reset.mutate(m.id); });
          }}>
            End Drill
          </Button>
        )}
      </div>

      {monitors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Per-Service Overrides</p>
          <p className="text-xs text-muted-foreground">Set individual service status</p>
          {monitors.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{m.name}</span>
              {m.statusOverride && <span className="text-xs text-status-degraded">sim</span>}
              <Select onValueChange={(v) => v && override.mutate({ id: m.id, status: v as string })}>
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue placeholder={m.computedStatus} />
                </SelectTrigger>
                <SelectContent>
                  {["operational", "degraded", "outage", "maintenance"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => reset.mutate(m.id)} disabled={!m.statusOverride}
                title="Reset to live status" aria-label="Reset to live status">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
