# @ory/mcp-access-control

A TypeScript module that provides MCP tool definitions for Ory Network access control integration. This module helps validate JWT tokens, create/retrieve Ory identities, and manage authentication sessions.

## Installation

```bash
npm install @ory/mcp-access-control
```

## Usage

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { McpAccessControl } from "@ory/mcp-access-control";
import { z } from "zod";

const getServer = () => {
  const server = new McpServer(
    {
      name: "ory-mcp-example",
      version: "1.0.0",
      description:
        "This is an example MCP server that uses Ory for authentication.",
    },
    { capabilities: { logging: {} } }
  );

  // Initialize the access control
  const accessControl = new McpAccessControl({
    jwksUrl: "https://your-jwks-url/.well-known/jwks.json",
    issuer: "https://your-issuer.com",
    audience: "your-audience",
    claimKey: "email",
    oryProjectUrl: "https://your-project.projects.oryapis.com",
    oryApiKey: "your-api-key",
  });

  // Tool that uses session validation
  server.tool(
    "getUserProfile",
    "Get user profile information (requires authentication)",
    {},
    async (params, context) => {
      try {
        // Validate session from request headers
        const validationResult = await accessControl.validateSession(
          context.headers,
          { headerName: "X-Session-Token" }
        );

        if (!validationResult.isValid) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication failed: ${validationResult.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Authenticated user: ${JSON.stringify(validationResult.identity, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Tool that uses the access control tool definition
  const oryAccessControlTool = accessControl.getToolDefinition();

  server.tool(
    oryAccessControlTool.name,
    oryAccessControlTool.description,
    {
      token: z.string(),
      password: z.string(),
    },
    async ({ token, password }) => {
      try {
        const result = await oryAccessControlTool.handler({ token, password });

        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication successful! Identity: ${JSON.stringify(result.identity, null, 2)}, Session: ${JSON.stringify(result.session, null, 2)}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Authentication failed: ${result.error}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  return server;
};
```

### Session Validation

The module provides a session validation function that can be used as middleware in MCP servers:

```typescript
// Validate session in your MCP tool/resource/prompt handler
async function handleRequest(headers: Record<string, string>) {
  const validationResult = await accessControl.validateSession(headers, {
    headerName: "X-Session-Token", // or any other header name you prefer
  });

  if (!validationResult.isValid) {
    throw new Error(`Authentication failed: ${validationResult.error}`);
  }

  // Continue with the request
  // validationResult.identity contains user information
  console.log("Authenticated user:", validationResult.identity);
}
```

## Features

- JWT token validation using JWKS
- Configurable JWT audience and claim extraction
- Automatic identity creation/retrieval in Ory Network
- Password-based authentication with session management
- Session token validation for MCP middleware
- MCP tool definition generation
- TypeScript support

## API Reference

### McpAccessControl

The main class that provides MCP tool definitions and session validation.

#### Constructor

```typescript
constructor(options: McpAccessControlOptions)
```

Options:

- `jwksUrl`: URL to the JWKS endpoint for JWT validation
- `issuer`: Expected JWT issuer
- `audience`: Expected JWT audience
- `claimKey`: The JWT claim key to extract (e.g., 'email', 'sub')
- `oryProjectUrl`: Ory Network project URL
- `oryApiKey`: Ory Network API key

#### Methods

##### getToolDefinition()

Returns an MCP tool definition that can be used to validate JWT tokens, create/retrieve Ory identities, and authenticate users.

The tool expects:

- `token`: JWT token containing the required claim
- `password`: Password for authentication

Returns:

- `success`: boolean indicating success/failure
- `identity`: user identity information
- `session`: session information including token

##### validateSession(headers, options)

Validates an Ory session token from request headers.

Parameters:

- `headers`: Object containing request headers
- `options.headerName`: Name of the header containing the session token

Returns:

- `isValid`: boolean indicating if the session is valid
- `identity`: user information if valid
- `error`: error message if validation fails

## MCP Integration

### Basic Server Setup

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { McpAccessControl } from "@ory/mcp-access-control";
import { z } from "zod";

const getServer = () => {
  const server = new McpServer(
    {
      name: "ory-mcp-example",
      version: "1.0.0",
      description:
        "This is an example MCP server that uses Ory for authentication.",
    },
    { capabilities: { logging: {} } }
  );

  // Initialize the access control
  const accessControl = new McpAccessControl({
    jwksUrl: "https://your-jwks-url/.well-known/jwks.json",
    issuer: "https://your-issuer.com",
    audience: "your-audience",
    claimKey: "email",
    oryProjectUrl: "https://your-project.projects.oryapis.com",
    oryApiKey: "your-api-key",
  });

  // Tool that uses session validation
  server.tool(
    "getUserProfile",
    "Get user profile information (requires authentication)",
    {},
    async (params, context) => {
      try {
        // Validate session from request headers
        const validationResult = await accessControl.validateSession(
          context.headers,
          { headerName: "X-Session-Token" }
        );

        if (!validationResult.isValid) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication failed: ${validationResult.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Authenticated user: ${JSON.stringify(validationResult.identity, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Tool that uses the access control tool definition
  const oryAccessControlTool = accessControl.getToolDefinition();

  server.tool(
    oryAccessControlTool.name,
    oryAccessControlTool.description,
    {
      token: z.string(),
      password: z.string(),
    },
    async ({ token, password }) => {
      try {
        const result = await oryAccessControlTool.handler({ token, password });

        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication successful! Identity: ${JSON.stringify(result.identity, null, 2)}, Session: ${JSON.stringify(result.session, null, 2)}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Authentication failed: ${result.error}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  return server;
};
```

### Session Validation Middleware

You can also create middleware functions for reusable authentication:

```typescript
// Middleware function for session validation
const withAuth = (handler: Function) => {
  return async (params: any, context: any) => {
    const validationResult = await accessControl.validateSession(
      context.headers,
      { headerName: "X-Session-Token" }
    );

    if (!validationResult.isValid) {
      return {
        content: [
          {
            type: "text",
            text: `Unauthorized: ${validationResult.error}`,
          },
        ],
      };
    }

    // Add user info to context for the handler
    context.user = validationResult.identity;
    return handler(params, context);
  };
};

// Use the middleware
server.tool(
  "protectedResource",
  "Access a protected resource (requires authentication)",
  {
    resourceId: z.string(),
  },
  withAuth(async ({ resourceId }, context) => {
    return {
      content: [
        {
          type: "text",
          text: `Accessing resource ${resourceId} for user ${context.user.email}`,
        },
      ],
    };
  })
);
```

## License

Apache-2.0
