// Copyright © 2025 Ory Corp

import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
  OAuthTokenRevocationRequest,
  OAuthTokensSchema,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import * as crypto from 'crypto';
import { Response } from 'express';

export type OryEndpoints = {
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl?: string;
  registrationUrl?: string;
};

export type HydraClient = {
  client_id: string;
  redirect_uris: string[];
};

export type OryProviderType = 'network' | 'hydra';

export type BaseOryOptions = {
  endpoints: OryEndpoints;
  providerType: OryProviderType;
  hydraAdminUrl?: string;
  hydraApiKey?: string;
  networkProjectUrl?: string;
  networkProjectApiKey?: string;
};

export type OryOptions = BaseOryOptions;

export class OryProvider implements OAuthServerProvider {
  protected readonly _endpoints: OryEndpoints;
  protected readonly _providerType: OryProviderType;
  protected readonly _hydraAdminUrl?: string;
  protected readonly _hydraApiKey?: string;
  protected readonly _networkProjectUrl?: string;
  protected readonly _networkProjectApiKey?: string;

  skipLocalPasswordGrant = false;
  skipLocalPkceValidation = true;

  revokeToken?: (
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ) => Promise<void>;

  constructor(options: OryOptions) {
    this._endpoints = options.endpoints;
    this._providerType = options.providerType;
    this._hydraAdminUrl = options.hydraAdminUrl;
    this._hydraApiKey = options.hydraApiKey;
    this._networkProjectUrl = options.networkProjectUrl;
    this._networkProjectApiKey = options.networkProjectApiKey;

    if (options.endpoints?.revocationUrl) {
      this.revokeToken = async (
        client: OAuthClientInformationFull,
        request: OAuthTokenRevocationRequest
      ): Promise<void> => {
        const revocationUrl = this._endpoints.revocationUrl;

        if (!revocationUrl) {
          throw new Error('No revocation endpoint configured');
        }

        const params = new URLSearchParams();
        params.set('token', request.token);
        params.set('client_id', client.client_id);
        if (client.client_secret) {
          params.set('client_secret', client.client_secret);
        }
        if (request.token_type_hint) {
          params.set('token_type_hint', request.token_type_hint);
        }

        const response = await fetch(revocationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (!response.ok) {
          throw new ServerError(`Token revocation failed: ${response.status}`);
        }
      };
    }
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const registrationUrl = this._endpoints.registrationUrl;
    return {
      getClient: this.getClient.bind(this),
      ...(registrationUrl && {
        registerClient: async (
          client: OAuthClientInformationFull
        ): Promise<OAuthClientInformationFull> => {
          const response = await fetch(registrationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(client),
          });

          if (!response.ok) {
            throw new ServerError(`Client registration failed: ${response.status}`);
          }

          const data = (await response.json()) as Record<string, unknown>;
          return OAuthClientInformationFullSchema.parse(data);
        },
      }),
    };
  }

