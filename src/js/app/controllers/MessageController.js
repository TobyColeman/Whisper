define("MessageController", ["EventManager", "Utils"], function(em,
    Utils) {

    var instance = null;

    function MessageController() {
        self = this;

        if (instance !== null)
            throw new Error("MessageController instance already exists");
    }

    MessageController.prototype.init = function(callback) {

        chrome.runtime.sendMessage({
            type: 'is_enabled'
        }, function(response) {
            if (response.success) {
                em.subscribe('set_thread', self.getThreadInfo);

                em.subscribe('decrypt_key', self.decryptKey);

                em.subscribe('set_encryption', function(
                    data) {
                    chrome.runtime.sendMessage({
                        type: 'set_encryption',
                        encrypted: data.encrypted
                    });

                });
                em.subscribe('disable_decryption', function(
                    data) {
                    chrome.runtime.sendMessage({
                        type: 'disable_decryption'
                    });
                });
            }

            callback(response.success);
        });
    };

    /*
     * Grabs thread id and participants for the current active thread, using fb's api
     * @param data {object} contains index of the current thread & the site
     */
    MessageController.prototype.getThreadInfo = function(data) {

        // get the id of the thread
        chrome.runtime.sendMessage({
            type: 'get_post_data',
            site: data.site
        }, function(response) {
            postData = response.payload;

            self.makeRequest(
                "/ajax/mercury/threadlist_info.php", {
                    type: 'POST',
                    params: 'inbox[offset]=' + data.threadIndex +
                        '&inbox[limit]=1&__user=' +
                        postData.uid +
                        '&__a=1b&__req=1&fb_dtsg=' +
                        postData.fb_dtsg,
                    retries: 3
                },
                sendThreadData);
        });

        function sendThreadData(data) {
            chrome.runtime.sendMessage({
                type: 'set_thread_info',
                data: data
            }, function(response) {
                // if missing a key, the view disables encryption controls
                if (response.hasAllKeys) {
                    em.publish('renderThreadSettings', {
                        isEncrypted: response.encrypted,
                        keys: response.keys,
                        hasAllKeys: true
                    });
                } else {
                    em.publish('renderThreadSettings', {
                        isEncrypted: response.encrypted,
                        keys: response.keys,
                        hasAllKeys: false
                    });
                }

            });
        }
    };

    /*
     * decrypts the user's private key
     * @param data {object} contains password from dialog in the view
     */
    MessageController.prototype.decryptKey = function(data) {
        chrome.runtime.sendMessage({
            type: 'decrypt_key',
            password: data.password
        }, function(response) {
            if (response.success) {
                em.publish('correctPassword');
            } else {
                em.publish('wrongPassword');
            }
        });
    };

    // ajax helper function
    MessageController.prototype.makeRequest = function(url, options,
        callback) {
        var xhr = new XMLHttpRequest();

        var retries = options.retries;

        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                callback(xhr.responseText.replace('for (;;);',
                    ''));
            } else if (xhr.readyState == 4 && xhr.status != 200) {
                retries--;

                if (retries > 0) {
                    setTimeout(function() {
                        makeRequest();
                    }, 1000);
                }
            }
        }

        function makeRequest() {
            xhr.open(options.type, url, true);

            if (options.type === 'POST')
                xhr.send(options.params);
            else
                xhr.send();
        }
        makeRequest();
    };


    MessageController.getInstance = function() {
        if (instance === null)
            instance = new MessageController();

        return instance;
    }

    return MessageController.getInstance();

});