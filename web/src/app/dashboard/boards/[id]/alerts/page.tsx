"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Play, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  createBoardAlert,
  deleteBoardAlert,
  listBoardAlerts,
  testBoardAlert,
} from "@/lib/board-api";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BoardAlertsPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["board-alerts", boardId],
    queryFn: async () => {
      const res = await listBoardAlerts(boardId);
      return res.alerts ?? [];
    },
    refetchInterval: 15_000,
  });

  const remove = useMutation({
    mutationFn: (alertId: string) => deleteBoardAlert(boardId, alertId),
    onSuccess: () => {
      toast.success("Alert target removed");
      qc.invalidateQueries({ queryKey: ["board-alerts", boardId] });
    },
    onError: () => toast.error("Failed to remove alert"),
  });

  const test = useMutation({
    mutationFn: (alertId: string) => testBoardAlert(boardId, alertId),
    onSuccess: () => toast.success("Test alert sent"),
    onError: () => toast.error("Test alert failed"),
  });

  const alerts = data ?? [];

  if (isLoading) return <div className="animate-pulse h-full" />;

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Boards", href: "/dashboard/boards" },
        { label: "Board", href: `/dashboard/boards/${boardId}` },
        { label: "Alerts" },
      ]} />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {alerts.length} alert target{alerts.length !== 1 ? "s" : ""}
          </p>
          <AddBoardAlertDialog boardId={boardId} />
        </div>
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center gap-3 py-4">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new URL(a.url).hostname}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {a.type}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => test.mutate(a.id)}
                  disabled={test.isPending}
                  aria-label="Send test alert"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remove "${a.name}"?`)) remove.mutate(a.id);
                  }}
                  disabled={remove.isPending}
                  aria-label="Delete alert target"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {alerts.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No alert targets</p>
            <AddBoardAlertDialog boardId={boardId} />
          </div>
        )}
      </div>
    </>
  );
}

function AddBoardAlertDialog({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"slack" | "webhook" | "teams">("slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => createBoardAlert(boardId, { type, name, url }),
    onSuccess: () => {
      toast.success("Alert target created");
      qc.invalidateQueries({ queryKey: ["board-alerts", boardId] });
      setOpen(false);
      setName("");
      setUrl("");
    },
    onError: () => toast.error("Failed to create alert"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> Add Alert
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Board Alert Target</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="teams">Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
