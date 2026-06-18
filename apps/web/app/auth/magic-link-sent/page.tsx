import { AuthShell } from "@/src/features/auth/components/auth-shell";
import { MagicLinkSent } from "@/src/features/auth/components/magic-link-sent";

interface MagicLinkSentPageProps {
  searchParams: Promise<{
    email?: string;
  }>;
}

export default async function MagicLinkSentPage({
  searchParams
}: MagicLinkSentPageProps) {
  const params = await searchParams;

  return (
    <AuthShell>
      <MagicLinkSent email={params.email} />
    </AuthShell>
  );
}
