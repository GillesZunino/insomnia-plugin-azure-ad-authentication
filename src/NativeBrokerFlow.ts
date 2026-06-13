// -----------------------------------------------------------------------------------
// Copyright 2025, Gilles Zunino
// -----------------------------------------------------------------------------------

import os from "os";

import * as msal from "@azure/msal-node";
import { executePowerShell } from 'powershell-utils';

import EntraIdClientApplication from "./EntraIdClientApplication";
import getWindowHandleByProcessId from "./GetWindowHandleByProcessId.ps1";


export default class NativeBrowkerFlow {
    private publicClientApplication: EntraIdClientApplication;

    public constructor(publicClientApplication: EntraIdClientApplication) {
        this.publicClientApplication = publicClientApplication;
    }

    public async authenticateInteractive(scopes: string[]): Promise<msal.AuthenticationResult | null> {
        let authenticationResult: msal.AuthenticationResult | null = null;
        if (this.publicClientApplication.instance !== null) {
            const interactiveRequest: msal.InteractiveRequest = {
                scopes: scopes,
                prompt: "select_account",

                windowHandle: await this.getNativeWindowHandleAsync(),

                openBrowser: (url: string) : Promise<void> => {
                    return new Promise<void>((resolve, reject) => {
                        resolve();
                    });

                }
            };
            
            // NOTE: The Windows Broker uses return URIs in the form of ms-appx-web://Microsoft.AAD.BrokerPlugin/<client id>
            const publicClientApplication: msal.PublicClientApplication = this.publicClientApplication.instance as msal.PublicClientApplication;
            authenticationResult = await publicClientApplication.acquireTokenInteractive(interactiveRequest);
        }

        return authenticationResult;
    }

    private async getNativeWindowHandleAsync(): Promise<Buffer<ArrayBufferLike>> {
        let hwndBigInt: bigint = 0n;
        const pwshCommand = getWindowHandleByProcessId.replace("__the_pid__", process.ppid.toString());
        try {
            const { stdout, stderr } = await executePowerShell(pwshCommand);
            hwndBigInt = BigInt(stdout.trim());
        } catch (error) {
            hwndBigInt = 0n;
        }

        const is64bit = os.arch() === "x64";
        const hwndBuffer: Buffer<ArrayBufferLike> = is64bit ? Buffer.alloc(8) : Buffer.alloc(4);
        if (is64bit) {
            hwndBuffer.writeBigInt64LE(hwndBigInt, 0);
        } else {
            hwndBuffer.writeInt32LE(Number(hwndBigInt), 0);
        }

        return hwndBuffer;
    }
}