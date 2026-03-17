"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

interface PublicBoard {
  board: { name: string; slug: string; description: string | null };
  status: string;
  monitors: Array<{ id: string; name: string; status: string; displayOrder: number }>;
  activeIncidents: Array<{
    id: string;
    title: string;
    status: string;
    impact: string;
    updatedAt: string;
  }>;
}

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-status", slug],
    queryFn: async () => {
      const res = await fetch(`${BASE}/boards/${slug}/public`);
      if (!res.ok) throw new Error("Board not found");
      return res.json() as Promise<PublicBoard>;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="animate-pulse min-h-screen" />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg font-medium">Status page not found</p>
        <p className="text-sm text-muted-foreground">Check the URL and try again.</p>
      </div>
    );
  }

  const { board, status, monitors, activeIncidents } = data;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = `${board.name} Status — StatusPulse`;
  }, [board.name]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6" />
            <h1 className="text-xl font-semibold tracking-tight">{board.name}</h1>
          </div>
          {board.description && (
            <p className="mt-1 text-sm text-muted-foreground">{board.description}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <StatusHero status={status} />
        <div className="space-y-2">
          {monitors
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <StatusDot status={m.status} />
                <span className="text-sm flex-1">{m.name}</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {m.status}
                </Badge>
              </div>
            ))}
        </div>
        {activeIncidents.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Active Incidents</h2>
              {activeIncidents.map((inc) => (
                <Card key={inc.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <StatusDot status={inc.impact ?? inc.status} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{inc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(inc.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        <footer className="pt-8 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by StatusPulse — Updated every 30s
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatusHero({ status }: { status: string }) {
  const colors: Record<string, string> = {
    operational: "bg-status-operational/10 border-status-operational/30 text-status-operational",
    degraded: "bg-status-degraded/10 border-status-degraded/30 text-status-degraded",
    outage: "bg-status-outage/10 border-status-outage/30 text-status-outage",
    maintenance: "bg-status-maintenance/10 border-status-maintenance/30 text-status-maintenance",
  };
  const labels: Record<string, string> = {
    operational: "All Systems Operational",
    degraded: "Degraded Performance",
    outage: "Major Outage",
    maintenance: "Scheduled Maintenance",
  };
  return (
    <div className={`border px-4 py-3 text-center ${colors[status] ?? colors.operational}`}>
      <p className="text-sm font-medium">{labels[status] ?? labels.operational}</p>
    </div>
  );
}
