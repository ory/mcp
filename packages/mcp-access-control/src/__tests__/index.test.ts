import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpAccessControl } from "../index";

// Mocks
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "mockJWKSet"),
  jwtVerify: vi.fn(),
}));

const mockCreateIdentity = vi.fn();
const mockListIdentities = vi.fn();
const mockCreateNativeLoginFlow = vi.fn();
const mockUpdateLoginFlow = vi.fn();
const mockToSession = vi.fn();

vi.mock("@ory/client-fetch", () => {
  return {
    Configuration: class {},
    IdentityApi: class {
      createIdentity = mockCreateIdentity;
      listIdentities = mockListIdentities;
    },
    FrontendApi: class {
      createNativeLoginFlow = mockCreateNativeLoginFlow;
      updateLoginFlow = mockUpdateLoginFlow;
      toSession = mockToSession;
    },
  };
});

describe("McpAccessControl", () => {
  const options = {
    jwksUrl: "https://example.com/jwks",
    issuer: "issuer",
    audience: "aud",
    claimKey: "email",
    oryProjectUrl: "https://ory",
    oryApiKey: "api-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with required options", () => {
    expect(() => new McpAccessControl(options)).not.toThrow();
  });

  it("getToolDefinition returns correct structure", () => {
    const ac = new McpAccessControl(options);
    const tool = ac.getToolDefinition();
    expect(tool).toHaveProperty("name");
    expect(tool).toHaveProperty("description");
    expect(tool).toHaveProperty("parameters");
    expect(tool).toHaveProperty("handler");
  });

  it("handler validates JWT and creates identity if not found", async () => {
    const ac = new McpAccessControl(options);
    // Mock JWT verify
    const { jwtVerify } = await import("jose");
    (jwtVerify as any).mockResolvedValue({ payload: { email: "foo@bar.com" } });
    // Mock identity not found
    mockListIdentities.mockResolvedValue([]);
    // Mock create identity
    mockCreateIdentity.mockResolvedValue({
      id: "id-123",
      traits: { email: "foo@bar.com" },
    });
    // Mock auth
    mockCreateNativeLoginFlow.mockResolvedValue({ id: "flow-1" });
    mockUpdateLoginFlow.mockResolvedValue({
      session: { id: "sess-1" },
      session_token: "token-1",
    });

    const tool = ac.getToolDefinition();
    const result = await tool.handler({ token: "tok", password: "pw" });
    expect(result.success).toBe(true);
    expect(result.identity!.email).toBe("foo@bar.com");
    expect(result.session!.token).toBe("token-1");
  });

  it("handler uses existing identity if found", async () => {
    const ac = new McpAccessControl(options);
    const { jwtVerify } = await import("jose");
    (jwtVerify as any).mockResolvedValue({ payload: { email: "foo@bar.com" } });
    mockListIdentities.mockResolvedValue([
      { id: "id-123", traits: { email: "foo@bar.com" } },
    ]);
    mockCreateNativeLoginFlow.mockResolvedValue({ id: "flow-1" });
    mockUpdateLoginFlow.mockResolvedValue({
      session: { id: "sess-1" },
      session_token: "token-1",
    });

    const tool = ac.getToolDefinition();
    const result = await tool.handler({ token: "tok", password: "pw" });
    expect(result.success).toBe(true);
    expect(result.identity!.id).toBe("id-123");
    expect(result.session!.token).toBe("token-1");
  });

  it("handler returns error if JWT is missing claim", async () => {
    const ac = new McpAccessControl(options);
    const { jwtVerify } = await import("jose");
    (jwtVerify as any).mockResolvedValue({ payload: {} });
    const tool = ac.getToolDefinition();
    const result = await tool.handler({ token: "tok", password: "pw" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/claim/);
  });

  it("validateSession returns valid for good session", async () => {
    const ac = new McpAccessControl(options);
    mockToSession.mockResolvedValue({
      identity: { id: "id-1", traits: { email: "foo@bar.com" } },
    });
    const result = await ac.validateSession(
      { "x-session-token": "token" },
      { headerName: "x-session-token" }
    );
    expect(result.isValid).toBe(true);
    expect(result.identity!.email).toBe("foo@bar.com");
  });

  it("validateSession returns error for missing token", async () => {
    const ac = new McpAccessControl(options);
    const result = await ac.validateSession(
      {},
      { headerName: "x-session-token" }
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/No session token/);
  });

  it("validateSession returns error for invalid session", async () => {
    const ac = new McpAccessControl(options);
    mockToSession.mockResolvedValue({ identity: undefined });
    const result = await ac.validateSession(
      { "x-session-token": "token" },
      { headerName: "x-session-token" }
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/Invalid/);
  });
});
