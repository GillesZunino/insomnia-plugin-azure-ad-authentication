// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

export default interface AzureADApplicationOptions {
    authority: string;
    tenantId: string;
    clientId: string;
    clientSecret?: string;
    clientCertificate?: {
        thumbprint: string;
        privateKey: string;
    }
}
