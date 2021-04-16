// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { AuthenticationResult } from "@azure/msal-common";
import AzureADClientApplication from "./AzureADClientApplication";


export default class TagTemplateLiveDisplayName {
    private static readonly HtmlArrow: string = "&rArr;";

    private azureAdClientApplication: AzureADClientApplication;

    public constructor(azureAdClientApplication: AzureADClientApplication) {
        this.azureAdClientApplication = azureAdClientApplication;
    }

    public liveDisplayName(args: any[]): string | null {
        const currentAuthenticationResult: AuthenticationResult | null = this.azureAdClientApplication.authenticationResult;
        if (currentAuthenticationResult) {
            return `Azure AD ${TagTemplateLiveDisplayName.HtmlArrow} [${currentAuthenticationResult.account?.username} - '${currentAuthenticationResult.scopes}']`;
        } else {
            return `Azure AD ${TagTemplateLiveDisplayName.HtmlArrow} Not logged in [${args[0].value}]`;
        }
    }
}