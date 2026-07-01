import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { TodoForm } from "@/src/features/todo/components/todo-form";

import { getShellProductConfig } from "@/app/product-module";
import {
  loadTodoWorkspaceDetailPage,
  updateTodoWorkspaceAction
} from "@/src/features/todo-product/server/todo-workspace";

interface ResourceEditPageProps {
  params: Promise<{ todoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceEditPage({
  params,
  searchParams
}: ResourceEditPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadTodoWorkspaceDetailPage(
    {
      todoId: resolvedParams.todoId,
      searchParams: resolvedSearchParams
    },
    {
      currentUser
    }
  );
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit Todo</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit Todo</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated todo record through the existing API seam.</p>
        </header>
        <TodoForm
          action={updateTodoWorkspaceAction}
          defaultValues={data.item ?? undefined}
          submitLabel="Save Todo"
        >
          <input name="todoId" type="hidden" value={data.item?.id ?? resolvedParams.todoId} />
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
        </TodoForm>
      </div>
    </AppShell>
  );
}
