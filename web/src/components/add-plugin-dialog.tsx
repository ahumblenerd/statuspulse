"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createPlugin } from "@/api/sdk.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AddPluginDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [statusPath, setStatusPath] = useState("status");
  const [mapping, setMapping] = useState('{"healthy":"operational","unhealthy":"outage"}');
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      createPlugin({
        body: {
          name,
          config: {
            url,
            statusPath,
            statusMapping: JSON.parse(mapping),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Plugin created");
      qc.invalidateQueries({ queryKey: ["plugins"] });
      setOpen(false);
      setName("");
      setUrl("");
    },
    onError: () => toast.error("Failed to create plugin"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> Add Plugin
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register Custom Plugin</DialogTitle>
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
            <Label>Health Check URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required />
          </div>
          <div className="space-y-2">
            <Label>Status JSON Path</Label>
            <Input
              value={statusPath}
              onChange={(e) => setStatusPath(e.target.value)}
              placeholder="e.g. status.overall"
            />
          </div>
          <div className="space-y-2">
            <Label>Status Mapping (JSON)</Label>
            <Textarea
              value={mapping}
              onChange={(e) => setMapping(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            Register
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
