"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createAlertTarget } from "@/api/sdk.gen";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddAlertDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"slack" | "webhook" | "teams">("slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => createAlertTarget({ body: { type, name, url } }),
    onSuccess: () => {
      toast.success("Alert target created");
      qc.invalidateQueries({ queryKey: ["alert-targets"] });
      setOpen(false);
      setName("");
      setUrl("");
    },
    onError: () => toast.error("Failed to create alert target"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> Add Alert
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Alert Target</DialogTitle>
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
