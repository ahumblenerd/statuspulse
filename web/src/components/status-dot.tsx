import { cn } from "@/lib/utils";

const dotColors: Record<string, string> = {
  operational: "bg-status-operational",
  degraded: "bg-status-degraded",
  outage: "bg-status-outage",
  maintenance: "bg-status-maintenance",
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const isActive = status === "outage" || status === "degraded";
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0",
        dotColors[status] ?? "bg-muted",
        isActive && "animate-pulse-dot",
        className
      )}
      title={status}
    />
  );
}
