// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import EntraIdClientApplication from "./EntraIdClientApplication";

export default class TemplateTagActions {
  private entraIdClientApplication: EntraIdClientApplication;

  public constructor(entraIdClientApplication: EntraIdClientApplication) {
    this.entraIdClientApplication = entraIdClientApplication;
  }

  public getActions(): any[] {
    return [
      {
        name: "Sign out",
        icon: "fa fa-sign-out",
        run: (context: any) => this.entraIdClientApplication.signOutAsync()
      },
      {
        name: "Clear Entra ID cache",
        icon: "fa fa-trash",
        run: (context: any) => this.entraIdClientApplication.clearCacheAsync()
      }
    ];
  }
}