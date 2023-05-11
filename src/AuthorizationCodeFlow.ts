// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { URL } from "url";
import { Server } from "http";
import { ChildProcess } from "child_process";
import * as express from "express";
import { createHttpTerminator, HttpTerminator } from "http-terminator";
import * as open from "open";
import * as msal from "@azure/msal-node";

import { SuccessHtml } from "./AuthSuccessHtml"
import { FailedHtml } from "./AuthFailureHtml"

import { PromiseCompletionSource } from "./PromiseCompletionSource";
import { getAuthenticationErrorMessageFromException } from "./AzureADUtilities";
import AzureADClientApplication from "./AzureADClientApplication";

export default class AuthorizationCodeFlow {
    private publicClientApplication: AzureADClientApplication;

    public constructor(publicClientApplication: AzureADClientApplication) {
        this.publicClientApplication = publicClientApplication;
    }

    public async authenticateInteractive(scopes: string[], redirectUri: string): Promise<msal.AuthenticationResult | null> {
        // Derive port, redirect path and base uri from the redirect uri given
        const parsedRedirectUri: URL = new URL(redirectUri);
        const redirectPort: number = parseInt(parsedRedirectUri.port);
        const redirectPath: string = `${parsedRedirectUri.pathname}`;
        const redirectBaseUri: string = `${parsedRedirectUri.protocol}//${parsedRedirectUri.host}`;

        let authenticationResult: msal.AuthenticationResult | null = null;

        if (this.publicClientApplication.instance !== null) {
            const authenticationResultPromiseCompletionSource: PromiseCompletionSource<msal.AuthenticationResult | null> = new PromiseCompletionSource();

            const app: express.Application = express.default();

            app.get("/", async (request, response) => {
                // Get url to sign user in and consent to scopes needed for application
                if (this.publicClientApplication.instance !== null) {
                    const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
                        scopes: scopes,
                        redirectUri: redirectUri,
                        responseMode: msal.ResponseMode.QUERY,
                        prompt: "select_account"
                    };

                    try {
                        const authRedirectUri: string = await this.publicClientApplication.instance.getAuthCodeUrl(authCodeUrlParameters);
                        response.redirect(authRedirectUri);
                    }
                    catch (e: unknown) {
                        response.status(200).send(this.formatErrorHtml(getAuthenticationErrorMessageFromException(e))).end();
                        authenticationResultPromiseCompletionSource.reject(e);
                    }
                } else {
                    const message: string = "Azure AD Public Client Application was not initialized properly";
                    const error: Error = new Error(message);
                    response.status(200).send(this.formatErrorHtml(message)).end();
                    authenticationResultPromiseCompletionSource.reject(error);
                }
            });

            app.get(redirectPath, async (request, response) => {
                if (typeof request.query?.code === "string") {
                    // MSAL returned a code which we can redeem for a token
                    const code: string | null = request.query?.code as string;
                    const tokenRequest: msal.AuthorizationCodeRequest = {
                        code: code,
                        scopes: scopes,
                        redirectUri: redirectUri,
                    };

                    // Redeem the code for an authentication result
                    if (this.publicClientApplication.instance !== null) {
                        try {
                            // Retrieve results - This may fail so we do not yet send a response to the client
                            const authenticationResult: msal.AuthenticationResult | null = await this.publicClientApplication.instance.acquireTokenByCode(tokenRequest);
                            response.status(200).send(SuccessHtml).end();

                            authenticationResultPromiseCompletionSource.resolve(authenticationResult);
                        }
                        catch (e: unknown) {
                            response.status(200).send(this.formatErrorHtml(getAuthenticationErrorMessageFromException(e))).end();
                            authenticationResultPromiseCompletionSource.reject(e);
                        }
                    }
                }
                else {
                    // Error - Check if MSAL returned an error or simply no code
                    const errorCode: string = typeof request.query?.error === "string" ? request.query?.error : "Unspecified error";
                    const errorDescription: string = typeof request.query?.error_description === "string" ? request.query?.error_description : "Redirect by getAuthCodeUrl() failed";
                    const message: string = `${errorCode} - ${errorDescription}`;
                    const error: Error = new Error(message);

                    // Inform the caller of the failure and the user via the browser by returning HTML
                    response.status(200).send(this.formatErrorHtml(message)).end();
                    authenticationResultPromiseCompletionSource.reject(error);
                }
            });


            // Trigger the authentication flow: Open the default browser, point it to '/'. This starts the Azure AD Authorization Code flow
            let server: Server | null = null;
            let httpConnectionsTerminator: HttpTerminator | null = null;
            let browserProcess: ChildProcess | null = null;

            try {
                // Listen for requests
                server = app.listen(redirectPort, () => console.log(`Listening on port ${redirectPort}`));
                httpConnectionsTerminator = createHttpTerminator({ server: server, gracefulTerminationTimeout: 1000 });

                // Open the user's default web browser and navigate it to the redirect uri (aka '/' handler above)
                browserProcess = await open.default(redirectBaseUri);

                // Wait for browser interaction to complete
                authenticationResult = await authenticationResultPromiseCompletionSource.promise;
            }
            finally {
                if (httpConnectionsTerminator) {
                    // Force the Http server to stop listening for connection and close all currently established ones
                    await httpConnectionsTerminator.terminate();
                    httpConnectionsTerminator = null;
                    server = null;
                }
            }
        }

        return authenticationResult;
    }

    private formatErrorHtml(message: string): string {
        return FailedHtml.replace("{{error}}", message);
    }
}