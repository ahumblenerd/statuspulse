"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getServices } from "@/api/sdk.gen";
import { createMonitor } from "@/lib/board-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/status-dot";

/** Dialog to add a service to a board. */
export function AddMonitorDialog({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await getServices();
      return res.data?.services ?? [];
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: (service: { id: string; name: string }) =>
      createMonitor(boardId, { name: service.name, providerServiceId: service.id }),
    onSuccess: () => {
      toast.success("Service added to board");
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["board-monitors", boardId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add service"),
  });

  const filtered = (data ?? []).filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> Add Service
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Service to Board</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 max-h-96">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-2 hover:bg-accent">
              <div className="flex items-center gap-2">
                <StatusDot status={s.status ?? "operational"} />
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {s.category}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => s.id && add.mutate({ id: s.id, name: s.name ?? s.id })}
                disabled={add.isPending}
              >
                Add
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No services found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
