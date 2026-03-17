"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { getPublicIncidents, getPublicServices, getPublicStatus } from "@/api/sdk.gen";
import { StatusBanner } from "@/components/status-banner";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PublicStatusPage() {
  const { data: status } = useQuery({
    queryKey: ["public-status"],
    queryFn: async () => (await getPublicStatus()).data,
    refetchInterval: 30_000,
  });

  const { data: services } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => (await getPublicServices()).data?.services ?? [],
    refetchInterval: 30_000,
  });

  const { data: incidents } = useQuery({
    queryKey: ["public-incidents"],
    queryFn: async () => (await getPublicIncidents()).data?.incidents ?? [],
    refetchInterval: 30_000,
  });

  const grouped = (services ?? []).reduce<Record<string, typeof services>>((acc, s) => {
    const cat = s.category ?? "Other";
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        <h1 className="text-lg font-semibold">StatusPulse</h1>
      </div>

      <StatusBanner status={status?.status ?? "operational"} />

      {Object.entries(grouped).map(([cat, svcs]) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {svcs!.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <StatusDot status={s.status} />
                <span className="text-sm flex-1">{s.name}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {s.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {(incidents ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incidents!.map((inc) => (
              <div key={inc.id} className="flex items-start gap-3">
                <StatusDot status={inc.impact ?? inc.status} className="mt-1" />
                <div>
                  <p className="text-sm font-medium">{inc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inc.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">Powered by StatusPulse</p>
    </div>
  );
}
