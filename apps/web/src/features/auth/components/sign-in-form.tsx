import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface SignInFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function SignInForm({ action }: SignInFormProps) {
  return (
    <Card className="grid w-full max-w-md gap-5">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your work email to receive a secure magic link.
        </p>
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
