"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { listBoards } from "@/lib/board-api";
import { StatusDot } from "@/components/status-dot";

export function BoardSwitcher() {
  const params = useParams();
  const currentBoardId = params?.id as string | undefined;

  const { data } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const res = await listBoards();
      return res.boards ?? [];
    },
    refetchInterval: 15_000,
  });

  const boards = data ?? [];
  if (boards.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground px-2">Boards</span>
      <div className="space-y-0.5">
        {boards.slice(0, 5).map((b) => (
          <Link
            key={b.id}
            href={`/dashboard/boards/${b.id}`}
            className={`flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent ${
              b.id === currentBoardId ? "bg-accent font-medium" : ""
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 truncate">{b.name}</span>
            <StatusDot status={b.status ?? "operational"} />
          </Link>
        ))}
        {boards.length > 5 && (
          <Link
            href="/dashboard/boards"
            className="block px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View all {boards.length} boards
          </Link>
        )}
      </div>
    </div>
  );
}
