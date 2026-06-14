// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

// This is a TypeScript port of "NativeBrokerPlugin" from "@azure/msal-node-extensions" (v5.2.4, MIT License, Copyright (c) Microsoft Corporation).
//
// "@azure/msal-node-extensions" unconditionally depends on "keytar" (used only by its cache persistence plugins, which this project does not use).
// "keytar" is no longer maintained and its native module fails to build when Insomnia installs this plugin, which prevents installation entirely.
//
// "NativeBrokerPlugin" itself has no dependency on "keytar" - It only depends on "@azure/msal-node-runtime" (which ships prebuilt native binaries and has no
// build step) and on "@azure/msal-common" (already a dependency of this project via "@azure/msal-node"). Vendoring this single class lets us drop
// "@azure/msal-node-extensions" - and therefore "keytar" - entirely.

import {
    AccountInfo, AuthenticationResult, AuthError, ClientAuthErrorCodes, ClientConfigurationErrorCodes,
    createClientAuthError, createClientConfigurationError, INativeBrokerPlugin, InteractionRequiredAuthError,
    Logger, LoggerOptions, NativeRequest, NativeSignOutRequest, PlatformBrokerError, ServerError, ServerTelemetryManager
} from "@azure/msal-common/node";

import {
    Account as NativeAccount, AuthResult as NativeAuthResult, AuthParameters, DiscoverAccountsResult, ErrorStatus,
    LogLevel as NativeLogLevel, msalNodeRuntime, ReadAccountResult, SignOutResult
} from "@azure/msal-node-runtime";


// Package name/version used for logging and telemetry - Mirrors the values used by "@azure/msal-node-extensions" v5.2.4
const PACKAGE_NAME: string = "@azure/msal-node-extensions";
const PACKAGE_VERSION: string = "5.2.4";

const ErrorCodes = {
    INTERATION_REQUIRED_ERROR_CODE: "interaction_required",
    SERVER_UNAVAILABLE: "server_unavailable"
};

// "PromptValue" and "AuthenticationScheme" are internal "@azure/msal-common" constants not part of its public API surface
const PromptValue = {
    LOGIN: "login",
    SELECT_ACCOUNT: "select_account",
    NONE: "none",
    CREATE: "create"
};

const AuthenticationScheme = {
    BEARER: "Bearer",
    POP: "pop"
};

// "RESOURCE" and "X_CLIENT_EXTRA_SKU" are internal "@azure/msal-common" AAD server parameter keys not part of its public API surface
const RESOURCE: string = "resource";
const X_CLIENT_EXTRA_SKU: string = "x-client-xtra-sku";

// Mirrors "toDateFromSeconds" from "@azure/msal-common"'s internal "TimeUtils"
function toDateFromSeconds(seconds: number): Date {
    return seconds ? new Date(Number(seconds) * 1000) : new Date();
}

type MsalRuntimeError = {
    errorCode: number;
    errorStatus: number;
    errorContext: string;
    errorTag: number;
};


export default class NativeBrokerPlugin implements INativeBrokerPlugin {
    private logger: Logger;

    public isBrokerAvailable: boolean;

    public constructor() {
        const defaultLoggerOptions: LoggerOptions = {
            loggerCallback: () => {},
            piiLoggingEnabled: false
        };
        this.logger = new Logger(defaultLoggerOptions, PACKAGE_NAME, PACKAGE_VERSION);
        this.isBrokerAvailable = msalNodeRuntime.StartupError ? false : true;
    }

