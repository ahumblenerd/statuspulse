"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getHistory } from "@/api/sdk.gen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UptimeChart({ serviceId }: { serviceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["history", serviceId],
    queryFn: async () => {
      const res = await getHistory({ path: { serviceId } });
      return res.data;
    },
  });

  if (isLoading) return <div className="h-48 animate-pulse bg-muted" />;

  const daily = data?.dailyUptime ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Uptime — last 30 days</CardTitle>
        {data?.uptime && (
          <p className="text-2xl font-bold tabular-nums">{data.uptime.percentage.toFixed(2)}%</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis domain={[90, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
            />
            <Area
              type="monotone"
              dataKey="uptimePercent"
              className="fill-chart-1/20 stroke-chart-1"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
