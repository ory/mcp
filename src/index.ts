import { Configuration, IdentityApi, FrontendApi } from "@ory/client-fetch";
import { jwtVerify, createRemoteJWKSet } from "jose";

export interface McpAccessControlOptions {
  // JWT validation options
  jwksUrl: string;
  issuer: string;
  audience: string;
  claimKey: string;
  // Ory Network options
  oryProjectUrl: string;
  oryApiKey: string;
}

export interface JwtPayload {
  [key: string]: unknown;
}

export interface SessionValidationOptions {
  headerName: string;
}

export interface ValidationResult {
  isValid: boolean;
  identity?: {
    id: string;
    email: string;
  };
  error?: string;
}

export class McpAccessControl {
  private readonly jwksUrl: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly claimKey: string;
  private readonly identityApi: IdentityApi;
  private readonly frontendApi: FrontendApi;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly oryProjectUrl: string;

  constructor(options: McpAccessControlOptions) {
    this.jwksUrl = options.jwksUrl;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.claimKey = options.claimKey;
    this.jwks = createRemoteJWKSet(new URL(this.jwksUrl));

    const configuration = new Configuration({
      basePath: options.oryProjectUrl,
      accessToken: options.oryApiKey,
    });

    this.identityApi = new IdentityApi(configuration);
    this.frontendApi = new FrontendApi(configuration);
    this.oryProjectUrl = options.oryProjectUrl;
  }

  private static getNestedProperty(obj: any, path: string) {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
      if (current === null || typeof current !== "object") {
        return undefined;
      }
      current = current[parts[i]];
    }
    return current;
  }

  private async findIdentityByEmail(email: string) {
    try {
      const identities = await this.identityApi.listIdentities({
        credentialsIdentifier: email,
      });
      return identities.length > 0 ? identities[0] : null;
    } catch (error) {
      return null;
    }
  }

  private async createIdentityWithCredentials(email: string, password: string) {
    const identity = await this.identityApi.createIdentity({
      createIdentityBody: {
        schema_id: "default",
        traits: {
          email: email,
        },
        credentials: {
          password: {
            config: {
              password: password,
            },
          },
        },
      },
    });
    return identity;
  }

  private async authenticateIdentity(email: string, password: string) {
    const loginFlow = await this.frontendApi.createNativeLoginFlow();

    const session = await this.frontendApi.updateLoginFlow({
      flow: loginFlow.id,
      updateLoginFlowBody: {
        method: "password",
        identifier: email,
        password: password,
      },
    });

    return session;
  }

  /**
   * Validates an Ory session token from the request headers
   * @param headers - Object containing request headers
   * @param options - Session validation options including header name
   * @returns Validation result with identity information if valid
   */
  public async validateSession(
    headers: Record<string, string>,
    options: SessionValidationOptions
  ): Promise<ValidationResult> {
    try {
      const sessionToken = headers[options.headerName.toLowerCase()];

      if (!sessionToken) {
        return {
          isValid: false,
          error: `No session token found in header: ${options.headerName}`,
        };
      }

      // Use toSession with the session token in the request headers
      const { identity } = await this.frontendApi.toSession(
        {
          xSessionToken: sessionToken,
        },
        {
          headers: {
            "X-Session-Token": sessionToken,
          },
        }
      );

      if (!identity) {
        return {
          isValid: false,
          error: "Invalid or expired session token",
        };
      }

      return {
        isValid: true,
        identity: {
          id: identity.id,
          email: identity.traits.email as string,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : "Failed to validate session",
      };
    }
  }

  public getToolDefinition() {
    return {
      name: "ory_access_control",
      description:
        "Validates a JWT token and creates/retrieves an Ory identity for the associated claim, then authenticates the identity",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "JWT token containing the required claim",
          },
          password: {
            type: "string",
            description:
              "Password to set for new identities or authenticate existing ones",
          },
        },
        required: ["token", "password"],
      },
      handler: async (params: { token: string; password: string }) => {
        try {
          // Validate JWT
          const { payload } = (await jwtVerify(params.token, this.jwks, {
            issuer: this.issuer,
            audience: this.audience,
          })) as { payload: JwtPayload };

          const claimValue = McpAccessControl.getNestedProperty(
            payload,
            this.claimKey
          );
          if (!claimValue) {
            throw new Error(`JWT must contain a ${this.claimKey} claim`);
          }

          // Check if identity exists
          let identity = await this.findIdentityByEmail(claimValue as string);

          // Create identity if it doesn't exist
          if (!identity) {
            identity = await this.createIdentityWithCredentials(
              claimValue as string,
              params.password
            );
          }

          // Authenticate the identity
          const session = await this.authenticateIdentity(
            claimValue as string,
            params.password
          );

          return {
            success: true,
            identity: {
              id: identity.id,
              email: claimValue,
            },
            session: {
              id: session.session?.id,
              token: session.session_token,
            },
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          };
        }
      },
    };
  }
}
