import { AuthCallbackForm } from "../../../src/features/auth/components/auth-callback-form";
import { AuthShell } from "../../../src/features/auth/components/auth-shell";
import { createSessionAction } from "../../../src/features/auth/server/auth-server";

interface AuthCallbackPageProps {
  searchParams: Promise<{
    email?: string;
    token?: string;
  }>;
}

export default async function AuthCallbackPage({
  searchParams
}: AuthCallbackPageProps) {
  const params = await searchParams;

  return (
    <AuthShell>
      <AuthCallbackForm
        action={createSessionAction}
        email={params.email ?? ""}
        token={params.token ?? ""}
      />
    </AuthShell>
  );
}
