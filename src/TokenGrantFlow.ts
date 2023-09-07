// -----------------------------------------------------------------------------------
// Copyright 2023, Gilles Zunino
// -----------------------------------------------------------------------------------

enum TokenGrantFlow {
    unknown = "",
    oauth2AuthorizationCode = "oauthAuthCode",
    oauth2ClientCredentialsPSK = "oauthClientCredentialsPSK",
    oauth2ClientCredentialsCertificate = "oauthClientCredentialsCertificate"
}

export default TokenGrantFlow;