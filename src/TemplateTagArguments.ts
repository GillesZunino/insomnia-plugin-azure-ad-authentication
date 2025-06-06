// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import TokenType from "./TokenType";
import TokenGrantFlow from "./TokenGrantFlow";
import { isTenantIdValid, isClientIdValid, isScopesValid, isRedirectUriValid, isCertificateThumbprintSyntacticallyValid } from "./ValidationUtilities";


const TemplateTagPluginArguments = [{
    displayName: "Authority",
    description: "Entra ID Authority",
    help: "Microsoft Entra ID endpoint to use when retrieving tokens",
    defaultValue: "https://login.microsoftonline.com",
    type: "enum",
    options: [{
        displayName: "Entra ID global service",
        value: "https://login.microsoftonline.com",
        description: "https://login.microsoftonline.com"
    },
    {
        displayName: "Entra ID for US Government",
        value: "https://login.microsoftonline.us",
        description: "https://login.microsoftonline.us"
    },
    {
        displayName: "Entra ID Germany",
        value: "https://login.microsoftonline.de",
        description: "https://login.microsoftonline.de"
    },
    {
        displayName: "Entra ID China operated by 21Vianet",
        value: "https://login.chinacloudapi.cn",
        description: "https://login.chinacloudapi.cn"
    }]
},
{
    displayName: "Directory (tenant) ID",
    description: "Directory (tenant) ID ('common', 'consumers', 'organizations', a tenant name or a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')",
    help: "The Microsoft Entra ID tenant. Can be 'common', 'consumers', 'organizations', a domain like 'contoso.com' or a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isTenantIdValid(arg);
        return isValid ? "" : "Must be 'common', 'consumers', 'organizations', a domain like 'contoso.com' or a tenant ID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'";
    }
},
{
    displayName: "Application (client) ID",
    description: "Application (client) ID (a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')",
    help: "Application (client) ID from the Azure Portal. It is a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isClientIdValid(arg);
        return isValid ? "" : "Must be a client ID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'";
    }
},
{
    displayName: "Scopes",
    description: "Scopes to request the Entra ID token for, separated by space",
    help: (args: any[]): string => {
        const isClientCredentialFlow: boolean = 
                (args.length >= TemplatePluginArgumentsPosition.TokenGrantFlow + 1) &&
                !!args[TemplatePluginArgumentsPosition.TokenGrantFlow] && 
                ((args[TemplatePluginArgumentsPosition.TokenGrantFlow].value === TokenGrantFlow.oauth2ClientCredentialsPSK) || (args[TemplatePluginArgumentsPosition.TokenGrantFlow].value === TokenGrantFlow.oauth2ClientCredentialsCertificate));
        return isClientCredentialFlow ? 
            "For Client Credential flows, scope must be '<application URI>/.default' where <app URI. is the application URI" :
            "A space separated list of resources to request the token for. Examples include 'User.Read' or 'openid profile'";
    },
    defaultValue: "openid profile offline_access",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isScopesValid(arg);
        return isValid ? "" : "Must be a list of scopes like 'openid User.Read'";
    }
},
{
    displayName: "Redirect URI",
    description: "A URI Entra ID will accept as destination when returning authentication responses (tokens or codes) after successfully authenticating users",
    help: "One of the Redirect URI configured in Microsoft Entra ID. Examples include 'http://127.0.0.1:1234/redirect' or 'http://127.0.0.1:6090/openid'. Insomnia will listen on this port and path on the local machine during authentication. Postman callback URLs ('https://oauth.pstmn.io/v1/callback' and variants) are not supported.",
    defaultValue: "http://127.0.0.1:1234/redirect",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isRedirectUriValid(arg);
        return isValid ? "" : "Must be a valid URI like 'http://127.0.0.1:1234/redirect'. 'https://' or Postman callback URLs ('https://oauth.pstmn.io/v1/callback' and variants) are not supported.";
    }
},
{
    displayName: "Token Grant Flow",
    description: "Authentication flow for requesting tokens",
    help: "Authentication flow - See https://learn.microsoft.com/en-us/azure/active-directory/develop/authentication-flows-app-scenarios#scenarios-and-supported-authentication-flows",
    defaultValue: TokenGrantFlow.oauth2AuthorizationCode,
    type: "enum",
    options: [{
        displayName: "OAuth 2.0 Auth Code grant with PKCE",
        value: TokenGrantFlow.oauth2AuthorizationCode,
        description: "Authenticate interactively with Web Browser"
    },
    {
        displayName: "OAuth 2.0 Client Credential grant with Shared Secret",
        value: TokenGrantFlow.oauth2ClientCredentialsPSK,
        description: "Authenticate silently with shared secret (not recommended)"
    },
    {
        displayName: "OAuth 2.0 Client Credential grant with Certificate",
        value: TokenGrantFlow.oauth2ClientCredentialsCertificate,
        description: "Authenticate silently with signed client assertion"
    }]
},
{
    displayName: "Shared Secret",
    description: "Shared secret to present",
    help: "Shared secret that you generated for your app - https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow#first-case-access-token-request-with-a-shared-secret",
    defaultValue: "",
    type: "string",
    validate: (arg: any): string => {
        return arg ? "" : "Must be a non empty string";
    },
    hide: (args: any[]): boolean => {
        return (args.length < TemplatePluginArgumentsPosition.TokenGrantFlow + 1) ||
                !args[TemplatePluginArgumentsPosition.TokenGrantFlow] || 
                (args[TemplatePluginArgumentsPosition.TokenGrantFlow].value !== TokenGrantFlow.oauth2ClientCredentialsPSK);
    }
},
{
    displayName: "Certificate Thumbprint",
    description: "Thumbprint of certificate registered with Entra ID",
    help: "Thumbprint of certificate registered with Microsoft Entra ID",
    defaultValue: "",
    type: "string",
    validate: (arg: any): string => {
        if (!arg) {
            return "Must be a non empty string";
        }
        return isCertificateThumbprintSyntacticallyValid(arg) ? "" : "Must contain only numbers and/or letters from A to Z";
    },
    hide: (args: any[]): boolean => {
        return (args.length < TemplatePluginArgumentsPosition.TokenGrantFlow + 1) ||
                !args[TemplatePluginArgumentsPosition.TokenGrantFlow] || 
                (args[TemplatePluginArgumentsPosition.TokenGrantFlow].value !== TokenGrantFlow.oauth2ClientCredentialsCertificate);
    }
},
{
    displayName: "Certificate Private Key",
    description: "Certificate private key in PEM format",
    help: "Certificate to sign the client assertion - See https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow#second-case-access-token-request-with-a-certificate",
    defaultValue: "",
    type: "file",
    extensions: [ "pem", "key" ],
    hide: (args: any[]): boolean => {
        return (args.length < TemplatePluginArgumentsPosition.TokenGrantFlow + 1) ||
        !args[TemplatePluginArgumentsPosition.TokenGrantFlow] || 
        (args[TemplatePluginArgumentsPosition.TokenGrantFlow].value !== TokenGrantFlow.oauth2ClientCredentialsCertificate);
    }
},
{
    displayName: "Token Type",
    description: "Type of token to request",
    help: "Access Token enable clients to securely call protected web APIs. Web APIs use access tokens to authenticate and authorize calls. Id Token carry information about the user and should not be used for authorization purposes",
    defaultValue: TokenType.accessToken,
    type: "enum",
    hide: (args: any[]): boolean => {
        return (args.length < TemplatePluginArgumentsPosition.TokenGrantFlow + 1) ||
        !args[TemplatePluginArgumentsPosition.TokenGrantFlow] || 
        (args[TemplatePluginArgumentsPosition.TokenGrantFlow].value !== TokenGrantFlow.oauth2AuthorizationCode);
    },
    options: [{
        displayName: "Access Token",
        value: TokenType.accessToken,
        description: "Securely call web APIs, authenticate and authorize"
    },
    {
        displayName: "Id Token",
        value: TokenType.idToken,
        description: "Verify a user is who they claim to be"
    }]
}];



