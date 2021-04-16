// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import AzureADClientApplication from "./AzureADClientApplication";

export default class TemplateTagActions {
  private azureAdClientApplication: AzureADClientApplication;

  public constructor(azureAdClientApplication: AzureADClientApplication) {
    this.azureAdClientApplication = azureAdClientApplication;
  }

  public getActions(): any[] {
    return [
      {
        name: "Sign out",
        icon: "fa fa-sign-out",
        run: (context: any) => this.azureAdClientApplication.signOut()
      },
      {
        name: "Clear Azure AD cache",
        icon: "fa fa-trash",
        run: (context: any) => this.azureAdClientApplication.clearCache()
      }
    ];
  }
}