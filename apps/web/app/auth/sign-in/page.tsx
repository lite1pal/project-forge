import { AuthShell } from "@/src/features/auth/components/auth-shell";
import { SignInForm } from "@/src/features/auth/components/sign-in-form";
import { requestMagicLinkAction } from "@/src/features/auth/server/auth-server";

interface SignInPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

function toErrorMessage(error: string | undefined) {
  if (error === "invalid_magic_link") {
    return "That sign-in link is invalid or expired. Request a new magic link.";
  }

  return undefined;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <AuthShell>
      <SignInForm
        action={requestMagicLinkAction}
        errorMessage={toErrorMessage(params.error)}
      />
    </AuthShell>
  );
}
