// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import EntraIdClientApplication from "./EntraIdClientApplication";

import { TemplateTagPluginArguments } from "./TemplateTagArguments";
import TemplateTagActions from "./TemplateTagActions";
import TemplateTagLiveDisplayName from "./TemplateTagLiveDisplayName";
import TemplateTagPlugin from "./TemplateTagPlugin";


const entraIdClientApplication: EntraIdClientApplication = new EntraIdClientApplication();
const templateTagActions: TemplateTagActions = new TemplateTagActions(entraIdClientApplication);
const templateTagLiveDisplayName: TemplateTagLiveDisplayName = new TemplateTagLiveDisplayName(entraIdClientApplication);
const templateTagPlugin: TemplateTagPlugin = new TemplateTagPlugin(entraIdClientApplication);




const templateTags = [{
  name: "azuread",
  displayName: "Entra ID Token",
  description: "Get a Microsoft Entra ID token",

  args: TemplateTagPluginArguments,
  actions: templateTagActions.getActions(),

  liveDisplayName: (args: any[]): string | null => templateTagLiveDisplayName.liveDisplayName(args),
  run: (context: any, ...args: any[]): Promise<string | null | undefined> => templateTagPlugin.pluginMain(context, args)
}];


export { templateTags }