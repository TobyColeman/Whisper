define("KeyController", ['StoreController', 'Key', 'EventManager'],
    function(Store, Key, EventManager) {
        var instance = null;

        var ERRORS = {
            invalidKey: chrome.i18n.getMessage('invalidKeyError'),
            noPrivKey: chrome.i18n.getMessage('noPrivKeyError'),
            noPubKey: chrome.i18n.getMessage('noPubKeyError'),
            wrongPassword: chrome.i18n.getMessage('wrongPasswordError'),
            keyExits: chrome.i18n.getMessage('keyExistsError'),
        }

        function KeyController() {
            self = this;

            if (instance !== null)
                throw new Error("KeyController instance already exists");
        }

        /*
         * runs initially when the options page loads, checks if the user has a key / friends
         * and publishes the results to EventManager
         */
        KeyController.prototype.init = function() {
            EventManager.subscribe('newKey', this.generateKey);

            EventManager.subscribe('privKeyInsert', this.insertPrivKey);

            EventManager.subscribe('pubKeyInsert', this.insertPubKey);

            // check if the user has a key 
            Store.hasPrivKey(function(key) {
                if (!key)
                    EventManager.publish('noPrivKey', {
                        keys: false
                    });
                else
                    EventManager.publish('newPrivKey', {
                        keys: key
                    });
            });

            // check if the user has any friends
            Store.getFriends(function(keys) {
                if (!keys)
                    EventManager.publish('noPubKeys', {
                        keys: false
                    });
                else
                    EventManager.publish('newPubKey', {
                        keys: keys
                    });
            })
        }

        /*
         * generates a new openpgp key and stores in localstorge
         * @param data {object} contains form data for creating the key
         */
        KeyController.prototype.generateKey = function(data) {
            var options = {
                numBits: data.numBits,
                userId: data.name + ' <' + data.email + '>',
                passphrase: data.password
            }

            openpgp.generateKeyPair(options).then(function(keypair) {
                var privKey = keypair.privateKeyArmored;

                var pubKey = keypair.publicKeyArmored;

                // store the key and notify subscribers of its' creation
                Store.setKey(data.vanityID, pubKey,
                    privKey,
                    function() {
                        EventManager.publish('newPrivKey', {
                            keys: new Key({
                                'vanityID': data
                                    .vanityID,
                                'pubKey': pubKey,
                                'privKey': privKey
                            })
                        });

                        self.insertPubKey({
                            vanityID: data.vanityID,
                            pubKey: pubKey,
                            noUpdate: true
                        });
                    });
            });
        }

        /*
         * Used when a user wants to insert an already generate private key
         * @param data {object} contains facebook id and private key
         */
        KeyController.prototype.insertPrivKey = function(data) {
            var result = self.checkKeyIntegrity(data.privKey);

            // malformed key check
            if (result['err']) {
                EventManager.publish('error', {
                    error: ERRORS.invalidKeyError
                });

                return;
            }

            // key is not private
            if (!result['key'].isPrivate()) {
                EventManager.publish('error', {
                    error: ERRORS.noPrivKey
                });

                return;
            }

            // wrong password
            if (!self.validateKeyPassword(result['key'], data.password)) {
                EventManager.publish('error', {
                    error: ERRORS.wrongPassword
                });

                return;
            }

            // key associated with an existing vanityID
            Store.getKey(null, function(keys) {
                if (keys[data.vanityID] !== undefined) {
                    EventManager.publish('error', {
                        error: ERRORS.keyExits + data.vanityID
                    });

                    return;
                }

                var pubKey = result['key'].toPublic().armor();

                // everything ok, store the key
                Store.setKey(data.vanityID, pubKey,
                    data.privKey,
                    function() {
                        EventManager.publish('newPrivKey', {
                            keys: new Key({
                                'vanityID': data
                                    .vanityID,
                                'pubKey': pubKey,
                                'privKey': data
                                    .privKey
                            })
                        });

                        self.insertPubKey({
                            vanityID: data.vanityID,
                            pubKey: pubKey,
                            noUpdate: true
                        });
                    });
            });
        }

        /*
         * Used when a user wants to insert an already generate private key
         * @param data {object} contains facebook id and public key
         */
        KeyController.prototype.insertPubKey = function(data) {
            var result = self.checkKeyIntegrity(data.pubKey);

            if (result['err']) {
                EventManager.publish('error', {
                    error: ERRORS.invalidKey
                });

                return;
            }

            if (!result['key'].isPublic()) {
                EventManager.publish('error', {
                    error: ERRORS.noPubKey
                });

                return;
            }

            Store.getKey(null, function(keys) {

                // key associated with an existing vanityID
                if (keys[data.vanityID] !== undefined) {
                    EventManager.publish('error', {
                        error: ERRORS.keyExits + data.vanityID
                    });

                    return;
                }

                // Everything is ok, so store the key and publish the newly stored key
                Store.setKey(data.vanityID, data.pubKey,
                    null,
                    function() {
                        if (data.noUpdate)
                            return;

                        EventManager.publish('newPubKey', {
                            keys: new Key({
                                'vanityID': data
                                    .vanityID,
                                'pubKey': data
                                    .pubKey
                            })
                        });
                    });
            });
        }

        /*
         * checks if the key is a valid
         * @param key {string} public/private openpgp key
         */
        KeyController.prototype.checkKeyIntegrity = function(key) {
            var result = openpgp.key.readArmored(key);

            if (result['err'])
                return {
                    'err': result['err'][0].message
                };

            return {
                'key': result.keys[0]
            };

        }

        /*
         * checks if the correct password has been entered for the private key
         * @param key {string} private openpgp key
         * @param password {string} password associated with private key
         * @return {boolean} true if the password successfully decrypts key
         */
        KeyController.prototype.validateKeyPassword = function(key,
            password) {
            // wrong password check
            if (!key.decrypt(password))
                return false;

            return true;
        }

        // return singleton instance
        KeyController.getInstance = function() {
            if (instance === null)
                instance = new KeyController();

            return instance;
        }

        return KeyController.getInstance();

    });
