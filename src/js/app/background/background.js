define("background", ['StoreController', 'Key', 'MessageReader',
    'MessageWriter'
], function(Store, Key, MessageReader, MessageWriter) {

    // data needed for making requests to facebook
    var postData = {
        uid: null,
        fb_dtsg: null,
        lastFetched: new Date()
    }

    var messenger_loaded_url = 'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*';

    chrome.runtime.onMessageExternal.addListener(externalHandler);

    chrome.runtime.onMessage.addListener(handleMessages);

    // listener for injected scripts
    function externalHandler(request, sender, sendResponse) {

        if (!sender.url.match(messenger_loaded_url))
            return;

        switch (request.type) {
            case "decrypt_message":
                MessageReader.processMessage(request, sendResponse);
                break;
            case "decrypt_message_batch":
                MessageReader.processMessage(request, sendResponse);
                break;
            case "encrypt_message":
                MessageWriter.encryptMessage(request.data, sendResponse);
                break;
            default:
                postData.uid = request.uid;
                postData.fb_dtsg = request.fb_dtsg;
        }

        return true;
    }

    // listener for content scripts
    function handleMessages(request, sender, sendResponse) {
        switch (request.type) {
            case "set_thread_info":
                MessageWriter.setThread(request.data, sendResponse);
                break;
            case "set_encryption":
                MessageWriter.updateEncryptionSettings(request.encrypted);
                break;
            case "get_post_data":
                sendResponse({
                    payload: postData
                });
                break;
            case "is_enabled":
                init();
                break;
            case "decrypt_key":
                unlockKey();
                break;
            case "disable_decryption":
                MessageReader.isDecrypting = false;
                break;
        }

        function init() {
            Store.hasPrivKey(function(key) {

                var hasKey = !!key ? true : false;

                MessageReader.bindKey(key, postData.uid);

                var imgPath = hasKey ? 'images/locked.png' :
                    'images/unlocked.png';

                var title = hasKey ? 'Whisper' :
                    'No private key';

                chrome.pageAction.setIcon({
                    tabId: sender.tab.id,
                    path: {
                        19: imgPath,
                        38: imgPath
                    }
                }, function() {

                    chrome.pageAction.setTitle({
                        title: title,
                        tabId: sender.tab.id
                    });
                });

                sendResponse({
                    success: hasKey
                });
            });
        }

        function unlockKey() {
            if (!MessageReader.decrypt(request.password)) {
                sendResponse({
                    success: false
                });
            } else {
                MessageReader.setFBID(postData.uid);
                sendResponse({
                    success: true
                });
            }
        }

        return true;
    }

    // refresh messenger pages on insertion/deletion of keys
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.type == 'key_update') {
                chrome.tabs.query({
                    url: "https://*.messenger.com/t/*"
                }, function(tabs) {
                    for (var i = 0; i < tabs.length; i++) {
                        chrome.tabs.reload(tabs[i].id);
                    };
                });
            }
        }
    );

    chrome.tabs.onUpdated.addListener(
        function(tabId, changeInfo, tab) {
            var messenger_url =
                'https\:\/\/[^ ]*messenger.com\/[^ ]*';

            // display pageAction if on messenger.com
            if (!!tab.url.match(messenger_url)) {
                chrome.pageAction.show(tab.id);

                // if threads loaded, inject the view
                if (!!tab.url.match(messenger_loaded_url)) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'init',
                        init: true
                    });
                }
            } else {
                chrome.pageAction.hide(tab.id);
            }
        }
    );
});
