"use client";

import { useParams } from "next/navigation";

import { ServiceDetailView } from "./service-detail-view";
import { ServicesListView } from "./services-list-view";

export default function ServicesPage() {
  const params = useParams<{ id?: string[] }>();
  const serviceId = params.id?.[0];

  if (serviceId) {
    return <ServiceDetailView id={serviceId} />;
  }

  return <ServicesListView />;
}
