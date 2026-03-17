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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Simulation panel — always available, not behind env flag. */
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
    onSuccess: () => {
      toast.success("Drill started");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const override = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      overrideMonitorStatus(id, status),
    onSuccess: () => {
      toast.success("Status overridden");
      invalidate();
    },
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetMonitor(id),
    onSuccess: () => {
      toast.success("Reset to live");
      invalidate();
    },
  });

  const seed = useMutation({
    mutationFn: () => seedHistory(boardId),
    onSuccess: () => toast.success("30 days of history seeded"),
  });

  const scenarios = data ?? [];
  const hasOverrides = monitors.some((m) => m.statusOverride);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4" /> Readiness Drill
          {hasOverrides && (
            <span className="text-xs font-normal text-amber-600 ml-auto">Simulation active</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Simulate outage scenarios to test your team&apos;s response
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scenarios.map((s) => (
              <Button
                key={s.name}
                size="sm"
                variant="secondary"
                onClick={() => apply.mutate(s.name)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => seed.mutate()}>
            Seed History
          </Button>
          {hasOverrides && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                monitors.forEach((m) => {
                  if (m.statusOverride) reset.mutate(m.id);
                });
              }}
            >
              End Drill
            </Button>
          )}
        </div>
        {monitors.length > 0 && (
          <ServiceOverrides
            monitors={monitors}
            onOverride={(id, s) => override.mutate({ id, status: s })}
            onReset={(id) => reset.mutate(id)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ServiceOverrides({
  monitors,
  onOverride,
  onReset,
}: {
  monitors: Monitor[];
  onOverride: (id: string, status: string) => void;
  onReset: (id: string) => void;
}) {
  const statuses = ["operational", "degraded", "outage", "maintenance"];
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Override individual services</p>
      {monitors.map((m) => (
        <div key={m.id} className="flex items-center gap-2">
          <span className="text-xs flex-1 truncate">{m.name}</span>
          {m.statusOverride && <span className="text-xs text-amber-600">simulated</span>}
          <Select onValueChange={(v) => v && onOverride(m.id, v as string)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder={m.computedStatus} />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReset(m.id)}
            disabled={!m.statusOverride}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
