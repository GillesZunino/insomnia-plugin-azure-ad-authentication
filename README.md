# Insomnia plugin for Azure AD
Easily acquire Azure AD access tokens from within [Insomnia REST Client](https://insomnia.rest/)!

This plugin supports:
* OAuth 2.0 code and client credential flows for Work or School accounts and Microsoft accounts (when applicable),
* Account saving to Insomnia store,
* Silent log in for saved accounts, even across Insomnia sessions.

# Pre-requisites
This plugin requires [Insomnia](https://insomnia.rest/), the Open Source API client.

# Installation
1. Start Insomnia,
2. Click "Application" -> "Preferences" and choose the "Plugins" tab,
3. Enter `insomnia-plugin-azure-ad-authentication` and click "Install Plugin",

    ![Plugin Installation](images/installation.png)

4. Close the dialog.

# Usage
1. Open a new request, switch to the "Headers" tab,
2. In the header name field, enter `Authorization`,
3. In the value field type `Bearer` <kbd>control</kbd> + <kbd>space</kbd> `azure`. This will bring the template tag menu and reveal the Azure AD Authorization template:

   ![Ctrl+Space Template Tag Menu](images/create-tag.png)

4. Choose the desired Azure AD instance. Most users will choose `Azure AD global service`. The tag will display its logged out form as follows:

   ![Logged out Template Tag](images/Loggedout-tag.png)

5. Click on the tag to edit. Specify the Directory (tenant) ID, the Application (client) ID, desired scopes and the Redirect URI. For Microsoft Accounts, set Directory to `consumers`. For Work or School accounts, set Directory to `organizations`, a tenant name or tenant ID (i.e `contoso.com` or `f0cb5560-5e2a-4b3b-88f9-8193bdd39f7a`). To allow for both Microsoft Accounts and Work or School accounts, select `common`. Choose the desired Scopes, Redirect Url (see [configure Azure AD Application](#Configuring-the-Azure-AD-application)) and Token Grant Flow (see [Choosing a token grant flow](#Choosing-a-token-grant-flow)).

   ![Template Tag Properties](images/tag-properties.png)

6. Close the "Edit Tag" dialog,
7. Send a request by pressing "Send". If an interactive login has been chosen, a browser window will appears and take you through the regular Azure AD login flow possibly including consent. When the authentication completes, the tag will display its logged in form as follows:

   ![Template Tag Properties](images/loggedin-tag.png)

# Configuring the Azure AD application
This plugin **requires** the Redirect URI specified during step 5 above to be configured under "**Mobile and Desktop applications**" or "**Web**" in Azure AD. Other platforms (including "Single Page Application") are not currently supported. See [Issue #2 - http not allowed anymore](https://github.com/GillesZunino/insomnia-plugin-azure-ad-authentication/issues/2) for additional details. By default, the Redirect URI is `http://127.0.0.1:1234/redirect`. An example of Azure AD application Redirect URIs can be seen below:

   ![Azure AD Redirect URIs](images/AzureAD-Mobile-Desktop-ReturnUri.png)

For web browser token grant flows, it is best to choose a Redirect URI targetting `127.0.0.1` instead of `localhost` since some web browsers block navigation to `http://localhost`.

## Configure for Shared Secret or Certificate authentication
Azure AD applications can authenticate as themselves wihtou any user interaction. This capability can be enabled by adding a shared secret (client secret) or a certificate. More details can be found in the Azure AD documentation [Quickstart: Register an application with the Microsoft identity platform](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app#add-credentials)

# Choosing a token grant flow
This plugin supports the following OAuth 2.0 grant flows. For more information on OAuth 2.0 flows, see [Scenarios and supported authentication flows](https://learn.microsoft.com/en-us/azure/active-directory/develop/authentication-flows-app-scenarios#scenarios-and-supported-authentication-flows")
1. Authorization code with PKCE - [Authorization code flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow),
2. Client Credentials - [Shared secret](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow#first-case-access-token-request-with-a-shared-secret),
3. Client Credentials - [Certificate](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow#second-case-access-token-request-with-a-certificate).

## Authorization code with PKCE
This is the most common flow. A web browser is opened and users authenticate with Azure AD interactively. With this flow, it is possible to choose the type of token returned and the scopes. An `access token` can be used to authenticate and authorize calls to Web APIs. An `id token` can be used to verify a user is who they claim to be.

   ![Authorization code with PKCE template tag properties](images/tag-auth-code.png)

When using this flow, the Scopes accepts a space separated list of Azure AD permission like `openid offline_access`.

## Client Credentials - Shared secret
This flow permits a web service (confidential client) to use its own credentials, instead of impersonating a user, to authenticate when calling another web service. The client presents a pre-established shared secret. This flow is not recommended in production. Create a shared secret in Azure AD and paste the secret in the 'Shared Secret' field.

   ![Shared secret template tag properties](images/tag-auth-secret.png)

When using this flow, the Scopes field must be set to `<app URI>/.default`, for instance `api://f0cb5560-5e2a-4b3b-88f9-8193bdd39f7a/.default`.

## Client Credentials - Certificate
This flow permits a web service (confidential client) to use its own credentials, instead of impersonating a user, to authenticate when calling another web service. The client uses a certificate to sign an assertion. Upload the public key of a certificate to Azure AD. Configure the plugin with the certificate thumbprint and the certificate private key file in PEM format.

   ![Certificate template tag properties](images/tag-auth-certificate.png)

When using this flow, the Scopes field must be set to `<app URI>/.default`, where `<app URI>` is the Azure AD application URI, for example `api://f0cb5560-5e2a-4b3b-88f9-8193bdd39f7a/.default`.

# Actions
The plugin allows users to log out or clear the cache to forget all saved accounts. These capabilities are accessible via the "Edit Tag" dialog:

   ![Actions](images/actions.png)

# Future Improvements
Enhancements include:

* Encrypt tokens saved to the Insomnia cache,
* Implement 'on behalf' flow,
* Enable B2C.