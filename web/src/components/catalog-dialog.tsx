"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { addService, getCatalog } from "@/api/sdk.gen";
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

export function CatalogDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await getCatalog();
      return res.data?.vendors ?? [];
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: (vendorId: string) => addService({ body: { vendorId } }),
    onSuccess: () => {
      toast.success("Service added");
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["status"] });
    },
    onError: () => toast.error("Failed to add service"),
  });

  const filtered = (data ?? []).filter(
    (v) =>
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" /> Add Vendor
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vendor Catalog</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 max-h-96">
          {filtered.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-2 hover:bg-accent">
              <div>
                <p className="text-sm font-medium">{v.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {v.category}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => v.id && add.mutate(v.id)}
                disabled={add.isPending}
              >
                Add
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No vendors found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