function getArgumentIndexByDisplayName(displayName: string): number {
    const index: number = TemplateTagPluginArguments.findIndex((templateTagPluginArgument: any) => templateTagPluginArgument.displayName === displayName);
    if (index !== -1) {
        return index;
    } else {
        throw new Error(`Cannot initialize TemplaterTagPluginArguments - Argument '${displayName}' cannot be found`);
    }
}


const TemplatePluginArgumentsPosition = {
    Authority: getArgumentIndexByDisplayName("Authority"),
    TenantId: getArgumentIndexByDisplayName("Directory (tenant) ID"),
    ClientId: getArgumentIndexByDisplayName("Application (client) ID"),
    Scopes: getArgumentIndexByDisplayName("Scopes"),
    RedirectUri: getArgumentIndexByDisplayName("Redirect URI"),
    TokenGrantFlow: getArgumentIndexByDisplayName("Token Grant Flow"),
    SharedSecret: getArgumentIndexByDisplayName("Shared Secret"),
    CertificateThumbprint: getArgumentIndexByDisplayName("Certificate Thumbprint"),
    CertificatePrivateKey: getArgumentIndexByDisplayName("Certificate Private Key"),
    TokenType: getArgumentIndexByDisplayName("Token Type")
}



export { TemplateTagPluginArguments, TemplatePluginArgumentsPosition }
