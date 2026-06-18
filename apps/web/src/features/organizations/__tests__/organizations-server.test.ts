import { describe, expect, it } from "vitest";

import { loadWorkspacePage } from "../server/organizations-server";

describe("loadWorkspacePage", () => {
  it("loads the selected project API keys and onboarding command", async () => {
    const result = await loadWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-2"
      },
      {
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
        config: {
          WEB_API_BASE_URL: "http://localhost:4000",
          WEB_API_KEY: undefined
        },
        cookieStore: {
          get() {
            return {
              value: JSON.stringify({
                name: "Production ingest",
                projectId: "project-2",
                rawKey: "atlabc_secret"
              })
            };
          }
        } as { get(name: string): { value: string } | undefined },
        organizationsClient: {
          async createOrganization() {
            throw new Error("not used");
          },
          async createProject() {
            throw new Error("not used");
          },
          async listOrganizations() {
            return {
              organizations: [{ id: "org-1", name: "Acme" }]
            };
          },
          async listProjects() {
            return {
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
              ]
            };
          }
        },
        requestHeaders: new Headers({
          host: "localhost:3000"
        })
      }
    );

    expect(result.activeProjectId).toBe("project-2");
    expect(result.apiKeys).toHaveLength(1);
    expect(result.newApiKey?.rawKey).toBe("atlabc_secret");
    expect(result.ingestCommand).toContain("authorization: Bearer atlabc_secret");
    expect(result.ingestCommand).toContain('"event":"billing.tested"');
  });
});
