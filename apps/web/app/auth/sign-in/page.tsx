import { AuthShell } from "@/src/features/auth/components/auth-shell";
import { SignInForm } from "@/src/features/auth/components/sign-in-form";
import { requestMagicLinkAction } from "@/src/features/auth/server/auth-server";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInForm action={requestMagicLinkAction} />
    </AuthShell>
  );
}
