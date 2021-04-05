// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { Server } from "node:http";
import { ChildProcess } from "child_process";
import express from "express";
import * as open from "open";
import * as msal from "@azure/msal-node";

import { SuccessHtml } from "./AuthSuccessHtml"
import { FailedHtml } from "./AuthFailureHtml"

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
        let authenticationResult: msal.AuthenticationResult | null = null;

        if (this.publicClientApplication.instance !== null) {
            const authenticationResultPromiseCompletionSource: PromiseCompletionSource<msal.AuthenticationResult | null> = new PromiseCompletionSource();

            const app: express.Application = express();

            app.get("/", async (request, response) => {
                const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
                    scopes: scopes,
                    redirectUri: AuthorizationCodeFlow.RedirectUri,
                    responseMode: msal.ResponseMode.QUERY,
                    prompt: "select_account"
                };

                // Get url to sign user in and consent to scopes needed for application
                if (this.publicClientApplication.instance !== null) {
                    try {
                        const authRedirectUri: string = await this.publicClientApplication.instance.getAuthCodeUrl(authCodeUrlParameters);
                        response.redirect(authRedirectUri);
                    }
                    catch (e) {
                        authenticationResultPromiseCompletionSource.reject(e);
                        response.status(200).send(this.formatErrorHtml(e));
                    }
                }
            });

            app.get("/redirect", async (request, response) => {
                if (typeof request.query?.code === "string") {
                    // MSAL returned a code which we can redeem for a token
                    const code: string | null = request.query?.code as string;
                    const tokenRequest: msal.AuthorizationCodeRequest = {
                        code: code,
                        scopes: scopes,
                        redirectUri: AuthorizationCodeFlow.RedirectUri,
                    };

                    // Redeem the code for an authentication result
                    if (this.publicClientApplication.instance !== null) {
                        try {
                            const authenticationResult: msal.AuthenticationResult | null = await this.publicClientApplication.instance.acquireTokenByCode(tokenRequest);
                            authenticationResultPromiseCompletionSource.resolve(authenticationResult);
                            response.status(200).send(SuccessHtml);
                        }
                        catch (e) {
                            authenticationResultPromiseCompletionSource.reject(e);
                            response.status(200).send(this.formatErrorHtml(e));
                        }
                    }
                }
                else {
                    // Error - Check if MSAL returned an error or simply no code
                    const errorCode: string = typeof request.query?.error === "string" ? request.query?.error : "Unspecified error";
                    const errorDescription: string = typeof request.query?.error_description === "string" ? request.query?.error_description : "Redirect by getAuthCodeUrl() failed";
                    const error: Error = new Error(`${errorCode} - ${errorDescription}`);

                    // Inform the caller of the failure and the user via the browser by returning HTML
                    authenticationResultPromiseCompletionSource.reject(error);
                    response.status(200).send(this.formatErrorHtml(error));
                }
            });

    
            // Trigger the authentication flow: Open the default browser, point it to '/'. This starts the Azure AD Authorization Code flow
            let server: Server | null = null;
            let browserProcess: ChildProcess | null = null;

            try {
                // Listen for requests
                server = app.listen(AuthorizationCodeFlow.Port, () => console.log(`Listening on port ${AuthorizationCodeFlow.Port}`));

                // Open the user's default web browser and navigate it to the redirect uri (aka '/' handler above)
                browserProcess = await open.default(AuthorizationCodeFlow.BaseUri);

                // Wait for browser interaction to complete
                authenticationResult = await authenticationResultPromiseCompletionSource.promise;
            }
            finally {
                if (server) {
                    server.close();
                }
            }
        }

        return authenticationResult;
    }

    private formatErrorHtml(error: Error): string {
        return FailedHtml.replace("{{error}}", error.message);
    }
}