    public setLogger(loggerOptions: LoggerOptions): void {
        this.logger = new Logger(loggerOptions, PACKAGE_NAME, PACKAGE_VERSION);

        const logCallback = (message: string, logLevel: NativeLogLevel, containsPii: boolean, correlationId: string = ""): void => {
            switch (logLevel) {
                case NativeLogLevel.Trace:
                case NativeLogLevel.Debug:
                    containsPii ? this.logger.tracePii(message, correlationId) : this.logger.trace(message, correlationId);
                    break;
                case NativeLogLevel.Info:
                    containsPii ? this.logger.infoPii(message, correlationId) : this.logger.info(message, correlationId);
                    break;
                case NativeLogLevel.Warning:
                    containsPii ? this.logger.warningPii(message, correlationId) : this.logger.warning(message, correlationId);
                    break;
                case NativeLogLevel.Error:
                case NativeLogLevel.Fatal:
                    containsPii ? this.logger.errorPii(message, correlationId) : this.logger.error(message, correlationId);
                    break;
                default:
                    containsPii ? this.logger.infoPii(message, correlationId) : this.logger.info(message, correlationId);
                    break;
            }
        };

        try {
            msalNodeRuntime.RegisterLogger(logCallback, loggerOptions.piiLoggingEnabled || false);
        } catch (e: unknown) {
            const wrappedError: AuthError | null = this.wrapError(e);
            if (wrappedError) {
                throw wrappedError;
            }
        }
    }

    public async getAccountById(accountId: string, correlationId: string): Promise<AccountInfo> {
        this.logger.trace("NativeBrokerPlugin - getAccountById called", correlationId);
        const readAccountResult: ReadAccountResult = await this.readAccountById(accountId, correlationId);
        return this.generateAccountInfo(readAccountResult.account);
    }

    public async getAllAccounts(clientId: string, correlationId: string): Promise<AccountInfo[]> {
        this.logger.trace("NativeBrokerPlugin - getAllAccounts called", correlationId);
        return new Promise<AccountInfo[]>((resolve, reject) => {
            const resultCallback = (result: DiscoverAccountsResult): void => {
                try {
                    result.CheckError();
                } catch (e: unknown) {
                    const wrappedError: AuthError | null = this.wrapError(e);
                    if (wrappedError) {
                        reject(wrappedError);
                        return;
                    }
                }

                resolve(result.accounts.map((account: NativeAccount) => this.generateAccountInfo(account)));
            };

            try {
                msalNodeRuntime.DiscoverAccountsAsync(clientId, correlationId, resultCallback);
            } catch (e: unknown) {
                const wrappedError: AuthError | null = this.wrapError(e);
                if (wrappedError) {
                    reject(wrappedError);
                }
            }
        });
    }

    public async acquireTokenSilent(request: NativeRequest): Promise<AuthenticationResult> {
        this.logger.trace("NativeBrokerPlugin - acquireTokenSilent called", request.correlationId);

        if (!request.redirectUri) {
            request.redirectUri = this.chooseRedirectUriByPlatform(request);
            this.logger.info("NativeBrokerPlugin - No Redirect URI provided, using default", request.correlationId);
        }

        const authParams: AuthParameters = this.generateRequestParameters(request);
        const account: NativeAccount | null = await this.getAccount(request);

        return new Promise<AuthenticationResult>((resolve, reject) => {
            const resultCallback = (result: NativeAuthResult): void => {
                try {
                    result.CheckError();
                } catch (e: unknown) {
                    const wrappedError: AuthError | null = this.wrapError(e);
                    if (wrappedError) {
                        reject(wrappedError);
                        return;
                    }
                }

                resolve(this.getAuthenticationResult(request, result));
            };

            try {
                if (account) {
                    msalNodeRuntime.AcquireTokenSilentlyAsync(authParams, request.correlationId, account, resultCallback);
                } else {
                    msalNodeRuntime.SignInSilentlyAsync(authParams, request.correlationId, resultCallback);
                }
            } catch (e: unknown) {
                const wrappedError: AuthError | null = this.wrapError(e);
                if (wrappedError) {
                    reject(wrappedError);
                }
            }
        });
    }

