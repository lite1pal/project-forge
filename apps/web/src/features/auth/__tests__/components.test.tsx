import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthCallbackForm } from "@/src/features/auth/components/auth-callback-form";
import { SignInForm } from "@/src/features/auth/components/sign-in-form";

describe("auth forms", () => {
  it("renders the callback form with a direct API post action", () => {
    render(
      <AuthCallbackForm
        action="https://api.example.com/api/v1/auth/sessions/confirm?email=user%40example.com&token=magic-token"
        email="user@example.com"
      />
    );

    expect(screen.getByRole("button", { name: "Confirm sign in" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm sign in" }).closest("form")?.getAttribute("action")
    ).toBe(
      "https://api.example.com/api/v1/auth/sessions/confirm?email=user%40example.com&token=magic-token"
    );
  });

  it("shows a sign-in error when the callback redirect reports one", () => {
    render(
      <SignInForm
        action={vi.fn(async () => {})}
        errorMessage="That sign-in link is invalid or expired. Request a new magic link."
      />
    );

    expect(
      screen.getByText("That sign-in link is invalid or expired. Request a new magic link.")
    ).toBeTruthy();
  });
});
