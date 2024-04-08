// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { AuthenticationResult } from "@azure/msal-common";
import EntraIdClientApplication from "./EntraIdClientApplication";


export default class TagTemplateLiveDisplayName {
    private static readonly HtmlArrow: string = "&rArr;";

    private entraIdClientApplication: EntraIdClientApplication;

    public constructor(entraIdClientApplication: EntraIdClientApplication) {
        this.entraIdClientApplication = entraIdClientApplication;
    }

    public liveDisplayName(args: any[]): string | null {
        const currentAuthenticationResult: AuthenticationResult | null = this.entraIdClientApplication.authenticationResult;
        if (currentAuthenticationResult) {
            return `Entra ID ${TagTemplateLiveDisplayName.HtmlArrow} [${currentAuthenticationResult.account?.username} - '${currentAuthenticationResult.scopes}']`;
        } else {
            return `Entra ID ${TagTemplateLiveDisplayName.HtmlArrow} Not logged in [${args[0].value}]`;
        }
    }
}