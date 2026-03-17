"use client";

import { useQuery } from "@tanstack/react-query";

import { getStatus } from "@/api/sdk.gen";

export function useStatusQuery() {
  return useQuery({
    queryKey: ["status"],
    queryFn: async () => {
      const res = await getStatus();
      return res.data;
    },
    refetchInterval: 15_000,
  });
}
