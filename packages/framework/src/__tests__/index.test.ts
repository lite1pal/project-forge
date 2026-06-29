import { describe, expect, it } from "vitest";

import {
  frameworkAgentTaskDefinitionSchema,
  frameworkGeneratorPlanSchema,
  frameworkOwnershipDefinitionSchema,
  frameworkResourceDefinitionSchema,
  frameworkResourceSpecSchema,
  normalizeFrameworkResourceSpec
} from "../index.js";

describe("framework contracts", () => {
  it("accepts a valid generic resource definition", () => {
    expect(
      frameworkResourceDefinitionSchema.parse({
        crud: {
          enabledOperations: ["list", "create", "read", "update"]
        },
        fields: [
          {
            name: "id",
            required: true,
            type: "uuid",
            unique: true
          },
          {
            name: "status",
            enumValues: ["draft", "active"],
            required: true,
            type: "enum"
          }
        ],
        id: "workspace",
        moduleId: "workspace-platform",
        moduleKind: "platform-core",
        name: "Workspace",
        ownership: {
          mode: "organization",
          ownerField: "organizationId"
        },
        routes: [
          {
            authStrategy: "session",
            id: "list-workspaces",
            method: "GET",
            path: "/workspaces",
            resourceId: "workspace"
          }
        ]
      })
    ).toMatchObject({
      id: "workspace",
      ownership: {
        mode: "organization",
        ownerField: "organizationId"
      }
    });
  });

  it("accepts a valid organization-owned resource spec", () => {
    expect(
      frameworkResourceSpecSchema.parse({
        api: {
          prefix: "/v1/customers"
        },
        crud: {
          create: true,
          delete: false,
          list: true,
          read: true,
          update: true
        },
        fields: [
          {
            name: "name",
            required: true,
            searchable: true,
            type: "string"
          },
          {
            name: "email",
            required: true,
            sortable: true,
            type: "email",
            unique: true
          },
          {
            default: "active",
            name: "status",
            required: true,
            type: "enum",
            values: ["active", "inactive"]
          }
        ],
        label: "Customer",
        ownership: "organization",
        permissions: {
          admin: "write",
          member: "read"
        },
        resource: "customer",
        ui: {
          nav: true,
          navLabel: "Customers"
        }
      })
    ).toMatchObject({
      api: {
        prefix: "/v1/customers"
      },
      ownership: "organization",
      pluralLabel: "Customers",
      resource: "customer",
      ui: {
        nav: true,
        navLabel: "Customers"
      }
    });
  });

  it("accepts a valid user-owned resource spec", () => {
    expect(
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            name: "title",
            required: true,
            type: "string"
          }
        ],
        label: "Preference",
        ownership: "user",
        resource: "userPreference"
      })
    ).toMatchObject({
      api: {
        prefix: "/v1/user-preferences"
      },
      ownership: "user",
      resource: "userPreference",
      ui: {
        createPage: true,
        detailPage: true,
        editPage: true,
        listPage: true
      }
    });
  });

  it("accepts a valid enum field", () => {
    expect(
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            default: "draft",
            name: "status",
            required: true,
            type: "enum",
            values: ["draft", "published"]
          }
        ],
        label: "Article",
        ownership: "none",
        resource: "article"
      }).fields[0]
    ).toMatchObject({
      default: "draft",
      values: ["draft", "published"]
    });
  });

  it("rejects an invalid enum field without values", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            name: "status",
            required: true,
            type: "enum"
          }
        ],
        label: "Article",
        ownership: "none",
        resource: "article"
      })
    ).toThrow(/values/i);
  });

  it("rejects duplicate field names", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            name: "email",
            required: true,
            type: "email"
          },
          {
            name: "email",
            required: false,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    ).toThrow(/unique/i);
  });

  it("rejects invalid field identifiers", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            name: "display-name",
            required: true,
            type: "string"
          }
        ],
        label: "Profile",
        ownership: "user",
        resource: "profile"
      })
    ).toThrow(/TypeScript identifiers/i);
  });

  it("rejects invalid API prefixes", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        api: {
          prefix: "v1/customers"
        },
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    ).toThrow(/start with \//i);
  });

  it("rejects specs with all CRUD operations disabled", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        crud: {
          create: false,
          delete: false,
          list: false,
          read: false,
          update: false
        },
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    ).toThrow(/at least one CRUD operation/i);
  });

  it("rejects reserved resource names", () => {
    expect(() =>
      frameworkResourceSpecSchema.parse({
        fields: [
          {
            name: "name",
            required: true,
            type: "string"
          }
        ],
        label: "User",
        ownership: "none",
        resource: "user"
      })
    ).toThrow(/reserved/i);
  });

  it("normalizes plural labels, CRUD defaults, UI defaults, and API prefixes", () => {
    expect(
      normalizeFrameworkResourceSpec({
        fields: [
          {
            name: "name",
            type: "string"
          }
        ],
        label: "Company",
        ownership: "organization",
        resource: "customerAccount"
      })
    ).toMatchObject({
      api: {
        filters: [],
        pagination: true,
        prefix: "/v1/customer-accounts",
        public: false
      },
      crud: {
        create: true,
        delete: false,
        list: true,
        read: true,
        update: true
      },
      pluralLabel: "Companies",
      timestamps: {
        createdAtField: "createdAt",
        enabled: true,
        updatedAtField: "updatedAt"
      },
      ui: {
        createPage: true,
        detailPage: true,
        editPage: true,
        listPage: true,
        nav: true,
        navLabel: "Companies"
      }
    });
  });

  it("rejects invalid field types", () => {
    expect(() =>
      frameworkResourceDefinitionSchema.parse({
        fields: [
          {
            name: "title",
            required: true,
            type: "markdown"
          }
        ],
        id: "note",
        moduleId: "notes",
        moduleKind: "product",
        name: "Note",
        ownership: {
          mode: "user",
          ownerField: "userId"
        }
      })
    ).toThrow();
  });

  it("rejects invalid ownership modes", () => {
    expect(() =>
      frameworkOwnershipDefinitionSchema.parse({
        mode: "workspace",
        ownerField: "workspaceId"
      })
    ).toThrow();
  });

  it("accepts a generator plan with generated file entries", () => {
    expect(
      frameworkGeneratorPlanSchema.parse({
        agentContext: {
          checkIds: ["framework-typecheck"],
          contextFiles: ["packages/framework/src/index.ts"],
          moduleIds: ["framework-contracts"],
          resourceIds: ["workspace"],
          summary: "Generate platform-owned framework contract scaffolding only.",
          taskIds: ["framework-contract-review"]
        },
        agentTasks: [
          {
            allowedPaths: ["packages/framework/**"],
            contextFiles: ["packages/framework/src/index.ts"],
            forbiddenPaths: ["apps/api/**", "apps/web/**"],
            goal: "Keep the contract package pure and generic.",
            id: "framework-contract-review",
            reportFields: ["files changed", "checks run"],
            requiredChecks: ["framework-typecheck"],
            stopConditions: ["unexpected runtime dependency", "product import detected"],
            taskType: "implementation"
          }
        ],
        checks: [
          {
            appliesToPaths: ["packages/framework/**"],
            command: "pnpm --filter @auditrail/framework typecheck",
            id: "framework-typecheck",
            required: true
          }
        ],
        generatedFiles: [
          {
            action: "create",
            moduleKind: "tooling",
            path: "packages/framework/src/index.ts",
            reason: "Expose the framework contract vocabulary.",
            requiresManualReview: false,
            templateId: "framework-contracts/index"
          }
        ],
        modules: [
          {
            id: "framework-contracts",
            kind: "tooling",
            resourceIds: ["workspace"],
            rootPath: "packages/framework/src"
          }
        ],
        resources: [
          {
            fields: [
              {
                name: "id",
                required: true,
                type: "uuid"
              }
            ],
            id: "workspace",
            moduleId: "framework-contracts",
            moduleKind: "tooling",
            name: "Workspace",
            ownership: {
              mode: "organization",
              ownerField: "organizationId"
            }
          }
        ]
      })
    ).toMatchObject({
      generatedFiles: [
        {
          action: "create",
          path: "packages/framework/src/index.ts"
        }
      ]
    });
  });

  it("accepts an agent task with allowed and forbidden paths", () => {
    expect(
      frameworkAgentTaskDefinitionSchema.parse({
        allowedPaths: ["packages/framework/**", "docs/**"],
        contextFiles: ["docs/02-architecture.md", "tasks/workflow.txt"],
        forbiddenPaths: ["apps/api/**", "packages/domain/src/audit-events/**"],
        goal: "Define the reusable framework contract layer without runtime changes.",
        id: "framework-contract-task",
        reportFields: ["boundary scanner result", "next suggested task"],
        requiredChecks: ["framework-typecheck", "boundaries"],
        stopConditions: ["runtime route change", "database migration required"],
        taskType: "implementation"
      })
    ).toMatchObject({
      allowedPaths: ["packages/framework/**", "docs/**"],
      forbiddenPaths: ["apps/api/**", "packages/domain/src/audit-events/**"]
    });
  });
});
