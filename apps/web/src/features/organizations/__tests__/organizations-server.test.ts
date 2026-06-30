import { describe, expect, it } from "vitest";

import { ApiError } from "@/src/lib/api/api-errors";
import {
  loadOrganizationMembersPage,
  loadWorkspacePage,
  submitBillingCheckout,
  submitBillingPortal
} from "@/src/features/organizations/server/organizations-server";

describe("loadWorkspacePage", () => {
  it("loads the selected project API keys and onboarding command", async () => {
    const result = await loadWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-2"
      },
      {
        currentUser: createCurrentUser({
          memberships: [
            {
              organization: {
                id: "org-1",
                name: "Acme"
              },
              organizationId: "org-1",
              plan: starterPlan(),
              projectIds: ["project-1", "project-2"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1"
                },
                {
                  id: "project-2",
                  name: "Billing",
                  organizationId: "org-1"
                }
              ],
              role: "owner"
            }
          ]
        }),
        apiKeysClient: {
          async createApiKey() {
            throw new Error("not used");
          },
          async listApiKeys() {
            return {
              apiKeys: [
                {
                  createdAt: "2026-06-18T10:00:00.000Z",
                  id: "key-1",
                  keyPrefix: "atlabc",
                  name: "Production ingest",
                  projectId: "project-2",
                  revoked: false
                }
              ]
            };
          },
          async revokeApiKey() {
            throw new Error("not used");
          }
        },
        billingClient: {
          async createCheckoutIntent() {
            throw new Error("not used");
          },
          async createPortalIntent() {
            throw new Error("not used");
          },
          async getBillingStatus() {
            return {
              customer: null,
              organizationId: "org-1",
              providerConfigurationStatus: "not_configured" as const,
              subscription: {
                billingCustomerId: "customer-1",
                billingPlanId: "billing-growth-monthly",
                cancelAtPeriodEnd: false,
                createdAt: "2026-06-18T10:00:00.000Z",
                currentPeriodEnd: "2026-07-01T00:00:00.000Z",
                currentPeriodStart: "2026-06-01T00:00:00.000Z",
                entitlementPlanId: "growth",
                id: "subscription-1",
                provider: "stripe" as const,
                providerPriceId: "price_123",
                providerSubscriptionId: "sub_123",
                status: "active" as const,
                updatedAt: "2026-06-18T10:00:00.000Z"
              }
            };
          }
        },
        config: {
          AUTH_SESSION_COOKIE_NAME: "auditrail_session",
          WEB_API_BASE_URL: "http://localhost:4000"
        },
        cookieStore: {
          delete() {},
          get() {
            return {
              value: JSON.stringify({
                name: "Production ingest",
                organizationId: "org-1",
                projectId: "project-2",
                rawKey: "atlabc_secret"
              })
            };
          }
        } as {
          delete(name: string): void;
          get(name: string): { value: string } | undefined;
        },
        webhooksClient: createWebhooksClientStub(),
        requestHeaders: new Headers({
          host: "localhost:3000"
        })
      }
    );

    expect(result.activeProjectId).toBe("project-2");
    expect(result.activeOrganizationPlan?.id).toBe("starter");
    expect(result.billingStatus?.subscription?.billingPlanId).toBe(
      "billing-growth-monthly"
    );
    expect(result.apiKeys).toHaveLength(1);
    expect(result.newApiKey?.rawKey).toBe("atlabc_secret");
    expect(result.ingestCommand).toContain("authorization: Bearer atlabc_secret");
    expect(result.ingestCommand).toContain('"event":"billing.tested"');
  });

  it("ignores a flashed api key from a different organization", async () => {
    const result = await loadWorkspacePage(
      {
        organizationId: "org-2"
      },
      {
        currentUser: createCurrentUser({
          memberships: [
            {
              organization: {
                id: "org-1",
                name: "Acme"
              },
              organizationId: "org-1",
              plan: starterPlan(),
              projectIds: ["project-1", "project-2"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1"
                },
                {
                  id: "project-2",
                  name: "Billing",
                  organizationId: "org-1"
                }
              ],
              role: "owner"
            },
            {
              organization: {
                id: "org-2",
                name: "Beta"
              },
              organizationId: "org-2",
              plan: growthPlan(),
              projectIds: ["project-9"],
              projects: [
                {
                  id: "project-9",
                  name: "Sandbox",
                  organizationId: "org-2"
                }
              ],
              role: "member"
            }
          ]
        }),
        apiKeysClient: {
          async createApiKey() {
            throw new Error("not used");
          },
          async listApiKeys() {
            return {
              apiKeys: []
            };
          },
          async revokeApiKey() {
            throw new Error("not used");
          }
        },
        billingClient: {
          async createCheckoutIntent() {
            throw new Error("not used");
          },
          async createPortalIntent() {
            throw new Error("not used");
          },
          async getBillingStatus() {
            return {
              customer: null,
              organizationId: "org-2",
              providerConfigurationStatus: "not_configured" as const,
              subscription: null
            };
          }
        },
        config: {
          AUTH_SESSION_COOKIE_NAME: "auditrail_session",
          WEB_API_BASE_URL: "http://localhost:4000"
        },
        cookieStore: {
          delete() {},
          get() {
            return {
              value: JSON.stringify({
                name: "Production ingest",
                organizationId: "org-1",
                projectId: "project-2",
                rawKey: "atlabc_secret"
              })
            };
          }
        } as {
          delete(name: string): void;
          get(name: string): { value: string } | undefined;
        },
        webhooksClient: createWebhooksClientStub(),
        requestHeaders: new Headers({
          host: "localhost:3000"
        })
      }
    );

    expect(result.activeOrganizationId).toBe("org-2");
    expect(result.billingStatus?.organizationId).toBe("org-2");
    expect(result.ingestCommand).toContain("authorization: Bearer <YOUR_API_KEY>");
  });

  it("fails closed when the selected organization does not have the required product", async () => {
    const result = await loadWorkspacePage(
      {
        organizationId: "org-2"
      },
      {
        currentUser: createCurrentUser({
          memberships: [
            {
              organization: {
                id: "org-1",
                name: "Acme"
              },
              organizationId: "org-1",
              plan: starterPlan(),
              projectIds: ["project-1"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1"
                }
              ],
              role: "owner"
            },
            {
              installedProducts: [
                {
                  enabled: false,
                  productId: "audit-events"
                }
              ],
              organization: {
                id: "org-2",
                name: "Beta"
              },
              organizationId: "org-2",
              plan: growthPlan(),
              projectIds: ["project-9"],
              projects: [
                {
                  id: "project-9",
                  name: "Sandbox",
                  organizationId: "org-2"
                }
              ],
              role: "admin"
            }
          ]
        }),
        apiKeysClient: {
          async createApiKey() {
            throw new Error("not used");
          },
          async listApiKeys() {
            throw new Error("not used");
          },
          async revokeApiKey() {
            throw new Error("not used");
          }
        },
        billingClient: {
          async createCheckoutIntent() {
            throw new Error("not used");
          },
          async createPortalIntent() {
            throw new Error("not used");
          },
          async getBillingStatus() {
            throw new Error("not used");
          }
        },
        config: {
          AUTH_SESSION_COOKIE_NAME: "auditrail_session",
          WEB_API_BASE_URL: "http://localhost:4000"
        },
        cookieStore: {
          delete() {},
          get() {
            return undefined;
          }
        },
        productId: "audit-events",
        requestHeaders: new Headers({
          host: "localhost:3000"
        })
      }
    );

    expect(result.activeOrganizationId).toBeUndefined();
    expect(result.activeProjectId).toBeUndefined();
    expect(result.organizations).toEqual([
      {
        id: "org-1",
        name: "Acme"
      }
    ]);
    expect(result.projects).toEqual([]);
  });
});