    public async acquireTokenInteractive(request: NativeRequest, providedWindowHandle?: Buffer): Promise<AuthenticationResult> {
        this.logger.trace("NativeBrokerPlugin - acquireTokenInteractive called", request.correlationId);

        if (!request.redirectUri) {
            request.redirectUri = this.chooseRedirectUriByPlatform(request);
            this.logger.info("NativeBrokerPlugin - No Redirect URI provided, using default", request.correlationId);
        }

        const authParams: AuthParameters = this.generateRequestParameters(request);
        const account: NativeAccount | null = await this.getAccount(request);
        const windowHandle: Buffer = providedWindowHandle || Buffer.from([0]);

        return new Promise<AuthenticationResult>((resolve, reject) => {
            const resultCallback = (result: NativeAuthResult): void => {
                try {
                    result.CheckError();
                } catch (e: unknown) {
                    const wrappedError: AuthError | null = this.wrapError(e);
                    if (wrappedError) {
                        reject(wrappedError);
                        return;
                    }
                }

                resolve(this.getAuthenticationResult(request, result));
            };

            try {
                switch (request.prompt) {
                    case PromptValue.LOGIN:
                    case PromptValue.SELECT_ACCOUNT:
                    case PromptValue.CREATE: {
                        this.logger.info("Calling native interop SignInInteractively API", request.correlationId);
                        const loginHint: string = request.loginHint || "";
                        msalNodeRuntime.SignInInteractivelyAsync(windowHandle, authParams, request.correlationId, loginHint, resultCallback);
                        break;
                    }
                    case PromptValue.NONE:
                        if (account) {
                            this.logger.info("Calling native interop AcquireTokenSilently API", request.correlationId);
                            msalNodeRuntime.AcquireTokenSilentlyAsync(authParams, request.correlationId, account, resultCallback);
                        } else {
                            this.logger.info("Calling native interop SignInSilently API", request.correlationId);
                            msalNodeRuntime.SignInSilentlyAsync(authParams, request.correlationId, resultCallback);
                        }
                        break;
                    default:
                        if (account) {
                            this.logger.info("Calling native interop AcquireTokenInteractively API", request.correlationId);
                            msalNodeRuntime.AcquireTokenInteractivelyAsync(windowHandle, authParams, request.correlationId, account, resultCallback);
                        } else {
                            this.logger.info("Calling native interop SignIn API", request.correlationId);
                            const loginHint: string = request.loginHint || "";
                            msalNodeRuntime.SignInAsync(windowHandle, authParams, request.correlationId, loginHint, resultCallback);
                        }
                        break;
                }
            } catch (e: unknown) {
                const wrappedError: AuthError | null = this.wrapError(e);
                if (wrappedError) {
                    reject(wrappedError);
                }
            }
        });
    }

    public async signOut(request: NativeSignOutRequest): Promise<void> {
        this.logger.trace("NativeBrokerPlugin - signOut called", request.correlationId);

        const account: NativeAccount | null = await this.getAccount(request);
        if (!account) {
            throw createClientAuthError(ClientAuthErrorCodes.noAccountFound);
        }

        return new Promise<void>((resolve, reject) => {
            const resultCallback = (result: SignOutResult): void => {
                try {
                    result.CheckError();
                } catch (e: unknown) {
                    const wrappedError: AuthError | null = this.wrapError(e);
                    if (wrappedError) {
                        reject(wrappedError);
                        return;
                    }
                }

                resolve();
            };

            try {
                msalNodeRuntime.SignOutSilentlyAsync(request.clientId, request.correlationId, account, resultCallback);
            } catch (e: unknown) {
                const wrappedError: AuthError | null = this.wrapError(e);
                if (wrappedError) {
                    reject(wrappedError);
                }
            }
        });
    }

    private async getAccount(request: NativeRequest | NativeSignOutRequest): Promise<NativeAccount | null> {
        if (request.accountId) {
            const readAccountResult: ReadAccountResult = await this.readAccountById(request.accountId, request.correlationId);
            return readAccountResult.account;
        }
        return null;
    }

