import { describe, expect, it } from "vitest";

import {
  createProductManifestRegistry,
  installedProductStateSchema,
  productDefinitionSchema,
  productModuleManifestSchema
} from "../index.js";

describe("productDefinitionSchema", () => {
  it("accepts a generic product definition with reusable onboarding steps", () => {
    expect(
      productDefinitionSchema.parse({
        emptyStateCopy: {
          emptyStateDescription: "Start by connecting your first resource.",
          emptyStateTitle: "No data yet",
          primaryCtaHref: "/setup",
          primaryCtaLabel: "Get started"
        },
        id: "example-product",
        name: "Example Product",
        navItems: [
          {
            href: "/overview",
            id: "overview",
            label: "Overview"
          }
        ],
        onboardingSteps: [
          {
            id: "workspace_created",
            required: true
          }
        ],
        usageMeters: [
          {
            key: "events",
            label: "Events"
          }
        ]
      })
    ).toMatchObject({
      id: "example-product",
      onboardingSteps: [{ id: "workspace_created", required: true }]
    });
  });

  it("rejects blank identifiers in boundary-facing product config", () => {
    expect(() =>
      productDefinitionSchema.parse({
        emptyStateCopy: {
          emptyStateDescription: "Has description",
          emptyStateTitle: "Has title"
        },
        id: " ",
        name: "Example Product",
        navItems: [],
        onboardingSteps: [],
        usageMeters: []
      })
    ).toThrow();
  });

  it("accepts a product-module manifest with runtime and resource metadata", () => {
    expect(
      productModuleManifestSchema.parse({
        capabilities: [
          {
            description: "Exposes invoice CRUD routes and screens.",
            id: "invoice-crud",
            kind: "resource"
          }
        ],
        chrome: {
          errorHeading: "Unable to load Invoices",
          loadingLabel: "Loading Invoices...",
          metadataDescription: "Invoice workspace",
          metadataTitle: "Invoices"
        },
        description: "Example product module manifest.",
        emptyStateCopy: {
          emptyStateDescription: "Create the first invoice to begin.",
          emptyStateTitle: "No invoices yet",
          primaryCtaHref: "/invoices/create",
          primaryCtaLabel: "Create invoice"
        },
        id: "invoices",
        name: "Invoices",
        navItems: [
          {
            href: "/invoices",
            id: "invoices",
            label: "Invoices"
          }
        ],
        onboardingContent: {
          completeSummaryDescription: "Required setup is complete.",
          dismissFromSidebarLabel: "Dismiss",
          eyebrow: "Setup",
          incompleteSummaryDescription: "Finish setup to send your first invoice.",
          showInSidebarLabel: "Show setup",
          stepContent: [
            {
              action: {
                label: "Create customer",
                target: "customers"
              },
              description: "Create the first billable customer.",
              stepId: "customer_created",
              title: "Create a customer"
            }
          ],
          title: "Getting started"
        },
        onboardingSteps: [
          {
            id: "customer_created",
            required: true
          }
        ],
        resources: [
          {
            id: "invoice",
            navigationId: "invoices",
            ownership: "organization",
            routeBasePath: "/api/v1/invoices"
          }
        ],
        runtime: {
          registrations: [
            {
              description: "Registers invoice routes.",
              id: "invoice-api-routes",
              surface: "api",
              target: "invoice-routes"
            }
          ]
        },
        usageMeters: [
          {
            key: "invoices",
            label: "Invoices"
          }
        ]
      })
    ).toMatchObject({
      capabilities: [{ id: "invoice-crud", kind: "resource" }],
      resources: [{ id: "invoice", ownership: "organization" }],
      runtime: {
        registrations: [{ id: "invoice-api-routes", surface: "api" }]
      }
    });
  });

  it("rejects a product-module manifest when onboarding content drifts from declared steps", () => {
    expect(() =>
      productModuleManifestSchema.parse({
        capabilities: [],
        emptyStateCopy: {
          emptyStateDescription: "Has description",
          emptyStateTitle: "Has title"
        },
        id: "example-product",
        name: "Example Product",
        navItems: [],
        onboardingContent: {
          completeSummaryDescription: "Done.",
          dismissFromSidebarLabel: "Dismiss",
          eyebrow: "Setup",
          incompleteSummaryDescription: "Still needs setup.",
          showInSidebarLabel: "Show setup",
          stepContent: [
            {
              action: {
                label: "Do setup",
                target: "setup"
              },
              description: "Do the setup.",
              stepId: "unknown_step",
              title: "Setup"
            }
          ],
          title: "Getting started"
        },
        onboardingSteps: [
          {
            id: "known_step",
            required: true
          }
        ],
        resources: [],
        runtime: {
          registrations: []
        },
        usageMeters: []
      })
    ).toThrow(/onboarding content/i);
  });

  it("accepts installed-product state and resolves enabled manifests through a registry", () => {
    const manifest = productModuleManifestSchema.parse({
      capabilities: [],
      emptyStateCopy: {
        emptyStateDescription: "Has description",
        emptyStateTitle: "Has title"
      },
      id: "tasks",
      name: "Tasks",
      navItems: [],
      onboardingContent: {
        completeSummaryDescription: "Done.",
        dismissFromSidebarLabel: "Dismiss",
        eyebrow: "Setup",
        incompleteSummaryDescription: "Needs setup.",
        showInSidebarLabel: "Show setup",
        stepContent: [],
        title: "Getting started"
      },
      onboardingSteps: [],
      resources: [],
      runtime: {
        registrations: []
      },
      usageMeters: []
    });
    const registry = createProductManifestRegistry([manifest]);
    const installedProducts = [
      installedProductStateSchema.parse({
        enabled: true,
        productId: "tasks"
      }),
      installedProductStateSchema.parse({
        enabled: false,
        productId: "unknown"
      })
    ];

    expect(registry.hasEnabledProduct(installedProducts, "tasks")).toBe(true);
    expect(registry.resolveEnabledProducts(installedProducts)).toEqual([manifest]);
    expect(registry.require("tasks")).toEqual(manifest);
  });
});
