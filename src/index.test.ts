// Copyright © 2025 Ory Corp

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OryProvider, OryOptions } from './index.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { Response } from 'express';

// Mock global fetch
const mockFetch = vi.fn();

describe('OryProvider', () => {
  const mockClient: OAuthClientInformationFull = {
    client_id: 'test-client',
    client_secret: 'test-secret',
    redirect_uris: ['http://localhost:3000/callback'],
    scope: 'openid profile email offline_access',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  };

  const baseMockOptions: OryOptions = {
    endpoints: {
      authorizationUrl: 'https://auth.example.com/oauth2/auth',
      tokenUrl: 'https://auth.example.com/oauth2/token',
      revocationUrl: 'https://auth.example.com/oauth2/revoke',
      registrationUrl: 'https://auth.example.com/clients',
    },
    providerType: 'network',
    networkProjectUrl: 'https://network.example.com/admin',
    networkProjectApiKey: 'network-api-key',
  };

  let provider: OryProvider;

  beforeEach(() => {
    vi.resetAllMocks(); // Resets all mocks
    global.fetch = mockFetch; // Re-assign mock fetch before each test
    provider = new OryProvider(baseMockOptions);
  });

  afterEach(() => {
    delete (global as { fetch?: typeof fetch }).fetch; // Clean up global fetch
  });

  describe('constructor', () => {
    it('should initialize with network provider type and default properties', () => {
      expect(provider).toBeDefined();
      expect(provider.skipLocalPasswordGrant).toBe(false);
      expect(provider.skipLocalPkceValidation).toBe(true);
      expect(provider['_providerType']).toBe('network');
      expect(provider['_networkProjectUrl']).toBe(baseMockOptions.networkProjectUrl);
      expect(provider['_networkProjectApiKey']).toBe(baseMockOptions.networkProjectApiKey);
      expect(provider.revokeToken).toBeDefined();
    });

    it('should initialize with hydra provider type', () => {
      const hydraOptions: OryOptions = {
        ...baseMockOptions,
        providerType: 'hydra',
        hydraAdminUrl: 'https://hydra.example.com/admin',
        hydraApiKey: 'hydra-api-key',
        networkProjectUrl: undefined,
        networkProjectApiKey: undefined,
      };
      const hydraProvider = new OryProvider(hydraOptions);
      expect(hydraProvider).toBeDefined();
      expect(hydraProvider['_providerType']).toBe('hydra');
      expect(hydraProvider['_hydraAdminUrl']).toBe(hydraOptions.hydraAdminUrl);
      expect(hydraProvider['_hydraApiKey']).toBe(hydraOptions.hydraApiKey);
    });

    it('should not define revokeToken if revocationUrl is not provided', () => {
      const optionsWithoutRevoke: OryOptions = {
        ...baseMockOptions,
        endpoints: { ...baseMockOptions.endpoints, revocationUrl: undefined },
      };
      const p = new OryProvider(optionsWithoutRevoke);
      expect(p.revokeToken).toBeUndefined();
    });
  });

  describe('clientsStore', () => {
    it('should have getClient method', () => {
      expect(typeof provider.clientsStore.getClient).toBe('function');
    });

    it('should have registerClient method if registrationUrl is provided', () => {
      const registerClient = provider.clientsStore.registerClient?.bind(provider.clientsStore);
      expect(registerClient).toBeDefined();
    });

    it('registerClient should be undefined if registrationUrl is not provided', () => {
      const optionsWithoutReg: OryOptions = {
        ...baseMockOptions,
        endpoints: { ...baseMockOptions.endpoints, registrationUrl: undefined },
      };
      const p = new OryProvider(optionsWithoutReg);
      const registerClient = p.clientsStore.registerClient?.bind(p.clientsStore);
      expect(registerClient).toBeUndefined();
    });

    describe('registerClient', () => {
      const newClientData: OAuthClientInformationFull = {
        ...mockClient,
        client_id: 'new-client',
      };

      it('should register client successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => newClientData,
        });
        const registeredClient = await provider.clientsStore.registerClient?.(newClientData);
        expect(mockFetch).toHaveBeenCalledWith(
          baseMockOptions.endpoints.registrationUrl,
          expect.any(Object)
        );
        expect(registeredClient).toEqual(newClientData);
      });

      it('should throw ServerError if registration fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        });
        await expect(provider.clientsStore.registerClient?.(newClientData)).rejects.toThrow(
          new ServerError('Client registration failed: 500')
        );
      });
    });
  });

  describe('getClient', () => {
    it('should fetch and return client information for network provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => [mockClient],
      });
      const result = await provider.getClient('test-client');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseMockOptions.networkProjectUrl}/admin/clients`,
        expect.any(Object)
      );
      expect(result).toEqual(mockClient);
    });

    it('should fetch and return client information for hydra provider', async () => {
      const hydraOptions: OryOptions = {
        ...baseMockOptions,
        providerType: 'hydra',
        hydraAdminUrl: 'https://hydra.example.com/admin',
        hydraApiKey: 'hydra-api-key',
      };
      const hydraProvider = new OryProvider(hydraOptions);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => [mockClient],
      });
      const result = await hydraProvider.getClient('test-client');
      expect(mockFetch).toHaveBeenCalledWith(
        `${hydraOptions.hydraAdminUrl}/admin/clients`,
        expect.any(Object)
      );
      expect(result).toEqual(mockClient);
    });

    it('should return undefined for non-existent client', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => [],
      });
      const result = await provider.getClient('non-existent-client');
      expect(result).toBeUndefined();
    });

    it('should throw error if networkProjectUrl is missing for network provider', async () => {
      const optionsNoUrl = { ...baseMockOptions, networkProjectUrl: undefined };
      const p = new OryProvider(optionsNoUrl);
      await expect(p.getClient('test-client')).rejects.toThrow(
        'Network project URL is required for network provider type'
      );
    });

    it('should throw error if hydraAdminUrl is missing for hydra provider', async () => {
      const optionsNoUrl: OryOptions = {
        ...baseMockOptions,
        providerType: 'hydra',
        hydraAdminUrl: undefined,
      };
      const p = new OryProvider(optionsNoUrl);
      await expect(p.getClient('test-client')).rejects.toThrow(
        'Hydra admin URL is required for hydra provider type'
      );
    });

    it('should throw error if fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });
      await expect(provider.getClient('test-client')).rejects.toThrow(
        'Failed to list OAuth2 clients: Server Error'
      );
    });
  });

  describe('verifyAccessToken', () => {
    const mockIntrospectionResponseBase = {
      scope: mockClient.scope,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should verify token and return auth info for network provider', async () => {
      mockFetch
        .mockResolvedValueOnce({
          // For introspectToken
          ok: true,
          status: 200,
          json: () => ({
            ...mockIntrospectionResponseBase,
            active: true,
            client_id: mockClient.client_id,
          }),
        })
        .mockResolvedValueOnce({
          // For listOAuth2Clients -> fetchClients
          ok: true,
          status: 200,
          json: () => [mockClient],
        });

      const result = await provider.verifyAccessToken('test-token');
      expect(result).toEqual({
        token: 'test-token',
        clientId: mockClient.client_id,
        scopes: (mockClient.scope || '').split(' '),
        expiresAt: mockIntrospectionResponseBase.exp,
      });
      expect(mockFetch.mock.calls.length).toBe(2);
      expect(mockFetch.mock.calls[1][0]).toBe(`${baseMockOptions.networkProjectUrl}/admin/clients`);
    });

    it('should verify token and return auth info for hydra provider', async () => {
      const hydraOptions: OryOptions = {
        ...baseMockOptions,
        providerType: 'hydra',
        hydraAdminUrl: 'https://hydra.example.com/admin',
        hydraApiKey: 'hydra-api-key',
      };
      const hydraProvider = new OryProvider(hydraOptions);
      mockFetch
        .mockResolvedValueOnce({
          // For introspectToken
          ok: true,
          status: 200,
          json: () => ({
            ...mockIntrospectionResponseBase,
            active: true,
            client_id: mockClient.client_id,
          }),
        })
        .mockResolvedValueOnce({
          // For listOAuth2Clients -> fetchClients
          ok: true,
          status: 200,
          json: () => [mockClient],
        });

      const result = await hydraProvider.verifyAccessToken('test-token');
      expect(mockFetch.mock.calls.length).toBe(2);
      expect(mockFetch.mock.calls[1][0]).toBe(`${hydraOptions.hydraAdminUrl}/admin/clients`);
      expect(result.clientId).toBe(mockClient.client_id);
    });

    it('should throw error if token is not active', async () => {
      mockFetch.mockResolvedValueOnce({
        // For introspectToken (token inactive)
        ok: true,
        status: 200,
        json: () => ({
          ...mockIntrospectionResponseBase,
          active: false,
          client_id: mockClient.client_id,
        }),
      });

      await expect(provider.verifyAccessToken('inactive-token')).rejects.toThrow(
        'Token is not active'
      );
      expect(mockFetch.mock.calls.length).toBe(1);
    });

    it('should throw error if client ID mismatch', async () => {
      mockFetch
        .mockResolvedValueOnce({
          // For introspectToken (token is active, but for original mockClient.client_id)
          ok: true,
          status: 200,
          json: () => ({
            ...mockIntrospectionResponseBase,
            active: true,
            client_id: mockClient.client_id,
          }),
        })
        .mockResolvedValueOnce({
          // For listOAuth2Clients -> fetchClients (returns a different client)
          ok: true,
          status: 200,
          json: () => [{ ...mockClient, client_id: 'another-client-id' }],
        });

      await expect(provider.verifyAccessToken('test-token')).rejects.toThrow(
        'Token client ID mismatch'
      );
      expect(mockFetch.mock.calls.length).toBe(2);
    });

    it('should throw error if introspection fails', async () => {
      mockFetch.mockResolvedValueOnce({
        // For introspectToken (network or server error)
        ok: false,
        status: 500,
        statusText: 'Introspection Error',
      });

      await expect(provider.verifyAccessToken('test-token')).rejects.toThrow(
        'Token introspection failed: Introspection Error'
      );
      expect(mockFetch.mock.calls.length).toBe(1);
    });
  });

  describe('authorize', () => {
    const mockRedirectFn = vi.fn();
    const mockRes = { redirect: mockRedirectFn } as unknown as Response;
    const authParams = {
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge: 'challenge',
      scopes: ['openid', 'profile'],
      state: 'state123',
    };

    beforeEach(() => {
      mockRedirectFn.mockClear();
    });

    it('should redirect to authorizationUrl with correct parameters', async () => {
      await provider.authorize(mockClient, authParams, mockRes);
      const expectedUrl = new URL(baseMockOptions.endpoints.authorizationUrl);
      expectedUrl.searchParams.set('client_id', mockClient.client_id);
      expectedUrl.searchParams.set('response_type', 'code');
      expectedUrl.searchParams.set('redirect_uri', authParams.redirectUri);
      expectedUrl.searchParams.set('code_challenge', authParams.codeChallenge);
      expectedUrl.searchParams.set('code_challenge_method', 'S256');
      expectedUrl.searchParams.set('state', authParams.state);
      expectedUrl.searchParams.set('scope', authParams.scopes.join(' '));
      expect(mockRedirectFn).toHaveBeenCalledWith(expectedUrl.toString());
    });

    it('should generate state if not provided', async () => {
      const paramsNoState = { ...authParams, state: undefined };
      await provider.authorize(mockClient, paramsNoState, mockRes);
      const redirectUrl = mockRedirectFn.mock.calls[0][0] as string;
      expect(new URL(redirectUrl).searchParams.get('state')).toBeDefined();
    });
  });

  describe('exchangeAuthorizationCode', () => {
    const mockTokens: OAuthTokens = {
      access_token: 'acc_token',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    it('should exchange authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => mockTokens,
      });
      const result = await provider.exchangeAuthorizationCode(mockClient, 'auth-code', 'verifier');
      expect(mockFetch).toHaveBeenCalledWith(
        baseMockOptions.endpoints.tokenUrl,
        expect.any(Object)
      );
      expect(result).toEqual(mockTokens);
    });

    it('should throw ServerError if exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });
      await expect(provider.exchangeAuthorizationCode(mockClient, 'auth-code')).rejects.toThrow(
        new ServerError('Token exchange failed: 400')
      );
    });
  });

  describe('exchangeRefreshToken', () => {
    const mockTokens: OAuthTokens = {
      access_token: 'new_acc_token',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    it('should exchange refresh token for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => mockTokens,
      });
      const result = await provider.exchangeRefreshToken(mockClient, 'refresh-token', ['openid']);
      expect(mockFetch).toHaveBeenCalledWith(
        baseMockOptions.endpoints.tokenUrl,
        expect.any(Object)
      );
      expect(result).toEqual(mockTokens);
    });

    it('should throw ServerError if refresh fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      await expect(provider.exchangeRefreshToken(mockClient, 'refresh-token')).rejects.toThrow(
        new ServerError('Token refresh failed: 401')
      );
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      await provider.revokeToken?.(mockClient, { token: 'test-token' });
      expect(mockFetch).toHaveBeenCalledWith(
        baseMockOptions.endpoints.revocationUrl,
        expect.any(Object)
      );
    });

    it('should throw ServerError if revocation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });
      await expect(provider.revokeToken?.(mockClient, { token: 'test-token' })).rejects.toThrow(
        new ServerError('Token revocation failed: 500')
      );
    });
  });
});