    private async readAccountById(accountId: string, correlationId: string): Promise<ReadAccountResult> {
        this.logger.trace("NativeBrokerPlugin - readAccountById called", correlationId);
        return new Promise<ReadAccountResult>((resolve, reject) => {
            const resultCallback = (result: ReadAccountResult): void => {
                try {
                    result.CheckError();
                } catch (e: unknown) {
                    const wrappedError: AuthError | null = this.wrapError(e);
                    if (wrappedError) {
                        reject(wrappedError);
                        return;
                    }
                }

                resolve(result);
            };

            try {
                msalNodeRuntime.ReadAccountByIdAsync(accountId, correlationId, resultCallback);
            } catch (e: unknown) {
                const wrappedError: AuthError | null = this.wrapError(e);
                if (wrappedError) {
                    reject(wrappedError);
                }
            }
        });
    }

    private generateRequestParameters(request: NativeRequest): AuthParameters {
        this.logger.trace("NativeBrokerPlugin - generateRequestParameters called", request.correlationId);

        const authParams: AuthParameters = new msalNodeRuntime.AuthParameters();
        try {
            authParams.CreateAuthParameters(request.clientId, request.authority);
            authParams.SetRedirectUri(request.redirectUri);
            authParams.SetRequestedScopes(request.scopes.join(" "));

            if (request.claims) {
                authParams.SetDecodedClaims(request.claims);
            }

            if (request.authenticationScheme === AuthenticationScheme.POP) {
                if (!request.resourceRequestMethod || !request.resourceRequestUri) {
                    throw new Error("Authentication Scheme set to POP but one or more of the following parameters are missing: resourceRequestMethod, resourceRequestUri");
                }

                const resourceUrl: URL = new URL(request.resourceRequestUri);
                authParams.SetPopParams(request.resourceRequestMethod, resourceUrl.host, resourceUrl.pathname, request.shrNonce || "");
            }

            if (request.resource) {
                authParams.SetAdditionalParameter(RESOURCE, request.resource);
            }

            if (request.extraParameters) {
                Object.entries(request.extraParameters).forEach(([key, value]) => {
                    authParams.SetAdditionalParameter(key, value);
                });
            }

            const skus: string = (request.extraParameters?.[X_CLIENT_EXTRA_SKU]?.length ? request.extraParameters[X_CLIENT_EXTRA_SKU] : "") as string;
            authParams.SetAdditionalParameter(X_CLIENT_EXTRA_SKU, ServerTelemetryManager.makeExtraSkuString({
                skus: skus,
                extensionName: "msal.node.ext",
                extensionVersion: PACKAGE_VERSION
            }));
        } catch (e: unknown) {
            const wrappedError: AuthError | null = this.wrapError(e);
            if (wrappedError) {
                throw wrappedError;
            }
        }

        return authParams;
    }

    private chooseRedirectUriByPlatform(request: NativeRequest): string {
        this.logger.trace("NativeBrokerPlugin - chooseRedirectUriByPlatform called", request.correlationId);
        switch (process.platform) {
            case "darwin":
                return "msauth.com.msauth.unsignedapp://auth";
            case "win32":
                return `ms-appx-web://Microsoft.AAD.BrokerPlugin/${request.clientId}`;
            default:
                return "https://login.microsoftonline.com/common/oauth2/nativeclient";
        }
    }

