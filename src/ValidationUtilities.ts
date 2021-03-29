// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as validator from "validator";

export function isTenantIdValid(tenantId: string | null | undefined): boolean {
    if (tenantId) {
        return (tenantId === "common") || (tenantId === "organizations") || validator.default.isFQDN(tenantId) || validator.default.isUUID(tenantId, 4);
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

export function normalizeAzureADScopes(scopes: string | null | undefined): string[] {
    if (scopes) {
      return scopes.split(" ")
                   .map((entry: string) => entry ? entry.trim() : "")
                   .filter((entry: string) => !!entry);
    } else {
      return [];
    }
  } 