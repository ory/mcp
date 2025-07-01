import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Response } from 'express';

type OryEndpoints = {
    authorizationUrl: string;
    tokenUrl: string;
    revocationUrl?: string;
    registrationUrl?: string;
};
type HydraClient = {
    client_id: string;
    redirect_uris: string[];
};
type OryProviderType = 'network' | 'hydra';
type BaseOryOptions = {
    endpoints: OryEndpoints;
    providerType: OryProviderType;
    hydraAdminUrl?: string;
    hydraApiKey?: string;
    networkProjectUrl?: string;
    networkProjectApiKey?: string;
};
type OryOptions = BaseOryOptions;
declare class OryProvider implements OAuthServerProvider {
    protected readonly _endpoints: OryEndpoints;
    protected readonly _providerType: OryProviderType;
    protected readonly _hydraAdminUrl?: string;
    protected readonly _hydraApiKey?: string;
    protected readonly _networkProjectUrl?: string;
    protected readonly _networkProjectApiKey?: string;
    skipLocalPasswordGrant: boolean;
    skipLocalPkceValidation: boolean;
    revokeToken?: (client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) => Promise<void>;
    constructor(options: OryOptions);
    get clientsStore(): OAuthRegisteredClientsStore;
    private fetchClients;
    listOAuth2Clients(): Promise<Record<string, OAuthClientInformationFull>>;
    getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
    authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void>;
    challengeForAuthorizationCode(_client: OAuthClientInformationFull, _authorizationCode: string): Promise<string>;
    exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string, codeVerifier?: string): Promise<OAuthTokens>;
    exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens>;
    private introspectToken;
    verifyAccessToken(token: string): Promise<AuthInfo>;
}

export { type BaseOryOptions, type HydraClient, type OryEndpoints, type OryOptions, OryProvider, type OryProviderType };
