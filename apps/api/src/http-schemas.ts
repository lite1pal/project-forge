import type { FastifyInstance } from "fastify";

export const schemaIds = {
  apiDescriptorResponse: "ApiDescriptorResponse",
  healthResponse: "HealthResponse",
  acceptedResponse: "AcceptedResponse",
  simpleErrorResponse: "SimpleErrorResponse",
  validationIssue: "ValidationIssue",
  validationErrorResponse: "ValidationErrorResponse",
  rateLimitErrorResponse: "RateLimitErrorResponse",
  eventAcceptedResponse: "EventAcceptedResponse",
  eventRecordResponse: "EventRecordResponse",
  eventListResponse: "EventListResponse",
  eventPageInfoResponse: "EventPageInfoResponse",
  eventStatsResponse: "EventStatsResponse",
  eventTimeseriesPointResponse: "EventTimeseriesPointResponse",
  eventTimeseriesResponse: "EventTimeseriesResponse",
  ingestEventBody: "IngestEventBody",
  listEventsQuery: "ListEventsQuery",
  summarizeEventsQuery: "SummarizeEventsQuery",
  timeseriesEventsQuery: "TimeseriesEventsQuery",
  openApiDocumentResponse: "OpenApiDocumentResponse"
  ,
  requestMagicLinkBody: "RequestMagicLinkBody",
  createSessionBody: "CreateSessionBody",
  authUserResponse: "AuthUserResponse",
  sessionCreatedResponse: "SessionCreatedResponse",
  currentUserResponse: "CurrentUserResponse",
  createApiKeyBody: "CreateApiKeyBody",
  managedApiKeyResponse: "ManagedApiKeyResponse"
} as const;

