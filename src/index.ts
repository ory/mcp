import { Configuration, IdentityApi } from "@ory/client-fetch";
import { jwtVerify, createRemoteJWKSet } from "jose";

export interface McpAccessControlOptions {
  jwksUrl: string;
  issuer: string;
  audience: string;
  claimKey: string;
  oryProjectUrl: string;
  oryApiKey: string;
}

export interface JwtPayload {
  [key: string]: unknown;
}

export class McpAccessControl {
  private readonly jwksUrl: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly claimKey: string;
  private readonly identityApi: IdentityApi;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

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
  }

  public getToolDefinition() {
    return {
      name: "ory_access_control",
      description:
        "Validates a JWT token and creates an Ory identity for the associated claim",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "JWT token containing the required claim",
          },
        },
        required: ["token"],
      },
      handler: async (params: { token: string }) => {
        try {
          // Validate JWT
          const { payload } = (await jwtVerify(params.token, this.jwks, {
            issuer: this.issuer,
            audience: this.audience,
          })) as { payload: JwtPayload };

          const claimValue = payload[this.claimKey];
          if (!claimValue) {
            throw new Error(`JWT must contain a ${this.claimKey} claim`);
          }

          // Create identity in Ory
          const identity = await this.identityApi.createIdentity({
            createIdentityBody: {
              schema_id: "default",
              traits: {
                email: claimValue as string,
              },
            },
          });

          return {
            success: true,
            identity: {
              id: identity.id,
              email: claimValue as string,
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
