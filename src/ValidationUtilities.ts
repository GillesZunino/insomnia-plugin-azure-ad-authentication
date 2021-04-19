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
      const parsedRedirectUri: URL = new URL(redirectUri);
      // Must be HTTP (and not HTTPS), must point to '127.0.0.1', no query string, no hash
      return (parsedRedirectUri.protocol === "http:") && (parsedRedirectUri.hostname === "127.0.0.1") && (parsedRedirectUri.search === "") && (parsedRedirectUri.hash === "");
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