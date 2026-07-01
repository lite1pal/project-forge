import { describe, expect, it } from "vitest";

import { todoProductModule } from "../product-module.js";

describe("todoProductModule", () => {
  it("builds scoped shell navigation for Todo", () => {
    expect(
      todoProductModule.getShellProductConfig({
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toEqual({
      navItems:       [
        {
          "href": "/todo?organizationId=org-1&projectId=project-1",
          "id": "todo-home",
          "label": "Todo"
        },
        {
          "href": "/todo/todos?organizationId=org-1&projectId=project-1",
          "id": "todo-todos",
          "label": "Todos"
        }
      ],
      productName: "Todo"
    });
  });

  it("keeps Todo onboarding empty for the first generated slice", () => {
    expect(
      todoProductModule.buildOnboardingStepViews({
        activeOnboarding: { steps: [] },
        activeOrganizationId: "org-1"
      })
    ).toEqual([]);
  });
});
