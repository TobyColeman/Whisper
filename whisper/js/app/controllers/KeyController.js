define("KeyController", ['StoreController', 'Key', 'openpgp', 'EventManager'],
    function(StoreController, Key, openpgp, EventManager) {

        var instance = null;

        function KeyController() {
            self = this;
            if (instance !== null)
                throw new Error("KeyController instance already exists");
        }

        /*
         * runs initially when the options page loads, checks if the user has a key / friends
         * and sets the view accordingly
         */
        KeyController.prototype.init = function() {

            EventManager.subscribe('newKey', this.generateKey);
            EventManager.subscribe('privKeyInsert', this.insertPrivKey);
            EventManager.subscribe('pubKeyInsert', this.insertPubKey);

            // check if the user has a key
            StoreController.getKey('whisper_key', function(result) {
                if (result['whisper_key'] === undefined)
                    EventManager.publish('noPrivKey', {
                        visible: false
                    })
                else
                    EventManager.publish('newPrivKey', {
                        visible: true,
                        keys: [new Key(result['whisper_key'])]
                    });
            });

            // check if the user has any friends
            StoreController.hasFriends(function(friends) {
                if (friends)
                    EventManager.publish('newPubKey', {
                        visible: true,
                        keys: friends
                    });
                else
                    EventManager.publish('noPubKeys', {
                        visible: false
                    });
            })
        }


        /*
         * generates a new openpgp key and stores in localstorge
         * @param data {object} contains form data for creating the key
         */
        KeyController.prototype.generateKey = function(data) {
            // options used to generate the key
            var options = {
                numBits: data.numBits,
                userId: data.name + ' <' + data.email + '>',
                passphrase: data.password
            }

            openpgp.generateKeyPair(options).then(function(keypair) {
                var privKey = keypair.privateKeyArmored;
                var pubKey = keypair.publicKeyArmored;

                // store the key and notify subscribers of its' creation
                StoreController.setKey(data.fb_id, pubKey, privKey, function() {
                    EventManager.publish('newPrivKey', {
                        visible: true,
                        keys: [new Key({
                            'fb_id': data.fb_id,
                            'pubKey': pubKey,
                            'privKey': privKey
                        })]
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

            if (result['err']) {
                EventManager.publish('error', {
                    error: 'Invalid Key'
                });
                return;
            }

            if (!result['key'].isPrivate()) {
                EventManager.publish('error', {
                    error: 'Please Insert a Private Key'
                });
                return;
            }

            if (!self.validateKeyPassword(result['key'], data.password)) {
                EventManager.publish('error', {
                    error: 'Wrong password'
                });
                return;
            }

            var pubKey = result['key'].toPublic().armor();

            StoreController.setKey(data.fb_id, pubKey, result['privKey'], function() {
                EventManager.publish('newPrivKey', {
                    visible: true,
                    keys: [new Key({
                        'fb_id': data.fb_id,
                        'pubKey': pubKey,
                        'privKey': data.privKey
                    })]
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
                    error: 'Invalid Key'
                });
                return;
            }

            if (!result['key'].isPublic()) {
                EventManager.publish('error', {
                    error: 'Please Insert a Public Key'
                });
                return;
            }

            StoreController.getKey(null, function(result) {

                if (result[data.fb_id] !== undefined || result['whisper_key'].fb_id == data.fb_id) {
                    EventManager.publish('error', {
                        error: 'Key Already Exists For: ' + data.fb_id
                    });
                    return;
                }

                StoreController.setKey(data.fb_id, data.pubKey, null, function() {
                    EventManager.publish('newPubKey', {
                        visible: true,
                        keys: [new Key({
                            'fb_id': data.fb_id,
                            'pubKey': data.pubKey
                        })]
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
        KeyController.prototype.validateKeyPassword = function(key, password) {
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
