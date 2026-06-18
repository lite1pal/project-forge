/**
 * Generated from apps/api /api/v1/openapi.json.
 *
 * Refresh with:
 * pnpm --filter web api:types
 */
export interface paths {
  "/api/v1/auth/magic-links": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            email: string;
          };
        };
      };
      responses: {
        202: {
          content: {
            "application/json": {
              accepted: boolean;
            };
          };
        };
      };
    };
  };
  "/api/v1/auth/sessions": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            email: string;
            token: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              user: components["schemas"]["AuthUser"];
            };
          };
        };
      };
    };
  };
  "/api/v1/auth/sessions/current": {
    delete: {
      responses: {
        204: never;
      };
    };
  };
  "/api/v1/me": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CurrentUserResponse"];
          };
        };
      };
    };
  };
  "/api/v1/organizations": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              organizations: components["schemas"]["Organization"][];
            };
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              membership: components["schemas"]["Membership"];
              organization: components["schemas"]["Organization"];
            };
          };
        };
      };
    };
  };
  [path: `/api/v1/organizations/${string}/projects`]: {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              projects: components["schemas"]["Project"][];
            };
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              project: components["schemas"]["Project"];
            };
          };
        };
      };
    };
  };
  [path: `/api/v1/organizations/${string}/projects/${string}/api-keys`]: {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              apiKeys: components["schemas"]["ManagedApiKey"][];
            };
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              apiKey: components["schemas"]["ManagedApiKey"];
              rawKey: string;
            };
          };
        };
      };
    };
  };
  [path: `/api/v1/organizations/${string}/projects/${string}/api-keys/${string}/revoke`]: {
    post: {
      responses: {
        204: never;
      };
    };
  };
  [path: `/api/v1/organizations/${string}/invitations`]: {
    post: {
      requestBody: {
        content: {
          "application/json": {
            email: string;
            role: "admin" | "member" | "viewer";
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              invitation: components["schemas"]["Invitation"];
              token: string;
            };
          };
        };
      };
    };
  };
  "/api/v1/invitations/accept": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            token: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              membership: components["schemas"]["Membership"];
            };
          };
        };
      };
    };
  };
  "/api/v1/events": {
    get: {
      parameters: {
        query?: {
          actor?: string;
          cursor?: string;
          event?: string;
          from?: string;
          limit?: number;
          target?: string;
          to?: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["EventListResponse"];
          };
        };
      };
    };
  };
  "/api/v1/events/stats": {
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          top?: number;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["EventStatsResponse"];
          };
        };
      };
    };
  };
  "/api/v1/events/timeseries": {
    get: {
      parameters: {
        query?: {
          bucket?: "hour" | "day";
          from: string;
          to: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["EventTimeseriesResponse"];
          };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    AuthUser: {
      email: string;
      id: string;
      name?: string;
    };
    CurrentUserResponse: {
      memberships: Array<{
        organization: components["schemas"]["Organization"];
        organizationId: string;
        projectIds: string[];
        projects: components["schemas"]["Project"][];
        role: "owner" | "admin" | "member" | "viewer";
      }>;
      user: components["schemas"]["AuthUser"];
    };
    ManagedApiKey: {
      createdAt: string;
      id: string;
      keyPrefix: string;
      lastUsedAt?: string;
      name: string;
      projectId: string;
      revoked: boolean;
    };
    EventListResponse: {
      events: Array<{
        actor?: string;
        createdAt: string;
        event: string;
        id: string;
        metadata: Record<string, unknown>;
        target?: string;
      }>;
      pageInfo: {
        hasMore: boolean;
        nextCursor: string | null;
      };
    };
    EventStatsResponse: {
      topEventTypes: Array<{
        count: number;
        event: string;
      }>;
      totalEvents: number;
    };
    EventTimeseriesResponse: {
      points: Array<{
        bucketStart: string;
        count: number;
      }>;
    };
    Invitation: {
      acceptedAt?: string;
      email: string;
      expiresAt: string;
      id: string;
      organizationId: string;
      revokedAt?: string;
      role: "owner" | "admin" | "member" | "viewer";
    };
    Membership: {
      id: string;
      organizationId: string;
      role: "owner" | "admin" | "member" | "viewer";
      userId: string;
    };
    Organization: {
      id: string;
      name: string;
    };
    Project: {
      id: string;
      name: string;
      organizationId: string;
    };
  };
}
