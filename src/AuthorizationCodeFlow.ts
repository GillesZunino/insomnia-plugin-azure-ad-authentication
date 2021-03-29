// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { Server } from "node:http";
import express from "express";
import * as open from "open";
import * as msal from "@azure/msal-node";

import { PromiseCompletionSource } from "./PromiseCompletionSource";
import AzureADClientApplication from "./AzureADClientApplication";

export default class AuthorizationCodeFlow {

    private static readonly Port: number = 1234;
    private static readonly HostName: string = "127.0.0.1";
    private static readonly BaseUri: string = `http://${AuthorizationCodeFlow.HostName}:${AuthorizationCodeFlow.Port}`;
    private static readonly RedirectUri: string = `http://${AuthorizationCodeFlow.HostName}:${AuthorizationCodeFlow.Port}/redirect`;

    private publicClientApplication: AzureADClientApplication;

    public constructor(publicClientApplication: AzureADClientApplication) {
        this.publicClientApplication = publicClientApplication;
    }

    public async authenticateInteractive(scopes: string[]): Promise<msal.AuthenticationResult | null> {
        if (this.publicClientApplication.instance !== null) {
            const authenticationResultPromiseCompletionSource: PromiseCompletionSource<msal.AuthenticationResult | null> = new PromiseCompletionSource();

            const app: express.Application = express();

            app.get("/", (req, res) => {
                const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
                    scopes: scopes,
                    redirectUri: AuthorizationCodeFlow.RedirectUri,
                };

                // Get url to sign user in and consent to scopes needed for application
                if (this.publicClientApplication.instance !== null) {
                    this.publicClientApplication.instance.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
                        res.redirect(response);
                    }).catch((error) => console.log(JSON.stringify(error)));
                }
            });

            app.get("/redirect", (req, res) => {
                const code: string = <string>req.query.code;
                if (req.query?.code) {
                    const tokenRequest: msal.AuthorizationCodeRequest = {
                        code: code,
                        scopes: scopes,
                        redirectUri: AuthorizationCodeFlow.RedirectUri,
                    };

                    if (this.publicClientApplication.instance !== null) {
                        this.publicClientApplication.instance.acquireTokenByCode(tokenRequest).then((response) => {
                            authenticationResultPromiseCompletionSource.resolve(response);

                            // TODO: Show the user a message indicating the authentication completed with success and the web browser can be closed

                            res.sendStatus(200);
                        }).catch((error) => {
                            console.log(error);
                            authenticationResultPromiseCompletionSource.reject(error);
                            res.status(500).send(error);
                        });
                    }

                } else {
                    console.error("Could not get Azure AD Url");
                    authenticationResultPromiseCompletionSource.reject("Could not get Azure AD Url");
                }
            });

            const server: Server = app.listen(AuthorizationCodeFlow.Port, () => console.log(`Listening on port ${AuthorizationCodeFlow.Port}`));

            await open.default(AuthorizationCodeFlow.BaseUri);

            const authCodeFinal: msal.AuthenticationResult | null = await authenticationResultPromiseCompletionSource.promise;

            if (server) {
                server.close();
            }

            return authCodeFinal;
        } else {
            return null;
        }
    }
}