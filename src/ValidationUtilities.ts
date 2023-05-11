// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { URL } from "url";
import * as validator from "validator";

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

export function isValidTokenType(tokenType: string | null | undefined): boolean {
      if (tokenType) {
        return (tokenType === "accessToken") || (tokenType === "idToken");
      }
      return false;
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