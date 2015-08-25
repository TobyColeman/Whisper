define("MessageWriter", ["Thread", "StoreController"], function(Thread, Store) {

    var instance = null;
    var self;

    function MessageWriter() {
        self = this;

        this.thread = null;

        if (instance !== null)
            throw new Error("MessageWriter instance already exists");
    }

    /*
     * Encrypts outgoing message
     * @param {data} params passed to send() in xhr 
     */
    MessageWriter.prototype.encryptMessage = function(data, callback) {
        var expr = /\[body\]=(.*?)&/;

        var messageBody = data.match(expr);

        // sending a picture, sticker, thumbs up
        if (messageBody === null) {
            callback({
                message: data
            });

            return;
        }

        messageBody = decodeURIComponent(messageBody[1]);

        if (self.thread.isEncrypted) {
            var payload = {};

            (function() {

                var i = 0;

                function encryptMessage() {
                    // for each person in the thread, encrypt your message 
                    if (i < self.thread.numPeople) {

                        var id = parseInt(Object.keys(self.thread
                            .keys)[i]);
                        openpgp.encryptMessage(self.thread.keys[
                            id].pubKey, messageBody).then(
                            function(pgpMessage) {

                                payload[self.thread.keys[id]
                                    .FBID] = pgpMessage;

                                i++;

                                encryptMessage();
                            });
                    } else {
                        // replace the plaintext message with encrypted message
                        payload = '[body]=' +
                            encodeURIComponent(JSON.stringify(
                                payload)) + '&';
                        
                        data = data.replace(expr, payload);
                        
                        callback({
                            message: data
                        });
                    }
                }

                encryptMessage();
            })();
        } else {
            callback({
                message: data
            });
        }
    };



    /* Constructs a new thread object & retrieves key's for every participant
     * Notifies the view as to whether encryption was on/off for the current thread
     * @param data {object} ajax response from facebook's api to threadlist_info
     */
    MessageWriter.prototype.setThread = function(data, sendResponse) {

        var threadInfo, threadId, participants;

        // parse response from threadlist_info.php
        threadInfo = JSON.parse(data);

        // array of participants in the active thread
        participants = threadInfo.payload.participants;

        // id of the active thread (group-convo)
        threadId = threadInfo.payload.ordered_threadlists[0].thread_fbids[
            0];

        // id of the active thread (solo-convo)
        if (threadId === undefined)
            threadId = threadInfo.payload.ordered_threadlists[0].other_user_fbids[
                0];

        // make a new thread, store its' id
        this.thread = new Thread(threadId);

        // get the settings for the current thread, check what public
        // keys are in storage then notify the view
        Store.getSettings(this.thread.id, function(encrypted) {
            (function() {
                var i = 0;

                function constructThread() {
                    if (i < participants.length) {

                        Store.getKey(participants[i].vanity,
                            function(key) {

                                // var key = {};
                                var fbid =
                                    participants[i]
                                    .fbid;
                                var vanity =
                                    participants[i]
                                    .vanity;

                                // if we found a key 
                                if (key) {
                                    key.setFBID(
                                        fbid);

                                    self.thread.addKey(
                                        key);
                                } else {
                                    self.thread.hasAllKeys =
                                        false;
                                }

                                i++;
                                
                                constructThread();
                            });
                    } else {
                        sendResponse({
                            hasAllKeys: self.thread
                                .hasAllKeys,
                            encrypted: encrypted,
                            keys: self.thread.keys
                        });

                        Store.getSettings(self.thread.id,
                            function(encrypted) {
                                self.thread.setEncrypted(
                                    encrypted);
                            })
                    }
                }

                constructThread();
            })();
        });
    }

    MessageWriter.prototype.updateEncryptionSettings = function(
        encrypted) {
       
        self.thread.setEncrypted(encrypted);
       
        Store.setSettings(self.thread.id);
    }

    MessageWriter.getInstance = function() {
        if (instance === null)
            instance = new MessageWriter();
        
        return instance;
    }

    return MessageWriter.getInstance();
    
});
