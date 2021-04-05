// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

import { Arguments } from "./TemplateTagArguments";
import { getActions } from "./TemplateTagActions";
import { isTenantIdValid, isClientIdValid, isScopesValid, normalizeAzureADScopes } from "./ValidationUtilities";
import AzureADClientApplication from "./AzureADClientApplication";


let publicClientApplication: AzureADClientApplication = new AzureADClientApplication();

function isSendingRequest(context: any): boolean {
  return context.renderPurpose === "send";
}



async function pluginMain(context: any, ...args: any[]): Promise<string | null | undefined> {
  // Configure the Azure AD persistence store to retrieve saved accounts
  publicClientApplication.ensureStore(context.store);


  // Validate arguments
  const authority: string | undefined = args[0];
  const tenantId: string | undefined = args[1];
  const clientId: string | undefined = args[2];
  const scopes: string | undefined = args[3];

  if (!authority) {
    throw new Error("'Authority' property is required");
  }


  // Tenant ID
  if (!tenantId) {
    throw new Error("'Directory (tenant) ID' property is required");
  }
  if (!isTenantIdValid(tenantId)) {
    throw new Error("'Directory (tenant) ID' property is invalid");
  }

  // Client ID
  if (!clientId) {
    throw new Error("'Application (client) ID' property is required");
  }
  if (!isClientIdValid(clientId)) {
    throw new Error("'Application (client) ID' property is invalid");
  }

  // Scopes
  if (!scopes) {
    throw new Error("'Scopes' property is required");
  }
  if (!isScopesValid(scopes)) {
    throw new Error("'Scopes' property must contain at least one valid entry");
  }


  // Apply configuration - This handles cases where the config has not changed
  const configurationChanged: boolean = await publicClientApplication.configure(authority, tenantId, clientId);

  // First, try to acquire a token silently
  const normalizedScopes: string[] = normalizeAzureADScopes(scopes);
  try {
    const silentAuthenticationResult: msal.AuthenticationResult | null = await publicClientApplication.authenticateSilent(normalizedScopes);
    if (silentAuthenticationResult) {
      return silentAuthenticationResult.accessToken;
    }
  }
  catch (e) {
    console.warn(`Could not get a token silently - ${e.message}`);
  }

  // If we could not acquire a token silently, offer to log in interactively when a request is being sent
  if (isSendingRequest(context)) {
    const interactiveAuthenticationResult: msal.AuthenticationResult | null = await publicClientApplication.authenticateInteractive(normalizedScopes);
    if (interactiveAuthenticationResult) {
      return interactiveAuthenticationResult.accessToken;
    } else {
      throw new Error("Could not retrieve a token from Azure AD - Unspecified error");
    }
  }

  return "Send a request to log in";
}

function liveDisplayName(args: any[]): string | null {
  const htmlArrow = "&rArr;";
  const currentAuthenticationResult = publicClientApplication?.authenticationResult;
  if (currentAuthenticationResult) {
    return `Azure AD ${htmlArrow} [${currentAuthenticationResult.account?.username} - '${currentAuthenticationResult.scopes}']`;
  } else {
    return `Azure AD ${htmlArrow} Not logged in [${args[0].value}]`;
  }
}


const templateTags = [{
  name: "azuread",
  displayName: "Azure AD Token",
  description: "Get an Azure AD access token",

  args: Arguments,
  actions: getActions(publicClientApplication),

  liveDisplayName: liveDisplayName,
  run: pluginMain
}];


export { templateTags }







