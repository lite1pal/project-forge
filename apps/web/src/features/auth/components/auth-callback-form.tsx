import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";

interface AuthCallbackFormProps {
  action: string;
  email: string;
}

export function AuthCallbackForm({
  action,
  email
}: AuthCallbackFormProps) {
  return (
    <Card className="grid w-full max-w-md gap-5">
      <div>
        <h1 className="text-2xl font-bold">Complete sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Confirm this browser session for {email}.
        </p>
      </div>
      <form action={action} method="post">
        <Button type="submit">Confirm sign in</Button>
      </form>
    </Card>
  );
}
