"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Layers, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { createBoard, deleteBoard, duplicateBoard, listBoards } from "@/lib/board-api";
import { SiteHeader } from "@/components/site-header";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BoardsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const res = await listBoards();
      return res.boards ?? [];
    },
    refetchInterval: 15_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      toast.success("Board deleted");
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete board"),
  });

  const dup = useMutation({
    mutationFn: (id: string) => duplicateBoard(id),
    onSuccess: () => {
      toast.success("Board duplicated");
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to duplicate board"),
  });

  const boards = data ?? [];

  if (isLoading) return <div className="animate-pulse h-full" />;

  return (
    <>
      <SiteHeader title="Boards" />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {boards.length} board{boards.length !== 1 ? "s" : ""}
          </p>
          <CreateBoardDialog />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Card key={b.id} className="group relative">
              <Link href={`/dashboard/boards/${b.id}`} className="absolute inset-0 z-10" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  {b.name}
                </CardTitle>
                <StatusDot status={b.status ?? "operational"} />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {b.description ?? "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {b.monitorCount ?? 0} monitors
                  </Badge>
                  <div className="flex gap-1 z-20 relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Duplicate board"
                      onClick={(e) => {
                        e.preventDefault();
                        dup.mutate(b.id);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete board"
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(`Delete "${b.name}"? This cannot be undone.`))
                          remove.mutate(b.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {boards.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Layers className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No boards yet</p>
            <CreateBoardDialog />
          </div>
        )}
      </div>
    </>
  );
}

function CreateBoardDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const create = useMutation({
    mutationFn: () => createBoard({ name, slug: toSlug(name), description }),
    onSuccess: () => {
      toast.success("Board created");
      qc.invalidateQueries({ queryKey: ["boards"] });
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create board"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> New Board
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Board</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
