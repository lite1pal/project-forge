import { Card } from "../../../components/ui/card";

interface MagicLinkSentProps {
  email?: string;
}

export function MagicLinkSent({ email }: MagicLinkSentProps) {
  return (
    <Card className="grid w-full max-w-md gap-3">
      <h1 className="text-2xl font-bold">Check your email</h1>
      <p className="text-sm text-[var(--muted)]">
        We sent a sign-in link{email ? ` to ${email}` : ""}. Open it in this
        browser to continue.
      </p>
    </Card>
  );
}
