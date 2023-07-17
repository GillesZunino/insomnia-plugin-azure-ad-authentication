// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

import CancellationToken from "./CancellationToken";

export default class CancellationTokenSource {
    private isCancelled: boolean;
    private cancellationToken: CancellationToken;

    public constructor() {
        const self: CancellationTokenSource = this;
        this.cancellationToken = {
            get isCancellationRequested(): boolean {
                return self.isCancelled;
            }
        };
    }

    public get token(): CancellationToken {
        return this.cancellationToken;
    }

    public cancel(): void {
        this.isCancelled = true;
    }
}