define("MessageReader", ["TabManager"], function(TabManager) {
    var instance = null;

    var self;

    function MessageReader(key) {
        self = this;

        if (instance !== null)
            throw new Error("MessageController instance already exists");
    }

    MessageReader.prototype.processMessage = function(tabId, request,
        sendResponse) {
        var tab = TabManager.getTab(tabId);

        // no key
        if (!tab.key) {
            sendResponse({
                message: request.data
            });

            return;
        }

        // password accepted & key unlocked
        else if (tab.key.isUnlocked() && tab.isEncrypted) {
            pickHandler();
        }

        // key locked
        else if (!tab.key.isUnlocked() && !tab.isEncrypted) {
            sendResponse({
                message: request.data
            });
        }

        // waiting for password
        else if (!tab.key.isUnlocked() && tab.isEncrypted) {
            setTimeout(function() {
                self.processMessage(tabId, request,
                    sendResponse);
            }, 500);
        }

        function pickHandler() {
            if (request.type == 'decrypt_message') {
                self.decryptMessage(tab, request.data,
                    sendResponse);
            } else {
                self.decryptMessageBatch(tab, request.data,
                    sendResponse);
            }
        }

        return true;
    }

    /*
     * decrypts message into plaintext
     * @param body {string} body of the message
     * @param callback {function} function to execute after decryption
     */
    MessageReader.prototype.decryptMessage = function(tab, body,
        callback) {
        try {
            var encryptedBody = isJSON(decodeURIComponent(body));
        } catch (e) {
            var encryptedBody = isJSON(body);
        }

        // plaintext message, picture or sticker
        if (!encryptedBody) {
            callback({
                message: body
            });

            return;
        }

        // message not found for user
        else if (!encryptedBody[tab.key.FBID]) {
            callback({
                message: body
            });

            return;
        }

        // read in the message
        try {
            var pgpMessage = openpgp.message.readArmored(
                encryptedBody[tab.key.FBID]);
        } catch (error) {
            callback({
                message: 'Could Not Decrypt Message'
            });

            return;
        }

        // decrypt the message
        openpgp.decryptMessage(tab.key.privKey,
            pgpMessage).then(
            function(plaintext) {
                plaintext = "🔏 " + plaintext;
                callback({
                    message: plaintext
                });
            }).catch(function(error) {
            callback({
                message: 'Could Not Decrypt Message'
            });
        });

        function isJSON(msg) {
            try {
                var body = JSON.parse(msg)
                return body;
            } catch (e) {
                return false;
            }
        }
    };

    /*
     * Decrypts an array of messages pulled in from an async request
     * @param messages {array} contains messages from facebook
     * @param callback {function} function called after decryption
     */
    MessageReader.prototype.decryptMessageBatch = function(tab,
        messages,
        callback) {

        (function() {
            var i = 0;

            function decryptMessages() {
                if (i < messages.length) {
                    self.decryptMessage(tab, messages[i].body,
                        function(response) {

                            messages[i].body = response.message;

                            i++;

                            decryptMessages();
                        });

                } else {
                    callback({
                        message: messages
                    });
                }
            }

            decryptMessages();
        })();
    };

    MessageReader.getInstance = function() {
        if (instance === null)
            instance = new MessageReader();

        return instance;
    }

    return MessageReader.getInstance();

});
