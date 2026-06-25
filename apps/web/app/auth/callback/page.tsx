import { redirect } from "next/navigation";

import { loadPublicConfig } from "@/src/config/env";
import { AuthCallbackForm } from "@/src/features/auth/components/auth-callback-form";
import { AuthShell } from "@/src/features/auth/components/auth-shell";
import { buildAuthActionUrl } from "@/src/features/auth/domain/action-urls";

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
  const email = params.email ?? "";
  const token = params.token ?? "";

  if (!email || !token) {
    redirect("/auth/sign-in?error=invalid_magic_link");
  }

  const action = buildAuthActionUrl(
    loadPublicConfig().NEXT_PUBLIC_API_BASE_URL,
    "/api/v1/auth/sessions/confirm",
    {
      email,
      redirectTo: "/",
      token
    }
  );

  return (
    <AuthShell>
      <AuthCallbackForm action={action} email={email} />
    </AuthShell>
  );
}
