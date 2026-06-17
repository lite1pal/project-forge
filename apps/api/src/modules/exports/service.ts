import { z } from "zod";

const exportFiltersSchema = z.object({
  actor: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  target: z.string().trim().min(1).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

export type ExportFilters = z.infer<typeof exportFiltersSchema>;
export type ExportJobStatus = "pending" | "running" | "completed" | "failed";

export interface ExportJob {
  id: string;
  error?: string;
  filters: ExportFilters;
  objectKey?: string;
  organizationId: string;
  projectId: string;
  requestedByUserId: string;
  status: ExportJobStatus;
}

export interface ExportJobRepo {
  create(input: Omit<ExportJob, "id" | "status">): Promise<ExportJob>;
  findById(input: {
    exportId: string;
    organizationId: string;
    projectId: string;
  }): Promise<ExportJob | undefined>;
  listByProject(input: {
    organizationId: string;
    projectId: string;
  }): Promise<ExportJob[]>;
  markCompleted(input: {
    exportId: string;
    objectKey: string;
  }): Promise<void>;
  markFailed(input: {
    error: string;
    exportId: string;
  }): Promise<void>;
  markRunning(exportId: string): Promise<void>;
  takePending(limit: number): Promise<ExportJob[]>;
}

export interface ExportService {
  createExport(input: {
    filters: unknown;
    organizationId: string;
    projectId: string;
    requestedByUserId: string;
  }): Promise<ExportJob>;
  listExports(input: {
    organizationId: string;
    projectId: string;
  }): Promise<ExportJob[]>;
  getExport(input: {
    exportId: string;
    organizationId: string;
    projectId: string;
  }): Promise<ExportJob | undefined>;
}

export function createExportService(repo: ExportJobRepo): ExportService {
  return {
    createExport(input) {
      return repo.create({
        filters: exportFiltersSchema.parse(input.filters),
        organizationId: input.organizationId,
        projectId: input.projectId,
        requestedByUserId: input.requestedByUserId
      });
    },
    listExports(input) {
      return repo.listByProject(input);
    },
    getExport(input) {
      return repo.findById(input);
    }
  };
}
