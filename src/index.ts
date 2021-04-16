// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import AzureADClientApplication from "./AzureADClientApplication";

import { Arguments } from "./TemplateTagArguments";
import TemplateTagActions from "./TemplateTagActions";
import TemplateTagLiveDisplayName from "./TemplateTagLiveDisplayName";
import TemplateTagPlugin from "./TemplateTagPlugin";


const azureAdClientApplication: AzureADClientApplication = new AzureADClientApplication();
const templateTagActions: TemplateTagActions = new TemplateTagActions(azureAdClientApplication);
const templateTagLiveDisplayName: TemplateTagLiveDisplayName = new TemplateTagLiveDisplayName(azureAdClientApplication);
const templateTagPlugin: TemplateTagPlugin = new TemplateTagPlugin(azureAdClientApplication);




const templateTags = [{
  name: "azuread",
  displayName: "Azure AD Token",
  description: "Get an Azure AD access token",

  args: Arguments,
  actions: templateTagActions.getActions(),

  liveDisplayName: (args: any[]): string | null => templateTagLiveDisplayName.liveDisplayName(args),
  run: (context: any, ...args: any[]): Promise<string | null | undefined> => templateTagPlugin.pluginMain(context, args)
}];


export { templateTags }