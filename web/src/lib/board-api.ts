const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

/** Generic typed fetch wrapper — surfaces server error messages. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error
      ? typeof body.error === "string"
        ? body.error
        : JSON.stringify(body.error)
      : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Board types */
export interface Board {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isDefault?: boolean;
  status?: string;
  monitorCount?: number;
  createdAt?: string;
}

export interface Monitor {
  id: string;
  boardId: string;
  name: string;
  monitorType: string;
  providerServiceId: string | null;
  selectionMode: string;
  selectedComponentIds: string | null;
  enabled: boolean;
  showOnStatusPage: boolean;
  displayOrder: number;
  statusOverride: string | null;
  computedStatus: string;
  createdAt: string;
}

export interface MonitorComponent {
  id: string;
  name: string;
  status: string;
  group?: string;
}

export interface BoardDetail extends Board {
  monitors: Monitor[];
  aggregateStatus: string;
}

export interface MockScenario {
  name: string;
  description: string;
}

/** Board CRUD */
export const listBoards = () => api<{ boards: Board[] }>("/boards");

export const createBoard = (body: { name: string; slug?: string; description?: string }) =>
  api<Board>("/boards", { method: "POST", body: JSON.stringify(body) });

export const getBoard = (id: string) => api<BoardDetail>(`/boards/${id}`);

export const updateBoard = (id: string, body: Partial<Board>) =>
  api<Board>(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteBoard = (id: string) => api<void>(`/boards/${id}`, { method: "DELETE" });

export const duplicateBoard = (id: string) =>
  api<Board>(`/boards/${id}/duplicate`, { method: "POST" });

/** Monitor CRUD */
export const listMonitors = (boardId: string) =>
  api<{ monitors: Monitor[] }>(`/boards/${boardId}/monitors`);

export const createMonitor = (boardId: string, body: { name: string; providerServiceId: string }) =>
  api<Monitor>(`/boards/${boardId}/monitors`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateMonitor = (
  boardId: string,
  id: string,
  body: {
    selectionMode?: string;
    selectedComponentIds?: string[] | null;
    name?: string;
    enabled?: boolean;
  }
) =>
  api<void>(`/boards/${boardId}/monitors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteMonitor = (boardId: string, id: string) =>
  api<void>(`/boards/${boardId}/monitors/${id}`, { method: "DELETE" });

export const getMonitorComponents = (boardId: string, id: string) =>
  api<{ components: MonitorComponent[] }>(`/boards/${boardId}/monitors/${id}/components`);

/** Board alerts */
export interface BoardAlert {
  id: string;
  boardId: string;
  type: string;
  name: string;
  url: string;
}

export const listBoardAlerts = (boardId: string) =>
  api<{ alerts: BoardAlert[] }>(`/boards/${boardId}/alerts`);

export const createBoardAlert = (
  boardId: string,
  body: { type: string; name: string; url: string }
) =>
  api<BoardAlert>(`/boards/${boardId}/alerts`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteBoardAlert = (boardId: string, id: string) =>
  api<void>(`/boards/${boardId}/alerts/${id}`, { method: "DELETE" });

export const testBoardAlert = (boardId: string, id: string) =>
  api<{ ok: boolean }>(`/boards/${boardId}/alerts/${id}/test`, { method: "POST" });

/** Mock endpoints */
export const listMockScenarios = () => api<{ scenarios: MockScenario[] }>("/mock/scenarios");

export const applyMockScenario = (boardId: string, name: string) =>
  api<void>(`/mock/boards/${boardId}/scenarios/${name}`, { method: "POST" });

export const overrideMonitorStatus = (monitorId: string, status: string) =>
  api<void>(`/mock/monitors/${monitorId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });

export const resetMonitor = (monitorId: string) =>
  api<void>(`/mock/monitors/${monitorId}/reset`, { method: "POST" });

export const seedHistory = (boardId: string) =>
  api<void>("/mock/seed-history", {
    method: "POST",
    body: JSON.stringify({ boardId }),
  });