describe("loadOrganizationMembersPage", () => {
  it("loads members for the active organization", async () => {
    const result = await loadOrganizationMembersPage(
      {
        organizationId: "org-1"
      },
      {
        currentUser: createCurrentUser({
          memberships: [
            {
              organization: {
                id: "org-1",
                name: "Acme"
              },
              organizationId: "org-1",
              plan: starterPlan(),
              projectIds: ["project-1"],
              projects: [
                {
                  id: "project-1",
                  name: "Production",
                  organizationId: "org-1"
                }
              ],
              role: "owner"
            }
          ]
        }),
        organizationsClient: {
          async changePlan() {
            throw new Error("not used");
          },
          async createOrganization() {
            throw new Error("not used");
          },
          async createProject() {
            throw new Error("not used");
          },
          async listMembers() {
            return {
              members: [
                {
                  email: "user@example.com",
                  id: "user-1",
                  name: "Casey",
                  role: "owner"
                }
              ]
            };
          },
          async listOrganizations() {
            throw new Error("not used");
          },
          async listProjects() {
            throw new Error("not used");
          }
        }
      }
    );

    expect(result.activeOrganizationId).toBe("org-1");
    expect(result.members).toEqual([
      {
        email: "user@example.com",
        id: "user-1",
        name: "Casey",
        role: "owner"
      }
    ]);
  });
});

