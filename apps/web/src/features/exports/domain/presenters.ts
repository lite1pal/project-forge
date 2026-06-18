import type { ExportJob } from "@/src/features/exports/domain/schemas";

export function toExportJobViewModel(job: ExportJob) {
  return {
    canDownload: job.status === "completed" && Boolean(job.objectKey),
    id: job.id,
    statusLabel: formatStatus(job.status)
  };
}

function formatStatus(status: ExportJob["status"]) {
  return status[0]?.toUpperCase() + status.slice(1);
}
