// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

import PromiseWaitTimeoutError from "./PromiseWaitTimeoutError";
import PromiseCompletionSource from "./PromiseCompletionSource";
import CancellationToken from "./CancellationToken";
import CancellationTokenSource from "./CancellationTokenSource";
import UntilOptions from "./UntilOptions";


class UntilPollingImplementation {
    private options: UntilOptions;
    private conditionCheckPromiseCompletionSource: PromiseCompletionSource<void>;

    public constructor(options: UntilOptions) {
        this.options = options;
        this.conditionCheckPromiseCompletionSource = new PromiseCompletionSource<void>();
    }

    public pollAsync(condition: () => boolean, cancellationToken: CancellationToken): Promise<void> {
        if (this.checkConditionWithCancellation(condition, cancellationToken)) {
            return this.conditionCheckPromiseCompletionSource.promise;
        }

        this.pollCheckConditionWithCancellation(condition, cancellationToken);
        return this.conditionCheckPromiseCompletionSource.promise;
    }

    private pollCheckConditionWithCancellation(condition: () => boolean, cancellationToken: CancellationToken): void {
        setTimeout(() => {
            if (!this.checkConditionWithCancellation(condition, cancellationToken)) {
                setTimeout(() => this.pollCheckConditionWithCancellation(condition, cancellationToken), this.options.interval);
            }
        }, this.options.interval);
    }

    private checkConditionWithCancellation(condition: () => boolean, cancellationToken: CancellationToken): boolean {
        if (cancellationToken.isCancellationRequested) {
            this.conditionCheckPromiseCompletionSource.reject();
            return true;
        } else {
            if (this.checkCondition(condition)) {
                this.conditionCheckPromiseCompletionSource.resolve();
                return true;
            }
        }
        return false;
    }

    private checkCondition(condition: () => boolean): boolean {
        let outcome: boolean = false;
        try { outcome = condition(); } catch (ex: unknown) {}
        return outcome;
    }
}

export default function Until(condition: () => boolean, options: UntilOptions): Promise<void> {
    const optionsWithDefaults: UntilOptions = {
        timeout: options.timeout,
        interval: options.interval || 10
    };

    const untilPoll: UntilPollingImplementation = new UntilPollingImplementation(optionsWithDefaults);
    const untilCancellationTokenSource: CancellationTokenSource = new CancellationTokenSource();

    if (options.timeout === Number.POSITIVE_INFINITY) {
        return untilPoll.pollAsync(condition, untilCancellationTokenSource.token);
    } else {
        const timeoutPromiseCompletionSource: PromiseCompletionSource<void> = new PromiseCompletionSource<void>();
        setTimeout(() => {
            untilCancellationTokenSource.cancel();
            timeoutPromiseCompletionSource.reject(new PromiseWaitTimeoutError(`Timeout ${options.timeout} expired`));
        }, options.timeout);

        return Promise.race([
            untilPoll.pollAsync(condition, untilCancellationTokenSource.token),
            timeoutPromiseCompletionSource.promise
        ]); 
    }
}