// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

export default interface CancellationToken {
    get isCancellationRequested(): boolean;
}