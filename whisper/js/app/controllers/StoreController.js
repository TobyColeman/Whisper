define("StoreController", ['Key'], function(Key) {

    var instance = null;

    function StoreController() {
        if (instance !== null)
            throw new Error("StoreController instance already exists");
    }


    /*
     * Get a key from local storage
     * @param key      {string} the key used to store data
     * @param callback {function} the function to execute when storing is complete
     */
    StoreController.prototype.getKey = function(key, callback) {
        chrome.storage.local.get(key, function(result) {
            // TODO: Should probably convert to keys here instead of in hasFriends()

            // remove the settings object, don't need it here
            delete result['settings'];

            if (key === null) {
                callback(result);
            } else if (result[key] === undefined) {
                callback(false);
            } else {
                callback(new Key(result[key]));
            }
        });
    }


    /* 
     * Stores armored keys
     * @param fb_id    {string} facebook id used in the key
     * @param pubKey   {string} public part of the keypair
     * @param privKey  {string} private part of the keypair
     * @param callback {function} the function to execute when retreival is complete
     */
    StoreController.prototype.setKey = function(fb_id, pubKey, privKey, callback) {

        var data = {};

        if (privKey !== null) {
            data['whisper_key'] = {
                'fb_id': fb_id,
                'privKey': privKey,
                'pubKey': pubKey
            };
        } else {
            data[fb_id] = {
                'fb_id': fb_id,
                'pubKey': pubKey
            };
        }

        chrome.storage.local.set(data, callback);
    }


    /* 
     * removes a key from local storage
     * @param key_id {string} the key used in localstorage 
     * @param callback {function} runs upon deletion/failure
     */
    StoreController.prototype.delKey = function(key_id, callback) {
        this.getKey(key_id, function(key) {
            if (!key) {
                callback(false);
            } else {
                chrome.storage.local.remove(key_id, callback(true));
                if(key_id == 'whisper_key') chrome.storage.local.remove(key.fb_id);
            }
        })
    };


    // tiny wrapper function to check if user has private key
    StoreController.prototype.hasPrivKey = function(callback) {
        this.getKey('whisper_key', callback);
    };


    /* 
     * Find out if user has any friends/public keys in storages
     * @param callback {function} executed when retreival from ls is complete
     */
    StoreController.prototype.hasFriends = function(callback) {

        this.getKey(null, function(results) {

            var friends = false;
            delete results['whisper_key'];

            // since user only has one key pair, we can assume the remaining 
            // items in the dict are their friends' public keys
            if (Object.keys(results).length > 0) {
                friends = [];
                for (key in results) {
                    friends.push(new Key({
                        "fb_id": results[key].fb_id,
                        "pubKey": results[key].pubKey
                    }));
                }
            }
            callback(friends);
        });
    }


    // Returns the settings for a conversation (if encryption is on/off)
    StoreController.prototype.getSettings = function(key, callback) {
        chrome.storage.local.get({settings: {}}, function(result){

            var settings = result.settings;

            if(settings[key] === undefined){
                callback(false);
            } else {
                callback(settings[key]);
            }
        })
    };


    // Sets whether encryption is enabled/disabled for a conversation
    StoreController.prototype.setSettings = function(key, callback) {

        chrome.storage.local.get({settings: {}}, function(result){

            var settings = result.settings;

            if (settings[key] === false || settings[key] === undefined)
                settings[key] = true;
            else
                settings[key] = false;

            chrome.storage.local.set({settings:settings}, callback);
        });
    };


    // return singleton instance
    StoreController.getInstance = function() {
        if (instance === null)
            instance = new StoreController();
        return instance;
    }

    return StoreController.getInstance();
});