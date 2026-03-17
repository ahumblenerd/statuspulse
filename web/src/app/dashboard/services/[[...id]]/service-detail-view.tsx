"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { getServiceById, updateService } from "@/api/sdk.gen";
import { SiteHeader } from "@/components/site-header";
import { StatusDot } from "@/components/status-dot";
import { UptimeChart } from "@/components/uptime-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { ServiceConfigForm } from "./service-config-form";
import { ComponentsTable } from "./components-table";

export function ServiceDetailView({ id }: { id: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["service", id],
    queryFn: async () => {
      const res = await getServiceById({ path: { id } });
      return res.data;
    },
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => updateService({ path: { id }, body: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service", id] });
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service updated");
    },
  });

  if (isLoading) return <div className="animate-pulse h-full" />;
  if (!data?.service) return <p className="p-4">Service not found.</p>;

  const s = data.service;

  return (
    <>
      <SiteHeader title={s.name} />
      <div className="p-4 space-y-4">
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Services
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusDot status={s.status} />
            <div>
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="text-sm text-muted-foreground">{s.description ?? s.vendorId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {s.statusPageUrl && (
              <Button
                variant="outline"
                size="sm"
                render={<a href={s.statusPageUrl} target="_blank" rel="noreferrer" />}
              >
                Status Page <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Enabled</span>
              <Switch checked={s.enabled} onCheckedChange={(checked) => toggle.mutate(checked)} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge variant="secondary">{s.category}</Badge>
          {s.region && <Badge variant="outline">{s.region}</Badge>}
          <Badge variant="outline" className="capitalize">
            {s.status}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ServiceConfigForm service={s} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="ID" value={s.id} />
              <Row label="Vendor ID" value={s.vendorId} />
              <Row label="Created" value={new Date(s.createdAt).toLocaleString()} />
              <Row
                label="Last Checked"
                value={s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : "Never"}
              />
              <Row
                label="Last Changed"
                value={s.lastChangedAt ? new Date(s.lastChangedAt).toLocaleString() : "Never"}
              />
            </CardContent>
          </Card>
        </div>

        <UptimeChart serviceId={id} />

        {data.components.length > 0 && <ComponentsTable components={data.components} />}
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
