import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type { ProjectWebhookEndpoint } from "@/src/features/organizations/domain/schemas";

interface ProjectWebhooksSettingsCardProps {
  activeOrganizationId?: string;
  activeProjectId?: string;
  activeProjectWebhookSecret?: {
    endpointId: string;
    secret: string;
  };
  canManage: boolean;
  createProjectWebhookAction: (formData: FormData) => Promise<void>;
  deleteProjectWebhookAction: (formData: FormData) => Promise<void>;
  projectWebhooks: ProjectWebhookEndpoint[];
  rotateProjectWebhookSecretAction: (formData: FormData) => Promise<void>;
  updateProjectWebhookAction: (formData: FormData) => Promise<void>;
}

export function ProjectWebhooksSettingsCard({
  activeOrganizationId,
  activeProjectId,
  activeProjectWebhookSecret,
  canManage,
  createProjectWebhookAction,
  deleteProjectWebhookAction,
  projectWebhooks,
  rotateProjectWebhookSecretAction,
  updateProjectWebhookAction
}: ProjectWebhooksSettingsCardProps) {
  const canConfigure = Boolean(activeOrganizationId && activeProjectId && canManage);

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Project webhooks</h2>
        <p className="text-sm text-[var(--muted)]">
          Deliver signed audit-event notifications to one endpoint per integration.
        </p>
      </div>

      {activeProjectWebhookSecret ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <p className="text-sm font-medium">Copy this secret now.</p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
            {activeProjectWebhookSecret.secret}
          </p>
        </div>
      ) : null}

      <form action={createProjectWebhookAction} className="grid gap-3">
        <input name="organizationId" type="hidden" value={activeOrganizationId ?? ""} />
        <input name="projectId" type="hidden" value={activeProjectId ?? ""} />
        <Label>
          <span>Destination URL</span>
          <Input
            disabled={!canConfigure}
            name="url"
            placeholder="https://example.com/auditrail/webhooks"
            required
            type="url"
          />
        </Label>
        <Label className="flex items-center gap-2 text-sm">
          <input defaultChecked disabled={!canConfigure} name="deliverAuditEventCreated" type="checkbox" />
          <span>Send audit event deliveries</span>
        </Label>
        <Button disabled={!canConfigure} type="submit">
          Add webhook
        </Button>
      </form>

      {!canConfigure ? (
        <p className="text-sm text-[var(--muted)]">
          {canManage
            ? "Select a project before managing webhook delivery."
            : "Only organization owners and admins can manage webhook endpoints."}
        </p>
      ) : null}

      <div className="grid gap-3">
        {projectWebhooks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No webhook endpoints are configured for this project yet.
          </p>
        ) : (
          projectWebhooks.map((endpoint) => (
            <Card className="grid gap-3" key={endpoint.id}>
              <form action={updateProjectWebhookAction} className="grid gap-3">
                <input name="organizationId" type="hidden" value={endpoint.organizationId} />
                <input name="projectId" type="hidden" value={endpoint.projectId} />
                <input name="endpointId" type="hidden" value={endpoint.id} />
                <Label>
                  <span>Destination URL</span>
                  <Input defaultValue={endpoint.url} name="url" required type="url" />
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <input
                    defaultChecked={endpoint.enabled}
                    name="enabled"
                    type="checkbox"
                  />
                  <span>Enabled</span>
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <input
                    defaultChecked={endpoint.subscribedEventTypes.includes("audit.event.created")}
                    name="deliverAuditEventCreated"
                    type="checkbox"
                  />
                  <span>Send audit event deliveries</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>

              <div className="grid gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-sm">
                <p className="font-medium">Latest delivery</p>
                {endpoint.latestDelivery ? (
                  <>
                    <p>Status: {endpoint.latestDelivery.status}</p>
                    <p>
                      Attempts: {endpoint.latestDelivery.attemptCount}/
                      {endpoint.latestDelivery.maxAttempts}
                    </p>
                    <p>
                      Last event: {endpoint.latestDelivery.auditEventType} at{" "}
                      {new Date(endpoint.latestDelivery.auditEventCreatedAt).toLocaleString()}
                    </p>
                    {endpoint.latestDelivery.responseStatusCode ? (
                      <p>Response: HTTP {endpoint.latestDelivery.responseStatusCode}</p>
                    ) : null}
                    {endpoint.latestDelivery.lastError ? (
                      <p className="text-[var(--muted)]">
                        Error: {endpoint.latestDelivery.lastError}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[var(--muted)]">No deliveries recorded yet.</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={rotateProjectWebhookSecretAction}>
                  <input name="organizationId" type="hidden" value={endpoint.organizationId} />
                  <input name="projectId" type="hidden" value={endpoint.projectId} />
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <Button type="submit" variant="secondary">
                    Rotate secret
                  </Button>
                </form>
                <form action={deleteProjectWebhookAction}>
                  <input name="organizationId" type="hidden" value={endpoint.organizationId} />
                  <input name="projectId" type="hidden" value={endpoint.projectId} />
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <Button type="submit" variant="secondary">
                    Delete endpoint
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </Card>
  );
}
