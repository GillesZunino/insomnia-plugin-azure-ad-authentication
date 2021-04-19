// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

import { isTenantIdValid, isClientIdValid, isScopesValid, normalizeAzureADScopes, isRedirectUriValid } from "./ValidationUtilities";
import AzureADClientApplication from "./AzureADClientApplication";

export default class TemplateTagPlugin {
    private azureAdClientApplication: AzureADClientApplication;

    public constructor(azureAdClientApplication: AzureADClientApplication) {
        this.azureAdClientApplication = azureAdClientApplication;
    }

    public async pluginMain(context: any, args: any[]): Promise<string | null | undefined> {
        // Configure the Azure AD persistence store to retrieve saved accounts
        this.azureAdClientApplication.ensureStore(context.store);


        // Validate arguments
        const authority: string | undefined = args[0];
        const tenantId: string | undefined = args[1];
        const clientId: string | undefined = args[2];
        const scopes: string | undefined = args[3];
        const redirectUri: string | undefined = args[4];

        if (!authority) {
            throw new Error("'Authority' property is required");
        }


        // Tenant ID
        if (!tenantId) {
            throw new Error("'Directory (tenant) ID' property is required");
        }
        if (!isTenantIdValid(tenantId)) {
            throw new Error("'Directory (tenant) ID' property is invalid");
        }

        // Client ID
        if (!clientId) {
            throw new Error("'Application (client) ID' property is required");
        }
        if (!isClientIdValid(clientId)) {
            throw new Error("'Application (client) ID' property is invalid");
        }

        // Scopes
        if (!scopes) {
            throw new Error("'Scopes' property is required");
        }
        if (!isScopesValid(scopes)) {
            throw new Error("'Scopes' property must contain at least one valid entry");
        }

        // Redirect Uri
        if (!redirectUri) {
            throw new Error("'Redirect URI' property is required");
        }
        if (!isRedirectUriValid(redirectUri)) {
            throw new Error("'Redirect URI' must be valid");
        }


        // Apply configuration - This handles cases where the config has not changed
        const configurationChanged: boolean = await this.azureAdClientApplication.configure(authority, tenantId, clientId);

        // First, try to acquire a token silently
        const normalizedScopes: string[] = normalizeAzureADScopes(scopes);
        try {
            const silentAuthenticationResult: msal.AuthenticationResult | null = await this.azureAdClientApplication.authenticateSilent(normalizedScopes);
            if (silentAuthenticationResult) {
                return silentAuthenticationResult.accessToken;
            }
        }
        catch (e) {
            console.warn(`Could not get a token silently - ${e.message}`);
        }

        // If we could not acquire a token silently, offer to log in interactively when a request is being sent
        if (this.isSendingRequest(context)) {
            const interactiveAuthenticationResult: msal.AuthenticationResult | null = await this.azureAdClientApplication.authenticateInteractive(normalizedScopes, redirectUri);
            if (interactiveAuthenticationResult) {
                return interactiveAuthenticationResult.accessToken;
            } else {
                throw new Error("Could not retrieve a token from Azure AD - Unspecified error");
            }
        }

        return "Send a request to log in";
    }

    private isSendingRequest(context: any): boolean {
        return context.renderPurpose === "send";
    }
}