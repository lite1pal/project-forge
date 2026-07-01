import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { TodoScreen } from "@/src/features/todo/components/todo-screen";

import { getShellProductConfig } from "@/app/product-module";
import {
  createTodoWorkspaceAction,
  loadTodoWorkspacePage
} from "@/src/features/todo-product/server/todo-workspace";

interface ResourcePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourcePage({ searchParams }: ResourcePageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedSearchParams = await searchParams;
  const data = await loadTodoWorkspacePage(resolvedSearchParams, {
    currentUser
  });
  const shellProduct = getShellProductConfig({
    activeOrganizationId: data.workspace.activeOrganizationId,
    activeProjectId: data.workspace.activeProjectId,
    installedProducts: data.workspace.activeOrganizationInstalledProducts,
    preferredProductId: "todo"
  });

  return (
    <AppShell
      activeOrganizationId={data.workspace.activeOrganizationId}
      activeProjectId={data.workspace.activeProjectId}
      availableProducts={shellProduct.availableProducts}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <div className="grid gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Todos</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Todos</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">This generated product route loads real todos through the API seam and allows inline creation.</p>
        </header>
        <form action={createTodoWorkspaceAction} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <label className="grid gap-2">
            <span>Title</span>
            <input name="title" type="text" required className="rounded-md border border-[var(--border)] px-3 py-2" />
          </label>
          <label className="grid gap-2">
            <span>Details</span>
            <textarea name="details" className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2" />
          </label>
          <label className="grid gap-2">
            <span>Status</span>
            <select name="status" defaultValue="todo" required className="rounded-md border border-[var(--border)] px-3 py-2">
              <option value="todo">Todo</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span>Due At</span>
            <input name="dueAt" type="datetime-local" className="rounded-md border border-[var(--border)] px-3 py-2" />
          </label>
          <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">Create Todo</button>
        </form>
        <TodoScreen items={data.items} />
      </div>
    </AppShell>
  );
}
