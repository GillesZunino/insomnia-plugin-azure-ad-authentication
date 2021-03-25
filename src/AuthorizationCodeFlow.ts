// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { Server } from "node:http";
import express from "express";
import * as open from "open";
import * as msal from "@azure/msal-node";

import { PromiseCompletionSource } from "./PromiseCompletionSource";


export default class AuthorizationCodeFlow {

    private static readonly Port: number = 1234;
    private static readonly HostName: string = "127.0.0.1";
    private static readonly BaseUri: string = `http://${AuthorizationCodeFlow.HostName}:${AuthorizationCodeFlow.Port}`;
    private static readonly RedirectUri: string = `http://${AuthorizationCodeFlow.HostName}:${AuthorizationCodeFlow.Port}/redirect`;

    public constructor() {
    }

    public async authenticateAsync(authority: string, tenantId: string, clientId: string, scopes: string): Promise<msal.AuthenticationResult | null> {
        const clientConfig: msal.Configuration = {
            auth: {
                clientId: clientId,
                protocolMode: msal.ProtocolMode.AAD,
                authority: `${authority}/${tenantId}`
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel: any, message, containsPii) {
                        console.log(message);
                    },
                    piiLoggingEnabled: false,
                    logLevel: msal.LogLevel.Error
                }
            }
        };

        let normalizedScopes: string[] = scopes.split(" ");

        const publicClientApplication = new msal.PublicClientApplication(clientConfig);
        const authenticationResultPromiseCompletionSource: PromiseCompletionSource<msal.AuthenticationResult | null> = new PromiseCompletionSource();

        const app = express();

        app.get("/", (req, res) => {
            const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
                scopes: normalizedScopes,
                redirectUri: AuthorizationCodeFlow.RedirectUri,
            };

            // get url to sign user in and consent to scopes needed for application
            publicClientApplication.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
                res.redirect(response);
            }).catch((error) => console.log(JSON.stringify(error)));
        });

        app.get("/redirect", (req, res) => {
            const code: string = < string > req.query.code;
            if (req.query?.code) {
                const tokenRequest: msal.AuthorizationCodeRequest = {
                    code: code,
                    scopes: normalizedScopes,
                    redirectUri: AuthorizationCodeFlow.RedirectUri,
                };

                publicClientApplication.acquireTokenByCode(tokenRequest).then((response) => {
                    authenticationResultPromiseCompletionSource.resolve(response);

                    // TODO: Show the user a message indicating the authentication completed with success and the web browser can be closed
                    res.sendStatus(200);
                }).catch((error) => {
                    console.log(error);
                    authenticationResultPromiseCompletionSource.reject(error);
                    res.status(500).send(error);
                });
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
    }
}