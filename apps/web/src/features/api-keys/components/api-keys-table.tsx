import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import type { ManagedApiKey } from "@/src/features/api-keys/domain/schemas";

interface ApiKeysTableProps {
  apiKeys: ManagedApiKey[];
  currentUserEmail: string;
  newApiKey?: {
    name: string;
    projectId: string;
    rawKey: string;
  };
  organizationId?: string;
  projectId?: string;
  revokeApiKeyAction: (formData: FormData) => Promise<void>;
}

export function ApiKeysTable({
  apiKeys,
  currentUserEmail,
  newApiKey,
  organizationId,
  projectId,
  revokeApiKeyAction
}: ApiKeysTableProps) {
  if (apiKeys.length === 0) {
    return <EmptyState label="No API keys yet for the selected project." />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  className="border-b border-[var(--border)] bg-[var(--panel-subtle)] p-4 text-left text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]"
                  key={header}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((apiKey) => {
              const isNewKey =
                newApiKey?.projectId === apiKey.projectId && newApiKey.name === apiKey.name;

              return (
                <tr className="align-top hover:bg-[var(--panel-subtle)]" key={apiKey.id}>
                  <td className="border-b border-[var(--border)] p-4 text-sm font-medium">
                    {apiKey.name}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {apiKey.revoked ? "Revoked" : "Active"}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-xs">
                    <code>{apiKey.id}</code>
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {isNewKey ? newApiKey.rawKey : "Hidden after creation"}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {formatDate(apiKey.createdAt)}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {isNewKey ? currentUserEmail : "Unavailable"}
                  </td>
                  <td className="border-b border-[var(--border)] p-4 text-sm">
                    {!apiKey.revoked && organizationId && projectId ? (
                      <form action={revokeApiKeyAction}>
                        <input name="organizationId" type="hidden" value={organizationId} />
                        <input name="projectId" type="hidden" value={projectId} />
                        <input name="apiKeyId" type="hidden" value={apiKey.id} />
                        <input name="redirectTo" type="hidden" value="/api-keys" />
                        <Button size="sm" type="submit" variant="secondary">
                          Revoke
                        </Button>
                      </form>
                    ) : (
                      "No actions"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const headers = [
  "Name",
  "Status",
  "Tracking ID",
  "Secret Key",
  "Created",
  "Last used",
  "Created by",
  "Actions"
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
