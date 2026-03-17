"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateService } from "@/api/sdk.gen";
import type { Service } from "@/api/types.gen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ServiceConfigForm({ service }: { service: Service }) {
  const [name, setName] = useState(service.name);
  const [category, setCategory] = useState(service.category);
  const [region, setRegion] = useState(service.region ?? "");
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: () =>
      updateService({
        path: { id: service.id! },
        body: { name, category, region: region || undefined },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service", service.id] });
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service configuration saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const isDirty =
    name !== service.name || category !== service.category || region !== (service.region ?? "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label className="text-xs">Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["cloud", "ci-cd", "monitoring", "communication", "payments", "auth", "other"].map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. us-east-1"
            />
          </div>
          <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
            <Save className="mr-1 h-3 w-3" /> Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
