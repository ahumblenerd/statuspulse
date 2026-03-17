"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteService, getServices, updateService } from "@/api/sdk.gen";
import { CatalogDialog } from "@/components/catalog-dialog";
import { DataTable } from "@/components/data-table";
import { SiteHeader } from "@/components/site-header";

import { getServiceColumns } from "./columns";

export function ServicesListView() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["services", { enabled: "" }],
    queryFn: async () => {
      const res = await getServices({ query: { enabled: "" } });
      return res.data?.services ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateService({ path: { id }, body: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service updated");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteService({ path: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["status"] });
      toast.success("Service deleted");
    },
  });

  const columns = getServiceColumns({
    onToggle: (id, enabled) => toggle.mutate({ id, enabled }),
    onDelete: (id) => remove.mutate(id),
  });

  return (
    <>
      <SiteHeader title="Services" />
      <div className="p-4">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            searchKey="name"
            searchPlaceholder="Search services..."
            toolbar={<CatalogDialog />}
          />
        )}
      </div>
    </>
  );
}