describe("billing actions", () => {
  it("returns a redirect URL when checkout session creation succeeds", async () => {
    await expect(
      submitBillingCheckout(
        {
          organizationId: "org-1",
          planId: "starter"
        },
        {
          billingClient: {
            async createCheckoutIntent() {
              return {
                provider: "stripe" as const,
                url: "https://checkout.stripe.com/c/pay/cs_test_123"
              };
            },
            async createPortalIntent() {
              throw new Error("not used");
            },
            async getBillingStatus() {
              throw new Error("not used");
            }
          },
          requestHeaders: new Headers({
            host: "app.example.com",
            "x-forwarded-proto": "https"
          })
        }
      )
    ).resolves.toEqual({
      redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      status: "success"
    });
  });

  it("maps checkout provider-not-configured responses to stable UI copy", async () => {
    await expect(
      submitBillingCheckout(
        {
          organizationId: "org-1",
          planId: "starter"
        },
        {
          billingClient: {
            async createCheckoutIntent() {
              throw new ApiError(
                "billing_provider_not_configured",
                501,
                "billing_provider_not_configured"
              );
            },
            async createPortalIntent() {
              throw new Error("not used");
            },
            async getBillingStatus() {
              throw new Error("not used");
            }
          },
          requestHeaders: new Headers({
            host: "app.example.com",
            "x-forwarded-proto": "https"
          })
        }
      )
    ).resolves.toEqual({
      message: "Billing checkout is not connected yet.",
      status: "error"
    });
  });

  it("maps portal provider-not-configured responses to stable UI copy", async () => {
    await expect(
      submitBillingPortal(
        {
          organizationId: "org-1"
        },
        {
          billingClient: {
            async createCheckoutIntent() {
              throw new Error("not used");
            },
            async createPortalIntent() {
              throw new ApiError(
                "billing_provider_not_configured",
                501,
                "billing_provider_not_configured"
              );
            },
            async getBillingStatus() {
              throw new Error("not used");
            }
          },
          requestHeaders: new Headers({
            host: "app.example.com",
            "x-forwarded-proto": "https"
          })
        }
      )
    ).resolves.toEqual({
      message: "Billing portal is not connected yet.",
      status: "error"
    });
  });

  it("maps missing billing customer responses to stable portal copy", async () => {
    await expect(
      submitBillingPortal(
        {
          organizationId: "org-1"
        },
        {
          billingClient: {
            async createCheckoutIntent() {
              throw new Error("not used");
            },
            async createPortalIntent() {
              throw new ApiError(
                "billing_customer_not_found",
                409,
                "billing_customer_not_found"
              );
            },
            async getBillingStatus() {
              throw new Error("not used");
            }
          },
          requestHeaders: new Headers({
            host: "app.example.com",
            "x-forwarded-proto": "https"
          })
        }
      )
    ).resolves.toEqual({
      message: "Billing portal is unavailable until this organization has a billing customer.",
      status: "error"
    });
  });
});

function createCurrentUser(
  overrides: Partial<{
    memberships: Array<{
      installedProducts?: Array<{
        enabled: boolean;
        productId: string;
      }>;
      organization: {
        id: string;
        name: string;
      };
      organizationId: string;
      plan: {
        id: "starter" | "growth" | "scale";
        includedEvents: number;
        name: string;
        periodEnd: string;
        periodStart: string;
        remainingEvents: number;
        usedEvents: number;
      };
      projectIds: string[];
      projects: Array<{
        id: string;
        name: string;
        organizationId: string;
      }>;
      role: "owner" | "admin" | "member" | "viewer";
      onboarding?: ReturnType<typeof incompleteOnboarding>;
    }>;
  }> = {}
) {
  return {
    memberships: (overrides.memberships ?? []).map((membership) => ({
      ...membership,
      installedProducts: membership.installedProducts ?? [
        {
          enabled: true,
          productId: "audit-events"
        }
      ],
      onboarding: membership.onboarding ?? incompleteOnboarding()
    })),
    user: {
      email: "user@example.com",
      id: "user-1"
    }
  };
}

function starterPlan() {
  return {
    id: "starter" as const,
    includedEvents: 100000,
    name: "Starter",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 99999,
    usedEvents: 1
  };
}

function growthPlan() {
  return {
    id: "growth" as const,
    includedEvents: 1000000,
    name: "Growth",
    periodEnd: "2026-07-01T00:00:00.000Z",
    periodStart: "2026-06-01T00:00:00.000Z",
    remainingEvents: 999000,
    usedEvents: 1000
  };
}

function incompleteOnboarding() {
  return {
    completedRequiredSteps: 0,
    isComplete: false,
    isDismissed: false,
    steps: [
      { id: "project_created" as const, required: true, status: "pending" as const },
      { id: "api_key_created" as const, required: true, status: "pending" as const },
      {
        id: "first_event_ingested" as const,
        required: true,
        status: "pending" as const
      },
      { id: "member_invited" as const, required: false, status: "pending" as const }
    ],
    totalRequiredSteps: 3
  };
}

function createWebhooksClientStub() {
  return {
    async createWebhook() {
      throw new Error("not used");
    },
    async deleteWebhook() {
      throw new Error("not used");
    },
    async listWebhooks() {
      return {
        endpoints: []
      };
    },
    async rotateSecret() {
      throw new Error("not used");
    },
    async updateWebhook() {
      throw new Error("not used");
    }
  };
}
