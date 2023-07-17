// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

import { Socket } from "net";
import { TLSSocket } from "tls";

import type { Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import type { Server as HttpsServer } from "https";

import PromiseCompletionSource from "../PromiseUtilities/PromiseCompletionSource";
import Until from "../PromiseUtilities/Until";

import HttpTerminatorOptions from "./HttpTerminatorOptions";
import PromiseWaitTimeoutError from "../PromiseUtilities/PromiseWaitTimeoutError";

export default class HttpTerminator {
    private readonly options: HttpTerminatorOptions;
    private readonly server: HttpServer | HttpsServer;

    private sockets: Set<Socket | TLSSocket>;
    private requests: Set<ServerResponse<IncomingMessage>>;

    private terminating: boolean;
    private terminatingPromiseCompletionSource: PromiseCompletionSource<void>;

    private onConnectionEventHandler: (socket: Socket | TLSSocket) => void;
    private onRequestEventHandler: (incomingMessage: IncomingMessage, serverResponse: ServerResponse<IncomingMessage>) => void;

    public constructor(server: HttpServer | HttpsServer, options: HttpTerminatorOptions) {
        this.server = server;
        this.options = options;

        this.sockets = new Set<Socket | TLSSocket>();
        this.requests = new Set<ServerResponse<IncomingMessage>>();

        this.terminating = false;
        this.terminatingPromiseCompletionSource = new PromiseCompletionSource<void>();

        this.onConnectionEventHandler = (socket: Socket | TLSSocket): void => this.onConnection(socket);
        this.onRequestEventHandler = (incomingMessage: IncomingMessage, serverResponse: ServerResponse<IncomingMessage>): void => this.onRequest(incomingMessage, serverResponse);
       
        this.attachConnectionEvents();
        this.attachRequestEvents();
    }

    public async terminateAsync(): Promise<void> {
        if (!this.terminating) {
            this.terminating = true;

            // Send 'Connection-Close' and end all standing requests
            for (const serverResponse of this.requests) {
                this.closeConnection(serverResponse);
            }

            // Wait for all sockets to close with a maximum timeout
            try {
                await Until(() => this.sockets.size === 0, { timeout: this.options.gracefulTerminationTimeout });
            }
            catch (ex: unknown) {
                if (!(ex instanceof PromiseWaitTimeoutError)) {
                    console.warn(ex);
                }
            }
            finally {
                // Destroy all leftover sockets
                for (const socket of this.sockets) {
                    this.destroySocket(socket);
                }
            }

            // Shutdown the server
            this.server.close((err?: Error | undefined): void => {
                if (err) {
                    this.terminatingPromiseCompletionSource.reject();
                } else {
                    this.terminatingPromiseCompletionSource.resolve();
                }
            });
        }

        try {
            await this.terminatingPromiseCompletionSource.promise;
        }
        finally {
            this.detachConnectionEvents();
            this.detachRequestEvents();
        }
    }

    private attachConnectionEvents(): void {
        this.server.on("connection", this.onConnectionEventHandler);
        this.server.on("secureConnection", this.onConnectionEventHandler);
    }

    private detachConnectionEvents(): void {
        this.server.off("connection", this.onConnectionEventHandler);
        this.server.off("secureConnection", this.onConnectionEventHandler);
    }

    private attachRequestEvents(): void {
        this.server.on("request", this.onRequestEventHandler);
    }

    private detachRequestEvents(): void {
        this.server.off("request", this.onRequestEventHandler);
    }

    private onConnection(socket: Socket | TLSSocket): void {
        if (this.terminating) {
            socket.destroy();
        } else {
            this.sockets.add(socket);
            socket.once("close", (hadError: boolean) => { this.sockets.delete(socket); });
        }
    }

    private onRequest(incomingMessage: IncomingMessage, serverResponse: ServerResponse<IncomingMessage>): void {
        if (this.terminating) {
            this.closeConnection(serverResponse);
        } else {
            this.requests.add(serverResponse);
            serverResponse.once("close", (closedServerResponse: ServerResponse<IncomingMessage>) => { this.requests.delete(closedServerResponse); });
        }
    }

    private closeConnection(serverResponse: ServerResponse<IncomingMessage>): void {
        if (!serverResponse.headersSent) {
            serverResponse.setHeader("connection", "close");
        }
        serverResponse.end();
    }

    private destroySocket(socket: Socket | TLSSocket): void {
        socket.destroy();
        this.sockets.delete(socket);
    }
}