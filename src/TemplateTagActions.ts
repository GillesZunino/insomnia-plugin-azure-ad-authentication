// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import AzureADClientApplication from "./AzureADClientApplication";


let publicClientApplication: AzureADClientApplication | null = null;


const actions = [
  {
    name: "Sign out",
    icon: "fa fa-sign-out",
    run: (context: any) => publicClientApplication?.signOut()
  },
  {
    name: "Clear Azure AD cache",
    icon: "fa fa-trash",
    run: (context: any) => publicClientApplication?.clearCache()
  }
];


function getActions(azureADClientApplication: AzureADClientApplication): any[] {
  if (publicClientApplication === null) {
    publicClientApplication = azureADClientApplication;
  }

  return actions;
}


export { getActions }
