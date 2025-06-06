// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

import InsomniaPersistencePlugin from "./InsomniaPersistencePlugin";
import EntraIdApplicationOptions from "./EntraIdApplicationOptions";
import AuthorizationCodeFlow from "./AuthorizationCodeFlow";

export default class EntraIdClientApplication {

    private static readonly LastHomeAccountIdKey: string = "LastHomeAccountId";

    private clientConfig: msal.Configuration;
    private clientApplication: msal.PublicClientApplication | msal.ConfidentialClientApplication | null;
    private insomniaStore: any | null;

    private currentAuthenticationResult: msal.AuthenticationResult | null;

    public get authenticationResult(): msal.AuthenticationResult | null { return this.currentAuthenticationResult; }
    public get instance(): msal.PublicClientApplication | msal.ConfidentialClientApplication | null { return this.clientApplication; }

    public constructor() {
        // Insomnia store
        this.insomniaStore = null;

        // Last successful authentication result
        this.currentAuthenticationResult = null;

        // Microsoft Entra ID application configuration
        this.clientApplication = null;
        this.clientConfig = {
            auth: {
                clientId: "",
                protocolMode: msal.ProtocolMode.AAD,
                authority: ""
            },
            system: {
                loggerOptions: {
                    loggerCallback(level: msal.LogLevel, message: string, containsPii: boolean): void {
                        console.log(message);
                    },
                    piiLoggingEnabled: false,
                    logLevel: msal.LogLevel.Error
                }
            }
        };
    }

    public ensureStore(insomniaStore: any): void {
        if (this.insomniaStore === null) {
            this.insomniaStore = insomniaStore;
            this.clientConfig.cache = {
                cachePlugin: new InsomniaPersistencePlugin(insomniaStore)
            };
        }
    }

    public async configure(options: EntraIdApplicationOptions): Promise<boolean> {
        const tenantedAuthority: string = this.getTenantedAuthority(options.authority, options.tenantId);
        const configurationChanged: boolean = (this.clientConfig.auth.authority !== tenantedAuthority) || (this.clientConfig.auth.clientId !== options.clientId) ||
                                              (this.clientConfig.auth.clientSecret !== options.clientSecret) ||
                                              (this.clientConfig.auth.clientCertificate?.privateKey !== options.clientCertificate?.privateKey) || (this.clientConfig.auth.clientCertificate?.thumbprint !== options.clientCertificate?.thumbprint);
        if (configurationChanged) {
            // Assume we can restore a previous session if we receive configuration for the first time - Otherwise, log the current user out
            if (this.clientConfig.auth.authority || this.clientConfig.auth.clientId) {
                await this.signOutAsync();
            }

            // Reconfigure the application
            this.clientConfig.auth.clientId = options.clientId;
            this.clientConfig.auth.authority = tenantedAuthority;

            // Decide which style of application we will need
            if (!!options.clientCertificate || !!options.clientSecret) {
                // Confidential application - Shared Secret or Certificate but not both

                // Reset configuration and apply new values
                this.clientConfig.auth.clientSecret = undefined;
                this.clientConfig.auth.clientCertificate = undefined;
                if (options.clientSecret) {
                    this.clientConfig.auth.clientSecret = options.clientSecret;
                }
                if (options.clientCertificate) {
                    this.clientConfig.auth.clientCertificate = options.clientCertificate;
                }
                this.clientApplication = new msal.ConfidentialClientApplication(this.clientConfig);
            } else {
                // Public application
                this.clientApplication = new msal.PublicClientApplication(this.clientConfig);
            }
        }

        return configurationChanged;
    }

    public async authenticateInteractiveAsync(scopes: string[], redirectUri: string): Promise<msal.AuthenticationResult | null> {
        try {
            const authorizationCodeFlow: AuthorizationCodeFlow = new AuthorizationCodeFlow(this);
            this.currentAuthenticationResult = await authorizationCodeFlow.authenticateInteractive(scopes, redirectUri);
            if (this.currentAuthenticationResult) {
                const homeAccountId: string | undefined = this.currentAuthenticationResult.account?.homeAccountId;
                if (homeAccountId) {
                    await this.setSavedAccountId(homeAccountId);
                } else {
                    await this.removeSavedAccountId();
                }
            }
        }
        catch (e: unknown) {
            this.currentAuthenticationResult = null;
            await this.removeSavedAccountId();
            throw e;
        }

        return this.currentAuthenticationResult;
    }

