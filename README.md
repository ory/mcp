# Ory MCP OAuth Provider

A TypeScript implementation of an OAuth provider for Ory MCP that supports both Ory Network and Ory Hydra as backend providers.

## Installation

```bash
npm install ory-mcp-oauth-provider
```

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

Here's how to use the provider with an MCP server:

```typescript
import { OryProvider } from 'ory-mcp-oauth-provider';
import { MCPServer } from '@modelcontextprotocol/sdk/server';

// Initialize the Ory provider
const oryProvider = new OryProvider({
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

// Create MCP server with the Ory provider
const server = new MCPServer({
  auth: {
    provider: oryProvider,
  },
});

// Start the server
server.listen(3000);
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
