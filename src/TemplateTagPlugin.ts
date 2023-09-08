// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";
import crypto from "crypto";
import fs from "fs";

import TokenType from "./TokenType";
import TokenGrantFlow from "./TokenGrantFlow";
import { TemplatePluginArgumentsPosition } from "./TemplateTagArguments";
import { isTenantIdValid, isClientIdValid, isScopesValid, normalizeAzureADScopes, isRedirectUriValid, normalizeTokenGrantFlow, normalizeTokenType, isCertificateThumbprintSyntacticallyValid } from "./ValidationUtilities";
import { getAuthenticationErrorMessageFromException, getTokenByType } from "./AzureADUtilities";
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
        const authority: string | undefined = args[TemplatePluginArgumentsPosition.Authority];
        const tenantId: string | undefined = args[TemplatePluginArgumentsPosition.TenantId];
        const clientId: string | undefined = args[TemplatePluginArgumentsPosition.ClientId];
        const scopes: string | undefined = args[TemplatePluginArgumentsPosition.Scopes];
        const redirectUri: string | undefined = args[TemplatePluginArgumentsPosition.RedirectUri];
        const tokenGrantFlow: string | undefined = args[TemplatePluginArgumentsPosition.TokenGrantFlow];


        // Authority
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

        // Token Grant Flow
        if (!tokenGrantFlow) {
            throw new Error("'Token Grant Flow' property is required");
        }
        const { tokenGrantFlowValid, normalizedTokenGrantFlow } = normalizeTokenGrantFlow(tokenGrantFlow);
        if (!tokenGrantFlowValid) {
            throw new Error("'Token Grant Flow' property must be valid");
        }

        let tokenType: TokenType = TokenType.unknown;
        let sharedSecret: string = "";
        let certificateThumbprint: string = "";
        let privateKeyObject: crypto.KeyObject | null = null;

        // Perform validation based on the token grant flow chosen
        switch (normalizedTokenGrantFlow) {
            case TokenGrantFlow.oauth2AuthorizationCode: {
                // Must have a valid token type
                const rawTokenType: string | undefined = args[TemplatePluginArgumentsPosition.TokenType];
                if (!rawTokenType) {
                    throw new Error("'Token Type' property is required");
                }
                const { tokenTypeValid, normalizedTokenType } = normalizeTokenType(rawTokenType);
                if (!tokenTypeValid) {
                    throw new Error("'Token Type' property must be valid");
                } else {
                    tokenType = normalizedTokenType;
                }
            }
            break;
            case TokenGrantFlow.oauth2ClientCredentialsPSK: {
                // Must have a valid shared secret - Token Type is always TokenType.accessToken
                const rawSharedSecret: string | undefined = args[TemplatePluginArgumentsPosition.SharedSecret];
                if (!rawSharedSecret) {
                    throw new Error("'Shared Secret' property is required");
                } else {
                    sharedSecret = rawSharedSecret;
                }                
            }
            break;
            case TokenGrantFlow.oauth2ClientCredentialsCertificate: {
                // Must have a valid certificate thumbprint and private key file - Token Type is always TokenType.accessToken
                certificateThumbprint= args[TemplatePluginArgumentsPosition.CertificateThumbprint];
                if (!certificateThumbprint) {
                    throw new Error("'Certificate Thumbprint' property is required");
                }
                if (!isCertificateThumbprintSyntacticallyValid(certificateThumbprint)) {
                    throw new Error("'Certificate Thumbprint' must contain only numbers and letters from A to Z");
                }
                const certificateFilePath: string | undefined = args[TemplatePluginArgumentsPosition.CertificatePrivateKey];
                if (!certificateFilePath) {
                    throw new Error("'Certificate' property is required");
                }
                try {
                    const certificateRawContent: Buffer = await fs.promises.readFile(certificateFilePath);
                    privateKeyObject = crypto.createPrivateKey({
                        key: certificateRawContent,
                        format: "pem"
                    });
                }
                catch (e: unknown) {
                    throw new Error(`Could not read a valid PEM private key from file '${certificateFilePath}'`);
                }
            }
            break;
            default:
                throw new Error("'Token Grant Flow' property must be valid");
        }

        
        const normalizedScopes: string[] = normalizeAzureADScopes(scopes);

        switch (normalizedTokenGrantFlow) {
            case TokenGrantFlow.oauth2AuthorizationCode: {
                // Apply configuration to our Azure AD Application - This handles cases where the config has changed
                const configurationChanged: boolean = await this.azureAdClientApplication.configure({ authority: authority, tenantId: tenantId, clientId: clientId });
                
                // First, try to acquire a token silently
                try {
                    const silentAuthenticationResult: msal.AuthenticationResult | null = await this.azureAdClientApplication.authenticateSilentAsync(normalizedScopes);
                    if (silentAuthenticationResult) {
                        return getTokenByType(silentAuthenticationResult, tokenType);
                    }
                }
                catch (e: unknown) {
                    const error: string = getAuthenticationErrorMessageFromException(e);
                    console.warn(`Could not get a token silently - ${error}`);
                }

                // If we could not acquire a token silently, offer to log in interactively when a request is being sent
                if (this.isSendingRequest(context)) {
                    const interactiveAuthenticationResult: msal.AuthenticationResult | null = await this.azureAdClientApplication.authenticateInteractiveAsync(normalizedScopes, redirectUri);
                    if (interactiveAuthenticationResult) {
                        return getTokenByType(interactiveAuthenticationResult, tokenType);
                    } else {
                        throw new Error("Could not retrieve a token from Azure AD - Unspecified error");
                    }
                }

                return "Send a request to log in";
            }
            case TokenGrantFlow.oauth2ClientCredentialsPSK: {
                // Apply configuration to our Azure AD Application - This handles cases where the config has changed
                const configurationChanged: boolean = await this.azureAdClientApplication.configure({
                    authority: authority,
                    tenantId: tenantId,
                    clientId: clientId,
                    clientSecret: sharedSecret
                });

                // Client credentials only offers silent token acquisition
                const clientCredentialsAuthenticationResult: msal.AuthenticationResult | null = await this.azureAdClientApplication.authenticateWithClientCredentialsAsync(normalizedScopes);
                if (clientCredentialsAuthenticationResult !== null) {
                    return getTokenByType(clientCredentialsAuthenticationResult, TokenType.accessToken);
                } else {
                    throw new Error("Could not retrieve a token from Azure AD - Unspecified error");
                }
            }
            case TokenGrantFlow.oauth2ClientCredentialsCertificate: {
                // Apply configuration to our Azure AD Application - This handles cases where the config has changed
                const configurationChanged: boolean = await this.azureAdClientApplication.configure({
                    authority: authority,
                    tenantId: tenantId,
                    clientId: clientId,
                    clientCertificate: {
                        thumbprint: certificateThumbprint,
                        privateKey: <string> privateKeyObject?.export({
                            format: "pem",
                            type: "pkcs8"
                        })
                    }
                });

                // Client credentials only offers silent token acquisition
                const clientCredentialsAuthenticationResult = await this.azureAdClientApplication.authenticateWithClientCredentialsAsync(normalizedScopes);
                if (clientCredentialsAuthenticationResult !== null) {
                    return getTokenByType(clientCredentialsAuthenticationResult, TokenType.accessToken);
                } else {
                    throw new Error("Could not retrieve a token from Azure AD - Unspecified error");
                }
            }
        }
    }

    private isSendingRequest(context: any): boolean {
        return context.renderPurpose === "send";
    }
}