"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Server, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";
import { getIncidents, getServices } from "@/api/sdk.gen";
import { Onboarding } from "@/components/onboarding";
import { SiteHeader } from "@/components/site-header";
import { StatusBanner } from "@/components/status-banner";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStatusQuery } from "@/hooks/use-status";

function StatsCards({
  totalServices,
  activeIncidents,
  staleServices,
  status,
}: {
  totalServices: number;
  activeIncidents: number;
  staleServices: number;
  status: string;
}) {
  const cards = [
    { label: "Services", value: totalServices, icon: Server },
    { label: "Active Incidents", value: activeIncidents, icon: AlertTriangle },
    { label: "Stale Services", value: staleServices, icon: Clock },
    { label: "Overall Status", value: status, icon: ShieldCheck },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
            <c.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentIncidents() {
  const { data } = useQuery({
    queryKey: ["incidents", { active: "true", limit: 5 }],
    queryFn: async () => {
      const res = await getIncidents({ query: { active: "true", limit: 5 } });
      return res.data?.incidents ?? [];
    },
  });
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((inc) => (
          <Link
            key={inc.id}
            href={`/dashboard/incidents/${inc.id}`}
            className="flex items-start gap-3 hover:bg-accent p-2 -mx-2"
          >
            <StatusDot status={inc.impact ?? inc.status} className="mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{inc.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(inc.updatedAt).toLocaleString()}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {inc.status}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ServicesList() {
  const { data } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await getServices();
      return res.data?.services ?? [];
    },
  });
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.slice(0, 10).map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/services/${s.id}`}
            className="flex items-center gap-3 p-2 -mx-2 hover:bg-accent"
          >
            <StatusDot status={s.status} />
            <span className="text-sm flex-1 truncate">{s.name}</span>
            <Badge variant="secondary" className="text-xs">
              {s.category}
            </Badge>
          </Link>
        ))}
        {data.length > 10 && (
          <Link href="/dashboard/services" className="block text-xs text-muted-foreground p-2">
            View all {data.length} services →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: status, isLoading } = useStatusQuery();

  if (isLoading) return <div className="animate-pulse h-full" />;

  const showOnboarding = status?.totalServices === 0;

  return (
    <>
      <SiteHeader title="Dashboard" />
      <StatusBanner status={status?.status ?? "operational"} />
      <div className="p-4 space-y-4">
        {showOnboarding && <Onboarding />}
        {status && (
          <StatsCards
            totalServices={status.totalServices}
            activeIncidents={status.activeIncidents}
            staleServices={status.staleServices}
            status={status.status}
          />
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <ServicesList />
          <RecentIncidents />
        </div>
      </div>
    </>
  );
}
