"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createBrowserApiClient } from "@/src/lib/api/browser-api-client";
import { createAuditEventsClient } from "@/src/features/audit-events/api/audit-events-client";
import { toEventListViewModel } from "@/src/features/audit-events/domain/presenters";
import type { EventListQuery } from "@/src/features/audit-events/domain/query";
import { createAuditEventsService } from "@/src/features/audit-events/services/audit-events-service";

export const auditEventKeys = {
  all: ["audit-events"] as const,
  list: (query: EventListQuery) => [...auditEventKeys.all, "list", query] as const
};

export function useAuditEvents(query: EventListQuery) {
  const service = useMemo(
    () => createAuditEventsService(createAuditEventsClient(createBrowserApiClient())),
    []
  );

  return useQuery({
    queryFn: () => service.list(query),
    queryKey: auditEventKeys.list(query),
    select: toEventListViewModel
  });
}
