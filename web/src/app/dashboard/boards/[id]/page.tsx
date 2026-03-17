"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, ExternalLink, FlaskConical, Layers, Link2, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getBoard } from "@/lib/board-api";
import type { Monitor } from "@/lib/board-api";
import { SimulationPanel } from "@/components/mock-scenario-panel";
import { SiteHeader } from "@/components/site-header";
import { StatusBanner } from "@/components/status-banner";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", id],
    queryFn: () => getBoard(id),
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="animate-pulse h-full" />;
  if (!board) return <p className="p-4 text-sm text-muted-foreground">Board not found</p>;

  const monitors = board.monitors ?? [];
  const hasSimulation = monitors.some((m) => m.statusOverride);

  return (
    <>
      <SiteHeader title={board.name} />
      <StatusBanner status={board.aggregateStatus ?? "operational"} />
      <div className="p-4 space-y-4">
        <BoardActions boardId={id} slug={board.slug} monitors={monitors} hasSimulation={hasSimulation} />
        <StatsRow monitorCount={monitors.length} status={board.aggregateStatus} />
        {monitors.length > 15 && (
          <Hint k="trim" text="Tip: Remove services you don't depend on to focus your board." />
        )}
        <MonitorGrid monitors={monitors} boardId={id} />
        {monitors.length > 0 && !hasSimulation && board.slug && (
          <Hint k="share" text={`Tip: Share your public status page at /status/${board.slug}`} />
        )}
      </div>
    </>
  );
}

function BoardActions({ boardId, slug, monitors, hasSimulation }: {
  boardId: string; slug?: string; monitors: Monitor[]; hasSimulation: boolean;
}) {
  const copyLink = () => {
    const url = `${window.location.origin}/status/${slug ?? "default"}`;
    navigator.clipboard.writeText(url);
    toast.success("Public page link copied");
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={`/dashboard/boards/${boardId}/monitors`}>
        <Button size="sm" variant="outline">
          <Settings className="mr-1 h-4 w-4" /> Services
        </Button>
      </Link>
      <Link href={`/dashboard/boards/${boardId}/alerts`}>
        <Button size="sm" variant="outline">
          <Bell className="mr-1 h-4 w-4" /> Alerts
        </Button>
      </Link>
      <Sheet>
        <SheetTrigger render={
          <Button size="sm" variant={hasSimulation ? "default" : "outline"}>
            <FlaskConical className="mr-1 h-4 w-4" />
            {hasSimulation ? "Drill Active" : "Simulate"}
          </Button>
        } />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Readiness Drill</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SimulationPanel boardId={boardId} monitors={monitors} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1" />
      {slug && (
        <>
          <Link href={`/status/${slug}`} target="_blank">
            <Button size="sm" variant="ghost" title="Open public status page">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={copyLink} title="Copy public page link" aria-label="Copy public page link">
            <Link2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function StatsRow({ monitorCount, status }: { monitorCount: number; status: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Services</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent><div className="text-2xl font-bold">{monitorCount}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
          <StatusDot status={status} />
        </CardHeader>
        <CardContent><div className="text-2xl font-bold capitalize">{status}</div></CardContent>
      </Card>
    </div>
  );
}

function MonitorGrid({ monitors, boardId }: { monitors: Monitor[]; boardId: string }) {
  if (monitors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">No services on this board yet</p>
          <Link href={`/dashboard/boards/${boardId}/monitors`}>
            <Button size="sm" variant="outline">Add Services</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {monitors.map((m) => (
        <Link key={m.id} href={`/dashboard/services/${m.providerServiceId}`}>
          <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${
            m.statusOverride ? "border-dashed border-status-degraded/40" : ""
          }`}>
            <CardContent className="flex items-center gap-3 py-4">
              <StatusDot status={m.computedStatus} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                {m.statusOverride && <p className="text-xs text-status-degraded">Simulated</p>}
              </div>
              <Badge variant="secondary" className="text-xs capitalize shrink-0">
                {m.computedStatus}
              </Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Hint({ k, text }: { k: string; text: string }) {
  const storageKey = `sp-hint-${k}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(storageKey) === "1") setDismissed(true);
  }, [storageKey]);
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-accent/50">
      <span className="flex-1">{text}</span>
      <button className="hover:text-foreground" onClick={() => {
        localStorage.setItem(storageKey, "1"); setDismissed(true);
      }}>Dismiss</button>
    </div>
  );
}
