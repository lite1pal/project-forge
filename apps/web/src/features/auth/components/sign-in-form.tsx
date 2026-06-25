import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface SignInFormProps {
  action: (formData: FormData) => Promise<void>;
  errorMessage?: string;
}

export function SignInForm({ action, errorMessage }: SignInFormProps) {
  return (
    <Card className="grid w-full max-w-md gap-5">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your work email to receive a secure magic link.
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorMessage}
          </p>
        ) : null}
      </div>
      <form action={action} className="grid gap-4">
        <Label>
          <span>Email</span>
          <Input name="email" placeholder="you@example.com" required type="email" />
        </Label>
        <Button type="submit">Send magic link</Button>
      </form>
    </Card>
  );
}
