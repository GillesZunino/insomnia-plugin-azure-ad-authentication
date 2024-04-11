// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

import { URL } from "url";
import { Server } from "http";
import { ChildProcess } from "child_process";
import * as express from "express";
import * as open from "open";
import * as msal from "@azure/msal-node";

import HttpTerminator from "./HttpTerminator/HttpTerminator";
import { SuccessHtml } from "./AuthSuccessHtml"
import { FailedHtml } from "./AuthFailureHtml"

import PromiseCompletionSource from "./PromiseUtilities/PromiseCompletionSource";
import { getAuthenticationErrorMessageFromException } from "./EntraIdUtilities";
import EntraIdClientApplication from "./EntraIdClientApplication";

export default class AuthorizationCodeFlow {
    private publicClientApplication: EntraIdClientApplication;

    public constructor(publicClientApplication: EntraIdClientApplication) {
        this.publicClientApplication = publicClientApplication;
    }

    public async authenticateInteractive(scopes: string[], redirectUri: string): Promise<msal.AuthenticationResult | null> {
        let authenticationResult: msal.AuthenticationResult | null = null;

        if (this.publicClientApplication.instance !== null) {
            const authenticationResultPromiseCompletionSource: PromiseCompletionSource<msal.AuthenticationResult | null> = new PromiseCompletionSource();

            // Create PKCE verifier and challenge
            const cryptoProvider: msal.CryptoProvider = new msal.CryptoProvider();
            const { verifier: pkceVerifier, challenge: pkceChallenge } = await cryptoProvider.generatePkceCodes();

            // Retrieve the Authentication url - This is where the systen browser will be navigated to
            const authCodeUrlParameters:msal.AuthorizationUrlRequest = {
                scopes: scopes,
                redirectUri: redirectUri,
                codeChallenge: pkceChallenge,
                codeChallengeMethod: "S256",
                responseMode: msal.ResponseMode.QUERY,
                prompt: "select_account"
            };
            const authCodeUrl: string = await this.publicClientApplication.instance.getAuthCodeUrl(authCodeUrlParameters);

            // Derive protocol, redirect path, base uri and port from the redirect uri given
            const parsedRedirectUri: URL = new URL(redirectUri);
            const redirectProtocol: string = parsedRedirectUri.protocol;
            const redirectPath: string = `${parsedRedirectUri.pathname}`;

            // Parse port and default to 80 or 443 if not provided
            let redirectPort: number = parseInt(parsedRedirectUri.port);
            if (isNaN(redirectPort)) {
                switch (redirectProtocol) {
                    case "http:":
                        redirectPort = 80;
                        break;
                    case "https:":
                        redirectPort = 443;
                        break;
                    default:
                        throw new Error(`Unsupported protocol: ${redirectProtocol}`);
                }
            }

            // Bind a web server to the given IP:Port and path sow e can retrieve the Entra ID result url
            const app: express.Application = express.default();

            app.get(redirectPath, async (request, response) => {
                if (typeof request.query?.code === "string") {
                    // MSAL returned a code which we can redeem for a token
                    const code: string | null = request.query?.code as string;
                    const tokenRequest: msal.AuthorizationCodeRequest = {
                        code: code,
                        codeVerifier: pkceVerifier,
                        scopes: scopes,
                        redirectUri: redirectUri
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


            // Trigger the authentication flow: Open the system browser and navigate it to the authentcation url
            let server: Server | null = null;
            let httpConnectionsTerminator: HttpTerminator | null = null;
            let browserProcess: ChildProcess | null = null;

           try {
                // Listen for requests so we can capture the result of the Entra ID authentication flow
                server = app.listen(redirectPort, () => console.log(`Listening on port ${redirectPort}`));
                httpConnectionsTerminator = new HttpTerminator(server, { gracefulTerminationTimeout: 1000 });

                // Open the system web browser and navigate it to the Entra ID authentication url
                browserProcess = await open.default(authCodeUrl);

                // Wait for browser interaction to complete
                authenticationResult = await authenticationResultPromiseCompletionSource.promise;
            }
            finally {
                if (httpConnectionsTerminator) {
                    // Force the Http server to stop listening for connection and close all currently established ones
                    await httpConnectionsTerminator.terminateAsync();
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