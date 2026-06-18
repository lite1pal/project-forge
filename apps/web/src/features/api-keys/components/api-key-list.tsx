import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import type { ManagedApiKey } from "@/src/features/api-keys/domain/schemas";

interface ApiKeyListProps {
  apiKeys: ManagedApiKey[];
  organizationId?: string;
  projectId?: string;
  revokeApiKeyAction: (formData: FormData) => Promise<void>;
}

export function ApiKeyList({
  apiKeys,
  organizationId,
  projectId,
  revokeApiKeyAction
}: ApiKeyListProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Project API keys</h2>
        <p className="text-sm text-[var(--muted)]">
          Keys are shown by name and prefix only. Raw values are returned once.
        </p>
      </div>
      {apiKeys.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No API keys yet.</p>
      ) : (
        <ul className="grid gap-3">
          {apiKeys.map((apiKey) => (
            <li
              className="grid gap-3 rounded-lg border border-[var(--border)] p-3"
              key={apiKey.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{apiKey.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Prefix: <code>{apiKey.keyPrefix}</code>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Created: {formatDate(apiKey.createdAt)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Last used: {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--muted)]">
                    {apiKey.revoked ? "Revoked" : "Active"}
                  </span>
                  {!apiKey.revoked && organizationId && projectId ? (
                    <form action={revokeApiKeyAction}>
                      <input
                        name="organizationId"
                        type="hidden"
                        value={organizationId}
                      />
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="apiKeyId" type="hidden" value={apiKey.id} />
                      <Button size="sm" type="submit" variant="secondary">
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
