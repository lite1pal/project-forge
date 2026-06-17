import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface AcceptInvitationFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function AcceptInvitationForm({ action }: AcceptInvitationFormProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Accept invitation</h2>
        <p className="text-sm text-[var(--muted)]">
          Paste an invitation token to join an organization.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <Label>
          <span>Token</span>
          <Input name="token" required />
        </Label>
        <Button type="submit" variant="secondary">
          Accept invitation
        </Button>
      </form>
    </Card>
  );
}
