import { schemaIds } from "../../http-schemas.js";

export const requestMagicLinkRouteSchema = {
  tags: ["auth"],
  summary: "Requests a passwordless magic link",
  response: {
    202: {
      $ref: `${schemaIds.acceptedResponse}#`
    },
    400: {
      $ref: `${schemaIds.simpleErrorResponse}#`
    },
    429: {
      $ref: `${schemaIds.rateLimitErrorResponse}#`
    }
  }
};

export const createSessionRouteSchema = {
  tags: ["auth"],
  summary: "Creates a browser session from a magic-link token",
  response: {
    201: {
      $ref: `${schemaIds.sessionCreatedResponse}#`
    },
    400: {
      $ref: `${schemaIds.simpleErrorResponse}#`
    },
    401: {
      $ref: `${schemaIds.simpleErrorResponse}#`
    },
    429: {
      $ref: `${schemaIds.rateLimitErrorResponse}#`
    }
  }
};

export const confirmSessionRouteSchema = {
  tags: ["auth"],
  summary: "Creates a browser session and redirects back to the web app",
  response: {
    303: {
      type: "null"
    }
  }
};

export const deleteSessionRouteSchema = {
  tags: ["auth"],
  summary: "Revokes the current browser session",
  response: {
    204: {
      type: "null"
    }
  }
};

export const logoutSessionRouteSchema = {
  tags: ["auth"],
  summary: "Revokes the current browser session and redirects back to the web app",
  response: {
    303: {
      type: "null"
    }
  }
};

export const getMeRouteSchema = {
  tags: ["auth"],
  summary: "Returns the current browser user",
  response: {
    200: {
      $ref: `${schemaIds.currentUserResponse}#`
    },
    401: {
      $ref: `${schemaIds.simpleErrorResponse}#`
    }
  }
};
