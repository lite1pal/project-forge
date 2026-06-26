import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { ManagedApiKey } from "@/src/features/api-keys/domain/schemas";
import type {
  Organization,
  OrganizationBillingStatus,
  Project
} from "@/src/features/organizations/domain/schemas";

export interface WorkspaceSettingsPlanUsageCopy {
  emptyStateDescription: string;
  metrics: {
    currentPlan: string;
    includedUnits: string;
    remainingUnits: string;
    usedThisMonth: string;
  };
  navDescription: string;
  navLabel: string;
  noPermissionDescription: string;
  resetDatePrefix: string;
  selectedPlanSuffix: string;
  sectionDescription: string;
  sectionTitle: string;
  switchToPlanPrefix: string;
  usageWindowPrefix: string;
}

export interface WorkspaceSettingsProductCopy {
  planUsage: WorkspaceSettingsPlanUsageCopy;
}

export interface WorkspaceBillingActionState {
  message?: string;
  status: "error" | "idle" | "success";
}

export interface WorkspaceSettingsScreenProps {
  acceptInvitationAction: (formData: FormData) => Promise<void>;
  activeOrganizationId?: string;
  billingStatus?: OrganizationBillingStatus;
  activeOrganizationPlan?: CurrentUserResponse["memberships"][number]["plan"];
  activeOrganizationRole?: "owner" | "admin" | "member" | "viewer";
  activeProjectId?: string;
  changeOrganizationPlanAction: (formData: FormData) => Promise<void>;
  apiKeys: ManagedApiKey[];
  createApiKeyAction: (formData: FormData) => Promise<void>;
  requestBillingCheckoutAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
  requestBillingPortalAction: (
    state: WorkspaceBillingActionState,
    formData: FormData
  ) => Promise<WorkspaceBillingActionState>;
  createOrganizationAction: (formData: FormData) => Promise<void>;
  createProjectAction: (formData: FormData) => Promise<void>;
  ingestCommand?: string;
  invitationUrl?: string;
  inviteMemberAction: (formData: FormData) => Promise<void>;
  newApiKey?: {
    name: string;
    projectId: string;
    rawKey: string;
  };
  organizations: Organization[];
  productCopy: WorkspaceSettingsProductCopy;
  projects: Project[];
  revokeApiKeyAction: (formData: FormData) => Promise<void>;
}
