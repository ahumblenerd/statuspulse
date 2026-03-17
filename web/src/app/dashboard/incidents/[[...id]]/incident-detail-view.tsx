"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

import { getIncidentById } from "@/api/sdk.gen";
import { SiteHeader } from "@/components/site-header";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IncidentDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const res = await getIncidentById({ path: { id } });
      return res.data;
    },
  });

  if (isLoading) return <div className="animate-pulse h-full" />;
  if (!data?.incident) return <p className="p-4">Incident not found.</p>;

  const inc = data.incident;
  const updates = data.updates ?? [];

  return (
    <>
      <SiteHeader title={inc.title} />
      <div className="p-4 space-y-4">
        <Link
          href="/dashboard/incidents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Incidents
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <StatusDot status={inc.impact ?? inc.status} className="mt-1.5" />
              <div className="flex-1">
                <CardTitle>{inc.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">
                    {inc.status}
                  </Badge>
                  {inc.impact && <Badge variant="secondary">{inc.impact}</Badge>}
                  {inc.region && <Badge variant="outline">{inc.region}</Badge>}
                </div>
              </div>
              {inc.shortlink && (
                <a
                  href={inc.shortlink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Service" value={inc.serviceId} />
            <Row label="Created" value={new Date(inc.createdAt).toLocaleString()} />
            <Row label="Updated" value={new Date(inc.updatedAt).toLocaleString()} />
            {inc.resolvedAt && (
              <Row label="Resolved" value={new Date(inc.resolvedAt).toLocaleString()} />
            )}
          </CardContent>
        </Card>

        {updates.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-border">
                {updates.map((u) => (
                  <div key={u.id} className="relative">
                    <div className="absolute -left-6 top-1 h-2.5 w-2.5 bg-border" />
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {u.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{u.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value ?? "—"}</span>
    </div>
  );
}
