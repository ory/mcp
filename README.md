# Ory MCP OAuth Provider

A TypeScript implementation of an OAuth provider for Ory MCP that supports both Ory Network and Ory Hydra as backend providers.

## Installation

```bash
npm install ory-mcp-oauth-provider
```

## Project Structure

```
ory-mcp-oauth-provider/
├── src/                    # Source code directory
│   ├── example/           # Example implementations
│   │   └── mcp-server.ts  # Complete MCP server example
│   ├── index.ts           # Main implementation
│   └── index.test.ts      # Test suite
├── dist/                  # Compiled output
├── package.json          # Project configuration and dependencies
├── tsconfig.json         # TypeScript configuration
├── tsup.config.ts        # Build configuration
└── vitest.config.ts      # Test configuration
```

The project is organized as a TypeScript library with the following key components:

- `src/index.ts`: Contains the main `OryProvider` implementation
- `src/example/`: Contains example implementations, including a complete MCP server setup
- `src/index.test.ts`: Comprehensive test suite for the provider
- Configuration files for TypeScript, testing, and building

## Usage

### Basic Setup

```typescript
import { OryProvider, OryOptions } from 'ory-mcp-oauth-provider';

// Initialize with Ory Network
const networkProvider = new OryProvider({
  providerType: 'network',
  networkProjectUrl: 'https://your-project.projects.oryapis.com',
  networkProjectApiKey: 'your-api-key',
  endpoints: {
    authorizationUrl: 'https://your-project.projects.oryapis.com/oauth2/auth',
    tokenUrl: 'https://your-project.projects.oryapis.com/oauth2/token',
    revocationUrl: 'https://your-project.projects.oryapis.com/oauth2/revoke',
    registrationUrl: 'https://your-project.projects.oryapis.com/admin/clients',
  },
});

// Or initialize with Ory Hydra
const hydraProvider = new OryProvider({
  providerType: 'hydra',
  hydraAdminUrl: 'https://hydra.example.com/admin',
  hydraApiKey: 'your-hydra-api-key',
  endpoints: {
    authorizationUrl: 'https://hydra.example.com/oauth2/auth',
    tokenUrl: 'https://hydra.example.com/oauth2/token',
    revocationUrl: 'https://hydra.example.com/oauth2/revoke',
    registrationUrl: 'https://hydra.example.com/admin/clients',
  },
});
```

### MCP Server Integration

Here's a complete example of how to set up an MCP server with Ory authentication:

```typescript
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { config } from 'dotenv';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OryProvider } from '@ory/mcp-oauth-provider';

// Load environment variables
config();

// Get configuration from environment variables
const oryProjectUrl = process.env.ORY_PROJECT_URL;
const oryProjectApiKey = process.env.ORY_PROJECT_API_KEY;
const mcpBaseUrl = process.env.MCP_BASE_URL;
const serviceDocumentationUrl = process.env.SERVICE_DOCUMENTATION_URL;

// Validate required environment variables
if (!oryProjectUrl || !oryProjectApiKey || !mcpBaseUrl || !serviceDocumentationUrl) {
  throw new Error('Required environment variables are not set');
}

// Initialize the Ory provider
const oryProvider = new OryProvider({
  providerType: 'network',
  networkProjectUrl: oryProjectUrl,
  networkProjectApiKey: oryProjectApiKey,
  endpoints: {
    authorizationUrl: `${oryProjectUrl}/oauth2/auth`,
    tokenUrl: `${oryProjectUrl}/oauth2/token`,
    revocationUrl: `${oryProjectUrl}/oauth2/revoke`,
    registrationUrl: `${oryProjectUrl}/oauth2/register`,
  },
});

// Create Express app
const app = express();
app.use(express.json());

// Set up MCP authentication router
app.use(
  mcpAuthRouter({
    provider: oryProvider,
    issuerUrl: new URL(oryProjectUrl),
    baseUrl: new URL(mcpBaseUrl),
    serviceDocumentationUrl: new URL(serviceDocumentationUrl),
  })
);

// Set up bearer auth middleware
const bearerAuthMiddleware = requireBearerAuth({
  provider: oryProvider,
  requiredScopes: ['ory.admin'],
});

// Create MCP server
const server = new McpServer(
  {
    name: 'ory-mpc-example',
    version: '1.0.0',
    description: 'Example MPC server with Ory authentication',
  },
  { capabilities: { logging: {} } }
);

// Handle MCP requests
app.post('/mcp', bearerAuthMiddleware, async (req, res) => {
  const transport = new StreamableHTTPServerTransport();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('close', () => {
    transport.close();
    server.close();
  });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`MCP server listening on port ${port}`);
});
```

### Key Features

- Supports both Ory Network and Ory Hydra as backend providers
- Handles OAuth2 authorization code flow with PKCE
- Manages client registration and token operations
- Provides token introspection and verification
- Integrates seamlessly with MCP server

### Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## License

Copyright 2025 Ory Corp

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
