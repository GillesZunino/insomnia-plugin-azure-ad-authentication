// -----------------------------------------------------------------------------------
// Copyright 2021, Gilles Zunino
// ----------------------------------------------------------------------------------

import * as msal from "@azure/msal-node";

export default class InsomniaPersistencePlugin implements msal.ICachePlugin {
    private static readonly StoreKey: string = "AzureAD_Token_Cache";

    private insomniaStore: any;
    private currentCache: string | null;

    public constructor(insomniaStore: any) {
        this.insomniaStore = insomniaStore;
    }

    public async beforeCacheAccess(tokenCacheContext: msal.TokenCacheContext): Promise<void> {
        this.currentCache = await this.load();
        if (this.currentCache) {
            tokenCacheContext.tokenCache.deserialize(this.currentCache);
        }
    }

    public async afterCacheAccess(tokenCacheContext: msal.TokenCacheContext): Promise<void> {
        if (tokenCacheContext.cacheHasChanged) {
            this.currentCache = tokenCacheContext.tokenCache.serialize();
            await this.save(this.currentCache);
        }
    }

    private save(contents: string): Promise<void> {
        return this.insomniaStore.setItem(InsomniaPersistencePlugin.StoreKey, contents);
    }

    private async load(): Promise<string | null> {
        let content: string | null = null;
        if (await this.insomniaStore.hasItem(InsomniaPersistencePlugin.StoreKey)) {
            content = await this.insomniaStore.getItem(InsomniaPersistencePlugin.StoreKey);
        }
        return content;
    }
}