    public async authenticateSilentAsync(scopes: string[]): Promise<msal.AuthenticationResult | null> {
        if (this.instance) {
            const savedHomeAccountId: string | null = this.authenticationResult?.account?.homeAccountId ? this.authenticationResult?.account?.homeAccountId : await this.getSavedAccountId();
            if (savedHomeAccountId) {
                // Get the AccountInfo from cache, if exists
                const tokenCache: msal.TokenCache = this.instance?.getTokenCache();
                const savedAccountInfo: msal.AccountInfo | null = await tokenCache?.getAccountByHomeId(savedHomeAccountId);

                // With an AccountInfo, try to get a token silently - We always call MSAL for an opportunity to refresh the token as needed
                if (savedAccountInfo) {
                    try {
                        this.currentAuthenticationResult = await this.instance?.acquireTokenSilent({
                            account: savedAccountInfo,
                            scopes: scopes
                        });
                    }
                    catch (e: unknown) {
                        this.currentAuthenticationResult = null;
                        throw e;
                    }
                }
            }
        }

        return this.currentAuthenticationResult;
    }

    public async authenticateWithClientCredentialsAsync(scopes: string[], clientAssertion?: string): Promise<msal.AuthenticationResult | null> {
        if (this.instance) {
            try {
                let clientCredentialRequest: msal.ClientCredentialRequest = { scopes: scopes };
                if (clientAssertion) {
                    clientCredentialRequest.clientAssertion = clientAssertion;
                }
                this.currentAuthenticationResult = await (<msal.ConfidentialClientApplication> this.instance).acquireTokenByClientCredential(clientCredentialRequest);
            }
            catch (e: unknown) {
                this.currentAuthenticationResult = null;
                throw e;
            }
        }

        return this.currentAuthenticationResult;
    }

    public async signOutAsync(): Promise<void> {
        if (this.instance) {
            if (this.currentAuthenticationResult?.account) {
                const tokenCache: msal.TokenCache = this.instance?.getTokenCache();
                await tokenCache.removeAccount(this.currentAuthenticationResult.account);    
            }
        }

        await this.removeSavedAccountId();
        this.currentAuthenticationResult = null;
    }

    public async clearCacheAsync(): Promise<void> {
        await this.signOutAsync();

        const tokenCache: msal.TokenCache | undefined = this.instance?.getTokenCache();
        if (tokenCache) {
            const allCachedAccounts: msal.AccountInfo[] = await tokenCache.getAllAccounts();
            allCachedAccounts.forEach((accountInfo: msal.AccountInfo) => {``
                tokenCache.removeAccount(accountInfo);
            });
        }
    }

    private async getSavedAccountId(): Promise<string | null> {
        if (await this.insomniaStore?.hasItem(EntraIdClientApplication.LastHomeAccountIdKey)) {
            return await this.insomniaStore.getItem(EntraIdClientApplication.LastHomeAccountIdKey);
        } else {
            return null;
        }
    }

    private async setSavedAccountId(accountId: string): Promise<void> {
        return this.insomniaStore?.setItem(EntraIdClientApplication.LastHomeAccountIdKey, accountId);
    }

    private async removeSavedAccountId(): Promise<void> {
        return this.insomniaStore?.removeItem(EntraIdClientApplication.LastHomeAccountIdKey);
    }

    private getTenantedAuthority(authority: string, tenantId: string): string {
        const authorityNoTrailingSlash: string = authority.replace(/\/+$/, "");
        const tenantIdNoLeadingSlash: string = tenantId.replace(/^\/+/, "");
        return `${authorityNoTrailingSlash}/${tenantIdNoLeadingSlash}`;
    }
}