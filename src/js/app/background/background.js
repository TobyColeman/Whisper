define("background", ['StoreController', 'Key', 'MessageReader',
    'MessageWriter', 'TabManager'
], function(Store, Key, MessageReader, MessageWriter, TabManager) {
    chrome.runtime.onMessageExternal.addListener(externalHandler);
    chrome.runtime.onMessage.addListener(handleMessages);

    // data needed for making requests to facebook
    var postData = {
        uid: null,
        fb_dtsg: null,
        lastFetched: new Date()
    }

    var messenger_loaded_url =
        'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*';

    var messenger_url =
        'https\:\/\/[^ ]*messenger.com\/[^ ]*';

    // listener for injected scripts
    function externalHandler(request, sender, sendResponse) {
        if (!sender.url.match(messenger_url))
            return;

        switch (request.type) {
            case "decrypt_message":
                MessageReader.processMessage(sender.tab.id, request,
                    sendResponse);
                break;
            case "decrypt_message_batch":
                MessageReader.processMessage(sender.tab.id, request,
                    sendResponse);
                break;
            case "encrypt_message":
                MessageWriter.encryptMessage(sender.tab.id, request.data,
                    sendResponse);
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
                MessageWriter.setThread(sender.tab.id, request.data,
                    sendResponse);
                break;
            case "set_encryption":
                TabManager.updateEncryptionSettings(sender.tab.id,
                    request.encrypted);
                break;
            case "get_post_data":
                sendResponse({
                    payload: postData
                });
                break;
            case "is_enabled":
                init(sender);
                break;
            case "decrypt_key":
                unlockKey();
                break;
            case "no_password":
                TabManager.getTab(sender.tab.id).setEncrypted(false);
                break;
        }

        function init(sender) {
            Store.hasPrivKey(function(key) {
                var hasKey = !!key ? true : false;

                TabManager.addTab(sender.tab.id, key);

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
            if (!TabManager.decryptKey(sender.tab.id, request.password)) {
                sendResponse({
                    success: false
                });
            } else {
                TabManager.getTab(sender.tab.id).setKeyFBID(postData.uid);
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
            // display pageAction if on messenger.com
            if (!!tab.url.match(messenger_url)) {
                chrome.pageAction.show(tab.id);

                // user changed thread
                if (!!tab.url.match(messenger_loaded_url) && tab.status ==
                    'complete') {
                    chrome.tabs.sendMessage(tabId, {
                        type: 'setThread'
                    });
                }
                if (tab.url == 'https://www.messenger.com/new') {
                    TabManager.getTab(tabId).setThread(-1);
                    chrome.tabs.sendMessage(tabId, {
                        type: 'new_message'
                    });
                }

            } else {
                chrome.pageAction.hide(tab.id);
            }
        }
    );

});