    private getAuthenticationResult(request: NativeRequest, authResult: NativeAuthResult): AuthenticationResult {
        this.logger.trace("NativeBrokerPlugin - getAuthenticationResult called", request.correlationId);

        let fromCache: boolean = false;
        try {
            const telemetryJSON: any = JSON.parse(authResult.telemetryData);
            fromCache = !!telemetryJSON["is_cache"];
        } catch (e: unknown) {
            this.logger.error("NativeBrokerPlugin: getAuthenticationResult - Error parsing telemetry data. Could not determine if response came from cache.", request.correlationId);
        }

        let idTokenClaims: any;
        try {
            idTokenClaims = JSON.parse(authResult.idToken);
        } catch (e: unknown) {
            throw new Error("Unable to parse idToken claims");
        }

        const accountInfo: AccountInfo = this.generateAccountInfo(authResult.account, idTokenClaims);

        let accessToken: string;
        let tokenType: string;
        if (authResult.isPopAuthorization) {
            // Header includes 'pop ' prefix
            accessToken = authResult.authorizationHeader.split(" ")[1];
            tokenType = AuthenticationScheme.POP;
        } else {
            accessToken = authResult.accessToken;
            tokenType = AuthenticationScheme.BEARER;
        }

        return {
            authority: request.authority,
            uniqueId: idTokenClaims.oid || idTokenClaims.sub || "",
            tenantId: idTokenClaims.tid || "",
            scopes: authResult.grantedScopes.split(" "),
            account: accountInfo,
            idToken: authResult.rawIdToken,
            idTokenClaims: idTokenClaims,
            accessToken: accessToken,
            fromCache: fromCache,
            // MsalRuntime expiresOn returned in seconds, converting to Date for AuthenticationResult
            expiresOn: toDateFromSeconds(authResult.expiresOn),
            tokenType: tokenType,
            correlationId: request.correlationId,
            fromPlatformBroker: true,
            ...(request.resource && { resource: request.resource })
        } as AuthenticationResult;
    }

    private generateAccountInfo(account: NativeAccount, idTokenClaims?: any): AccountInfo {
        this.logger.trace("NativeBrokerPlugin - generateAccountInfo called", "");
        return {
            homeAccountId: account.homeAccountId,
            environment: account.environment,
            tenantId: account.realm,
            username: account.username,
            localAccountId: account.localAccountId,
            name: account.displayName,
            idTokenClaims: idTokenClaims,
            nativeAccountId: account.accountId
        };
    }

    private isMsalRuntimeError(result: unknown): result is MsalRuntimeError {
        return typeof result === "object" && result !== null &&
            ("errorCode" in result || "errorStatus" in result || "errorContext" in result || "errorTag" in result);
    }

    private wrapError(error: unknown): AuthError | null {
        if (error && typeof error === "object" && this.isMsalRuntimeError(error)) {
            const { errorCode, errorStatus, errorContext, errorTag } = error;
            const msalNodeRuntimeError: PlatformBrokerError = new PlatformBrokerError(ErrorStatus[errorStatus], errorContext, errorCode, errorTag);

            let wrappedError: AuthError;
            switch (errorStatus) {
                case ErrorStatus.InteractionRequired:
                case ErrorStatus.AccountUnusable:
                    wrappedError = new InteractionRequiredAuthError(ErrorCodes.INTERATION_REQUIRED_ERROR_CODE, msalNodeRuntimeError.message);
                    break;
                case ErrorStatus.NoNetwork:
                case ErrorStatus.NetworkTemporarilyUnavailable:
                    wrappedError = createClientAuthError(ClientAuthErrorCodes.noNetworkConnectivity);
                    break;
                case ErrorStatus.ServerTemporarilyUnavailable:
                    wrappedError = new ServerError(ErrorCodes.SERVER_UNAVAILABLE, msalNodeRuntimeError.message);
                    break;
                case ErrorStatus.UserCanceled:
                    wrappedError = createClientAuthError(ClientAuthErrorCodes.userCanceled);
                    break;
                case ErrorStatus.AuthorityUntrusted:
                    wrappedError = createClientConfigurationError(ClientConfigurationErrorCodes.untrustedAuthority);
                    break;
                case ErrorStatus.UserSwitched:
                    // Not an error case, if there's customer demand we can surface this as a response property
                    return null;
                case ErrorStatus.AccountNotFound:
                    wrappedError = createClientAuthError(ClientAuthErrorCodes.noAccountFound);
                    break;
                default:
                    wrappedError = createClientAuthError(ClientAuthErrorCodes.platformBrokerError);
            }

            (wrappedError as any).platformBrokerError = msalNodeRuntimeError;
            return wrappedError;
        }

        throw error;
    }
}
