import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResourceDetailPage from "@/app/todo/todos/[todoId]/page";
import ResourceEditPage from "@/app/todo/todos/[todoId]/edit/page";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { TodoRecord } from "@/src/features/todo/domain/schemas";
import ResourcePage from "@/app/todo/todos/page";
import {
  createTodoWorkspaceAction,
  loadTodoWorkspaceDetailPage,
  loadTodoWorkspacePage,
  updateTodoWorkspaceAction
} from "@/src/features/todo-product/server/todo-workspace";

const records: TodoRecord[] = [];
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();
const requireCurrentUserMock = vi.fn<() => Promise<CurrentUserResponse>>();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args)
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args)
}));

vi.mock("@/src/lib/api/server-api-client", () => ({
  createServerApiClient: vi.fn(() => ({}))
}));

vi.mock("@/src/features/auth/server/auth-server", () => ({
  requireCurrentUser: () => requireCurrentUserMock()
}));

vi.mock("@/app/product-module", () => ({
  getShellProductConfig: vi.fn(() => ({
    availableProducts: [],
    navItems: [],
    productName: "Todo"
  }))
}));

vi.mock("@/src/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("@/src/features/todo/api/todo-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: TodoRecord = {
        createdAt: "2026-07-01T09:00:00.000Z",
        details:
          typeof body.details === "string" ? body.details : undefined,
        dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
        id: "todo-1",
        organizationId,
        status: body.status === "done" ? "done" : "todo",
        title: String(body.title),
        updatedAt: "2026-07-01T09:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    },
    async get() {
      return records[0];
    },
    async list() {
      return {
        items: [...records]
      };
    },
    async update(
      _organizationId: string,
      _id: string,
      body: Record<string, unknown>
    ) {
      const existing = records[0];

      if (!existing) {
        throw new Error("missing_todo");
      }
      const nextRecord: TodoRecord = {
        ...existing,
        details:
          typeof body.details === "string" ? body.details : undefined,
        dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
        status: body.status === "done" ? "done" : "todo",
        title: String(body.title),
        updatedAt: "2026-07-01T10:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    }
  }))
}));

describe("generated todo product flow", () => {
  beforeEach(() => {
    records.splice(0, records.length);
    revalidatePathMock.mockReset();
    redirectMock.mockReset();
    requireCurrentUserMock.mockReset();
    requireCurrentUserMock.mockResolvedValue(createCurrentUser());
  });

  it("loads the workspace, creates a todo, opens detail, edits it, and lists the updated record", async () => {
    const currentUser = createCurrentUser();
    const emptyPage = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(emptyPage.workspace.activeOrganizationId).toBe("org-1");
    expect(emptyPage.workspace.activeProjectId).toBe("project-1");
    expect(emptyPage.items).toEqual([]);

    const formData = new FormData();
    formData.set("organizationId", "org-1");
    formData.set("projectId", "project-1");
    formData.set("title", "Ship generated proof");
    formData.set("details", "Create and list one todo through the generated page");
    formData.set("status", "todo");
    formData.set("dueAt", "2026-07-01T12:30");

    await createTodoWorkspaceAction(formData);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1"
    );

    const detailPage = await loadTodoWorkspaceDetailPage(
      {
        searchParams: {
          organizationId: "org-1",
          projectId: "project-1"
        },
        todoId: "todo-1"
      },
      {
        currentUser
      }
    );

    expect(detailPage.item).toEqual(
      expect.objectContaining({
        title: "Ship generated proof"
      })
    );

    const updateFormData = new FormData();
    updateFormData.set("todoId", "todo-1");
    updateFormData.set("organizationId", "org-1");
    updateFormData.set("projectId", "project-1");
    updateFormData.set("title", "Ship generated detail flow");
    updateFormData.set("details", "Detail and edit now come from generated product routes");
    updateFormData.set("status", "done");
    updateFormData.set("dueAt", "2026-07-01T14:45");

    await updateTodoWorkspaceAction(updateFormData);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1?organizationId=org-1&projectId=project-1"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1?organizationId=org-1&projectId=project-1"
    );

    const populatedPage = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(populatedPage.items).toEqual([
      expect.objectContaining({
        details: "Detail and edit now come from generated product routes",
        dueAt: expect.any(String),
        organizationId: "org-1",
        status: "done",
        title: "Ship generated detail flow"
      })
    ]);
  });

  it("renders the generated todo list, detail, and edit pages with the created todo visible", async () => {
    records.splice(0, records.length, {
      createdAt: "2026-07-01T09:00:00.000Z",
      details: "Detail and edit now come from generated product routes",
      dueAt: "2026-07-01T12:30:00.000Z",
      id: "todo-1",
      organizationId: "org-1",
      status: "done",
      title: "Ship generated detail flow",
      updatedAt: "2026-07-01T09:00:00.000Z"
    });

    render(
      await ResourcePage({
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Todos" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Todo" })).toBeTruthy();
    expect(screen.getByText("Ship generated detail flow")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();

    render(
      await ResourceDetailPage({
        params: Promise.resolve({
          todoId: "todo-1"
        }),
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Ship generated detail flow" })[0]
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to list" })).toBeTruthy();

    render(
      await ResourceEditPage({
        params: Promise.resolve({
          todoId: "todo-1"
        }),
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: "Edit Todo" })).toBeTruthy();
    expect(screen.getByDisplayValue("Ship generated detail flow")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Todo" })).toBeTruthy();
  });
});

function createCurrentUser(): CurrentUserResponse {
  return {
    memberships: [
      {
        installedProducts: [
          {
            enabled: true,
            productId: "todo"
          }
        ],
        onboarding: {
          completedRequiredSteps: 0,
          isComplete: false,
          isDismissed: false,
          steps: [],
          totalRequiredSteps: 0
        },
        organization: {
          id: "org-1",
          name: "Acme"
        },
        organizationId: "org-1",
        plan: {
          id: "starter",
          includedEvents: 1000,
          name: "Starter",
          periodEnd: "2026-07-31T00:00:00.000Z",
          periodStart: "2026-07-01T00:00:00.000Z",
          remainingEvents: 1000,
          usedEvents: 0
        },
        projectIds: ["project-1"],
        projects: [
          {
            id: "project-1",
            name: "Platform",
            organizationId: "org-1"
          }
        ],
        role: "owner"
      }
    ],
    user: {
      email: "owner@example.com",
      id: "user-1",
      name: "Owner"
    }
  };
}
