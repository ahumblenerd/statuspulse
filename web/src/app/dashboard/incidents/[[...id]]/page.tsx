"use client";

import { useParams } from "next/navigation";

import { IncidentDetailView } from "./incident-detail-view";
import { IncidentsListView } from "./incidents-list-view";

export default function IncidentsPage() {
  const params = useParams<{ id?: string[] }>();
  const incidentId = params.id?.[0];

  if (incidentId) {
    return <IncidentDetailView id={incidentId} />;
  }

  return <IncidentsListView />;
}
