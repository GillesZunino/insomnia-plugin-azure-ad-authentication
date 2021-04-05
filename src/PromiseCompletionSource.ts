// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// -----------------------------------------------------------------------------------

export class PromiseCompletionSource<T> {
    private internalPromise: Promise<T>;
    private internalResolve: (value: T | PromiseLike<T>) => void;
    private internalReject: (reason?: any) => void;

    public get promise(): Promise<T> { return this.internalPromise; }

    public constructor() {
        this.internalPromise = new Promise((resolve, reject) => {
            this.internalResolve = resolve;
            this.internalReject = reject;
        });
    }

    public resolve(value: T | PromiseLike<T>): void {
        this.internalResolve(value);
    }

    public reject(reason?: any): void {
        this.internalReject(reason);
    }
}