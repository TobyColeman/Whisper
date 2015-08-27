define("TabManager", ["Tab", "StoreController"], function(Tab, Store) {
    var instance = null;

    var self;

    function TabManager() {
        self = this;

        this.tabs = {};

        if (instance !== null)
            throw new Error("MessageController instance already exists");
    }

    TabManager.prototype.addTab = function(tabId, key) {
        this.tabs[tabId] = new Tab(tabId, key);
    };

    TabManager.prototype.getTab = function(tabId) {
        return this.tabs[tabId];
    };

    TabManager.prototype.decryptKey = function(tabId, password) {
        if (!this.tabs[tabId].key.privKey.decrypt(password)) {
            return false;
        }

        return true;
    };

    TabManager.prototype.updateEncryptionSettings = function(tabId,
        encrypted) {
        var tab = this.getTab(tabId);

        tab.thread.setEncrypted(encrypted);

        Store.setSettings(tab.thread.id);
    }

    TabManager.getInstance = function() {
        if (instance === null)
            instance = new TabManager();

        return instance;
    }

    return TabManager.getInstance();
});
