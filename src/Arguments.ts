// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as validator from "validator";

const Arguments = [{
    displayName: "Authority",
    description: "Azure AD Authority",
    defaultValue: "https://login.microsoftonline.com",
    type: "enum",
    options: [{
            displayName: "Azure AD (global service)",
            value: "https://login.microsoftonline.com",
            description: "Azure AD (global service - https://login.microsoftonline.com)"
        },
        {
            displayName: "Azure AD for US Government",
            value: "https://login.microsoftonline.us",
            description: "Azure AD for US Government (https://login.microsoftonline.us)"
        },
        {
            displayName: "Azure AD Germany",
            value: "https://login.microsoftonline.de",
            description: "Azure AD Germany (https://login.microsoftonline.de)"
        },
        {
            displayName: "Azure AD China operated by 21Vianet",
            value: "https://login.chinacloudapi.cn",
            description: "Azure AD China operated by 21Vianet (https://login.chinacloudapi.cn)"
        }
    ]
},
{
    displayName: "Directory (tenant) ID",
    description: "Directory (tenant) ID ('common', 'organizations' or a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')",
    type: "string",
    validate: (arg: any): string => {
        return (arg === "common") || (arg === "organizations") || validator.default.isUUID(arg, 4) ? "" : "Must be 'common', 'organizations' or a tenant ID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'";
    }
},
{
    displayName: "Application (client) ID",
    description: "Application (client) ID (a GUID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')",
    type: "string",
    validate: (arg: any): string => {
        return validator.default.isUUID(arg, 4) ? "" : "Must be a client ID like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'";
    }
},
{
    displayName: "Scopes",
    description: "Scopes to request the Azure AD token for, separated by space",
    defaultValue: "openid profile offline_access",
    type: "string",
    validate: (arg: any): string => (arg ? "" : "Required")
}]

export { Arguments }