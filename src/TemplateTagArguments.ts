// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { isTenantIdValid, isClientIdValid, isScopesValid } from "./ValidationUtilities";


const Arguments = [{
    displayName: "Authority",
    description: "Azure AD Authority",
    help: "Azure AD endpoint to use when retrieving tokens",
    defaultValue: "https://login.microsoftonline.com",
    type: "enum",
    options: [{
        displayName: "Azure AD global service",
        value: "https://login.microsoftonline.com",
        description: "https://login.microsoftonline.com"
    },
    {
        displayName: "Azure AD for US Government",
        value: "https://login.microsoftonline.us",
        description: "https://login.microsoftonline.us"
    },
    {
        displayName: "Azure AD Germany",
        value: "https://login.microsoftonline.de",
        description: "https://login.microsoftonline.de"
    },
    {
        displayName: "Azure AD China operated by 21Vianet",
        value: "https://login.chinacloudapi.cn",
        description: "https://login.chinacloudapi.cn"
    }]
},
{
    displayName: "Directory (tenant) ID",
    description: "Directory (tenant) ID ('common', 'organizations', a tenant name or a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')",
    help: "The Azure AD tenant. Can be 'common', 'organizations', a domain like 'contoso.com' or a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isTenantIdValid(arg);
        return isValid ? "" : "Must be 'common', 'organizations', a domain like 'contoso.com' or a tenant ID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'";
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
    description: "Scopes to request the Azure AD token for, separated by space",
    help: "A space separated list of resources to request the token for. Examples include 'User.Read' or 'openid profile'",
    defaultValue: "openid profile offline_access",
    type: "string",
    validate: (arg: any): string => {
        const isValid: boolean = isScopesValid(arg);
        return isValid ? "" : "Must be a list of scopes like 'openid User.Read'";
    }
}]

export { Arguments }

