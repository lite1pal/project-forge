import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface CreateApiKeyFormProps {
  action: (formData: FormData) => Promise<void>;
  organizationId?: string;
  projectId?: string;
}

export function CreateApiKeyForm({
  action,
  organizationId,
  projectId
}: CreateApiKeyFormProps) {
  const canCreate = Boolean(organizationId && projectId);

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Create API key</h2>
        <p className="text-sm text-[var(--muted)]">
          Generate a machine key for the selected project.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <input name="organizationId" type="hidden" value={organizationId ?? ""} />
        <input name="projectId" type="hidden" value={projectId ?? ""} />
        <div className="grid gap-2">
          <Label htmlFor="api-key-name">Key name</Label>
          <Input
            defaultValue="Production ingest"
            id="api-key-name"
            name="name"
            placeholder="Production ingest"
          />
        </div>
        <Button disabled={!canCreate} type="submit">
          Generate key
        </Button>
      </form>
      {!canCreate ? (
        <p className="text-sm text-[var(--muted)]">
          Create and select a project before generating a key.
        </p>
      ) : null}
    </Card>
  );
}
