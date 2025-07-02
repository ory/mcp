# Ory MCP (Model Context Protocol)

This repository contains TypeScript packages for integrating Ory authentication and access control with the Model Context Protocol (MCP). The repository has been renamed from `mcp-oauth-provider` to `mcp` to be inclusive of all Ory MCP projects.

## Packages

### @ory/mcp-oauth-provider

A TypeScript implementation of an OAuth provider for Ory MCP that supports both Ory Network and Ory Hydra as backend providers. This package provides seamless integration between MCP servers and Ory's OAuth2.1 authentication system.

**Key Features:**

- Supports both Ory Network and Ory Hydra as backend providers
- Handles OAuth2 authorization code flow with PKCE
- Manages client registration and token operations
- Provides token introspection and verification
- Integrates seamlessly with MCP server authentication

**Installation:**

```bash
npm install @ory/mcp-oauth-provider
```

For detailed documentation and usage examples, see the [package README](./packages/mcp-oauth-provider/README.md).

### @ory/mcp-access-control

A TypeScript module that provides MCP tool definitions for Ory Network access control integration. This module helps validate JWT tokens, create/retrieve Ory identities, and manage authentication sessions.

**Key Features:**

- JWT token validation using JWKS
- Configurable JWT audience and claim extraction
- Automatic identity creation/retrieval in Ory Network
- Password-based authentication with session management
- Session token validation for MCP middleware
- MCP tool definition generation

**Installation:**

```bash
npm install @ory/mcp-access-control
```

For detailed documentation and usage examples, see the [package README](./packages/mcp-access-control/README.md).

## Examples

### OAuth Provider Example

The `examples/oauth-provider-example/` directory contains a complete MCP server implementation that demonstrates how to use the `@ory/mcp-oauth-provider` package with Ory Network authentication.

**Features demonstrated:**

- Complete MCP server setup with Ory OAuth2.1 authentication
- Bearer token authentication middleware
- Project management tools
- Both Streamable HTTP and SSE transport support

**Getting Started:**

1. Set up your environment variables:

   ```bash
   ORY_PROJECT_URL=https://your-project.projects.oryapis.com
   ORY_PROJECT_API_KEY=your-api-key
   MCP_BASE_URL=http://localhost:3000
   SERVICE_DOCUMENTATION_URL=https://your-docs-url.com
   ```

2. Run the example server:
   ```bash
   cd examples/oauth-provider-example
   npm install
   npm start
   ```

For the complete implementation, see [examples/oauth-provider-example/mcp-server.ts](./examples/oauth-provider-example/mcp-server.ts).

## Repository History

This repository was originally named `mcp-oauth-provider` and focused solely on OAuth provider functionality. It has been renamed to `mcp` to better reflect its expanded scope as a collection of Ory MCP integration packages. The original `mcp-oauth-provider` package can still be found in the `packages/mcp-oauth-provider/` directory.

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Building Packages

To build all packages:

```bash
# Build mcp-oauth-provider
cd packages/mcp-oauth-provider
npm install
npm run build

# Build mcp-access-control
cd ../mcp-access-control
npm install
npm run build
```

### Testing

To run tests for all packages:

```bash
# Test mcp-oauth-provider
cd packages/mcp-oauth-provider
npm test

# Test mcp-access-control
cd ../mcp-access-control
npm test
```

## Contributing

We welcome contributions! Please see the individual package directories for specific contribution guidelines.

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