export function registerApiSchemas(app: FastifyInstance) {
  addSchemaIfMissing(app, {
    $id: schemaIds.apiDescriptorResponse,
    type: "object",
    additionalProperties: false,
    required: ["basePath", "latestVersion", "defaultVersion", "versions"],
    properties: {
      basePath: { type: "string" },
      latestVersion: { type: "string" },
      defaultVersion: { type: "string" },
      versions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["version", "path"],
          properties: {
            version: { type: "string" },
            path: { type: "string" }
          }
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.healthResponse,
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["ok"]
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.acceptedResponse,
    type: "object",
    additionalProperties: false,
    required: ["accepted"],
    properties: {
      accepted: { type: "boolean" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.simpleErrorResponse,
    type: "object",
    additionalProperties: false,
    required: ["error"],
    properties: {
      error: { type: "string" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.validationIssue,
    type: "object",
    additionalProperties: false,
    required: ["message", "code", "path"],
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      path: {
        type: "array",
        items: {
          anyOf: [{ type: "string" }, { type: "number" }]
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.validationErrorResponse,
    type: "object",
    additionalProperties: false,
    required: ["error", "issues"],
    properties: {
      error: { type: "string" },
      issues: {
        type: "array",
        items: {
          $ref: `${schemaIds.validationIssue}#`
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.rateLimitErrorResponse,
    type: "object",
    additionalProperties: false,
    required: ["statusCode", "error", "message"],
    properties: {
      statusCode: { type: "number" },
      code: { type: "string" },
      error: { type: "string" },
      message: { type: "string" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.requestMagicLinkBody,
    type: "object",
    additionalProperties: false,
    required: ["email"],
    properties: {
      email: {
        type: "string",
        format: "email"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.createSessionBody,
    type: "object",
    additionalProperties: false,
    required: ["email", "token"],
    properties: {
      email: {
        type: "string",
        format: "email"
      },
      token: {
        type: "string",
        minLength: 1
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.authUserResponse,
    type: "object",
    additionalProperties: false,
    required: ["id", "email"],
    properties: {
      id: { type: "string" },
      email: {
        type: "string",
        format: "email"
      },
      name: { type: "string" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.currentUserResponse,
    type: "object",
    additionalProperties: false,
    required: ["user", "memberships"],
    properties: {
      user: {
        $ref: `${schemaIds.authUserResponse}#`
      },
      memberships: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "projectIds", "role"],
          properties: {
            organizationId: { type: "string" },
            organization: {
              type: "object",
              additionalProperties: false,
              required: ["id", "name"],
              properties: {
                id: { type: "string" },
                name: { type: "string" }
              }
            },
            projectIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            projects: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "organizationId", "name"],
                properties: {
                  id: { type: "string" },
                  organizationId: { type: "string" },
                  name: { type: "string" }
                }
              }
            },
            role: {
              type: "string",
              enum: ["owner", "admin", "member", "viewer"]
            }
          }
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.sessionCreatedResponse,
    type: "object",
    additionalProperties: false,
    required: ["user"],
    properties: {
      user: {
        $ref: `${schemaIds.authUserResponse}#`
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.createApiKeyBody,
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 120
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.managedApiKeyResponse,
    type: "object",
    additionalProperties: false,
    required: ["id", "projectId", "keyPrefix", "name", "revoked", "createdAt"],
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      keyPrefix: { type: "string" },
      name: { type: "string" },
      revoked: { type: "boolean" },
      createdAt: {
        type: "string",
        format: "date-time"
      },
      lastUsedAt: {
        type: "string",
        format: "date-time"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventAcceptedResponse,
    type: "object",
    additionalProperties: false,
    required: ["id", "event", "accepted"],
    properties: {
      id: { type: "string" },
      event: { type: "string" },
      accepted: { type: "boolean" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventRecordResponse,
    type: "object",
    additionalProperties: false,
    required: ["id", "event", "metadata", "createdAt"],
    properties: {
      id: { type: "string" },
      event: { type: "string" },
      actor: { type: "string" },
      target: { type: "string" },
      metadata: {
        type: "object",
        additionalProperties: true
      },
      createdAt: {
        type: "string",
        format: "date-time"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventPageInfoResponse,
    type: "object",
    additionalProperties: false,
    required: ["hasMore", "nextCursor"],
    properties: {
      hasMore: { type: "boolean" },
      nextCursor: {
        anyOf: [{ type: "string" }, { type: "null" }]
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventListResponse,
    type: "object",
    additionalProperties: false,
    required: ["events", "pageInfo"],
    properties: {
      events: {
        type: "array",
        items: {
          $ref: `${schemaIds.eventRecordResponse}#`
        }
      },
      pageInfo: {
        $ref: `${schemaIds.eventPageInfoResponse}#`
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventStatsResponse,
    type: "object",
    additionalProperties: false,
    required: ["totalEvents", "topEventTypes"],
    properties: {
      totalEvents: { type: "number" },
      topEventTypes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["event", "count"],
          properties: {
            event: { type: "string" },
            count: { type: "number" }
          }
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventTimeseriesPointResponse,
    type: "object",
    additionalProperties: false,
    required: ["bucketStart", "count"],
    properties: {
      bucketStart: {
        type: "string",
        format: "date-time"
      },
      count: { type: "number" }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.eventTimeseriesResponse,
    type: "object",
    additionalProperties: false,
    required: ["points"],
    properties: {
      points: {
        type: "array",
        items: {
          $ref: `${schemaIds.eventTimeseriesPointResponse}#`
        }
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.ingestEventBody,
    type: "object",
    additionalProperties: false,
    required: ["event"],
    properties: {
      event: {
        type: "string",
        minLength: 1,
        maxLength: 200
      },
      actor: {
        type: "string",
        minLength: 1,
        maxLength: 200
      },
      target: {
        type: "string",
        minLength: 1,
        maxLength: 200
      },
      metadata: {
        type: "object",
        additionalProperties: true
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.listEventsQuery,
    type: "object",
    additionalProperties: false,
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 25
      },
      cursor: {
        type: "string",
        minLength: 1
      },
      event: {
        type: "string",
        minLength: 1
      },
      actor: {
        type: "string",
        minLength: 1
      },
      target: {
        type: "string",
        minLength: 1
      },
      events: {
        type: "string",
        minLength: 1
      },
      actors: {
        type: "string",
        minLength: 1
      },
      targets: {
        type: "string",
        minLength: 1
      },
      from: {
        type: "string",
        format: "date-time"
      },
      to: {
        type: "string",
        format: "date-time"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.summarizeEventsQuery,
    type: "object",
    additionalProperties: false,
    properties: {
      top: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        default: 5
      },
      from: {
        type: "string",
        format: "date-time"
      },
      to: {
        type: "string",
        format: "date-time"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.timeseriesEventsQuery,
    type: "object",
    additionalProperties: false,
    required: ["from", "to"],
    properties: {
      from: {
        type: "string",
        format: "date-time"
      },
      to: {
        type: "string",
        format: "date-time"
      },
      bucket: {
        type: "string",
        enum: ["hour", "day"],
        default: "hour"
      }
    }
  });

  addSchemaIfMissing(app, {
    $id: schemaIds.openApiDocumentResponse,
    type: "object",
    additionalProperties: true
  });
}

function addSchemaIfMissing(
  app: FastifyInstance,
  schema: { $id: string } & Record<string, unknown>
) {
  if (app.getSchema(schema.$id)) {
    return;
  }

  app.addSchema(schema);
}
