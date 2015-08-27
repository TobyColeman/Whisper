define("MessageWriter", ["Thread", "StoreController", "TabManager"], function(
    Thread, Store, TabManager) {
    var instance = null;

    var self;

    function MessageWriter() {
        self = this;

        if (instance !== null)
            throw new Error("MessageWriter instance already exists");
    }

    /*
     * Encrypts outgoing message
     * @param {data} params passed to send() in xhr 
     */
    MessageWriter.prototype.encryptMessage = function(tabId, data,
        callback) {
        var tab = TabManager.getTab(tabId);

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

        if (tab.thread.isEncrypted) {
            var payload = {};

            (function() {
                var i = 0;

                function encryptMessage() {
                    // for each person in the thread, encrypt your message 
                    if (i < tab.thread.numPeople) {

                        var id = parseInt(Object.keys(tab.thread
                            .keys)[i]);
                        openpgp.encryptMessage(tab.thread.keys[
                            id].pubKey, messageBody).then(
                            function(pgpMessage) {
                                payload[tab.thread.keys[id]
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
    MessageWriter.prototype.setThread = function(tabId, data,
        sendResponse) {
        var threadInfo, threadId, participants, tab = TabManager.getTab(
            tabId);

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
        tab.setThread(threadId);

        // get the settings for the current thread, check what public
        // keys are in storage then notify the view
        Store.getSettings(tab.thread.id, function(encrypted) {
            (function() {
                var i = 0;

                function constructThread() {
                    if (i < participants.length) {
                        Store.getKey(participants[i].vanity,
                            function(key) {
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

                                    tab.thread.addKey(
                                        key);
                                } else {
                                    tab.thread.hasAllKeys =
                                        false;
                                }

                                i++;

                                constructThread();
                            });
                    } else {
                        sendResponse({
                            hasAllKeys: tab.thread
                                .hasAllKeys,
                            encrypted: encrypted,
                            keys: tab.thread.keys
                        });

                        Store.getSettings(tab.thread.id,
                            function(encrypted) {
                                tab.thread.setEncrypted(
                                    encrypted);
                            });
                    }
                }

                constructThread();
            })();
        });
    }

    MessageWriter.getInstance = function() {
        if (instance === null)
            instance = new MessageWriter();

        return instance;
    }

    return MessageWriter.getInstance();

});
