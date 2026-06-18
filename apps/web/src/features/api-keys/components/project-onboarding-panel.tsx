import { Card } from "@/src/components/ui/card";

interface ProjectOnboardingPanelProps {
  activeProjectName?: string;
  createdApiKeyName?: string;
  createdRawKey?: string;
  ingestCommand?: string;
}

export function ProjectOnboardingPanel({
  activeProjectName,
  createdApiKeyName,
  createdRawKey,
  ingestCommand
}: ProjectOnboardingPanelProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">First event guide</h2>
        <p className="text-sm text-[var(--muted)]">
          Use the selected project and send one event to verify the full path.
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        <p>
          Project: <strong>{activeProjectName ?? "No project selected"}</strong>
        </p>
        <p>
          Latest key:
          {" "}
          <strong>{createdApiKeyName ?? "Generate a key below"}</strong>
        </p>
      </div>
      {createdRawKey ? (
        <section className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <p className="text-sm font-bold">Raw API key</p>
          <code className="break-all text-sm">{createdRawKey}</code>
        </section>
      ) : null}
      {ingestCommand ? (
        <section className="grid gap-2">
          <p className="text-sm font-bold">Send a test event</p>
          <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-xs">
            {ingestCommand}
          </pre>
        </section>
      ) : null}
    </Card>
  );
}
