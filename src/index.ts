// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

import { Arguments } from "./TemplateTagArguments";
import { getActions } from "./TemplateTagActions";
import AzureADClientApplication from "./AzureADClientApplication";


let publicClientApplication: AzureADClientApplication = new AzureADClientApplication();


const templateTags = [{
  name: "azuread",
  displayName: "Azure AD Token",
  description: "Get an Azure AD access token",
  liveDisplayName: (args: any[]) => {
    const htmlArrow = "&rArr;";
    const currentAuthenticationResult = publicClientApplication?.authenticationResult;
    if (currentAuthenticationResult) {
      return `Azure AD ${htmlArrow} [${currentAuthenticationResult.account?.username} - '${currentAuthenticationResult.scopes}']`;
    } else {
      return `Azure AD ${htmlArrow} Not logged in [${args[0].value}]`;
    }
  },

  args: Arguments,
  actions: getActions(publicClientApplication),

  async run(context: any, ...args: any[]) {
    // Configure the Azure AD persistence store to retrieve saved accounts
    publicClientApplication.ensureStore(context.store);

    // Validate arguments
    const authority: string | undefined = args[0];
    const tenantId: string | undefined = args[1];
    const clientId: string | undefined= args[2];
    const scopes: string | undefined = args[3];
    const flow: string | undefined = args[4];

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

    if (!flow) {
      throw new Error("'Flow' property is required");
    }

    publicClientApplication.configure(authority, tenantId, clientId);

    const splitScopes: string[] = scopes.split(" ");

    const silentAuthenticationResult: msal.AuthenticationResult | null = await publicClientApplication.authenticateSilent(splitScopes);
    if (silentAuthenticationResult) {
      return silentAuthenticationResult.accessToken;
    } else {
      // Only log in interactively when a request is being sent
      if (context.renderPurpose === "send") {
        const interactiveAuthenticationResult: msal.AuthenticationResult | null = await publicClientApplication.authenticateInteractive(splitScopes);
        if (interactiveAuthenticationResult) {
          return interactiveAuthenticationResult.accessToken;
        } else {
          // TODO: Error handling
        }
      }

      return "Send a request to log in";
    }
  }
}];


export { templateTags }
