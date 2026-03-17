"use client";

import { StatusDot } from "@/components/status-dot";

const labels: Record<string, string> = {
  operational: "All Systems Operational",
  degraded: "Degraded Performance",
  outage: "Major Outage",
  maintenance: "Scheduled Maintenance",
};

const bgColors: Record<string, string> = {
  operational: "bg-status-operational/10",
  degraded: "bg-status-degraded/10",
  outage: "bg-status-outage/10",
  maintenance: "bg-status-maintenance/10",
};

export function StatusBanner({ status }: { status: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${bgColors[status] ?? "bg-muted"}`}>
      <StatusDot status={status} />
      <span className="text-sm font-medium">{labels[status] ?? status}</span>
    </div>
  );
}
