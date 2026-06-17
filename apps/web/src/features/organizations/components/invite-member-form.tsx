import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface InviteMemberFormProps {
  action: (formData: FormData) => Promise<void>;
  organizationId?: string;
}

export function InviteMemberForm({
  action,
  organizationId
}: InviteMemberFormProps) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Invite member</h2>
        <p className="text-sm text-[var(--muted)]">
          Generate an invitation token for a teammate.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <input name="organizationId" type="hidden" value={organizationId ?? ""} />
        <Label>
          <span>Email</span>
          <Input disabled={!organizationId} name="email" required type="email" />
        </Label>
        <Label>
          <span>Role</span>
          <select
            className="min-h-10 rounded-lg border border-slate-300 bg-[var(--panel)] px-3 text-sm"
            disabled={!organizationId}
            name="role"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
        </Label>
        <Button disabled={!organizationId} type="submit">
          Create invitation
        </Button>
      </form>
    </Card>
  );
}
