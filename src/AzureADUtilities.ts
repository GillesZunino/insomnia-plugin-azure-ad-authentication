// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";
import TokenType from "./TokenType";

export function getAuthenticationErrorMessageFromException(e: unknown): string {
    if (e instanceof msal.AuthError) {
        const authError: msal.AuthError = <msal.AuthError>e;
        return `${authError.errorCode} - ${authError.errorMessage} - ${authError.subError}`;
    }

    if (e instanceof Error) {
        return (<Error> e).message;
    }

    return (<any> e).toString();
}

export function getTokenByType(authResult: msal.AuthenticationResult, tokenType: TokenType): string {
    switch (tokenType) {
        case TokenType.idToken:
            return authResult.idToken;
        case TokenType.accessToken:
            return authResult.accessToken;
        default:
            return "";
    }
}