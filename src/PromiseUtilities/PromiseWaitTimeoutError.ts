// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

export default class PromiseWaitTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PromiseWaitTimeoutError";
	}
}