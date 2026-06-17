import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface CreateOrganizationFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function CreateOrganizationForm({ action }: CreateOrganizationFormProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Create organization</h2>
        <p className="text-sm text-[var(--muted)]">
          Start a workspace for a team or product.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <Label>
          <span>Name</span>
          <Input name="name" placeholder="Acme Security" required />
        </Label>
        <Button type="submit">Create organization</Button>
      </form>
    </Card>
  );
}
