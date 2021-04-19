// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

import InsomniaPersistencePlugin from "./InsomniaPersistencePlugin";
import AuthorizationCodeFlow from "./AuthorizationCodeFlow";

export default class AzureADClientApplication {

    private static readonly LastHomeAccountIdKey: string = "LastHomeAccountId";

    private clientConfig: msal.Configuration;
    private publicClientApplication: msal.PublicClientApplication | null;
    private insomniaStore: any | null;

    private currentAuthenticationResult: msal.AuthenticationResult | null;

    public get authenticationResult(): msal.AuthenticationResult | null { return this.currentAuthenticationResult; }
    public get instance(): msal.PublicClientApplication | null { return this.publicClientApplication; }

    public constructor() {
        // Store
        this.insomniaStore = null;

        // Last successful authentication result
        this.currentAuthenticationResult = null;

        // Azure AD application configuration
        this.publicClientApplication = null;
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
                    piiLoggingEnabled: true,
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

    public async configure(authority: string, tenantId: string, clientId: string): Promise<boolean> {
        const tenantedAuthority: string = this.getTenantedAuthority(authority, tenantId);
        const configurationChanged: boolean = (this.clientConfig.auth.authority !== tenantedAuthority) || (this.clientConfig.auth.clientId !== clientId);
        if (configurationChanged) {
            // Reconfigure the application
            this.clientConfig.auth.clientId = clientId;
            this.clientConfig.auth.authority = tenantedAuthority;
            this.publicClientApplication = new msal.PublicClientApplication(this.clientConfig);

            // Log the current user out
            await this.signOut();
        }

        return configurationChanged;
    }

    public async authenticateInteractive(scopes: string[], redirectUri: string): Promise<msal.AuthenticationResult | null> {
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
        catch (e) {
            this.currentAuthenticationResult = null;
            await this.removeSavedAccountId();
            throw e;
        }

        return this.currentAuthenticationResult;
    }

    public async authenticateSilent(scopes: string[]): Promise<msal.AuthenticationResult | null> {
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
                    catch (e) {
                        this.currentAuthenticationResult = null;
                        throw e;
                    }
                }
            }
        }

        return this.currentAuthenticationResult;
    }

    public async signOut(): Promise<void> {
        if (this.instance) {
            if (this.currentAuthenticationResult?.account) {
                const tokenCache: msal.TokenCache = this.instance?.getTokenCache();
                await tokenCache.removeAccount(this.currentAuthenticationResult.account);    
            }
        }

        await this.removeSavedAccountId();
        this.currentAuthenticationResult = null;
    }

    public async clearCache(): Promise<void> {
        await this.signOut();

        const tokenCache: msal.TokenCache | undefined = this.instance?.getTokenCache();
        if (tokenCache) {
            const allCachedAccounts: msal.AccountInfo[] = await tokenCache.getAllAccounts();
            allCachedAccounts.forEach((accountInfo: msal.AccountInfo) => {
                tokenCache.removeAccount(accountInfo);
            });
        }
    }

    private async getSavedAccountId(): Promise<string | null> {
        if (await this.insomniaStore.hasItem(AzureADClientApplication.LastHomeAccountIdKey)) {
            return await this.insomniaStore.getItem(AzureADClientApplication.LastHomeAccountIdKey);
        } else {
            return null;
        }
    }

    private async setSavedAccountId(accountId: string): Promise<void> {
        return this.insomniaStore.setItem(AzureADClientApplication.LastHomeAccountIdKey, accountId);
    }

    private async removeSavedAccountId(): Promise<void> {
        return this.insomniaStore.removeItem(AzureADClientApplication.LastHomeAccountIdKey);
    }

    private getTenantedAuthority(authority: string, tenantId: string): string {
        const authorityNoTrailingSlash: string = authority.replace(/\/+$/, "");
        const tenantIdNoLeadingSlash: string = tenantId.replace(/^\/+/, "");
        return `${authorityNoTrailingSlash}/${tenantIdNoLeadingSlash}`;
    }
}