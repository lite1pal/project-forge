import { Card } from "@/src/components/ui/card";

interface InvitationLinkCardProps {
  invitationUrl?: string;
}

export function InvitationLinkCard({ invitationUrl }: InvitationLinkCardProps) {
  return invitationUrl ? (
    <Card className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        Invitation link
      </p>
      <p className="text-sm text-[var(--muted)]">
        Share this link with teammates so they can accept the pending invitation.
      </p>
      <code className="block break-all rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-sm">
        {invitationUrl}
      </code>
    </Card>
  ) : (
    <Card className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        Invitation link
      </p>
      <p className="text-sm text-[var(--muted)]">
        Create an invitation to generate a shareable join link for this organization.
      </p>
    </Card>
  );
}
