define("Thread", function() {

    function Thread(id) {
        this.id = id;
        this.isEncrypted = false;
        this.hasAllKeys = true;
        this.numPeople = 0;
        this.keys = {};
    }

    Thread.prototype.setEncrypted = function(encrypted) {
        this.isEncrypted = encrypted;
    };

    Thread.prototype.setNumPeople = function() {
        this.numPeople += 1;
    };

    Thread.prototype.addKey = function(key) {
        this.keys[key.FBID] = key;
        this.setNumPeople();
    };

    Thread.prototype.removeKey = function(key) {

        var index = this.keys.indexOf(key);

        if (index > -1)
            this.keys.splice(index, 1);
    };

    return Thread;
});
