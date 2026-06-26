interface OnboardingSidebarToggleButtonProps {
  dismissFromSidebarLabel: string;
  isDismissed: boolean;
  showInSidebarLabel: string;
}

export function OnboardingSidebarToggleButton({
  dismissFromSidebarLabel,
  isDismissed,
  showInSidebarLabel
}: OnboardingSidebarToggleButtonProps) {
  return (
    <button
      className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--panel-subtle)]"
      type="submit"
    >
      {isDismissed ? showInSidebarLabel : dismissFromSidebarLabel}
    </button>
  );
}
