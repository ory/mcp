# @ory/mcp-access-control

A TypeScript module that provides MCP tool definitions for Ory Network access control integration.

## Installation

```bash
npm install @ory/mcp-access-control
```

## Usage

```typescript
import { McpAccessControl } from "@ory/mcp-access-control";

const accessControl = new McpAccessControl({
  jwksUrl: "https://your-jwks-url/.well-known/jwks.json",
  issuer: "https://your-issuer.com",
  oryProjectUrl: "https://your-project.projects.oryapis.com",
  oryApiKey: "your-api-key",
});

const toolDefinition = accessControl.getToolDefinition();
```

## License

Apache-2.0
