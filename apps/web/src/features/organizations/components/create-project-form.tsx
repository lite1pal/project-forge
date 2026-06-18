import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface CreateProjectFormProps {
  action: (formData: FormData) => Promise<void>;
  organizationId?: string;
}

export function CreateProjectForm({
  action,
  organizationId
}: CreateProjectFormProps) {
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
            disabled={!organizationId}
            name="name"
            placeholder="Production"
            required
          />
        </Label>
        <Button disabled={!organizationId} type="submit">
          Create project
        </Button>
      </form>
    </Card>
  );
}
