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

        // Last sucessful authentication result
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

    public configure(authority: string | undefined, tenantId: string | undefined, clientId: string | undefined): void {
        if (authority && tenantId && clientId) {
            // const configurationChanged: boolean = applyAuthority(authority, tenantId) || applyClientId(clientId);
            // if (configurationChanged) {
            // TODO: Update configuration and reset cached creds when things change
            if (true) {
                this.clientConfig.auth.clientId = clientId;
                this.clientConfig.auth.authority = `${authority}/${tenantId}`;
                this.publicClientApplication = new msal.PublicClientApplication(this.clientConfig);
            }
        } else {
            this.publicClientApplication = null;
        }
    }

    public async authenticateInteractive(scopes: string[]): Promise<msal.AuthenticationResult | null> {
        try {
            const authorizationCodeFlow: AuthorizationCodeFlow = new AuthorizationCodeFlow(this);
            this.currentAuthenticationResult = await authorizationCodeFlow.authenticateInteractive(scopes);
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
            // TODO: Handle error
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
                        const silentAuthenticationResult: msal.AuthenticationResult | null = await this.instance?.acquireTokenSilent({
                            account: savedAccountInfo,
                            scopes: scopes
                        });
                        this.currentAuthenticationResult = silentAuthenticationResult ? silentAuthenticationResult : null;
                    }
                    catch (e) {
                        // TODO: Handle error
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
}