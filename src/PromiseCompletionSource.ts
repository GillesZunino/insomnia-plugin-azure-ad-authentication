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

        if (this.internalPromise.finally) {
            this.internalPromise.finally.bind(this.internalPromise);
        }
    }

    public resolve(value: T | PromiseLike<T>): void {
        this.internalResolve(value);
    }

    public reject(reason?: any): void {
        this.internalReject(reason);
    }

    public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
        return this.internalPromise.then(onfulfilled);
    }

    public catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
        return this.internalPromise.catch(onrejected);
    }
}