import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageShell } from "@/src/components/ui/page-shell";
import { SectionHeader } from "@/src/components/ui/section-header";
import { ApiKeysTable } from "@/src/features/api-keys/components/api-keys-table";
import { CreateApiKeyForm } from "@/src/features/api-keys/components/create-api-key-form";
import type { ManagedApiKey } from "@/src/features/api-keys/domain/schemas";

interface ApiKeysScreenProps {
  activeOrganizationId?: string;
  activeProjectId?: string;
  apiKeys: ManagedApiKey[];
  createApiKeyAction: (formData: FormData) => Promise<void>;
  currentUserEmail: string;
  newApiKey?: {
    name: string;
    projectId: string;
    rawKey: string;
  };
  organizationName?: string;
  projectName?: string;
  revokeApiKeyAction: (formData: FormData) => Promise<void>;
}

export function ApiKeysScreen({
  activeOrganizationId,
  activeProjectId,
  apiKeys,
  createApiKeyAction,
  currentUserEmail,
  newApiKey,
  organizationName,
  projectName,
  revokeApiKeyAction
}: ApiKeysScreenProps) {
  const description =
    organizationName && projectName
      ? `${organizationName} / ${projectName}`
      : "Manage machine credentials for the active workspace.";

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader description={description} eyebrow="Security" title="API Keys" />
        <Button asChild>
          <a href="#create-api-key">Create a new API key</a>
        </Button>
      </div>
      <ApiKeysTable
        apiKeys={apiKeys}
        currentUserEmail={currentUserEmail}
        newApiKey={newApiKey}
        organizationId={activeOrganizationId}
        projectId={activeProjectId}
        revokeApiKeyAction={revokeApiKeyAction}
      />
      <Card className="grid gap-3" id="create-api-key">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold">Create a new API key</h2>
          <p className="text-sm text-[var(--muted)]">
            Secret keys are only shown immediately after creation. Creator metadata for older
            keys is not stored yet.
          </p>
        </div>
        <CreateApiKeyForm
          action={createApiKeyAction}
          organizationId={activeOrganizationId}
          projectId={activeProjectId}
          redirectTo="/api-keys"
        />
      </Card>
    </PageShell>
  );
}