  private async fetchClients(): Promise<OAuthClientInformationFull[]> {
    if (this._providerType === 'hydra') {
      if (!this._hydraAdminUrl) {
        throw new Error('Hydra admin URL is required for hydra provider type');
      }
      const response = await fetch(`${this._hydraAdminUrl}/admin/clients`, {
        headers: {
          Authorization: `Bearer ${this._hydraApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list OAuth2 clients: ${response.statusText}`);
      }

      const clients = (await response.json()) as unknown[];
      return clients.map((client: unknown) => OAuthClientInformationFullSchema.parse(client));
    }

    if (this._providerType === 'network') {
      if (!this._networkProjectUrl) {
        throw new Error('Network project URL is required for network provider type');
      }
      const response = await fetch(`${this._networkProjectUrl}/admin/clients`, {
        headers: {
          Authorization: `Bearer ${this._networkProjectApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list OAuth2 clients: ${response.statusText}`);
      }

      const clients = (await response.json()) as unknown[];
      return clients.map((client: unknown) => OAuthClientInformationFullSchema.parse(client));
    }

    throw new Error('Invalid provider type');
  }

  async listOAuth2Clients(): Promise<Record<string, OAuthClientInformationFull>> {
    try {
      const clients = await this.fetchClients();
      return clients.reduce(
        (acc: Record<string, OAuthClientInformationFull>, client: OAuthClientInformationFull) => {
          acc[client.client_id] = client;
          return acc;
        },
        {}
      );
    } catch (error) {
      console.error('Error listing OAuth2 clients:', error);
      throw error;
    }
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    try {
      const clients = await this.listOAuth2Clients();
      return clients[clientId];
    } catch (error) {
      console.error('Error getting client:', error);
      throw error;
    }
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    let state = '';
    if (!params.state) {
      state = crypto.randomBytes(32).toString('hex');
      params.state = state;
    }

    if (params.scopes?.length === 0) {
      params.scopes = ['ory.admin'];
    }

    // Start with required OAuth parameters
    const targetUrl = new URL(this._endpoints.authorizationUrl);
    const searchParams = new URLSearchParams({
      client_id: client.client_id,
      response_type: 'code',
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    });

    // Add optional standard OAuth parameters
    if (params.state) searchParams.set('state', params.state);
    if (params.scopes?.length) searchParams.set('scope', params.scopes.join(' '));

    targetUrl.search = searchParams.toString();
    // This below line is just a hack to make the function async as lint will complain
    await new Promise(resolve => setTimeout(resolve, 100));
    res.redirect(targetUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    _authorizationCode: string
  ): Promise<string> {
    // In a proxy setup, we don't store the code challenge ourselves
    // Instead, we proxy the token request and let the upstream server validate it
    // This below line is just a hack to make the function async as lint will complain
    await new Promise(resolve => setTimeout(resolve, 100));
    return '';
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code: authorizationCode,
      redirect_uri: client.redirect_uris[0],
    });

    if (client.client_secret) {
      params.append('client_secret', client.client_secret);
    }

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(this._endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new ServerError(`Token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return OAuthTokensSchema.parse(data);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[]
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client.client_id,
      refresh_token: refreshToken,
    });

    if (client.client_secret) {
      params.set('client_secret', client.client_secret);
    }

    if (scopes?.length) {
      params.set('scope', scopes.join(' '));
    }

    const response = await fetch(this._endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new ServerError(`Token refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return OAuthTokensSchema.parse(data);
  }

  private async introspectToken(token: string): Promise<{
    active: boolean;
    client_id: string;
    scope?: string;
    exp: number;
  }> {
    if (this._providerType === 'hydra') {
      if (!this._hydraAdminUrl) {
        throw new Error('Hydra admin URL is required for hydra provider type');
      }
      const response = await fetch(`${this._hydraAdminUrl}/admin/oauth2/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(token).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token introspection failed: ${response.statusText}`);
      }

      return response.json() as Promise<{
        active: boolean;
        client_id: string;
        scope?: string;
        exp: number;
      }>;
    }

    if (this._providerType === 'network') {
      if (!this._networkProjectUrl) {
        throw new Error('Network project URL is required for network provider type');
      }
      const response = await fetch(`${this._networkProjectUrl}/admin/oauth2/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this._networkProjectApiKey}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token introspection failed: ${response.statusText}`);
      }

      return response.json() as Promise<{
        active: boolean;
        client_id: string;
        scope?: string;
        exp: number;
      }>;
    }

    throw new Error('Invalid provider type');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const introspection = await this.introspectToken(token);

      if (!introspection.active) {
        throw new Error('Token is not active');
      }

      const clients = await this.listOAuth2Clients();
      const client = clients[introspection.client_id];

      if (!client) {
        throw new Error('Token client ID mismatch');
      }

      return {
        token,
        clientId: introspection.client_id,
        scopes: introspection.scope?.split(' ') || [],
        expiresAt: introspection.exp,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      throw error;
    }
  }
}
