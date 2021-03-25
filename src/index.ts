// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

// For help writing plugins, visit the documentation to get started: https://support.insomnia.rest/article/173-plugins

import * as msal from "@azure/msal-node";


import { Arguments } from "./Arguments";
import AuthorizationCodeFlow from "./AuthorizationCodeFlow";


let cachedAuthResult: msal.AuthenticationResult | null = null;


const templateTags = [{
    name: "azuread",
    displayName: "Azure AD Token",
    description: "Get an Azure AD Token",
    //disablePreview: () => true,
    args: Arguments,
    async run(context: any, authority: string | undefined, tenantId: string | undefined, clientId: string | undefined, scopes: string | undefined) {
        if (!authority) {
            throw new Error("'Authority' property is required");
        }

        if (!tenantId) {
            throw new Error("'Directory (tenant) ID' property is required");
        }

        if (!clientId) {
            throw new Error("'Application (client) ID' property is required");
        }

        if (!scopes) {
            throw new Error("'Scopes' property is required");
        }


        // TODO: Refresh the token when necessary, get from cache
        // TODO: Detect if the request is for the same set of paramters or not
        // TODO: Intrduce a way to have multiple identities
        if (cachedAuthResult) {
            return cachedAuthResult.accessToken;
        }

        const authorizationCodeFlow = new AuthorizationCodeFlow();
        cachedAuthResult = await authorizationCodeFlow.authenticateAsync(authority, tenantId, clientId, scopes);
        return cachedAuthResult != null ? cachedAuthResult.accessToken : "";
    }
}];


export { templateTags }