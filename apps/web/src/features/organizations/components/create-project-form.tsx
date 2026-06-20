import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface CreateProjectFormProps {
  action: (formData: FormData) => Promise<void>;
  canManage?: boolean;
  organizationId?: string;
}

export function CreateProjectForm({
  action,
  canManage = true,
  organizationId
}: CreateProjectFormProps) {
  const canCreate = Boolean(organizationId && canManage);

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Create project</h2>
        <p className="text-sm text-[var(--muted)]">
          Projects scope audit events and exports.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <input name="organizationId" type="hidden" value={organizationId ?? ""} />
        <Label>
          <span>Name</span>
          <Input
            disabled={!canCreate}
            name="name"
            placeholder="Production"
            required
          />
        </Label>
        <Button disabled={!canCreate} type="submit">
          Create project
        </Button>
      </form>
      {!canCreate ? (
        <p className="text-sm text-[var(--muted)]">
          {canManage
            ? "Select an organization before creating a project."
            : "Only organization owners and admins can create projects."}
        </p>
      ) : null}
    </Card>
  );
}
