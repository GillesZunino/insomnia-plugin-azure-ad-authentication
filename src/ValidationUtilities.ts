// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { URL } from "url";
import * as validator from "validator";
import TokenType from "./TokenType";
import TokenGrantFlow from "./TokenGrantFlow";

export function isTenantIdValid(tenantId: string | null | undefined): boolean {
    if (tenantId) {
        return (tenantId === "common") || (tenantId === "consumers") || (tenantId === "organizations") || validator.default.isFQDN(tenantId) || validator.default.isUUID(tenantId, 4);
    }
    return false;
}

export function isClientIdValid(clientId: string | null | undefined): boolean {
    if (clientId) {
        return validator.default.isUUID(clientId, 4);
    }
    return false;
}

export function isScopesValid(scopes: string | null | undefined): boolean {
    if (scopes) {
        const normalizedScopes: string[] = normalizeAzureADScopes(scopes);
        return normalizedScopes.length > 0;
    }
    return false;
}

export function isRedirectUriValid(redirectUri: string | null | undefined): boolean {
    if (redirectUri) {
        try {
            const parsedRedirectUri: URL = new URL(redirectUri);
            // Must not have a query string, no hash - If HTTP, must be localhost. If HTTPS, can be anything
            switch (parsedRedirectUri.protocol) {
                case "http:":
                    return (parsedRedirectUri.hostname === "localhost") && (parsedRedirectUri.search === "") && (parsedRedirectUri.hash === "");
                case "https:":
                    return (parsedRedirectUri.search === "") && (parsedRedirectUri.hash === "");
                default:
                    return false;
            }
        } catch (e: unknown) {
            return false;
        }
    }
    return false;
}

export function normalizeTokenType(tokenType: string | null | undefined): { tokenTypeValid: boolean, normalizedTokenType: TokenType} {
    switch (tokenType) {
        case TokenType.accessToken:
            return { tokenTypeValid: true, normalizedTokenType: TokenType.accessToken };
        case TokenType.idToken:
            return { tokenTypeValid: true, normalizedTokenType: TokenType.idToken };
        default:
            return { tokenTypeValid: false, normalizedTokenType: TokenType.unknown };
    }
}

export function normalizeTokenGrantFlow(tokenGrantFlow: string | null | undefined): { tokenGrantFlowValid: boolean, normalizedTokenGrantFlow: TokenGrantFlow} {  
    switch (tokenGrantFlow) {
        case TokenGrantFlow.oauth2AuthorizationCode:
            return { tokenGrantFlowValid: true, normalizedTokenGrantFlow: TokenGrantFlow.oauth2AuthorizationCode };
        case TokenGrantFlow.oauth2ClientCredentialsPSK:
            return { tokenGrantFlowValid: true, normalizedTokenGrantFlow: TokenGrantFlow.oauth2ClientCredentialsPSK };
        case TokenGrantFlow.oauth2ClientCredentialsCertificate:
            return { tokenGrantFlowValid: true, normalizedTokenGrantFlow: TokenGrantFlow.oauth2ClientCredentialsCertificate };
        default:
            return { tokenGrantFlowValid: false, normalizedTokenGrantFlow: TokenGrantFlow.unknown };
    }
}

export function normalizeAzureADScopes(scopes: string | null | undefined): string[] {
    if (scopes) {
      return scopes.split(" ")
                   .map((entry: string) => entry ? entry.trim() : "")
                   .filter((entry: string) => !!entry);
    } else {
      return [];
    }
}

export function isCertificateThumbprintSyntacticallyValid(thumbprint: string): boolean {
    return !!thumbprint && (thumbprint.length === 40) && (thumbprint.match(/^[0-9a-fA-F]+$/) ? true : false);
}