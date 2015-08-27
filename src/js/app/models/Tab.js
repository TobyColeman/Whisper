define("Tab", ["Thread"], function(Thread) {
    function Tab(id, key) {
        this.id = id;
        this.key = key;
        this.isEncrypted = true;
        this.thread = null;
    }

    Tab.prototype.setKeyFBID = function(FBID) {
        this.key.setFBID(FBID);
    };

    Tab.prototype.setEncrypted = function(encrypted) {
        this.isEncrypted = encrypted;
    }

    Tab.prototype.setThread = function(threadId) {
        this.thread = new Thread(threadId);
    };

    return Tab;
});